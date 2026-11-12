import { NextResponse } from "next/server";
import { checkDbHealth } from "@/lib/db";

export async function GET() {
  try {
    const dbHealth = await checkDbHealth();

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
        proveedor: "Google Gemini / Copiloto Heurístico Experto",
        modelo: process.env.GEMINI_MODEL || "gemini-1.5-flash",
        apiKeyConfigurada: Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== "DEMO"),
        modoActual: process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== "DEMO" 
          ? "Gemini API en Vivo" 
          : "Modo Demostración Inteligente Autónomo (Heurístico con Reglas de Negocio V3)",
      },
      whatsapp: {
        modo: process.env.WHATSAPP_DEMO_MODE === "false" ? "API Cloud Oficial" : "Motor Comercial El Establo",
        webhookVerificado: true,
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

