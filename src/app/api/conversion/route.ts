import { NextResponse } from "next/server";
import { executeQuery } from "@/lib/db";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const idNegociacion = searchParams.get("negociacionId");

    if (idNegociacion) {
      const query = `
        SELECT 
          n.id_negociacion, n.id_persona, n.nro_ciclo, n.estado AS estado_negociacion,
          n.fecha_inicio, n.fecha_primer_pago,
          CAST(CASE WHEN n.fecha_primer_pago IS NOT NULL 
               THEN DATEDIFF_BIG(SECOND, n.fecha_inicio, n.fecha_primer_pago) / 3600.0 END AS DECIMAL(10,2)) AS horas_conversion,
          p.nombres, p.apellidos, p.fase_actual,
          pd.id_pedido, pd.tipo AS tipo_pedido, pd.estado AS estado_pedido, pd.total, pd.subtotal, pd.descuento,
          pg.id_pago, pg.monto, pg.fecha_pago, pg.estado AS estado_pago, pg.referencia,
          mp.codigo AS medio_pago
        FROM dbo.negociacion n
        JOIN dbo.persona p ON p.id_persona = n.id_persona
        LEFT JOIN dbo.pedido pd ON pd.id_pedido = n.id_pedido
        LEFT JOIN dbo.pago pg ON pg.id_pedido = pd.id_pedido
        LEFT JOIN dbo.medio_pago mp ON mp.id_medio_pago = pg.id_medio_pago
        WHERE n.id_negociacion = @idNegociacion;
      `;
      const data = await executeQuery<any>(query, {
        idNegociacion: { type: (await import("mssql")).BigInt, value: parseInt(idNegociacion, 10) },
      });

      return NextResponse.json({ success: true, detalle: data });
    }

    // Listado general de conversiones con desglose de primer pago y saldos
    const conversionesQuery = `
      SELECT 
        n.id_negociacion,
        n.id_persona,
        n.nro_ciclo,
        p.nombres,
        p.apellidos,
        p.telefono,
        p.email,
        s.nombre AS segmento_nombre,
        n.fecha_inicio,
        n.fecha_primer_pago,
        CAST(DATEDIFF_BIG(SECOND, n.fecha_inicio, n.fecha_primer_pago) / 3600.0 AS DECIMAL(10,2)) AS tcp_horas_ciclo,
        pd.id_pedido,
        pd.tipo AS tipo_pedido,
        pd.estado AS estado_pedido,
        pd.total AS total_pedido,
        primer_pg.id_pago AS id_primer_pago,
        primer_pg.monto AS monto_primer_pago,
        primer_pg.fecha_pago AS fecha_primer_pago_real,
        primer_pg.estado AS estado_primer_pago,
        primer_pg.referencia AS referencia_pago,
        mp.codigo AS medio_pago_codigo,
        mp.nombre AS medio_pago_nombre,
        ps.pagado_confirmado,
        ps.saldo_pendiente,
        res.nro_personas AS reserva_personas,
        res.estado AS reserva_estado
      FROM dbo.negociacion n
      JOIN dbo.persona p ON p.id_persona = n.id_persona
      LEFT JOIN dbo.segmento_cliente s ON s.id_segmento = p.id_segmento
      JOIN dbo.pedido pd ON pd.id_pedido = n.id_pedido
      LEFT JOIN dbo.vw_pedido_saldo ps ON ps.id_pedido = pd.id_pedido
      LEFT JOIN dbo.reserva res ON res.id_pedido = pd.id_pedido
      OUTER APPLY (
        SELECT TOP 1 q.id_pago, q.id_medio_pago, q.monto, q.fecha_pago, q.estado, q.referencia
        FROM dbo.pago q
        WHERE q.id_pedido = pd.id_pedido AND q.estado IN ('CONFIRMADO', 'REEMBOLSADO')
        ORDER BY q.fecha_pago ASC, q.id_pago ASC
      ) primer_pg
      LEFT JOIN dbo.medio_pago mp ON mp.id_medio_pago = primer_pg.id_medio_pago
      WHERE n.estado = 'CONVERTIDA'
      ORDER BY n.fecha_primer_pago DESC;
    `;

    const conversiones = await executeQuery<any>(conversionesQuery);

    return NextResponse.json({
      success: true,
      conversiones,
      total: conversiones.length,
    });
  } catch (error: any) {
    console.error("[API Conversion Error]:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

