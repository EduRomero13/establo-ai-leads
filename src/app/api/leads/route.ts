import { NextResponse } from "next/server";
import { executeQuery, sql } from "@/lib/db";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const busqueda = searchParams.get("q") || "";
    const estado = searchParams.get("estado") || "";
    const idSegmento = searchParams.get("segmento") || "";
    const caso = searchParams.get("caso") || "";

    let whereClauses: string[] = [];
    const params: Record<string, { type: any; value: any }> = {};

    if (busqueda.trim() !== "") {
      whereClauses.push(`(p.nombres LIKE @busqueda OR p.apellidos LIKE @busqueda OR p.telefono LIKE @busqueda OR p.email LIKE @busqueda)`);
      params.busqueda = { type: sql.NVarChar(100), value: `%${busqueda.trim()}%` };
    }

    if (estado && estado !== "TODOS") {
      whereClauses.push(`n.estado = @estado`);
      params.estado = { type: sql.VarChar(15), value: estado };
    }

    if (idSegmento && idSegmento !== "TODOS") {
      whereClauses.push(`p.id_segmento = @idSegmento`);
      params.idSegmento = { type: sql.Int, value: parseInt(idSegmento, 10) };
    }

    // Filtros de casos de demostración solicitados
    if (caso === "ana") {
      whereClauses.push(`p.nombres = 'Ana' AND p.apellidos = 'Ramirez'`);
    } else if (caso === "luis") {
      whereClauses.push(`p.nombres = 'Luis' AND p.apellidos = 'Torres'`);
    } else if (caso === "maria") {
      whereClauses.push(`p.nombres = 'Maria' AND p.apellidos = 'Paredes'`);
    } else if (caso === "sofia") {
      whereClauses.push(`p.nombres = 'Sofia' AND p.apellidos = 'Vargas'`);
    } else if (caso === "diego") {
      whereClauses.push(`p.nombres = 'Diego' AND p.apellidos = 'Flores'`);
    } else if (caso === "jorge") {
      whereClauses.push(`p.nombres = 'Jorge' AND p.apellidos = 'Mendoza'`);
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";

    const query = `
      SELECT 
        n.id_negociacion,
        n.id_persona,
        n.nro_ciclo,
        n.estado,
        n.motivo_perdida,
        n.detalle_perdida,
        n.fecha_inicio,
        n.fecha_fin,
        n.fecha_primer_pago,
        n.fecha_atencion,
        n.resumen,
        p.nombres AS persona_nombre,
        p.apellidos AS persona_apellidos,
        p.telefono,
        p.email,
        p.fecha_nacimiento,
        p.fase_actual,
        p.id_segmento,
        s.nombre AS segmento_nombre,
        n.id_pedido,
        pd.total AS total_pedido,
        pd.estado AS estado_pedido,
        n.id_sesion_whatsapp,
        -- Cálculo de horas de conversión para convertidas
        CAST(CASE WHEN n.fecha_primer_pago IS NOT NULL 
             THEN DATEDIFF_BIG(SECOND, n.fecha_inicio, n.fecha_primer_pago) / 3600.0 END AS DECIMAL(10,2)) AS horas_conversion,
        -- Cálculo de tiempo sin respuesta del cliente (desde último mensaje entrante o inicio)
        CAST(DATEDIFF_BIG(SECOND, COALESCE(ult_m.fecha_mensaje, n.fecha_inicio), SYSUTCDATETIME()) / 3600.0 AS DECIMAL(10,2)) AS horas_sin_respuesta,
        COALESCE(ult_m.contenido, n.resumen, 'Sin interacciones recientes') AS ultima_actividad_texto,
        COALESCE(ult_m.fecha_mensaje, n.fecha_inicio) AS ultima_actividad_fecha
      FROM dbo.negociacion n
      JOIN dbo.persona p ON p.id_persona = n.id_persona
      LEFT JOIN dbo.segmento_cliente s ON s.id_segmento = p.id_segmento
      LEFT JOIN dbo.pedido pd ON pd.id_pedido = n.id_pedido
      OUTER APPLY (
        SELECT TOP 1 m.fecha_mensaje, m.contenido, m.direccion
        FROM dbo.mensaje_whatsapp m
        WHERE m.id_sesion = n.id_sesion_whatsapp
        ORDER BY m.fecha_mensaje DESC
      ) ult_m
      ${whereSql}
      ORDER BY n.fecha_inicio DESC;
    `;

    const leads = await executeQuery<any>(query, params);

    // Segmentos para el filtro
    const segmentos = await executeQuery<any>(`SELECT id_segmento, nombre FROM dbo.segmento_cliente ORDER BY nombre;`);

    return NextResponse.json({
      success: true,
      leads,
      segmentos,
      total: leads.length,
    });
  } catch (error: any) {
    console.error("[API Leads Error]:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Error al obtener lista de leads" },
      { status: 500 }
    );
  }
}

