import { NextRequest, NextResponse } from "next/server";
import {
  validarFirmaMeta,
  registrarEventoIntegracion,
  marcarEventoProcesado,
  procesarMensajeEntranteMeta,
  actualizarEstadoMensajeMeta,
  mapearTipoMensaje,
  MetaWebhookPayload,
} from "@/lib/whatsapp-service";

// =========================================================================
// A. VERIFICACIÓN DEL WEBHOOK DE META (GET)
// =========================================================================

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const mode = searchParams.get("hub.mode");
    const token = searchParams.get("hub.verify_token");
    const challenge = searchParams.get("hub.challenge");

    const expectedToken = process.env.WHATSAPP_VERIFY_TOKEN || "establo_ai_webhook_secret_2026";

    if (mode === "subscribe" && token === expectedToken) {
      console.log("[Webhook WhatsApp] Verificación oficial de Meta exitosa");
      return new NextResponse(challenge, {
        status: 200,
        headers: { "Content-Type": "text/plain" },
      });
    }

    console.warn("[Webhook WhatsApp] Intento de verificación fallido o token inválido");
    return NextResponse.json({ error: "Token de verificación incorrecto" }, { status: 403 });
  } catch (error: any) {
    console.error("[Webhook WhatsApp GET Error]:", error);
    return NextResponse.json({ error: "Error en verificación de webhook" }, { status: 500 });
  }
}

// =========================================================================
// B. RECEPCIÓN DE MENSAJES Y EVENTOS DE ESTADO (POST)
// =========================================================================

export async function POST(request: NextRequest) {
  try {
    // 1. Obtener cuerpo original en texto para verificar firma
    const rawBody = await request.text();
    const signature = request.headers.get("x-hub-signature-256");

    // 2. Validar X-Hub-Signature-256
    const firmaValida = validarFirmaMeta(rawBody, signature);
    if (!firmaValida) {
      console.error("[Webhook WhatsApp] Firma X-Hub-Signature-256 inválida");
      return NextResponse.json({ error: "Firma inválida" }, { status: 401 });
    }

    let payload: MetaWebhookPayload;
    try {
      payload = JSON.parse(rawBody);
    } catch (e) {
      return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
    }

    if (payload.object !== "whatsapp_business_account") {
      return NextResponse.json({ status: "ignored" }, { status: 200 });
    }

    // 3. Procesar eventos de entry de manera desacoplada
    if (payload.entry && Array.isArray(payload.entry)) {
      for (const entry of payload.entry) {
        if (!entry.changes || !Array.isArray(entry.changes)) continue;

        for (const change of entry.changes) {
          const val = change.value;
          if (!val) continue;

          // B.1 Procesar Estados de Entrega (sent, delivered, read, failed)
          if (val.statuses && Array.isArray(val.statuses)) {
            for (const status of val.statuses) {
              const eventId = `status_${status.id}_${status.status}_${status.timestamp}`;
              const { esDuplicado, idEvento } = await registrarEventoIntegracion(
                "WHATSAPP_CLOUD",
                eventId,
                `STATUS_${status.status.toUpperCase()}`
              );

              if (!esDuplicado) {
                await actualizarEstadoMensajeMeta({
                  wamid: status.id,
                  estado: status.status,
                  timestamp: status.timestamp,
                  error: status.errors?.[0]?.message,
                });
                if (idEvento) await marcarEventoProcesado(idEvento);
              }
            }
          }

          // B.2 Procesar Mensajes Entrantes de Clientes
          if (val.messages && Array.isArray(val.messages)) {
            const contactName = val.contacts?.[0]?.profile?.name || "Cliente WhatsApp";

            for (const msg of val.messages) {
              const eventId = `msg_${msg.id}`;
              const { esDuplicado, idEvento } = await registrarEventoIntegracion(
                "WHATSAPP",
                eventId,
                "MENSAJE_ENTRANTE"
              );

              if (esDuplicado) {
                console.log(`[Webhook WhatsApp] Mensaje duplicado omitido: ${msg.id}`);
                continue;
              }

              // Extraer texto u opción
              let contenidoTexto = "";
              let opcionSeleccionada: string | undefined;

              if (msg.type === "text" && msg.text) {
                contenidoTexto = msg.text.body;
              } else if (msg.type === "interactive" && msg.interactive) {
                if (msg.interactive.button_reply) {
                  contenidoTexto = msg.interactive.button_reply.title;
                  opcionSeleccionada = msg.interactive.button_reply.id;
                } else if (msg.interactive.list_reply) {
                  contenidoTexto = msg.interactive.list_reply.title;
                  opcionSeleccionada = msg.interactive.list_reply.id;
                }
              } else if (msg.type === "button" && msg.button) {
                contenidoTexto = msg.button.text;
                opcionSeleccionada = msg.button.payload;
              } else {
                contenidoTexto = `[Contenido multimedia: ${msg.type}]`;
              }

              // Procesar mensaje y generar respuesta con IA de forma asíncrona
              // No bloqueamos la respuesta rápida 200 a Meta
              procesarMensajeEntranteMeta({
                wamid: msg.id,
                remitenteRaw: msg.from,
                nombreContacto: contactName,
                contenido: contenidoTexto,
                tipo: mapearTipoMensaje(msg.type),
                opcionSeleccionada,
              })
                .then(() => {
                  if (idEvento) marcarEventoProcesado(idEvento);
                })
                .catch((err) => {
                  console.error("[Error Procesando Evento Webhook]:", err);
                  if (idEvento) marcarEventoProcesado(idEvento, err.message);
                });
            }
          }
        }
      }
    }

    // 4. Responder inmediatamente 200 OK a Meta
    return NextResponse.json({ status: "success", received: true }, { status: 200 });
  } catch (error: any) {
    console.error("[Webhook WhatsApp POST Error]:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
