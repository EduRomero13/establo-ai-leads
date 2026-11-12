import crypto from "crypto";
import { executeQuery, sql } from "./db";
import { procesarMensajeLead, toolRegistrarAccionAgente } from "./ai-agent";

// =========================================================================
// TIPOS Y DEFINICIONES DE WHATSAPP BUSINESS CLOUD API
// =========================================================================

export interface MetaWebhookPayload {
  object: string;
  entry?: Array<{
    id: string;
    changes?: Array<{
      value: {
        messaging_product: string;
        metadata: {
          display_phone_number: string;
          phone_number_id: string;
        };
        contacts?: Array<{
          profile: { name: string };
          wa_id: string;
        }>;
        messages?: Array<{
          from: string;
          id: string;
          timestamp: string;
          type: "text" | "interactive" | "button" | "image" | "location";
          text?: { body: string };
          interactive?: {
            type: "button_reply" | "list_reply";
            button_reply?: { id: string; title: string };
            list_reply?: { id: string; title: string; description?: string };
          };
          button?: { text: string; payload?: string };
        }>;
        statuses?: Array<{
          id: string;
          status: "sent" | "delivered" | "read" | "failed";
          timestamp: string;
          recipient_id: string;
          errors?: Array<{ code: number; title: string; message: string }>;
        }>;
      };
      field: string;
    }>;
  }>;
}

// =========================================================================
// MAPEO CENTRALIZADO DE TIPOS DE MENSAJE (SQL Server V3 - CHECK constraint dbo.mensaje_whatsapp.tipo)
// Admite únicamente: 'TEXTO' | 'BOTONES' | 'INTERACTIVO' | 'IMAGEN' | 'OTRO'
// =========================================================================

export type TipoMensajeValidoSQL = 'TEXTO' | 'BOTONES' | 'INTERACTIVO' | 'IMAGEN' | 'OTRO';

export function mapearTipoMensaje(tipoOriginal?: string | null): TipoMensajeValidoSQL {
  if (!tipoOriginal) return 'TEXTO';
  const normalizado = tipoOriginal.trim().toLowerCase();
  switch (normalizado) {
    case 'text':
    case 'texto':
      return 'TEXTO';
    case 'button':
    case 'button_reply':
    case 'botones':
      return 'BOTONES';
    case 'interactive':
    case 'interactivo':
    case 'list_reply':
      return 'INTERACTIVO';
    case 'image':
    case 'imagen':
      return 'IMAGEN';
    default:
      return 'OTRO';
  }
}

// =========================================================================
// 1. SEGURIDAD: VALIDACIÓN DE FIRMA X-Hub-Signature-256
// =========================================================================

export function validarFirmaMeta(bodyRaw: string, signatureHeader: string | null): boolean {
  const secret = process.env.META_APP_SECRET;
  // Si no está configurado el secret (ej. en desarrollo local/demostración), permitimos paso con log de advertencia
  if (!secret || secret.trim() === "" || secret === "DEMO_SECRET") {
    return true;
  }

  if (!signatureHeader || !signatureHeader.startsWith("sha256=")) {
    return false;
  }

  const signatureExpected = signatureHeader.replace("sha256=", "");
  const hmac = crypto.createHmac("sha256", secret);
  hmac.update(bodyRaw, "utf8");
  const signatureCalculated = hmac.digest("hex");

  return crypto.timingSafeEqual(
    Buffer.from(signatureCalculated, "hex"),
    Buffer.from(signatureExpected, "hex")
  );
}

// =========================================================================
// 2. NORMALIZACIÓN DE TELÉFONO PERUANO
// =========================================================================

export function normalizarTelefono(telefono: string): string {
  // Limpiar caracteres no numéricos
  let limpio = telefono.replace(/\D/g, "");
  // Si tiene código de país Perú (51) de 11 dígitos ej. 51948834920 -> 948834920
  if (limpio.startsWith("51") && limpio.length === 11) {
    limpio = limpio.substring(2);
  }
  return limpio;
}

// =========================================================================
// 3. IDEMPOTENCIA: REGISTRO DE EVENTO EN dbo.evento_integracion
// =========================================================================

