import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import {
  registrarEventoIntegracion,
  marcarEventoProcesado,
  procesarMensajeEntrante,
  mapearTipoMensaje,
} from "@/lib/whatsapp-service";

function validarTokenWhapi(request: NextRequest): boolean {
  const expectedSecret = (process.env.WHAPI_WEBHOOK_SECRET || process.env.WHATSAPP_VERIFY_TOKEN || "").trim();
  if (!expectedSecret) {
    // En producción sin secreto configurado, rechazar por seguridad (fail-closed)
    if (process.env.NODE_ENV === "production") {
      console.error("[Webhook Whapi] WHAPI_WEBHOOK_SECRET / WHATSAPP_VERIFY_TOKEN no configurado en producción.");
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

// =========================================================================
// RECEPCIÓN DE MENSAJES DE WHAPI.CLOUD (POST)
// =========================================================================

export async function POST(request: NextRequest) {
  try {
    if (!validarTokenWhapi(request)) {
      console.warn("[Webhook Whapi] Petición rechazada: token secreto inválido o ausente.");
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const payload = await request.json();

    // Whapi envía diferentes tipos de eventos. Nos interesan los mensajes.
    // Estructura típica: { messages: [ { id, from, body, type, ... } ] }
    if (payload.messages && Array.isArray(payload.messages)) {
      for (const msg of payload.messages) {
        // Evitar procesar mensajes propios (salientes) para prevenir bucles
        if (msg.from_me) continue;

        const chatId = msg.chat_id || msg.from || "";
        if (!chatId) continue;

        const eventId = `whapi_${msg.id}`;
        const { esDuplicado, idEvento } = await registrarEventoIntegracion(
          "WHAPI",
          eventId,
          "MENSAJE_ENTRANTE"
        );

        if (esDuplicado) {
          console.log(`[Webhook Whapi] Mensaje duplicado omitido: ${msg.id}`);
          continue;
        }

        // Extraer contenido
        let contenidoTexto = "";
        if (msg.type === "text") {
          contenidoTexto = msg.text?.body || "";
        } else if (msg.type === "interactive") {
          contenidoTexto = msg.interactive?.list_reply?.title || msg.interactive?.button_reply?.title || "";
        } else {
          contenidoTexto = `[Multimedia: ${msg.type}]`;
        }

        // Procesar mensaje asíncronamente
        procesarMensajeEntrante({
          proveedor: "WHAPI",
          wamid: msg.id,
          remitenteRaw: chatId.split("@")[0], // Whapi usa chat_id: "51948834920@s.whatsapp.net"
          nombreContacto: msg.from_name || "Cliente Whapi",
          contenido: contenidoTexto,
          tipo: mapearTipoMensaje(msg.type),
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
