import { NextResponse } from "next/server";
import { executeQuery, sql } from "@/lib/db";
import { toolRegistrarAccionAgente } from "@/lib/ai-agent";
import { enviarMensajeWhatsApp } from "@/lib/whatsapp-service";

// Clasificación de tiempo sin respuesta
function clasificarTiempo(horas: number): {
  categoria: string;
  severidad: 'normal' | 'advertencia' | 'riesgo' | 'critico';
  accionSugerida: string;
} {
  if (horas < 2) {
    return {
      categoria: "Espera normal (0-2 h)",
      severidad: "normal",
      accionSugerida: "Esperar respuesta natural del lead",
    };
  } else if (horas < 6) {
    return {
      categoria: "Respuesta demorada (2-6 h)",
      severidad: "advertencia",
      accionSugerida: "Monitorear chat sin insistir",
    };
  } else if (horas < 24) {
    return {
      categoria: "Posible desinterés (6-24 h)",
      severidad: "advertencia",
      accionSugerida: "Enviar mensaje de reactivación amable o valor agregado",
    };
  } else if (horas < 48) {
    return {
      categoria: "Riesgo alto de abandono (24-48 h)",
      severidad: "riesgo",
      accionSugerida: "Ofrecer promoción o combo especial del segmento",
    };
  } else if (horas < 72) {
    return {
      categoria: "Negociación inactiva (48-72 h)",
      severidad: "riesgo",
      accionSugerida: "Último intento de contacto antes de cierre por inactividad",
    };
  } else {
    return {
      categoria: "Inactividad prolongada (> 72 h)",
      severidad: "critico",
      accionSugerida: "Revisar para cierre por TIMEOUT_72H con confirmación del operador",
    };
  }
}

