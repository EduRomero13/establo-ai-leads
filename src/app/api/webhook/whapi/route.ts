import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import {
  registrarEventoIntegracion,
  marcarEventoProcesado,
  procesarMensajeEntrante,
  mapearTipoMensaje,
} from "@/lib/whatsapp-service";

export const dynamic = "force-dynamic";

function validarTokenWhapi(request: NextRequest): boolean {
  const expectedSecret = (
    process.env.WHAPI_WEBHOOK_TOKEN ||
    process.env.WHAPI_WEBHOOK_SECRET ||
    process.env.WHATSAPP_VERIFY_TOKEN ||
    ""
  ).trim();
  if (!expectedSecret) {
    // En producción sin secreto configurado, rechazar por seguridad (fail-closed)
    if (process.env.NODE_ENV === "production") {
      console.error("[Webhook Whapi] WHAPI_WEBHOOK_TOKEN no configurado en producción.");
      return false;
    }
    return true;
  }

  const { searchParams } = new URL(request.url);
  const tokenQuery = searchParams.get("token");
  const tokenHeader = request.headers.get("x-whapi-token");
  const authHeader = request.headers.get("authorization");
  const tokenBearer = authHeader?.startsWith("Bearer ") ? authHeader.slice(7).trim() : null;

  const providedToken = (tokenQuery || tokenHeader || tokenBearer || "").trim();
  if (!providedToken) return false;

  const bufA = Buffer.from(providedToken, "utf8");
  const bufB = Buffer.from(expectedSecret, "utf8");
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

// -------------------------------------------------------------------------
// Helpers de normalización para payloads de Whapi
// -------------------------------------------------------------------------

function soloDigitos(valor: unknown): string {
  return String(valor || "").replace(/\D/g, "");
}

/**
 * Whapi puede identificar al remitente con "phone" (número real) o con un
 * "chat_id"/"from" terminado en @s.whatsapp.net o @lid. Preferimos siempre el
 * número de teléfono para que la BD (telefono_cliente varchar(20)) y el envío
 * de la respuesta funcionen.
 */
function resolverTelefonoWhapi(msg: any): string {
  const candidatos = [msg.phone, msg.from, msg.chat_id];
  for (const candidato of candidatos) {
    const digitos = soloDigitos(candidato);
    if (digitos.length >= 9 && digitos.length <= 15) {
      return digitos;
    }
  }
  return "";
}

/**
 * Extrae el texto de los tipos de mensaje habituales de Whapi. Los mensajes
 * interactivos de Whapi NO usan la forma de Meta (list_reply/button_reply).
 */
function extraerTextoWhapi(msg: any): string {
  if (typeof msg?.text?.body === "string" && msg.text.body.trim()) {
    return msg.text.body;
  }
  if (typeof msg?.reply?.body === "string" && msg.reply.body.trim()) {
    return msg.reply.body;
  }
  if (typeof msg?.interactive?.body === "string" && msg.interactive.body.trim()) {
    return msg.interactive.body;
  }
  if (typeof msg?.list?.body === "string" && msg.list.body.trim()) {
    return msg.list.body;
  }
  if (typeof msg?.buttons?.text === "string" && msg.buttons.text.trim()) {
    return msg.buttons.text;
  }
  if (typeof msg?.caption === "string" && msg.caption.trim()) {
    return msg.caption;
  }
  return `[Multimedia: ${msg?.type || "desconocido"}]`;
}

// =========================================================================
// DIAGNÓSTICO (GET): abrir esta URL en el navegador debe devolver "ready"
// =========================================================================

export async function GET() {
  return NextResponse.json({
    status: "ready",
    provider: "whapi",
    webhook: "/api/webhook/whapi",
    tokenConfigured: Boolean(
      (process.env.WHAPI_WEBHOOK_TOKEN || process.env.WHAPI_WEBHOOK_SECRET || "").trim(),
    ),
    hint: "Whapi debe enviar POST a /api/webhook/whapi?token=<WHAPI_WEBHOOK_TOKEN>",
  });
}

// =========================================================================
// RECEPCIÓN DE MENSAJES DE WHAPI.CLOUD (POST)
// =========================================================================

export async function POST(request: NextRequest) {
  try {
    if (!validarTokenWhapi(request)) {
      console.warn("[Webhook Whapi] Petición rechazada: token secreto inválido o ausente.");
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    let payload: any;
    try {
      payload = await request.json();
    } catch {
      return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
    }

    const totalMensajes = Array.isArray(payload?.messages) ? payload.messages.length : 0;
    const tipoEvento = payload?.event?.type || (totalMensajes > 0 ? "messages" : "sin-eventos");
    console.log(
      `[Webhook Whapi] Evento recibido: ${tipoEvento} | mensajes: ${totalMensajes} | channel: ${payload?.channel_id || "n/d"}`,
    );

    // Whapi envía diferentes tipos de eventos. Nos interesan los mensajes.
    // Estructura típica: { messages: [ { id, from, phone, chat_id, type, text, ... } ] }
    if (payload?.messages && Array.isArray(payload.messages)) {
      for (const msg of payload.messages) {
        // Evitar procesar mensajes propios (salientes) para prevenir bucles
        if (msg.from_me) continue;

        const chatId = String(msg.chat_id || msg.from || "");
        if (!chatId || chatId.endsWith("@g.us")) continue; // Ignorar grupos

        if (!msg.id) {
          console.warn("[Webhook Whapi] Mensaje sin id, se omite.");
          continue;
        }

        const remitente = resolverTelefonoWhapi(msg);
        if (!remitente) {
          console.warn(
            `[Webhook Whapi] No se pudo resolver el teléfono del mensaje ${msg.id} (chat_id=${chatId}).`,
          );
          continue;
        }

        const eventId = `whapi_${msg.id}`;
        const { esDuplicado, idEvento } = await registrarEventoIntegracion(
          "WHATSAPP",
          eventId,
          "MENSAJE_ENTRANTE"
        );

        if (esDuplicado) {
          console.log(`[Webhook Whapi] Mensaje duplicado omitido: ${msg.id}`);
          continue;
        }

        const contenidoTexto = extraerTextoWhapi(msg);
        const tipoMapeado = mapearTipoMensaje(msg.type);

        console.log(
          `[Webhook Whapi] Procesando ${msg.id} | tipo=${msg.type} -> ${tipoMapeado} | de=${remitente}`,
        );

        // Procesar mensaje asíncronamente (Whapi exige respuesta 200 rápida)
        procesarMensajeEntrante({
          proveedor: "WHAPI",
          wamid: msg.id,
          remitenteRaw: remitente,
          nombreContacto: msg.from_name || msg.chat_name || "Cliente Whapi",
          contenido: contenidoTexto,
          tipo: msg.type,
        })
          .then(() => {
            if (idEvento) marcarEventoProcesado(idEvento);
          })
          .catch((err) => {
            console.error("[Whapi Process Error]:", err);
            if (idEvento) marcarEventoProcesado(idEvento, err.message);
          });
      }
    }

    return NextResponse.json({ status: "success" }, { status: 200 });
  } catch (error: any) {
    console.error("[Webhook Whapi Error]:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
