import { NextResponse } from "next/server";
import { toolGenerarRecomendaciones, toolRegistrarOferta } from "@/lib/ai-agent";
import { executeQuery } from "@/lib/db";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const idPersona = searchParams.get("personaId");

    if (idPersona) {
      const rec = await toolGenerarRecomendaciones(parseInt(idPersona, 10));
      return NextResponse.json({ success: true, recomendaciones: rec });
    }

    // Si no hay personaId, devolvemos vista panorámica de recomendaciones por segmento
    const topCortes = await executeQuery<any>(`SELECT * FROM dbo.vw_top_cortes_segmento ORDER BY unidades_vendidas DESC;`);
    const topCombos = await executeQuery<any>(`SELECT * FROM dbo.vw_top_combos_segmento ORDER BY unidades_vendidas DESC;`);
    const topProductos = await executeQuery<any>(`SELECT * FROM dbo.vw_top_productos_segmento ORDER BY unidades_vendidas DESC;`);
    const promosVigentes = await executeQuery<any>(`SELECT * FROM dbo.vw_promos_vigentes;`);

    return NextResponse.json({
      success: true,
      topCortes,
      topCombos,
      topProductos,
      promosVigentes,
    });
  } catch (error: any) {
    console.error("[API Recommendations Error]:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { id_negociacion, id_producto, id_combo, id_promocion, respuesta = 'SIN_RESPUESTA', detalle } = body;

    if (!id_negociacion || (!id_producto && !id_combo && !id_promocion)) {
      return NextResponse.json(
        { success: false, error: "Datos incompletos. Debe especificar id_negociacion y al menos un ítem ofertado" },
        { status: 400 }
      );
    }

    const idOferta = await toolRegistrarOferta(id_negociacion, {
      id_producto,
      id_combo,
      id_promocion,
      respuesta,
      detalle,
    });

    return NextResponse.json({
      success: true,
      id_oferta: idOferta,
      mensaje: `Oferta registrada con respuesta: ${respuesta}`,
    });
  } catch (error: any) {
    console.error("[API Recommendations POST Error]:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