export async function GET() {
  try {
    // 1. Negociaciones abiertas con tiempo sin respuesta
    const query = `
      SELECT 
        n.id_negociacion,
        n.id_persona,
        n.nro_ciclo,
        n.estado,
        n.fecha_inicio,
        n.resumen,
        p.nombres,
        p.apellidos,
        p.telefono,
        p.email,
        p.id_segmento,
        s.nombre AS segmento_nombre,
        n.id_sesion_whatsapp,
        ult_m.contenido AS ultimo_mensaje_texto,
        ult_m.direccion AS ultimo_mensaje_direccion,
        ult_m.fecha_mensaje AS ultimo_mensaje_fecha,
        CAST(DATEDIFF_BIG(SECOND, COALESCE(ult_m.fecha_mensaje, n.fecha_inicio), SYSUTCDATETIME()) / 3600.0 AS DECIMAL(10,2)) AS horas_sin_respuesta
      FROM dbo.negociacion n
      JOIN dbo.persona p ON p.id_persona = n.id_persona
      LEFT JOIN dbo.segmento_cliente s ON s.id_segmento = p.id_segmento
      OUTER APPLY (
        SELECT TOP 1 m.contenido, m.direccion, m.fecha_mensaje
        FROM dbo.mensaje_whatsapp m
        WHERE m.id_sesion = n.id_sesion_whatsapp
        ORDER BY m.fecha_mensaje DESC
      ) ult_m
      WHERE n.estado = 'ABIERTA'
      ORDER BY horas_sin_respuesta DESC;
    `;

    const abiertas = await executeQuery<any>(query);

    const negociacionesConClasificacion = abiertas.map(neg => {
      const horas = Number(neg.horas_sin_respuesta) || 0;
      const clasif = clasificarTiempo(horas);
      return {
        ...neg,
        horas_sin_respuesta: horas,
        clasificacion: clasif.categoria,
        severidad: clasif.severidad,
        accionSugerida: clasif.accionSugerida,
        esCandidatoTimeout: horas >= 72,
      };
    });

    // 2. Lista de Vendedores / Trabajadores Activos (Humanos)
    const queryVendedores = `
      SELECT id_personal, nombres, apellidos, cargo, area
      FROM dbo.personal
      WHERE activo = 1 AND es_agente_ia = 0
      ORDER BY nombres ASC;
    `;
    const vendedores = await executeQuery<any>(queryVendedores);

    // 3. Indicador de Rendimiento: ¿Qué vendedor cierra más ventas?
    const queryRanking = `
      SELECT 
        per.id_personal,
        CONCAT(per.nombres, ' ', COALESCE(per.apellidos, '')) AS vendedor,
        per.cargo,
        per.area,
        COUNT(p.id_pedido) AS ventas_cerradas,
        COALESCE(SUM(p.total), 0) AS monto_total,
        COALESCE(AVG(p.total), 0) AS ticket_promedio,
        MAX(p.fecha_registro) AS ultimo_cierre
      FROM dbo.personal per
      LEFT JOIN dbo.pedido p ON p.id_personal_atiende = per.id_personal AND p.estado IN ('ATENDIDO', 'PAGADO')
      WHERE per.es_agente_ia = 0 AND per.activo = 1
      GROUP BY per.id_personal, per.nombres, per.apellidos, per.cargo, per.area
      ORDER BY ventas_cerradas DESC, monto_total DESC;
    `;
    const rankingVendedores = await executeQuery<any>(queryRanking);

    return NextResponse.json({
      success: true,
      negociaciones: negociacionesConClasificacion,
      totalAbiertas: negociacionesConClasificacion.length,
      vendedores,
      rankingVendedores,
    });
  } catch (error: any) {
    console.error("[API Followup GET Error]:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// POST: Enviar mensaje de seguimiento vía WhatsApp real, Cerrar Venta con Vendedor, o Cerrar Pérdida
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action = "cerrar_perdida", id_negociacion } = body;

    if (!id_negociacion) {
      return NextResponse.json(
        { success: false, error: "El id_negociacion es obligatorio." },
        { status: 400 }
      );
    }

    // =========================================================================
    // ACCIÓN 1: TRABAJADOR ENVÍA MENSAJE DE SEGUIMIENTO (WHATSAPP REAL)
    // =========================================================================
    if (action === "enviar_mensaje") {
      const { id_personal, mensaje } = body;
      if (!id_personal || !mensaje || !mensaje.trim()) {
        return NextResponse.json(
          { success: false, error: "Se requiere seleccionar el trabajador (id_personal) y el texto del mensaje." },
          { status: 400 }
        );
      }

      // Obtener datos del lead y de la sesión
      const negData = await executeQuery<any>(`
        SELECT n.id_negociacion, n.id_persona, n.id_sesion_whatsapp, p.nombres, p.apellidos, p.telefono
        FROM dbo.negociacion n
        JOIN dbo.persona p ON p.id_persona = n.id_persona
        WHERE n.id_negociacion = @idNeg;
      `, { idNeg: { type: sql.BigInt, value: id_negociacion } });

      if (negData.length === 0) {
        return NextResponse.json({ success: false, error: "Negociación no encontrada." }, { status: 404 });
      }

      const lead = negData[0];
      const telefonoDestino = lead.telefono;

      if (!telefonoDestino) {
        return NextResponse.json({ success: false, error: "El lead no cuenta con número de teléfono registrado." }, { status: 400 });
      }

      // Obtener datos del trabajador
      const personalData = await executeQuery<any>(`
        SELECT id_personal, nombres, apellidos, cargo FROM dbo.personal WHERE id_personal = @idP;
      `, { idP: { type: sql.Int, value: id_personal } });
      const trabajador = personalData[0] || { nombres: "Asesor Comercial" };

      // 1. Enviar el mensaje por el proveedor activo (Whapi si está configurado, si no Meta)
      console.log(`[Seguimiento Trabajador] Enviando WhatsApp a ${lead.nombres} (${telefonoDestino}) por trabajador: ${trabajador.nombres}`);
      const resWhatsApp = await enviarMensajeWhatsApp({
        telefonoDestino,
        texto: mensaje.trim(),
      });

      if (!resWhatsApp.success) {
        return NextResponse.json({
          success: false,
          error: `Error al enviar WhatsApp: ${resWhatsApp.error || "No se pudo entregar"}`,
        }, { status: 500 });
      }

      // 2. Registrar el mensaje saliente en dbo.mensaje_whatsapp
      let idSesion = lead.id_sesion_whatsapp;
      if (!idSesion) {
        // Si no tiene sesión, buscar o crear
        const sesionCheck = await executeQuery<{ id_sesion: number }>(`
          SELECT TOP 1 id_sesion FROM dbo.sesion_whatsapp WHERE id_persona = @idP ORDER BY fecha_inicio DESC;
        `, { idP: { type: sql.BigInt, value: lead.id_persona } });

        if (sesionCheck.length > 0) {
          idSesion = sesionCheck[0].id_sesion;
        } else {
          const newSes = await executeQuery<{ id_sesion: number }>(`
            INSERT INTO dbo.sesion_whatsapp (id_persona, telefono_cliente, fecha_inicio, fecha_ultimo_mensaje, estado)
            VALUES (@idP, @tel, SYSUTCDATETIME(), SYSUTCDATETIME(), 'ABIERTA');
            SELECT SCOPE_IDENTITY() AS id_sesion;
          `, { idP: { type: sql.BigInt, value: lead.id_persona }, tel: { type: sql.VarChar(20), value: telefonoDestino } });
          idSesion = newSes[0].id_sesion;
        }

        await executeQuery(`
          UPDATE dbo.negociacion SET id_sesion_whatsapp = @idSes WHERE id_negociacion = @idNeg;
        `, { idSes: { type: sql.BigInt, value: idSesion }, idNeg: { type: sql.BigInt, value: id_negociacion } });
      }

      await executeQuery(`
        INSERT INTO dbo.mensaje_whatsapp (id_sesion, wamid, direccion, tipo, contenido, fecha_mensaje, estado_entrega)
        VALUES (@idSes, @wamid, 'SALIENTE', 'TEXTO', @contenido, SYSUTCDATETIME(), 'ENVIADO');
      `, {
        idSes: { type: sql.BigInt, value: idSesion },
        contenido: { type: sql.NVarChar(sql.MAX), value: mensaje.trim() },
        wamid: { type: sql.VarChar(200), value: resWhatsApp.wamid || `wamid.TRAB_${Date.now()}` },
      });

      // 3. Registrar la acción de seguimiento del trabajador en dbo.accion_agente
      await executeQuery(`
        INSERT INTO dbo.accion_agente (id_personal, id_negociacion, id_sesion_whatsapp, accion, detalle, resultado, fecha_ejecucion)
        VALUES (@idP, @idNeg, @idSes, 'SEGUIMIENTO_HUMANO_WHATSAPP', @detalle, 'EXITOSO', SYSUTCDATETIME());
      `, {
        idP: { type: sql.Int, value: id_personal },
        idNeg: { type: sql.BigInt, value: id_negociacion },
        idSes: { type: sql.BigInt, value: idSesion },
        detalle: { type: sql.NVarChar(300), value: `Mensaje de seguimiento enviado por ${trabajador.nombres} a WhatsApp real de ${lead.nombres} (${telefonoDestino})` },
      });

      return NextResponse.json({
        success: true,
        wamid: resWhatsApp.wamid,
        mensaje: `Mensaje enviado con éxito al WhatsApp real de ${lead.nombres} (+${telefonoDestino}).`,
      });
    }

    // =========================================================================
    // ACCIÓN 2: EL VENDEDOR CIERRA LA VENTA ÉL MISMO (REGISTRAR VENDEDOR Y VENTA)
    // =========================================================================
    if (action === "cerrar_venta") {
      const {
        id_personal,
        monto,
        detalleVenta = "Venta parrillera cerrada directamente por vendedor",
        medioPago = "YAPE",
        referenciaPago = `VENTA_VEND_${Date.now()}`,
      } = body;

      if (!id_personal) {
        return NextResponse.json(
          { success: false, error: "Debes seleccionar qué vendedor realizó el cierre de la venta." },
          { status: 400 }
        );
      }

      const montoNum = parseFloat(monto) || 0;
      if (montoNum <= 0) {
        return NextResponse.json(
          { success: false, error: "El monto de la venta debe ser mayor a 0." },
          { status: 400 }
        );
      }

      // Obtener datos de la negociación y del lead
      const negData = await executeQuery<any>(`
        SELECT n.id_negociacion, n.id_persona, n.id_pedido, n.id_sesion_whatsapp, p.nombres, p.apellidos, p.telefono
        FROM dbo.negociacion n
        JOIN dbo.persona p ON p.id_persona = n.id_persona
        WHERE n.id_negociacion = @idNeg;
      `, { idNeg: { type: sql.BigInt, value: id_negociacion } });

      if (negData.length === 0) {
        return NextResponse.json({ success: false, error: "Negociación no encontrada." }, { status: 404 });
      }

      const neg = negData[0];

      // Obtener datos del vendedor
      const vendData = await executeQuery<any>(`
        SELECT id_personal, nombres, apellidos, cargo, area FROM dbo.personal WHERE id_personal = @idP;
      `, { idP: { type: sql.Int, value: id_personal } });
      const vendedor = vendData[0] || { nombres: "Vendedor" };

      // Obtener id_medio_pago
      const mpData = await executeQuery<any>(`
        SELECT TOP 1 id_medio_pago FROM dbo.medio_pago WHERE codigo = @codigo;
      `, { codigo: { type: sql.VarChar(20), value: medioPago.toUpperCase() } });
      const idMedioPago = mpData[0]?.id_medio_pago || 1;

      // 1. Crear el pedido oficial atendido por este vendedor (o reutilizarlo si ya existe)
      let idPedido: number = neg.id_pedido;
      if (!idPedido) {
        const pedResult = await executeQuery<{ id_pedido: number }>(`
          INSERT INTO dbo.pedido (id_persona, id_negociacion, id_personal_atiende, tipo, fecha_registro, estado, fecha_atencion, subtotal, descuento, total)
          VALUES (@idP, @idNeg, @idPersonal, 'LOCAL', SYSUTCDATETIME(), 'ATENDIDO', SYSUTCDATETIME(), @monto, 0, @monto);
          SELECT SCOPE_IDENTITY() AS id_pedido;
        `, {
          idP: { type: sql.BigInt, value: neg.id_persona },
          idNeg: { type: sql.BigInt, value: id_negociacion },
          idPersonal: { type: sql.Int, value: id_personal },
          monto: { type: sql.Decimal(10, 2), value: montoNum },
        });
        idPedido = pedResult[0].id_pedido;
      }

      // 2. Registrar el pago confirmado en dbo.pago (evitar duplicar si ya existe)
      const pagoExistente = await executeQuery<{ id_pago: number }>(`
        SELECT TOP 1 id_pago FROM dbo.pago WHERE id_pedido = @idPed AND estado = 'CONFIRMADO';
      `, { idPed: { type: sql.BigInt, value: idPedido } });
      if (pagoExistente.length === 0) {
        await executeQuery(`
          INSERT INTO dbo.pago (id_pedido, id_medio_pago, monto, moneda, fecha_pago, estado, referencia)
          VALUES (@idPed, @idMP, @monto, 'PEN', SYSUTCDATETIME(), 'CONFIRMADO', @ref);
        `, {
          idPed: { type: sql.BigInt, value: idPedido },
          idMP: { type: sql.Int, value: idMedioPago },
          monto: { type: sql.Decimal(10, 2), value: montoNum },
          ref: { type: sql.VarChar(100), value: referenciaPago },
        });
      }

      // 3. Actualizar la negociación a CONVERTIDA con el vendedor y pedido asociado
      await executeQuery(`
        UPDATE dbo.negociacion
        SET estado = 'CONVERTIDA',
            id_pedido = @idPed,
            fecha_primer_pago = SYSUTCDATETIME(),
            fecha_fin = SYSUTCDATETIME(),
            resumen = @resumen
        WHERE id_negociacion = @idNeg;
      `, {
        idPed: { type: sql.BigInt, value: idPedido },
        resumen: { type: sql.NVarChar(300), value: `Venta cerrada por ${vendedor.nombres}: ${detalleVenta} (S/ ${montoNum.toFixed(2)})` },
        idNeg: { type: sql.BigInt, value: id_negociacion },
      });

      // 4. Actualizar fase del lead a PAYER y registrar en historial (idempotente)
      await executeQuery(`
        UPDATE dbo.persona SET fase_actual = 'PAYER' WHERE id_persona = @idP;
      `, { idP: { type: sql.BigInt, value: neg.id_persona } });

      const historialExistente = await executeQuery<{ id_historial: number }>(`
        SELECT TOP 1 id_historial FROM dbo.historial_fases
        WHERE id_persona = @idP AND fase = 'PAYER' AND id_pedido = @idPed;
      `, {
        idP: { type: sql.BigInt, value: neg.id_persona },
        idPed: { type: sql.BigInt, value: idPedido },
      });
      if (historialExistente.length === 0) {
        await executeQuery(`
          INSERT INTO dbo.historial_fases (id_persona, fase, fecha_cambio, id_negociacion, id_pedido)
          VALUES (@idP, 'PAYER', SYSUTCDATETIME(), @idNeg, @idPed);
        `, {
          idP: { type: sql.BigInt, value: neg.id_persona },
          idNeg: { type: sql.BigInt, value: id_negociacion },
          idPed: { type: sql.BigInt, value: idPedido },
        });
      }

      // 5. Registrar en auditoría de acciones del personal
      await executeQuery(`
        INSERT INTO dbo.accion_agente (id_personal, id_negociacion, id_sesion_whatsapp, accion, detalle, resultado, fecha_ejecucion)
        VALUES (@idP, @idNeg, @idSes, 'CIERRE_VENTA_VENDEDOR', @detalle, 'EXITOSO', SYSUTCDATETIME());
      `, {
        idP: { type: sql.Int, value: id_personal },
        idNeg: { type: sql.BigInt, value: id_negociacion },
        idSes: { type: sql.BigInt, value: neg.id_sesion_whatsapp },
        detalle: { type: sql.NVarChar(300), value: `Venta de S/ ${montoNum.toFixed(2)} cerrada por el vendedor ${vendedor.nombres} ${vendedor.apellidos || ''}. Pedido #${idPedido}.` },
      });

      return NextResponse.json({
        success: true,
        mensaje: `¡Venta de S/ ${montoNum.toFixed(2)} registrada exitosamente a nombre de ${vendedor.nombres}! El lead fue convertido a PAYER.`,
        id_pedido: idPedido,
      });
    }

    // =========================================================================
    // ACCIÓN 3: CERRAR NEGOCIACIÓN COMO PÉRDIDA (RECHAZO O TIMEOUT_72H)
    // =========================================================================
    const { motivo = "TIMEOUT_72H", detalle } = body;
    if (!['RECHAZO', 'TIMEOUT_72H'].includes(motivo)) {
      return NextResponse.json(
        { success: false, error: "Motivo debe ser 'RECHAZO' o 'TIMEOUT_72H'" },
        { status: 400 }
      );
    }

    const updateQuery = `
      UPDATE dbo.negociacion
      SET estado = 'PERDIDA',
          motivo_perdida = @motivo,
          detalle_perdida = @detalle,
          fecha_fin = SYSUTCDATETIME()
      WHERE id_negociacion = @idNegociacion AND estado = 'ABIERTA';
    `;

    await executeQuery(updateQuery, {
      idNegociacion: { type: sql.BigInt, value: id_negociacion },
      motivo: { type: sql.VarChar(20), value: motivo },
      detalle: { type: sql.NVarChar(300), value: detalle || `Cierre registrado como ${motivo}` },
    });

    await toolRegistrarAccionAgente({
      id_negociacion,
      accion: 'MARCAR_PERDIDA',
      detalle: `Negociación cerrada como PERDIDA (${motivo}). Detalle: ${detalle || motivo}`,
      resultado: 'EXITOSO',
    });

    return NextResponse.json({
      success: true,
      mensaje: `Negociación marcada exitosamente como PERDIDA por ${motivo}.`,
    });
  } catch (error: any) {
    console.error("[API Followup POST Error]:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
