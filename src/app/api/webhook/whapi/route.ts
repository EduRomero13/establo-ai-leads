import { NextRequest, NextResponse } from "next/server";
import {
  registrarEventoIntegracion,
  marcarEventoProcesado,
  procesarMensajeEntrante,
  mapearTipoMensaje,
} from "@/lib/whatsapp-service";

// =========================================================================
// RECEPCIÓN DE MENSAJES DE WHAPI.CLOUD (POST)
// =========================================================================

export async function POST(request: NextRequest) {
  try {
    const payload = await request.json();

    // Whapi envía diferentes tipos de eventos. Nos interesan los mensajes.
    // Estructura típica: { messages: [ { id, from, body, type, ... } ] }
    if (payload.messages && Array.isArray(payload.messages)) {
      for (const msg of payload.messages) {
        // Evitar procesar mensajes propios (salientes)
        if (msg.from_me) continue;

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
          remitenteRaw: msg.chat_id.split("@")[0], // Whapi usa chat_id: "51948834920@s.whatsapp.net"
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
