import { NextResponse } from "next/server";
import { executeQuery } from "@/lib/db";
import { getDiaLetraPeru, getFechaHoyPeru } from "@/lib/promotions-engine";

export async function GET() {
  try {
    // 1. Productos de la carta
    const productosQuery = `
      SELECT id_producto, nombre, categoria, descripcion, estilo, es_corte, peso_cantidad, peso_unidad, precio, activo
      FROM dbo.producto_carta
      ORDER BY categoria, nombre;
    `;
    const productos = await executeQuery<any>(productosQuery);

    // 2. Combos con sus componentes detallados
    const combosQuery = `
      SELECT id_combo, nombre, descripcion, precio, activo
      FROM dbo.combo
      ORDER BY nombre;
    `;
    const comboDetallesQuery = `
      SELECT cd.id_combo, cd.id_producto, cd.cantidad, pc.nombre AS producto_nombre, pc.es_corte, pc.peso_cantidad, pc.peso_unidad
      FROM dbo.combo_detalle cd
      JOIN dbo.producto_carta pc ON pc.id_producto = cd.id_producto;
    `;
    const combos = await executeQuery<any>(combosQuery);
    const comboDetalles = await executeQuery<any>(comboDetallesQuery);

    const combosConDetalle = combos.map(c => ({
      ...c,
      detalles: comboDetalles.filter(d => d.id_combo === c.id_combo),
    }));

    // 3. Promociones con sus ítems aplicables y segmento
    const promosQuery = `
      SELECT p.id_promocion, p.nombre_promocion, p.descripcion, p.tipo_beneficio, p.valor_beneficio,
             p.fecha_inicio, p.fecha_fin, p.dias_aplicables, p.id_segmento_objetivo,
             s.nombre AS segmento_objetivo_nombre, p.activa
      FROM dbo.promocion p
      LEFT JOIN dbo.segmento_cliente s ON s.id_segmento = p.id_segmento_objetivo
      ORDER BY p.nombre_promocion;
    `;
    const aplicablesQuery = `
      SELECT pa.id_aplicacion, pa.id_promocion, pa.id_producto, pa.id_combo, pa.categoria,
             pc.nombre AS producto_nombre, c.nombre AS combo_nombre
      FROM dbo.promocion_aplicable pa
      LEFT JOIN dbo.producto_carta pc ON pc.id_producto = pa.id_producto
      LEFT JOIN dbo.combo c ON c.id_combo = pa.id_combo;
    `;
    const promociones = await executeQuery<any>(promosQuery);
    const aplicables = await executeQuery<any>(aplicablesQuery);

    const diaActual = getDiaLetraPeru();
    const hoyStr = getFechaHoyPeru();

    const promosConDetalle = promociones.map(p => {
      const items = aplicables.filter(a => a.id_promocion === p.id_promocion);
      const inicioStr = (typeof p.fecha_inicio === "string" 
        ? p.fecha_inicio 
        : (p.fecha_inicio as any)?.toISOString?.() || String(p.fecha_inicio)).substring(0, 10);
      const finStr = p.fecha_fin 
        ? (typeof p.fecha_fin === "string" ? p.fecha_fin : (p.fecha_fin as any)?.toISOString?.() || String(p.fecha_fin)).substring(0, 10) 
        : null;

      const enFecha = hoyStr >= inicioStr && (!finStr || hoyStr <= finStr);
      const diaPermitido = p.dias_aplicables.trim().toUpperCase() === "TODOS" || p.dias_aplicables.includes(diaActual);
      const vigenteHoy = p.activa && enFecha && diaPermitido;

      return {
        ...p,
        aplicables: items,
        vigenteHoy,
        diaActualPeru: diaActual,
        fechaHoyPeru: hoyStr,
      };
    });

    return NextResponse.json({
      success: true,
      productos,
      combos: combosConDetalle,
      promociones: promosConDetalle,
    });
  } catch (error: any) {
    console.error("[API Catalog Error]:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

