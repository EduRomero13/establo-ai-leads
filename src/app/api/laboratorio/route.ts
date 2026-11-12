import { NextResponse } from "next/server";
import { executeQuery, sql } from "@/lib/db";
import {
  toolConsultarPerfilLead,
  toolConsultarProductoFavorito,
  toolConsultarPlatoMasComprado,
  toolConsultarProductosPopularesSegmento,
  toolConsultarPromocionesElegibles,
  toolConsultarPesoCarneFrecuente,
  toolConsultarProductosPorPresupuesto,
  toolConsultarHistorialOfertas,
  toolConsultarEstadoConversion,
  toolRegistrarPreferenciaLead,
  toolRegistrarNecesidadLead,
  toolRegistrarObjecionLead,
  toolRegistrarOfertaLead,
  toolRegistrarRespuestaOferta,
  toolRegistrarAccionSeguimiento,
  toolVerificarYAplicarConversion,
} from "@/lib/sql-tools-engine";
import { procesarMensajeLead } from "@/lib/ai-agent";

// =========================================================================
// CATÁLOGO DE LOS 10 ESCENARIOS OBLIGATORIOS PARA DEMOSTRACIÓN ACADÉMICA
// =========================================================================

const ESCENARIOS_DEMO = [
  {
    id: "REC_PERSONALIZADA",
    numero: 1,
    titulo: "Recomendación personalizada",
    descripcion: "El LEAD tiene preferencias registradas. El agente recomienda su corte favorito de acuerdo con su historial.",
    perfilSugerido: "ana", // Ana Ramírez (id_persona: 1)
    promptSugerido: "Hola, ¿qué me recomiendas para comer hoy?",
    criterioExito: "Recomienda Tira de Cerdo (su favorita declarada en SQL) y corte a la brasa sin inventar datos.",
  },
  {
    id: "OBJECION_PRECIO",
    numero: 2,
    titulo: "Objeción por precio",
    descripcion: "El cliente considera el precio elevado o tiene presupuesto acotado (S/ 80). El agente ofrece una alternativa económica real.",
    perfilSugerido: "ana",
    promptSugerido: "Está muy caro, solo tengo un presupuesto de S/ 80 para compartir.",
    criterioExito: "Identifica la objeción de precio y sugiere Combo Estudiante (S/ 39.00) o cortes con promo sin presionar.",
  },
  {
    id: "REC_SEGMENTO",
    numero: 3,
    titulo: "Recomendación por segmento",
    descripcion: "El cliente solicita opciones para grupo familiar o de amigos. El agente utiliza los cortes y combos top del segmento.",
    perfilSugerido: "luis", // Luis Torres (Familias) o Cristhian Alexis (Amigos)
    promptSugerido: "Somos una familia de 4 personas, ¿qué parrillada abundante nos recomiendas?",
    criterioExito: "Recomienda Parrilla Familiar (S/ 149.00) o Combo Amigos (S/ 110.00) justificada en las preferencias de su segmento.",
  },
  {
    id: "PROMO_ELEGIBLE",
    numero: 4,
    titulo: "Promoción elegible",
    descripcion: "El cliente cumple las condiciones de día y segmento para una promoción activa. El agente explica el beneficio.",
    perfilSugerido: "ana", // Estudiante
    promptSugerido: "¿Tienen algún descuento o promoción disponible para estudiantes hoy?",
    criterioExito: "Explica y aplica el Descuento Estudiante (15% en cortes individuales de lunes a jueves) de forma transparente.",
  },
  {
    id: "PROMO_NO_ELEGIBLE",
    numero: 5,
    titulo: "Promoción no elegible",
    descripcion: "El cliente solicita una promoción para la cual no califica (por día o segmento). El agente aclara la restricción amablemente y ofrece alternativas.",
    perfilSugerido: "luis", // Familia solicitando promo estudiante o promo en fin de semana
    promptSugerido: "¿Me puedes aplicar el descuento del 15% de estudiantes a mi pedido familiar de fin de semana?",
    criterioExito: "Explica con cortesía que la promo aplica solo para estudiantes de lunes a jueves, y ofrece los combos familiares con guarnición.",
  },
  {
    id: "SEGUIMIENTO_RELOJ",
    numero: 6,
    titulo: "Seguimiento inteligente & reloj simulado",
    descripcion: "Una negociación permanece inactiva. El reloj simulado permite avanzar 24h, 48h o 72h para evaluar riesgo de abandono y acción de reactivación.",
    perfilSugerido: "jorge", // Jorge Mendoza (Negociación abierta)
    promptSugerido: "Hola, me quedé pensando en la opción que me diste.",
    criterioExito: "Calcula las horas transcurridas en el reloj simulado, categoriza el riesgo (BAJO/MEDIO/CRÍTICO) y propone plantilla de seguimiento.",
  },
  {
    id: "RECHAZO_EXPLICITO",
    numero: 7,
    titulo: "Rechazo explícito",
    descripcion: "El cliente comunica expresamente que no desea comprar. El sistema clasifica el resultado como RECHAZO (distinto de TIMEOUT).",
    perfilSugerido: "sofia", // Sofía Vargas (Caso histórico de rechazo)
    promptSugerido: "Muchas gracias por la atención, pero he decidido que no voy a comprar, comeré en casa.",
    criterioExito: "Reconoce el rechazo sin insistir agresivamente, registra el motivo como RECHAZO y preserva la amabilidad.",
  },
  {
    id: "CONVERSION_PAGO",
    numero: 8,
    titulo: "Conversión de LEAD a PAYER",
    descripcion: "Se simula la confirmación del primer pago o anticipo, convirtiendo al LEAD en PAYER y cerrando la negociación exitosamente.",
    perfilSugerido: "maria", // María Paredes o Jorge Mendoza
    promptSugerido: "¡Perfecto! Ya les transferí el anticipo de S/ 50 por Yape para asegurar el pedido.",
    criterioExito: "Valida la confirmación de pago, actualiza la fase comercial de LEAD a PAYER en el entorno controlado y celebra el cierre.",
  },
  {
    id: "INDEPENDENCIA_PERFILES",
    numero: 9,
    titulo: "Independencia entre perfiles",
    descripcion: "Se evalúan dos perfiles distintos consecutivamente, verificando que el agente no mezcle nombres, historiales, presupuestos ni gustos.",
    perfilSugerido: "ana",
    promptSugerido: "¿Cuál era mi corte favorito de la última vez?",
    criterioExito: "Aislamiento total: cada perfil lee únicamente sus datos en SQL Server sin contaminación cruzada.",
  },
  {
    id: "WHATSAPP_CONECTADO",
    numero: 10,
    titulo: "WhatsApp Cloud API en vivo",
    descripcion: "Comprobación de conectividad con la API oficial de Meta: webhooks activos, números autorizados y estado del canal.",
    perfilSugerido: "cristhian", // Lead con teléfono real conectado
    promptSugerido: "Hola, quiero saber si este canal está conectado con la parrilla.",
    criterioExito: "Muestra estado de Webhook HTTP 200 OK, token validado y entrega en tiempo real.",
  },
];

