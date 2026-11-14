import { NextResponse } from "next/server";
import { executeQuery, sql } from "@/lib/db";
import { toolRegistrarAccionAgente } from "@/lib/ai-agent";
import { detectarPlatoMediaPorTexto, getPlatoAbsoluteUrl } from "@/lib/platos-media";
import { enviarMensajeWhatsApp, mapearTipoMensaje } from "@/lib/whatsapp-service";

// Cadencia basada en buenas prácticas de WhatsApp (ventana de 24h y anti-spam):
// - Toque 1: 20 min sin respuesta (aprovechar antojo inmediato en restaurante)
// - Toque 2: 4 horas sin respuesta (recordatorio con valor dentro de la ventana 24h)
// - Toque 3: 48 horas sin respuesta (pregunta rápida de baja fricción antes del límite 72h)
const UMBRAL_TOQUE_1_MIN = 20;
const UMBRAL_TOQUE_2_MIN = 240; // 4 horas
const UMBRAL_TOQUE_3_MIN = 2880; // 48 horas

function autorizarCron(request: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return true;
  const auth = request.headers.get("authorization") || "";
  const url = new URL(request.url);
  const tokenParam = url.searchParams.get("token") || "";
  return auth === `Bearer ${secret}` || tokenParam === secret;
}

async function ejecutarInsistenciaAutomatica(dryRun: boolean) {
  const candidatos = await executeQuery<{
    id_negociacion: number;
    id_persona: number;
    nombres: string;
    telefono: string | null;
    id_sesion_whatsapp: number;
    ultimo_mensaje_texto: string | null;
    ultimo_mensaje_dir: string | null;
    ultimo_mensaje_fecha: Date;
    minutos_sin_respuesta: number;
    toques_enviados: number;
  }>(`
    SELECT
      n.id_negociacion,
      n.id_persona,
      p.nombres,
      p.telefono,
      n.id_sesion_whatsapp,
      ult.contenido AS ultimo_mensaje_texto,
      ult.direccion AS ultimo_mensaje_dir,
      ult.fecha_mensaje AS ultimo_mensaje_fecha,
      DATEDIFF(MINUTE, ult.fecha_mensaje, SYSUTCDATETIME()) AS minutos_sin_respuesta,
      (
        SELECT COUNT(*)
        FROM dbo.accion_agente a
        WHERE a.id_negociacion = n.id_negociacion
          AND a.accion LIKE 'INSISTENCIA_AUTO_%'
          AND a.fecha_ejecucion >= COALESCE(ult_in.fecha_mensaje, n.fecha_inicio)
      ) AS toques_enviados
    FROM dbo.negociacion n
    JOIN dbo.persona p ON p.id_persona = n.id_persona
    CROSS APPLY (
      SELECT TOP 1 m.contenido, m.direccion, m.fecha_mensaje
      FROM dbo.mensaje_whatsapp m
      WHERE m.id_sesion = n.id_sesion_whatsapp
      ORDER BY m.fecha_mensaje DESC
    ) ult
    OUTER APPLY (
      SELECT TOP 1 m2.fecha_mensaje
      FROM dbo.mensaje_whatsapp m2
      WHERE m2.id_sesion = n.id_sesion_whatsapp AND m2.direccion = 'ENTRANTE'
      ORDER BY m2.fecha_mensaje DESC
    ) ult_in
    WHERE n.estado = 'ABIERTA'
      AND n.id_sesion_whatsapp IS NOT NULL
      AND p.telefono IS NOT NULL
      AND ult.direccion = 'SALIENTE'
      AND DATEDIFF(MINUTE, ult.fecha_mensaje, SYSUTCDATETIME()) >= @minUmbral;
  `, {
    minUmbral: { type: sql.Int, value: UMBRAL_TOQUE_1_MIN },
  });

  const procesados: Array<{
    id_negociacion: number;
    cliente: string;
    toque: number;
    minutos_sin_respuesta: number;
    enviado: boolean;
    con_imagen: boolean;
  }> = [];

  for (const c of candidatos) {
    let toqueNumero: 1 | 2 | 3 | null = null;
    let accionNombre = "";
    let mensaje = "";

    if (c.toques_enviados === 0 && c.minutos_sin_respuesta >= UMBRAL_TOQUE_1_MIN) {
      toqueNumero = 1;
      accionNombre = "INSISTENCIA_AUTO_1";
      mensaje = `¡Hola, ${c.nombres}! 🔥 Nuestras brasas siguen encendidas y ese corte a la leña te está esperando 🤤.\n¿Te lo separamos ahora para enviártelo calientito? ¡Pagas al toque con Yape o Plin! 🥩📲`;
    } else if (c.toques_enviados === 1 && c.minutos_sin_respuesta >= UMBRAL_TOQUE_2_MIN) {
      toqueNumero = 2;
      accionNombre = "INSISTENCIA_AUTO_2";
      mensaje = `¡${c.nombres}! 🥩✨ Aún estás a tiempo de aprovechar nuestras promos del día en Parrilladas El Establo (delivery GRATIS desde S/ 80) 🛵🔥.\n¿Armamos tu pedido para almuerzo o cena hoy? 📲`;
    } else if (c.toques_enviados === 2 && c.minutos_sin_respuesta >= UMBRAL_TOQUE_3_MIN) {
      toqueNumero = 3;
      accionNombre = "INSISTENCIA_AUTO_3";
      mensaje = `Hola ${c.nombres} 🙌, ¿sigues interesado en tu parrillada para esta semana o prefieres que pausemos tu solicitud por ahora? Respóndeme *1* para ver opciones o *2* para después 🥩.`;
    }

    if (!toqueNumero || !c.telefono) continue;

    // En el primer toque adjuntamos la foto del último plato mencionado si existe
    const plato = toqueNumero === 1 ? detectarPlatoMediaPorTexto(c.ultimo_mensaje_texto) : null;
    const imagenUrl = plato ? getPlatoAbsoluteUrl(plato.slug, "avif") : null;

    if (dryRun) {
      procesados.push({
        id_negociacion: c.id_negociacion,
        cliente: c.nombres,
        toque: toqueNumero,
        minutos_sin_respuesta: c.minutos_sin_respuesta,
        enviado: false,
        con_imagen: Boolean(imagenUrl),
      });
      continue;
    }

    const envio = await enviarMensajeWhatsApp({
      telefonoDestino: c.telefono,
      texto: mensaje,
      imagenUrl,
    });

    if (envio.success) {
      await executeQuery(
        `INSERT INTO dbo.mensaje_whatsapp (id_sesion, wamid, direccion, tipo, contenido, fecha_mensaje, estado_entrega)
         VALUES (@idSesion, @wamid, 'SALIENTE', @tipo, @contenido, SYSUTCDATETIME(), 'ENVIADO');`,
        {
          idSesion: { type: sql.BigInt, value: c.id_sesion_whatsapp },
          wamid: { type: sql.VarChar(200), value: envio.wamid || null },
          tipo: { type: sql.VarChar(20), value: mapearTipoMensaje(envio.sentImage ? "IMAGEN" : "TEXTO") },
          contenido: { type: sql.NVarChar(sql.MAX), value: mensaje },
        }
      );

      await toolRegistrarAccionAgente({
        id_negociacion: c.id_negociacion,
        id_sesion_whatsapp: c.id_sesion_whatsapp,
        accion: accionNombre,
        detalle: `Insistencia automática toque #${toqueNumero} tras ${c.minutos_sin_respuesta} min sin respuesta`,
        resultado: "EXITOSO",
      });
    }

    procesados.push({
      id_negociacion: c.id_negociacion,
      cliente: c.nombres,
      toque: toqueNumero,
      minutos_sin_respuesta: c.minutos_sin_respuesta,
      enviado: envio.success,
      con_imagen: Boolean(envio.sentImage),
    });
  }

  return {
    success: true,
    dryRun,
    evaluados: candidatos.length,
    procesados,
  };
}

export async function GET(request: Request) {
  if (!autorizarCron(request)) {
    return NextResponse.json({ success: false, error: "No autorizado" }, { status: 401 });
  }
  try {
    const url = new URL(request.url);
    const dryRun = url.searchParams.get("dryRun") === "1";
    const result = await ejecutarInsistenciaAutomatica(dryRun);
    return NextResponse.json(result);
  } catch (error: any) {
    console.error("[Cron Followup GET Error]:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Error en seguimiento automático" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  if (!autorizarCron(request)) {
    return NextResponse.json({ success: false, error: "No autorizado" }, { status: 401 });
  }
  try {
    const body = await request.json().catch(() => ({}));
    const result = await ejecutarInsistenciaAutomatica(Boolean(body?.dryRun));
    return NextResponse.json(result);
  } catch (error: any) {
    console.error("[Cron Followup POST Error]:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Error en seguimiento automático" },
      { status: 500 }
    );
  }
}
