import { NextResponse } from "next/server";
import { checkDbHealth } from "@/lib/db";

export async function GET() {
  try {
    const dbHealth = await checkDbHealth();

    const hermesUrl = process.env.HERMES_API_URL?.trim() || "";
    const hermesKey = process.env.HERMES_API_KEY?.trim() || "";
    const hermesModel = process.env.HERMES_MODEL?.trim() || "hermes-agent";
    const hermesConfigurado = Boolean(hermesUrl && hermesKey);

    const whapiToken = process.env.WHAPI_TOKEN?.trim() || "";
    const metaToken = process.env.WHATSAPP_ACCESS_TOKEN?.trim() || "";
    const proveedorWhatsApp = whapiToken
      ? "WHAPI"
      : metaToken
        ? "META_CLOUD_API"
        : "DEMO";

    const configInfo = {
      sistema: {
        nombre: "ESTABLO AI — Sistema Inteligente de Gestión y Conversión de LEADS",
        version: "3.0.0 (SQL Server V3)",
        restaurante: "Parrilladas El Establo",
        ciudad: "Trujillo, Perú",
        faseEnfoque: "LEADS (BUYER -> LEAD -> PAYER -> CUSTOMER)",
      },
      baseDeDatos: {
        motor: "Microsoft SQL Server",
        base: process.env.DB_NAME || "buyer",
        servidor: process.env.DB_SERVER || "127.0.0.1",
        puerto: process.env.DB_PORT || "1434",
        usuario: process.env.DB_USER || "establo_app",
        conectado: dbHealth.connected,
        tablasDetectadas: dbHealth.tableCount || 0,
        error: dbHealth.error || null,
        kpiMensualDetectado: dbHealth.kpiSummary || [],
      },
      inteligenciaArtificial: {
        proveedor: "Hermes Agent / Copiloto Heurístico Experto",
        hermesConfigurado,
        hermesUrl: hermesConfigurado ? hermesUrl : null,
        modelo: hermesModel,
        timeoutMs: Number(process.env.HERMES_TIMEOUT_MS || 45000),
        motorActual: hermesConfigurado ? "HERMES (con respaldo heurístico)" : "HEURISTICO",
        modoActual: hermesConfigurado
          ? "Hermes Agent en Vivo"
          : "Modo Demostración Inteligente Autónomo (Heurístico con Reglas de Negocio V3)",
      },
      whatsapp: {
        proveedor: proveedorWhatsApp,
        modo:
          proveedorWhatsApp === "WHAPI"
            ? "Whapi.Cloud (gate.whapi.cloud)"
            : proveedorWhatsApp === "META_CLOUD_API"
              ? "WhatsApp Cloud API Oficial (Meta)"
              : "Modo Demostración (sin envío real)",
        webhookPath: "/api/webhook/whapi",
        webhookTokenConfigurado: Boolean(
          (process.env.WHAPI_WEBHOOK_TOKEN || process.env.WHAPI_WEBHOOK_SECRET || "").trim(),
        ),
        canalNegociacion: "sesion_whatsapp + mensaje_whatsapp",
      },
      reglasNegocio: {
        metaTcpHoras: 48,
        metaTenPorcentaje: 30,
        metaTpnPorcentajeMax: 40,
        horasTimeoutPerdida: 72,
        zonaHoraria: process.env.TZ || "America/Lima",
        promocionesMaxPorPedido: 1,
      },
    };

    return NextResponse.json({ success: true, config: configInfo });
  } catch (error: any) {
    console.error("[API Config Error]:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