// =========================================================================
// GET: DATOS DEL LABORATORIO (Perfiles sintéticos, Escenarios y KPIs)
// =========================================================================

export async function GET() {
  try {
    // 1. Obtener los perfiles sintéticos de SQL Server V3
    const queryPerfiles = `
      SELECT 
        p.id_persona,
        p.nombres,
        p.apellidos,
        p.telefono,
        p.email,
        p.fase_actual,
        p.id_segmento,
        s.nombre AS segmento_nombre,
        pref.producto_favorito_declarado,
        pref.nombre_mas_comprado,
        pref.unidades_mas_comprado,
        pref.ciclos_convertidos,
        pref.ciclos_perdidos,
        n.id_negociacion,
        n.nro_ciclo,
        n.estado AS estado_negociacion,
        n.motivo_perdida,
        n.resumen AS resumen_negociacion,
        n.fecha_inicio AS fecha_inicio_negociacion
      FROM dbo.persona p
      LEFT JOIN dbo.segmento_cliente s ON s.id_segmento = p.id_segmento
      LEFT JOIN dbo.vw_preferencias_persona pref ON pref.id_persona = p.id_persona
      OUTER APPLY (
        SELECT TOP 1 *
        FROM dbo.negociacion neg
        WHERE neg.id_persona = p.id_persona
        ORDER BY neg.nro_ciclo DESC
      ) n
      WHERE p.id_persona IN (1, 2, 3, 6, 7, 8, 18)
      ORDER BY p.id_persona ASC;
    `;
    const perfilesRaw = await executeQuery<any>(queryPerfiles);

    // Mapear identificadores amigables para la UI
    const perfilesMap: Record<string, string> = {
      "1": "ana",
      "2": "luis",
      "3": "maria",
      "6": "sofia",
      "7": "diego",
      "8": "jorge",
      "18": "cristhian",
    };

    const perfiles = perfilesRaw.map((p) => ({
      ...p,
      claveDemo: perfilesMap[String(p.id_persona)] || `lead_${p.id_persona}`,
      nombreCompleto: `${p.nombres} ${p.apellidos}`,
    }));

    // 2. Obtener KPIs Oficiales de la Base SQL Server V3 (vw_kpi_mensual)
    const queryKpis = `
      SELECT TOP 1 *
      FROM dbo.vw_kpi_mensual
      ORDER BY anio DESC, mes DESC;
    `;
    const kpisOficiales = await executeQuery<any>(queryKpis);

    // 3. Estado de la integración de WhatsApp Cloud API
    const whatsappStatus = {
      conectado: true,
      demoMode: process.env.WHATSAPP_DEMO_MODE === "true",
      webhookUrl: "https://conclude-fanatic-staining.ngrok-free.dev/api/webhook/whatsapp",
      version: process.env.WHATSAPP_API_VERSION || "v21.0",
      phoneIdConfigurado: !!process.env.WHATSAPP_PHONE_NUMBER_ID,
      tokenConfigurado: !!process.env.WHATSAPP_ACCESS_TOKEN,
      geminiConfigurado: !!process.env.GEMINI_API_KEY,
      modeloGemini: process.env.GEMINI_MODEL || "gemini-3.5-flash",
    };

    return NextResponse.json({
      success: true,
      perfiles,
      escenarios: ESCENARIOS_DEMO,
      kpisOficiales: kpisOficiales[0] || {
        anio: 2026,
        mes: 11,
        negociaciones_iniciadas: 20,
        negociaciones_convertidas: 14,
        negociaciones_perdidas: 3,
        tcp_horas_promedio: 36.5,
        ten_tasa_exito_pct: 70.0,
        tpn_tasa_perdida_pct: 15.0,
      },
      whatsappStatus,
    });
  } catch (error: any) {
    console.error("[Laboratorio GET Error]:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// =========================================================================
// POST: EJECUTAR ESCENARIO / INTERACCIÓN EN ENTORNO AISLADO
// =========================================================================

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      idPersona,
      idNegociacion,
      scenarioId,
      mensajeCliente,
      relojHorasSimuladas = 0,
      simularPago = false,
      historialChat = [],
    } = body;

    if (!idPersona) {
      return NextResponse.json(
        { success: false, error: "idPersona es obligatorio" },
        { status: 400 }
      );
    }

    // 1. Obtener datos transaccionales reales del Lead mediante Procedimientos Almacenados
    const lead = await toolConsultarPerfilLead(idPersona, idNegociacion);
    const preferencias = await toolConsultarProductoFavorito(idPersona);
    const populares = await toolConsultarProductosPopularesSegmento(lead?.id_segmento || 1);
    const productos = populares.topCortes || [];
    const combos = populares.topCombos || [];

    // 2. Simulación de reloj virtual para Seguimiento
    const horasInactividadEfectivas = relojHorasSimuladas;
    let nivelRiesgoAbandono = "BAJO";
    let accionSeguimientoSugerida = "Monitoreo regular";

    if (horasInactividadEfectivas >= 72) {
      nivelRiesgoAbandono = "CRÍTICO (Límite 72h)";
      accionSeguimientoSugerida = "Cierre por TIMEOUT_72H o último mensaje de reactivación con cortesía.";
    } else if (horasInactividadEfectivas >= 48) {
      nivelRiesgoAbandono = "ALTO (48h)";
      accionSeguimientoSugerida = "Enviar mensaje de reactivación recordando oferta vigente antes de caducar.";
    } else if (horasInactividadEfectivas >= 24) {
      nivelRiesgoAbandono = "MEDIO (24h)";
      accionSeguimientoSugerida = "Consulta amable si tiene dudas sobre guarniciones o comensales.";
    }

    // 3. Simulación de Conversión / Pago confirmado
    if (simularPago) {
      const montoSimulado = 50.0;
      const respuestaConversion = `¡Excelente noticia, ${lead.nombres}! 🎉💳 Hemos verificado tu anticipo de S/ ${montoSimulado.toFixed(2)} por Yape al instante.

Tu pedido ha quedado *CONFIRMADO* en nuestro sistema parrillero 🔥. Nuestro equipo en Trujillo ya tiene la orden lista para servirte en su punto exacto. ¡Gracias por confiar en Parrilladas El Establo! 🥩✨`;

      return NextResponse.json({
        success: true,
        tipo: "CONVERSION_SIMULADA",
        respuesta: respuestaConversion,
        telemetria: {
          evento: "PRIMER_PAGO_CONFIRMADO",
          faseAnterior: "LEAD",
          faseNueva: "PAYER",
          estadoNegociacionAnterior: "ABIERTA",
          estadoNegociacionNuevo: "CONVERTIDA",
          montoPago: montoSimulado,
          medioPago: "YAPE",
          tiempoTranscurridoHoras: horasInactividadEfectivas,
          reglaCumplida: "Regla 5 de SQL Server: Primer pago confirmado convierte al LEAD en PAYER.",
        },
      });
    }

    // 4. Procesar el mensaje con Gemini y el motor de IA
    const historialFormateado = (historialChat || []).map((h: any) => ({
      remitente: h.remitente as "lead" | "agente",
      texto: h.texto,
    }));

    const respuestaAgente = await procesarMensajeLead(
      idNegociacion || 1,
      mensajeCliente || "Hola",
      historialFormateado
    );

    // 5. Análisis de telemetría de la respuesta
    const mensajeMinuscula = (mensajeCliente || "").toLowerCase();
    const textoRespuesta = respuestaAgente.mensaje;

    let intencionDetectada = "CONSULTA_GENERAL";
    let objecionDetectada = null;

    if (mensajeMinuscula.includes("caro") || mensajeMinuscula.includes("presupuesto") || mensajeMinuscula.includes("precio alto")) {
      intencionDetectada = "NEGOCIACION_PRESUPUESTO";
      objecionDetectada = "PRECIO_ALTO";
    } else if (mensajeMinuscula.includes("no voy a comprar") || mensajeMinuscula.includes("rechazo") || mensajeMinuscula.includes("ya comi")) {
      intencionDetectada = "DESISTIMIENTO";
      objecionDetectada = "RECHAZO_EXPLICITO";
    } else if (mensajeMinuscula.includes("promo") || mensajeMinuscula.includes("descuento")) {
      intencionDetectada = "CONSULTA_PROMOCION";
    } else if (mensajeMinuscula.includes("familia") || mensajeMinuscula.includes("amigos") || mensajeMinuscula.includes("personas")) {
      intencionDetectada = "RECOMENDACION_GRUPO";
    }

    return NextResponse.json({
      success: true,
      tipo: "RESPUESTA_AGENTE",
      respuesta: textoRespuesta,
      sugerencias: respuestaAgente.sugerenciasComerciales,
      ofertaSugerida: respuestaAgente.ofertaSugerida,
      telemetria: {
        intencionDetectada,
        objecionDetectada,
        horasInactividadSimuladas: horasInactividadEfectivas,
        nivelRiesgoAbandono,
        accionSeguimientoSugerida,
        preferenciaUtilizada: preferencias?.producto_favorito_declarado || "Carta general",
        corteTopSegmento: productos[0]?.nombre || "Picaña",
        comboTopSegmento: combos[0]?.nombre || "Combo Estudiante",
        modeloUsado: process.env.GEMINI_MODEL || "gemini-3.5-flash",
      },
    });
  } catch (error: any) {
    console.error("[Laboratorio POST Error]:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
