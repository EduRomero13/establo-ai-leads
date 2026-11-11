import { NextResponse } from "next/server";
import { executeQuery, sql } from "@/lib/db";
import { procesarMensajeLead, toolRegistrarOferta, toolRegistrarAccionAgente } from "@/lib/ai-agent";

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
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// Enviar un mensaje (como Lead simulado o como Agente)
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { id_sesion, id_negociacion, direccion, contenido, tipo = "TEXTO", autoResponder = true } = body;

    if (!id_sesion || !contenido) {
      return NextResponse.json({ success: false, error: "Datos incompletos (id_sesion, contenido)" }, { status: 400 });
    }

    // 1. Insertar el mensaje entrante o saliente
    const insertMsg = `
      INSERT INTO dbo.mensaje_whatsapp (id_sesion, wamid, direccion, tipo, contenido, fecha_mensaje, estado_entrega)
      VALUES (@idSesion, @wamid, @direccion, @tipo, @contenido, SYSUTCDATETIME(), @estadoEntrega);
      SELECT SCOPE_IDENTITY() AS id_mensaje;
    `;
    const wamid = `SIM_WAMID_${Date.now()}`;
    const estadoEntrega = direccion === "SALIENTE" ? "ENVIADO" : null;

    const resMsg = await executeQuery<{ id_mensaje: number }>(insertMsg, {
      idSesion: { type: sql.BigInt, value: id_sesion },
      wamid: { type: sql.VarChar(200), value: wamid },
      direccion: { type: sql.VarChar(10), value: direccion },
      tipo: { type: sql.VarChar(20), value: tipo },
      contenido: { type: sql.NVarChar(sql.MAX), value: contenido },
      estadoEntrega: { type: sql.VarChar(20), value: estadoEntrega },
    });

    // Actualizar fecha_ultimo_mensaje en sesion_whatsapp
    await executeQuery(`
      UPDATE dbo.sesion_whatsapp 
      SET fecha_ultimo_mensaje = SYSUTCDATETIME() 
      WHERE id_sesion = @idSesion;
    `, {
      idSesion: { type: sql.BigInt, value: id_sesion },
    });

    let respuestaAgente: any = null;

    // 2. Si el mensaje es ENTRANTE (del Lead) y autoResponder es true, procesamos con el Agente IA
    if (direccion === "ENTRANTE" && autoResponder && id_negociacion) {
      // Obtener últimos mensajes previos para contexto
      const ultimosMsg = await executeQuery<any>(`
        SELECT TOP 6 direccion, contenido FROM dbo.mensaje_whatsapp
        WHERE id_sesion = @idSesion ORDER BY fecha_mensaje DESC;
      `, { idSesion: { type: sql.BigInt, value: id_sesion } });

      const historialFormateado = ultimosMsg.reverse().map((m: any) => ({
        remitente: m.direccion === "ENTRANTE" ? "lead" as const : "agente" as const,
        texto: m.contenido,
      }));

      // Procesar con el Agente Inteligente
      respuestaAgente = await procesarMensajeLead(id_negociacion, contenido, historialFormateado);

      // Guardar la respuesta del Agente en la base de datos
      const wamidResp = `AGENTE_WAMID_${Date.now()}`;
      await executeQuery(`
        INSERT INTO dbo.mensaje_whatsapp (id_sesion, wamid, direccion, tipo, contenido, fecha_mensaje, estado_entrega)
        VALUES (@idSesion, @wamid, 'SALIENTE', 'TEXTO', @contenido, SYSUTCDATETIME(), 'ENVIADO');
      `, {
        idSesion: { type: sql.BigInt, value: id_sesion },
        wamid: { type: sql.VarChar(200), value: wamidResp },
        contenido: { type: sql.NVarChar(sql.MAX), value: respuestaAgente.mensaje },
      });

      // Si el agente recomendó una oferta y se desea registrar como propuesta
      if (respuestaAgente.ofertaSugerida) {
        const off = respuestaAgente.ofertaSugerida;
        await toolRegistrarOferta(id_negociacion, {
          id_producto: off.tipo === "PRODUCTO" ? off.id : undefined,
          id_combo: off.tipo === "COMBO" ? off.id : undefined,
          id_promocion: off.tipo === "PROMOCION" ? off.id : undefined,
          respuesta: 'SIN_RESPUESTA',
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
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