export async function registrarEventoIntegracion(
  proveedor: string,
  idEventoExterno: string,
  tipo: string
): Promise<{ esDuplicado: boolean; idEvento?: number }> {
  try {
    // Verificar si ya existe
    const checkQuery = `
      SELECT id_evento, estado FROM dbo.evento_integracion
      WHERE proveedor = @proveedor AND id_evento_externo = @idEventoExterno;
    `;
    const existente = await executeQuery<any>(checkQuery, {
      proveedor: { type: sql.VarChar(20), value: proveedor },
      idEventoExterno: { type: sql.VarChar(200), value: idEventoExterno },
    });

    if (existente && existente.length > 0) {
      if (existente[0].estado !== 'ERROR') {
        return { esDuplicado: true, idEvento: existente[0].id_evento };
      }
      return { esDuplicado: false, idEvento: existente[0].id_evento };
    }

    // Registrar nuevo evento
    const insertQuery = `
      INSERT INTO dbo.evento_integracion (proveedor, id_evento_externo, tipo, recibido_en, estado)
      VALUES (@proveedor, @idEventoExterno, @tipo, SYSUTCDATETIME(), 'RECIBIDO');
      SELECT SCOPE_IDENTITY() AS id_evento;
    `;
    const res = await executeQuery<{ id_evento: number }>(insertQuery, {
      proveedor: { type: sql.VarChar(20), value: proveedor },
      idEventoExterno: { type: sql.VarChar(200), value: idEventoExterno },
      tipo: { type: sql.VarChar(50), value: tipo },
    });

    return { esDuplicado: false, idEvento: res[0]?.id_evento };
  } catch (err: any) {
    console.error("[Evento Integracion Error]:", err);
    return { esDuplicado: false };
  }
}

export async function marcarEventoProcesado(idEvento: number, error?: string) {
  try {
    const updateQuery = `
      UPDATE dbo.evento_integracion
      SET procesado_en = SYSUTCDATETIME(),
          estado = @estado,
          error_resumen = @error
      WHERE id_evento = @idEvento;
    `;
    await executeQuery(updateQuery, {
      idEvento: { type: sql.BigInt, value: idEvento },
      estado: { type: sql.VarChar(15), value: error ? 'ERROR' : 'PROCESADO' },
      error: { type: sql.NVarChar(300), value: error ? error.substring(0, 300) : null },
    });
  } catch (err) {
    console.error("[Marcar Evento Error]:", err);
  }
}

// =========================================================================
// 4. ENVÍO OFICIAL DE MENSAJES VÍA GRAPH API DE META
// =========================================================================

export async function enviarMensajeWhatsAppOficial(params: {
  telefonoDestino: string; // ej "51948834920"
  texto: string;
}): Promise<{ success: boolean; wamid?: string; error?: string }> {
  const token = process.env.WHATSAPP_ACCESS_TOKEN?.trim();
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID?.trim();
  const version = process.env.WHATSAPP_API_VERSION?.trim() || "v21.0";
  const isDemo = process.env.WHATSAPP_DEMO_MODE === "true" || !token || token.trim() === "";

  if (isDemo) {
    console.log(`[WhatsApp DEMO OUT] Para: ${params.telefonoDestino} | Mensaje: ${params.texto}`);
    return {
      success: true,
      wamid: `wamid.DEMO_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    };
  }

  try {
    const telDigits = params.telefonoDestino.replace(/\D/g, "");
    const toPhone = telDigits.startsWith("51") ? telDigits : `51${telDigits}`;

    const url = `https://graph.facebook.com/${version}/${phoneId}/messages`;
    const payload = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: toPhone,
      type: "text",
      text: { preview_url: false, body: params.texto },
    };

    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });

    const data = await res.json();
    if (!res.ok) {
      console.error("[WhatsApp Cloud API Error]:", data);
      return { success: false, error: data?.error?.message || "Error al enviar mensaje vía Meta API" };
    }

    const wamid = data?.messages?.[0]?.id;
    return { success: true, wamid };
  } catch (err: any) {
    console.error("[WhatsApp Send Exception]:", err);
    return { success: false, error: err.message };
  }
}

// =========================================================================
// 5. RECEPCIÓN Y ASIGNACIÓN DEL CLIENTE / NEGOCIACIÓN / SESIÓN
// =========================================================================

