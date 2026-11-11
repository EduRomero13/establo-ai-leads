import { NextResponse } from "next/server";
import { executeQuery, sql } from "@/lib/db";
import { VwKpiMensual } from "@/types/database";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const anio = searchParams.get("anio");
    const mes = searchParams.get("mes");

    // 1. KPI Mensual oficial desde la vista dbo.vw_kpi_mensual
    let kpiQuery = `
      SELECT anio, mes, ciclos_lead, payers, perdidas, abiertas, tcp_horas, tasa_exito_ten, tasa_perdida_tpn
      FROM dbo.vw_kpi_mensual
      ORDER BY anio ASC, mes ASC;
    `;
    const kpiMensual = await executeQuery<VwKpiMensual>(kpiQuery);

    // 2. Conteo global diferenciando Ciclos vs Personas Únicas
    const resumenQuery = `
      SELECT 
        COUNT(DISTINCT n.id_negociacion) AS total_ciclos_lead,
        COUNT(DISTINCT n.id_persona) AS total_personas_unicas_lead,
        COUNT(DISTINCT CASE WHEN n.estado = 'CONVERTIDA' THEN n.id_persona END) AS personas_unicas_payers,
        SUM(CASE WHEN n.estado = 'CONVERTIDA' THEN 1 ELSE 0 END) AS total_payers_ciclos,
        SUM(CASE WHEN n.estado = 'ABIERTA' THEN 1 ELSE 0 END) AS total_abiertas,
        SUM(CASE WHEN n.estado = 'PERDIDA' THEN 1 ELSE 0 END) AS total_perdidas,
        CAST(AVG(CASE WHEN n.estado = 'CONVERTIDA' AND n.fecha_primer_pago IS NOT NULL 
             THEN DATEDIFF_BIG(SECOND, n.fecha_inicio, n.fecha_primer_pago) / 3600.0 END) AS DECIMAL(10,2)) AS tcp_global_horas,
        CAST(100.0 * SUM(CASE WHEN n.estado = 'CONVERTIDA' THEN 1 ELSE 0 END) / NULLIF(COUNT(*),0) AS DECIMAL(6,2)) AS ten_global,
        CAST(100.0 * SUM(CASE WHEN n.estado = 'PERDIDA' THEN 1 ELSE 0 END) / NULLIF(COUNT(*),0) AS DECIMAL(6,2)) AS tpn_global
      FROM dbo.negociacion n;
    `;
    const resumenGlobal = await executeQuery<any>(resumenQuery);

    // 3. Distribución por Segmento
    const segmentoQuery = `
      SELECT s.nombre AS segmento,
             COUNT(n.id_negociacion) AS ciclos_lead,
             SUM(CASE WHEN n.estado = 'CONVERTIDA' THEN 1 ELSE 0 END) AS convertidas,
             SUM(CASE WHEN n.estado = 'PERDIDA' THEN 1 ELSE 0 END) AS perdidas,
             SUM(CASE WHEN n.estado = 'ABIERTA' THEN 1 ELSE 0 END) AS abiertas
      FROM dbo.negociacion n
      JOIN dbo.persona p ON p.id_persona = n.id_persona
      LEFT JOIN dbo.segmento_cliente s ON s.id_segmento = p.id_segmento
      GROUP BY s.nombre;
    `;
    const leadsPorSegmento = await executeQuery<any>(segmentoQuery);

    // 4. Métricas complementarias del Agente IA (ofertas y tasa de aceptación)
    const agenteQuery = `
      SELECT 
        COUNT(*) AS total_ofertas,
        SUM(CASE WHEN respuesta = 'ACEPTADA' THEN 1 ELSE 0 END) AS ofertas_aceptadas,
        SUM(CASE WHEN respuesta = 'RECHAZADA' THEN 1 ELSE 0 END) AS ofertas_rechazadas,
        SUM(CASE WHEN respuesta = 'SIN_RESPUESTA' THEN 1 ELSE 0 END) AS ofertas_sin_respuesta,
        CAST(100.0 * SUM(CASE WHEN respuesta = 'ACEPTADA' THEN 1 ELSE 0 END) / NULLIF(COUNT(*),0) AS DECIMAL(6,2)) AS tasa_aceptacion_ofertas
      FROM dbo.oferta_negociacion;
    `;
    const agenteMetricas = await executeQuery<any>(agenteQuery);

    // 5. Total de acciones del agente
    const accionesQuery = `
      SELECT accion, resultado, COUNT(*) AS cantidad
      FROM dbo.accion_agente
      GROUP BY accion, resultado
      ORDER BY cantidad DESC;
    `;
    const accionesAgente = await executeQuery<any>(accionesQuery);

    return NextResponse.json({
      success: true,
      kpiMensual,
      resumenGlobal: resumenGlobal[0] || {},
      leadsPorSegmento,
      agenteMetricas: agenteMetricas[0] || {},
      accionesAgente,
    });
  } catch (error: any) {
    console.error("[API KPI Error]:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Error al obtener indicadores KPI" },
      { status: 500 }
    );
  }
}

