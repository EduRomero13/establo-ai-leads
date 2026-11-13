import { NextResponse } from "next/server";
import { executeQuery, sql } from "@/lib/db";
import {
  procesarMensajeLead,
  toolRegistrarOferta,
  toolRegistrarAccionAgente,
  toolConsultarLead,
  toolConsultarPreferencias,
  toolConsultarProductos,
  toolConsultarCombos,
} from "@/lib/ai-agent";
import {
  mapearTipoMensaje,
  enviarMensajeWhatsApp,
} from "@/lib/whatsapp-service";

// Listar sesiones de WhatsApp con su respectiva negociación y persona
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const idSesion = searchParams.get("sesionId");

    if (idSesion) {
      // Obtener mensajes de una sesión específica
      const queryMensajes = `
        SELECT m.id_mensaje, m.id_sesion, m.wamid, m.direccion, m.tipo, m.contenido,
               m.opcion_seleccionada, m.fecha_mensaje, m.estado_entrega
        FROM dbo.mensaje_whatsapp m
        WHERE m.id_sesion = @idSesion
        ORDER BY m.fecha_mensaje ASC;
      `;
      const mensajes = await executeQuery<any>(queryMensajes, {
        idSesion: { type: sql.BigInt, value: parseInt(idSesion, 10) },
      });

      return NextResponse.json({ success: true, mensajes });
    }

    // Listar todas las sesiones
    const querySesiones = `
      SELECT 
        s.id_sesion,
        s.id_persona,
        s.telefono_cliente,
        s.fecha_inicio,
        s.fecha_ultimo_mensaje,
        s.estado,
        s.origen,
        p.nombres,
        p.apellidos,
        p.fase_actual,
        p.id_segmento,
        seg.nombre AS segmento_nombre,
        n.id_negociacion,
        n.estado AS estado_negociacion,
        n.nro_ciclo,
        ult_m.contenido AS ultimo_mensaje_texto,
        ult_m.direccion AS ultimo_mensaje_direccion,
        ult_m.fecha_mensaje AS ultimo_mensaje_fecha
      FROM dbo.sesion_whatsapp s
      LEFT JOIN dbo.persona p ON p.id_persona = s.id_persona
      LEFT JOIN dbo.segmento_cliente seg ON seg.id_segmento = p.id_segmento
      LEFT JOIN dbo.negociacion n ON n.id_sesion_whatsapp = s.id_sesion
      OUTER APPLY (
        SELECT TOP 1 m.contenido, m.direccion, m.fecha_mensaje
        FROM dbo.mensaje_whatsapp m
        WHERE m.id_sesion = s.id_sesion
        ORDER BY m.fecha_mensaje DESC
      ) ult_m
      ORDER BY s.fecha_ultimo_mensaje DESC;
    `;

    const sesiones = await executeQuery<any>(querySesiones);

    return NextResponse.json({ success: true, sesiones });
  } catch (error: any) {
    console.error("[API Chat GET Error]:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}

// POST: Enviar mensajes, invocar copiloto inteligente o confirmar conversión
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      action,
      id_sesion,
      id_negociacion,
      direccion,
      contenido,
      tipo = "TEXTO",
      autoResponder = true,
      enviarWhatsAppReal = true,
      monto = 50.0,
      medioPago = "YAPE",
    } = body;

    // -----------------------------------------------------------------------
    // ACCIÓN: COPILOTO IA — Analizar conversación y generar recomendación / telemetría
    // -----------------------------------------------------------------------
    if (action === "copiloto_assist") {
      if (!id_negociacion) {
        return NextResponse.json(
          { success: false, error: "id_negociacion requerido" },
          { status: 400 },
        );
      }

      // Obtener últimos mensajes de la sesión
      let ultimosMsg: any[] = [];
      if (id_sesion) {
        ultimosMsg = await executeQuery<any>(
          `
          SELECT TOP 8 direccion, contenido FROM dbo.mensaje_whatsapp
          WHERE id_sesion = @idSesion ORDER BY fecha_mensaje DESC;
        `,
          { idSesion: { type: sql.BigInt, value: id_sesion } },
        );
      }

      const historialFormateado = ultimosMsg.reverse().map((m: any) => ({
        remitente:
          m.direccion === "ENTRANTE" ? ("lead" as const) : ("agente" as const),
        texto: m.contenido,
      }));

      const ultimoTexto =
        historialFormateado.length > 0
          ? historialFormateado[historialFormateado.length - 1].texto
          : "Hola, ¿qué opciones me recomiendas?";

      // Consultar IA con Gemini y reglas de negocio
      const respuestaAgente = await procesarMensajeLead(
        id_negociacion,
        ultimoTexto,
        historialFormateado,
      );

      // Evaluar telemetría de razonamiento
      const txt = ultimoTexto.toLowerCase();
      let intencionDetectada = "CONSULTA_GENERAL";
      let objecionDetectada = null;
      let tecnicaSuperacion =
        "Escucha activa y personalización por preferencias";

      if (
        txt.includes("caro") ||
        txt.includes("presupuesto") ||
        txt.includes("a cuanto sale") ||
        txt.includes("precio")
      ) {
        intencionDetectada = "CONSULTA_PRECIO_PRESUPUESTO";
        objecionDetectada = txt.includes("caro")
          ? "PRECIO_ALTO"
          : "VALIDACION_PRECIO";
        tecnicaSuperacion =
          "Desglose de abundancia, costo por persona y alternativas en combos";
      } else if (
        txt.includes("amigos") ||
        txt.includes("familia") ||
        txt.includes("grupo") ||
        txt.includes("personas")
      ) {
        intencionDetectada = "RECOMENDACION_GRUPO";
        tecnicaSuperacion =
          "Enfoque en rendición, cortes para compartir y guarniciones abundantes";
      } else if (
        txt.includes("promo") ||
        txt.includes("descuento") ||
        txt.includes("oferta")
      ) {
        intencionDetectada = "CONSULTA_PROMOCIONES";
        tecnicaSuperacion =
          "Transparencia en condiciones y entrega de valor inmediato";
      } else if (
        txt.includes("delivery") ||
        txt.includes("tiempo") ||
        txt.includes("demora")
      ) {
        intencionDetectada = "CONSULTA_LOGISTICA";
        objecionDetectada = "TIEMPO_ENTREGA";
        tecnicaSuperacion =
          "Garantía de salida a la brasa caliente y empaque térmico seguro";
      }

      return NextResponse.json({
        success: true,
        copiloto: {
          propuestaMensaje: respuestaAgente.mensaje,
          intencionDetectada,
          objecionDetectada,
          tecnicaSuperacion,
          estrategiaComercial:
            "Venta Consultiva Transparente basada en Preferencias SQL V3",
          ofertaSugerida: respuestaAgente.ofertaSugerida,
          sugerenciasComerciales: respuestaAgente.sugerenciasComerciales || [],
        },
      });
    }

    // -----------------------------------------------------------------------
    // ACCIÓN: CONFIRMAR CONVERSIÓN (PRIMER PAGO CONFIRMADO -> PAYER)
    // -----------------------------------------------------------------------
    if (action === "confirmar_conversion") {
      if (!id_negociacion) {
        return NextResponse.json(
          { success: false, error: "id_negociacion requerido" },
          { status: 400 },
        );
      }

      // Obtener negociación y persona
      const negData = await executeQuery<any>(
        `SELECT n.id_negociacion, n.id_persona, n.id_pedido, n.id_sesion_whatsapp, p.nombres, p.apellidos, s.telefono_cliente
         FROM dbo.negociacion n
         JOIN dbo.persona p ON p.id_persona = n.id_persona
         LEFT JOIN dbo.sesion_whatsapp s ON s.id_sesion = n.id_sesion_whatsapp
         WHERE n.id_negociacion = @idNeg`,
        { idNeg: { type: sql.BigInt, value: id_negociacion } },
      );

      if (negData.length === 0) {
        return NextResponse.json(
          { success: false, error: "Negociación no encontrada" },
          { status: 404 },
        );
      }

      const neg = negData[0];
      let idPedido = neg.id_pedido;

      // 1. Si no tiene pedido vinculado, crear uno en estado CONFIRMADO
      if (!idPedido) {
        const resPed = await executeQuery<{ id_pedido: number }>(
          `
          INSERT INTO dbo.pedido (id_persona, id_negociacion, tipo, fecha_registro, estado, subtotal, descuento, total)
          VALUES (@idPersona, @idNeg, 'LOCAL', SYSUTCDATETIME(), 'PAGADO', @monto, 0, @monto);
          SELECT SCOPE_IDENTITY() AS id_pedido;
        `,
          {
            idPersona: { type: sql.BigInt, value: neg.id_persona },
            idNeg: { type: sql.BigInt, value: id_negociacion },
            monto: { type: sql.Decimal(10, 2), value: monto },
          },
        );
        idPedido = resPed[0].id_pedido;

        await executeQuery(
          `UPDATE dbo.negociacion SET id_pedido = @idPed WHERE id_negociacion = @idNeg;`,
          {
            idPed: { type: sql.BigInt, value: idPedido },
            idNeg: { type: sql.BigInt, value: id_negociacion },
          },
        );
      }

      // 2. Registrar el pago en dbo.pago
      const resPago = await executeQuery<{ id_pago: number }>(
        `
        INSERT INTO dbo.pago (id_pedido, id_medio_pago, monto, moneda, fecha_pago, estado, referencia)
        VALUES (@idPedido, 1, @monto, 'PEN', SYSUTCDATETIME(), 'CONFIRMADO', @ref);
        SELECT SCOPE_IDENTITY() AS id_pago;
      `,
        {
          idPedido: { type: sql.BigInt, value: idPedido },
          monto: { type: sql.Decimal(10, 2), value: monto },
          ref: { type: sql.VarChar(100), value: `PAGO_YAPE_${Date.now()}` },
        },
      );

      // 3. Actualizar la negociación a CONVERTIDA con fecha_primer_pago
      await executeQuery(
        `
        UPDATE dbo.negociacion 
        SET estado = 'CONVERTIDA', 
            fecha_fin = COALESCE(fecha_fin, SYSUTCDATETIME()),
            fecha_primer_pago = COALESCE(fecha_primer_pago, SYSUTCDATETIME())
        WHERE id_negociacion = @idNeg;
      `,
        { idNeg: { type: sql.BigInt, value: id_negociacion } },
      );

      // 4. Actualizar fase_actual del cliente a PAYER (Regla comercial 5)
      await executeQuery(
        `
        UPDATE dbo.persona 
        SET fase_actual = 'PAYER' 
        WHERE id_persona = @idPersona;
      `,
        { idPersona: { type: sql.BigInt, value: neg.id_persona } },
      );

      // 5. Registrar acción del agente
      await toolRegistrarAccionAgente({
        id_negociacion,
        id_sesion_whatsapp: neg.id_sesion_whatsapp,
        accion: "CONVERTIR_LEAD_A_PAYER",
        detalle: `Pago confirmado de S/ ${monto} vía Yape. Conversión exitosa.`,
        resultado: "EXITOSO",
      });

      // 6. Si hay teléfono y se solicita WhatsApp, enviar confirmación oficial
      if (enviarWhatsAppReal && neg.telefono_cliente) {
        const textoConfirmacion = `¡Excelente noticia, ${neg.nombres}! 🎉💳 Hemos verificado tu anticipo de S/ ${Number(monto).toFixed(2)} por Yape al instante.

Tu pedido ha quedado *CONFIRMADO* en nuestro sistema parrillero 🔥. Nuestro equipo en Trujillo ya tiene la orden lista para servirte calientito. ¡Muchas gracias por tu compra en Parrilladas El Establo! 🥩✨`;

        const envio = await enviarMensajeWhatsApp({
          telefonoDestino: neg.telefono_cliente,
          texto: textoConfirmacion,
        });

        if (envio.success && neg.id_sesion_whatsapp) {
          await executeQuery(
            `
            INSERT INTO dbo.mensaje_whatsapp (id_sesion, wamid, direccion, tipo, contenido, fecha_mensaje, estado_entrega)
            VALUES (@idSesion, @wamid, 'SALIENTE', 'TEXTO', @contenido, SYSUTCDATETIME(), 'ENVIADO');
          `,
            {
              idSesion: { type: sql.BigInt, value: neg.id_sesion_whatsapp },
              wamid: { type: sql.VarChar(200), value: envio.wamid || null },
              contenido: {
                type: sql.NVarChar(sql.MAX),
                value: textoConfirmacion,
              },
            },
          );
        }
      }

      return NextResponse.json({
        success: true,
        mensaje: "Conversión registrada exitosamente",
        id_pago: resPago[0]?.id_pago,
        id_pedido: idPedido,
      });
    }

    // -----------------------------------------------------------------------
    // ACCIÓN: ENVIAR MENSAJE REGULAR (DEL LEAD O DEL AGENTE)
    // -----------------------------------------------------------------------
    if (!id_sesion || !contenido) {
      return NextResponse.json(
        { success: false, error: "Datos incompletos (id_sesion, contenido)" },
        { status: 400 },
      );
    }

    let wamid = `SIM_WAMID_${Date.now()}`;
    let estadoEntrega = direccion === "SALIENTE" ? "ENVIADO" : null;

    // Si es un mensaje SALIENTE del Agente hacia el cliente y se solicita WhatsApp Real:
    if (direccion === "SALIENTE" && enviarWhatsAppReal) {
      const sesData = await executeQuery<{ telefono_cliente: string }>(
        `SELECT telefono_cliente FROM dbo.sesion_whatsapp WHERE id_sesion = @idSesion`,
        { idSesion: { type: sql.BigInt, value: id_sesion } },
      );

      if (sesData.length > 0 && sesData[0].telefono_cliente) {
        const envio = await enviarMensajeWhatsApp({
          telefonoDestino: sesData[0].telefono_cliente,
          texto: contenido,
        });
        if (envio.success && envio.wamid) {
          wamid = envio.wamid;
        }
      }
    }

    // 1. Insertar el mensaje entrante o saliente
    const insertMsg = `
      INSERT INTO dbo.mensaje_whatsapp (id_sesion, wamid, direccion, tipo, contenido, fecha_mensaje, estado_entrega)
      VALUES (@idSesion, @wamid, @direccion, @tipo, @contenido, SYSUTCDATETIME(), @estadoEntrega);
      SELECT SCOPE_IDENTITY() AS id_mensaje;
    `;

    const tipoMapeado = mapearTipoMensaje(tipo);

    const resMsg = await executeQuery<{ id_mensaje: number }>(insertMsg, {
      idSesion: { type: sql.BigInt, value: id_sesion },
      wamid: { type: sql.VarChar(200), value: wamid },
      direccion: { type: sql.VarChar(10), value: direccion },
      tipo: { type: sql.VarChar(20), value: tipoMapeado },
      contenido: { type: sql.NVarChar(sql.MAX), value: contenido },
      estadoEntrega: { type: sql.VarChar(20), value: estadoEntrega },
    });

    // Actualizar fecha_ultimo_mensaje en sesion_whatsapp
    await executeQuery(
      `
      UPDATE dbo.sesion_whatsapp 
      SET fecha_ultimo_mensaje = SYSUTCDATETIME() 
      WHERE id_sesion = @idSesion;
    `,
      {
        idSesion: { type: sql.BigInt, value: id_sesion },
      },
    );

    let respuestaAgente: any = null;

    // 2. Si el mensaje es ENTRANTE (del Lead) y autoResponder es true, procesamos con el Agente IA
    if (direccion === "ENTRANTE" && autoResponder && id_negociacion) {
      const ultimosMsg = await executeQuery<any>(
        `
        SELECT TOP 6 direccion, contenido FROM dbo.mensaje_whatsapp
        WHERE id_sesion = @idSesion ORDER BY fecha_mensaje DESC;
      `,
        { idSesion: { type: sql.BigInt, value: id_sesion } },
      );

      const historialFormateado = ultimosMsg.reverse().map((m: any) => ({
        remitente:
          m.direccion === "ENTRANTE" ? ("lead" as const) : ("agente" as const),
        texto: m.contenido,
      }));

      // Procesar con el Agente Inteligente
      respuestaAgente = await procesarMensajeLead(
        id_negociacion,
        contenido,
        historialFormateado,
      );

      // Si tenemos teléfono y se solicita WhatsApp Real, enviar la respuesta del Agente a WhatsApp
      let wamidResp = `AGENTE_WAMID_${Date.now()}`;
      if (enviarWhatsAppReal) {
        const sesData = await executeQuery<{ telefono_cliente: string }>(
          `SELECT telefono_cliente FROM dbo.sesion_whatsapp WHERE id_sesion = @idSesion`,
          { idSesion: { type: sql.BigInt, value: id_sesion } },
        );
        if (sesData.length > 0 && sesData[0].telefono_cliente) {
          const envio = await enviarMensajeWhatsApp({
            telefonoDestino: sesData[0].telefono_cliente,
            texto: respuestaAgente.mensaje,
          });
          if (envio.success && envio.wamid) {
            wamidResp = envio.wamid;
          }
        }
      }

      // Guardar la respuesta del Agente en la base de datos
      await executeQuery(
        `
        INSERT INTO dbo.mensaje_whatsapp (id_sesion, wamid, direccion, tipo, contenido, fecha_mensaje, estado_entrega)
        VALUES (@idSesion, @wamid, 'SALIENTE', @tipo, @contenido, SYSUTCDATETIME(), 'ENVIADO');
      `,
        {
          idSesion: { type: sql.BigInt, value: id_sesion },
          wamid: { type: sql.VarChar(200), value: wamidResp },
          tipo: { type: sql.VarChar(20), value: mapearTipoMensaje("TEXTO") },
          contenido: {
            type: sql.NVarChar(sql.MAX),
            value: respuestaAgente.mensaje,
          },
        },
      );

      // Si el agente recomendó una oferta y se desea registrar como propuesta
      if (respuestaAgente.ofertaSugerida) {
        const off = respuestaAgente.ofertaSugerida;
        await toolRegistrarOferta(id_negociacion, {
          id_producto: off.tipo === "PRODUCTO" ? off.id : undefined,
          id_combo: off.tipo === "COMBO" ? off.id : undefined,
          id_promocion: off.tipo === "PROMOCION" ? off.id : undefined,
          respuesta: "SIN_RESPUESTA",
          detalle: `Sugerido por Agente Establo IA: ${off.nombre}`,
        });
      }
    }

    return NextResponse.json({
      success: true,
      mensajeEnviadoId: resMsg[0]?.id_mensaje,
      respuestaAgente,
    });
  } catch (error: any) {
    console.error("[API Chat POST Error]:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}