export async function procesarMensajeEntranteMeta(params: {
  wamid: string;
  remitenteRaw: string;
  nombreContacto?: string;
  contenido: string;
  tipo?: string;
  opcionSeleccionada?: string;
}) {
  const telefonoNorm = normalizarTelefono(params.remitenteRaw);
  const telefonoConMas = `+51${telefonoNorm}`;

  // 1. Buscar en dbo.persona por teléfono
  const personaQuery = `
    SELECT TOP 1 p.id_persona, p.nombres, p.apellidos, p.fase_actual, p.id_segmento, s.nombre AS segmento_nombre
    FROM dbo.persona p
    LEFT JOIN dbo.segmento_cliente s ON s.id_segmento = p.id_segmento
    WHERE p.telefono = @tel 
       OR p.telefono = @telMas
       OR REPLACE(REPLACE(p.telefono, '+', ''), ' ', '') LIKE '%' + @telClean;
  `;
  const personas = await executeQuery<any>(personaQuery, {
    tel: { type: sql.VarChar(20), value: params.remitenteRaw },
    telMas: { type: sql.VarChar(20), value: telefonoConMas },
    telClean: { type: sql.VarChar(20), value: telefonoNorm },
  });

  const persona = personas[0] || null;

  // 2. Gestionar sesión de WhatsApp en dbo.sesion_whatsapp
  let idSesion: number;
  const sesionQuery = `
    SELECT TOP 1 id_sesion, id_persona, estado
    FROM dbo.sesion_whatsapp
    WHERE telefono_cliente = @tel OR telefono_cliente = @telClean
    ORDER BY fecha_ultimo_mensaje DESC;
  `;
  const sesiones = await executeQuery<any>(sesionQuery, {
    tel: { type: sql.VarChar(20), value: params.remitenteRaw },
    telClean: { type: sql.VarChar(20), value: telefonoNorm },
  });

  if (sesiones.length > 0) {
    idSesion = sesiones[0].id_sesion;
    // Actualizar fecha de último mensaje
    await executeQuery(
      `UPDATE dbo.sesion_whatsapp SET fecha_ultimo_mensaje = SYSUTCDATETIME() WHERE id_sesion = @idSesion;`,
      { idSesion: { type: sql.BigInt, value: idSesion } }
    );
  } else {
    // Crear nueva sesión vinculando a persona si existe
    const insertSesion = `
      INSERT INTO dbo.sesion_whatsapp (id_persona, telefono_cliente, fecha_inicio, fecha_ultimo_mensaje, estado, origen)
      VALUES (@idPersona, @tel, SYSUTCDATETIME(), SYSUTCDATETIME(), 'ABIERTA', 'WHATSAPP_CLOUD_API');
      SELECT SCOPE_IDENTITY() AS id_sesion;
    `;
    const resSes = await executeQuery<{ id_sesion: number }>(insertSesion, {
      idPersona: { type: sql.BigInt, value: persona?.id_persona || null },
      tel: { type: sql.VarChar(20), value: params.remitenteRaw },
    });
    idSesion = resSes[0].id_sesion;
  }

  // 3. Registrar mensaje entrante en dbo.mensaje_whatsapp
  const tipoMapeadoEntrante = mapearTipoMensaje(params.tipo);
  const insertMensaje = `
    INSERT INTO dbo.mensaje_whatsapp (id_sesion, wamid, direccion, tipo, contenido, opcion_seleccionada, fecha_mensaje, estado_entrega)
    VALUES (@idSesion, @wamid, 'ENTRANTE', @tipo, @contenido, @opcion, SYSUTCDATETIME(), 'RECIBIDO');
    SELECT SCOPE_IDENTITY() AS id_mensaje;
  `;
  const resMsg = await executeQuery<{ id_mensaje: number }>(insertMensaje, {
    idSesion: { type: sql.BigInt, value: idSesion },
    wamid: { type: sql.VarChar(200), value: params.wamid },
    tipo: { type: sql.VarChar(20), value: tipoMapeadoEntrante },
    contenido: { type: sql.NVarChar(sql.MAX), value: params.contenido },
    opcion: { type: sql.VarChar(50), value: params.opcionSeleccionada || null },
  });

  const idMensajeEntrante = resMsg[0].id_mensaje;

  // 4. Evaluar Negociación LEAD
  let idNegociacion: number | null = null;
  if (persona) {
    const negQuery = `
      SELECT TOP 1 id_negociacion, estado, nro_ciclo
      FROM dbo.negociacion
      WHERE id_persona = @idPersona
      ORDER BY nro_ciclo DESC;
    `;
    const negs = await executeQuery<any>(negQuery, {
      idPersona: { type: sql.BigInt, value: persona.id_persona },
    });

    if (negs.length > 0 && negs[0].estado === 'ABIERTA') {
      idNegociacion = negs[0].id_negociacion;
      // Asegurar que la negociación tenga vinculada la sesión
      await executeQuery(
        `UPDATE dbo.negociacion SET id_sesion_whatsapp = @idSesion WHERE id_negociacion = @idNeg;`,
        {
          idSesion: { type: sql.BigInt, value: idSesion },
          idNeg: { type: sql.BigInt, value: idNegociacion },
        }
      );
    }
  }

  // 5. Tarea asíncrona desacoplada: Generar respuesta inteligente del Agente IA
  // Si no está registrado como LEAD, invitar cordial al formulario de captación sin inventar negociación
  if (!persona || !idNegociacion) {
    const textoNoLead = `¡Hola! Bienvenido a Parrilladas El Establo 🥩🔥

Para darte promociones exclusivas y asesorarte a tu gusto, regístrate en segundos aquí:
👉 https://elestablo.pe/captacion

¡Apenas lo envíes, nuestro asesor te atenderá con los mejores cortes a la leña! 🤤🚀`;

    const envio = await enviarMensajeWhatsAppOficial({
      telefonoDestino: params.remitenteRaw,
      texto: textoNoLead,
    });

    if (envio.success) {
      await executeQuery(
        `INSERT INTO dbo.mensaje_whatsapp (id_sesion, wamid, direccion, tipo, contenido, fecha_mensaje, estado_entrega)
         VALUES (@idSesion, @wamid, 'SALIENTE', @tipo, @contenido, SYSUTCDATETIME(), 'ENVIADO');`,
        {
          idSesion: { type: sql.BigInt, value: idSesion },
          wamid: { type: sql.VarChar(200), value: envio.wamid || null },
          tipo: { type: sql.VarChar(20), value: mapearTipoMensaje('TEXTO') },
          contenido: { type: sql.NVarChar(sql.MAX), value: textoNoLead },
        }
      );
    }
    return;
  }

  // Lead identificado: invocar Agente IA
  try {
    const respuestaAgente = await procesarMensajeLead(idNegociacion, params.contenido, [
      { remitente: 'lead', texto: params.contenido },
    ]);

    // Enviar respuesta por WhatsApp
    const envio = await enviarMensajeWhatsAppOficial({
      telefonoDestino: params.remitenteRaw,
      texto: respuestaAgente.mensaje,
    });

    if (envio.success) {
      await executeQuery(
        `INSERT INTO dbo.mensaje_whatsapp (id_sesion, wamid, direccion, tipo, contenido, fecha_mensaje, estado_entrega)
         VALUES (@idSesion, @wamid, 'SALIENTE', @tipo, @contenido, SYSUTCDATETIME(), 'ENVIADO');`,
        {
          idSesion: { type: sql.BigInt, value: idSesion },
          wamid: { type: sql.VarChar(200), value: envio.wamid || null },
          tipo: { type: sql.VarChar(20), value: mapearTipoMensaje('TEXTO') },
          contenido: { type: sql.NVarChar(sql.MAX), value: respuestaAgente.mensaje },
        }
      );

      await toolRegistrarAccionAgente({
        id_negociacion: idNegociacion,
        id_sesion_whatsapp: idSesion,
        accion: 'RESPONDER_WHATSAPP_CLOUD_API',
        detalle: `Mensaje enviado a ${persona.nombres} vía Meta API`,
        resultado: 'EXITOSO',
      });
    }
  } catch (err: any) {
    console.error("[Error Procesando Respuesta de Agente IA]:", err);
  }
}

// =========================================================================
// 6. ACTUALIZACIÓN DE ESTADOS DE ENTREGA (Sent, Delivered, Read, Failed)
// =========================================================================

export async function actualizarEstadoMensajeMeta(params: {
  wamid: string;
  estado: "sent" | "delivered" | "read" | "failed";
  timestamp: string;
  error?: string;
}) {
  try {
    const estadoMap: Record<string, string> = {
      sent: "ENVIADO",
      delivered: "ENTREGADO",
      read: "LEIDO",
      failed: "FALLIDO",
    };

    const estadoDb = estadoMap[params.estado] || "DESCONOCIDO";

    const updateQuery = `
      UPDATE dbo.mensaje_whatsapp
      SET estado_entrega = @estado
      WHERE wamid = @wamid;
    `;
    await executeQuery(updateQuery, {
      estado: { type: sql.VarChar(20), value: estadoDb },
      wamid: { type: sql.VarChar(200), value: params.wamid },
    });
  } catch (err) {
    console.error("[Actualizar Estado Mensaje Error]:", err);
  }
}
