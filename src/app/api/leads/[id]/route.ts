import { NextResponse } from "next/server";
import { executeQuery, sql } from "@/lib/db";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const idNegociacion = parseInt(id, 10);

    if (isNaN(idNegociacion)) {
      return NextResponse.json({ success: false, error: "ID de negociación no válido" }, { status: 400 });
    }

    // 1. Negociación y Persona
    const negQuery = `
      SELECT 
        n.id_negociacion, n.id_persona, n.nro_ciclo, n.estado, n.motivo_perdida, n.detalle_perdida,
        n.fecha_inicio, n.fecha_fin, n.fecha_primer_pago, n.fecha_atencion, n.resumen,
        n.id_sesion_whatsapp, n.id_formulario, n.id_pedido,
        p.nombres, p.apellidos, p.telefono, p.email, p.fecha_nacimiento, p.fase_actual, p.fecha_registro,
        p.consentimiento_datos_fecha, p.consentimiento_marketing_fecha,
        p.id_segmento, s.nombre AS segmento_nombre, s.descripcion AS segmento_descripcion
      FROM dbo.negociacion n
      JOIN dbo.persona p ON p.id_persona = n.id_persona
      LEFT JOIN dbo.segmento_cliente s ON s.id_segmento = p.id_segmento
      WHERE n.id_negociacion = @idNegociacion;
    `;
    const negRes = await executeQuery<any>(negQuery, {
      idNegociacion: { type: sql.BigInt, value: idNegociacion },
    });

    if (negRes.length === 0) {
      return NextResponse.json({ success: false, error: "Negociación no encontrada" }, { status: 404 });
    }

    const negociacion = negRes[0];
    const idPersona = negociacion.id_persona;

    // 2. Preferencias desde vw_preferencias_persona
    const prefQuery = `
      SELECT * FROM dbo.vw_preferencias_persona WHERE id_persona = @idPersona;
    `;
    const prefRes = await executeQuery<any>(prefQuery, {
      idPersona: { type: sql.BigInt, value: idPersona },
    });

    // 3. Formulario de Captación (si existe)
    const formQuery = `
      SELECT f.id_formulario, f.fecha_envio, f.acepta_politica_datos, f.acepta_marketing,
             pc.nombre AS producto_favorito_nombre, seg.nombre AS segmento_declarado_nombre,
             plat.nombre_pagina AS plataforma_origen
      FROM dbo.formulario_captacion f
      LEFT JOIN dbo.producto_carta pc ON pc.id_producto = f.id_producto_favorito
      LEFT JOIN dbo.segmento_cliente seg ON seg.id_segmento = f.id_segmento_declarado
      LEFT JOIN dbo.plataforma plat ON plat.id_plataforma = f.id_plataforma_origen
      WHERE f.id_persona = @idPersona
      ORDER BY f.fecha_envio DESC;
    `;
    const formularios = await executeQuery<any>(formQuery, {
      idPersona: { type: sql.BigInt, value: idPersona },
    });

    // 4. Historial de Fases y Recurrencia
    const vecesFaseQuery = `
      SELECT fase, veces, primera_vez, ultima_vez 
      FROM dbo.vw_veces_fase_persona 
      WHERE id_persona = @idPersona;
    `;
    const historialFasesQuery = `
      SELECT h.id_historial, h.fase, h.fecha_cambio, h.id_negociacion, h.id_pedido
      FROM dbo.historial_fases h
      WHERE h.id_persona = @idPersona
      ORDER BY h.fecha_cambio ASC;
    `;
    const todasNegociacionesQuery = `
      SELECT n.id_negociacion, n.nro_ciclo, n.estado, n.motivo_perdida, n.fecha_inicio, n.fecha_fin, n.fecha_primer_pago, n.resumen
      FROM dbo.negociacion n
      WHERE n.id_persona = @idPersona
      ORDER BY n.nro_ciclo ASC;
    `;
    const vecesFase = await executeQuery<any>(vecesFaseQuery, { idPersona: { type: sql.BigInt, value: idPersona } });
    const historialFases = await executeQuery<any>(historialFasesQuery, { idPersona: { type: sql.BigInt, value: idPersona } });
    const todasNegociaciones = await executeQuery<any>(todasNegociacionesQuery, { idPersona: { type: sql.BigInt, value: idPersona } });

    // 5. Conversaciones de WhatsApp (si tiene sesión asociada)
    let mensajes: any[] = [];
    if (negociacion.id_sesion_whatsapp) {
      const msgQuery = `
        SELECT m.id_mensaje, m.id_sesion, m.wamid, m.direccion, m.tipo, m.contenido, m.opcion_seleccionada, m.fecha_mensaje, m.estado_entrega
        FROM dbo.mensaje_whatsapp m
        WHERE m.id_sesion = @idSesion
        ORDER BY m.fecha_mensaje ASC;
      `;
      mensajes = await executeQuery<any>(msgQuery, {
        idSesion: { type: sql.BigInt, value: negociacion.id_sesion_whatsapp },
      });
    }

    // 6. Ofertas y Recomendaciones registradas en esta negociación
    const ofertasQuery = `
      SELECT o.id_oferta, o.fecha_oferta, o.respuesta, o.detalle,
             o.id_producto, pc.nombre AS producto_nombre, pc.precio AS producto_precio,
             o.id_combo, c.nombre AS combo_nombre, c.precio AS combo_precio,
             o.id_promocion, pr.nombre_promocion, pr.descripcion AS promo_desc, pr.tipo_beneficio, pr.valor_beneficio
      FROM dbo.oferta_negociacion o
      LEFT JOIN dbo.producto_carta pc ON pc.id_producto = o.id_producto
      LEFT JOIN dbo.combo c ON c.id_combo = o.id_combo
      LEFT JOIN dbo.promocion pr ON pr.id_promocion = o.id_promocion
      WHERE o.id_negociacion = @idNegociacion
      ORDER BY o.fecha_oferta DESC;
    `;
    const ofertas = await executeQuery<any>(ofertasQuery, {
      idNegociacion: { type: sql.BigInt, value: idNegociacion },
    });

    // 7. Conversión, Pedido y Pagos asociados
    let pedidoInfo: any = null;
    let pagos: any[] = [];
    let reservaInfo: any = null;

    if (negociacion.id_pedido) {
      const pedQuery = `
        SELECT p.id_pedido, p.tipo, p.fecha_registro, p.estado, p.fecha_atencion,
               p.subtotal, p.descuento, p.total, p.id_promocion,
               pr.nombre_promocion
        FROM dbo.pedido p
        LEFT JOIN dbo.promocion pr ON pr.id_promocion = p.id_promocion
        WHERE p.id_pedido = @idPedido;
      `;
      const pedDetQuery = `
        SELECT pd.id_detalle, pd.cantidad, pd.precio_unitario,
               COALESCE(pc.nombre, c.nombre) AS item_nombre,
               COALESCE(pc.precio, c.precio) AS item_precio_catalogo,
               CASE WHEN pd.id_producto IS NOT NULL THEN 'PRODUCTO' ELSE 'COMBO' END AS tipo_item
        FROM dbo.pedido_detalle pd
        LEFT JOIN dbo.producto_carta pc ON pc.id_producto = pd.id_producto
        LEFT JOIN dbo.combo c ON c.id_combo = pd.id_combo
        WHERE pd.id_pedido = @idPedido;
      `;
      const pagoQuery = `
        SELECT pg.id_pago, pg.monto, pg.moneda, pg.fecha_pago, pg.estado, pg.referencia,
               mp.codigo AS medio_pago_codigo, mp.nombre AS medio_pago_nombre
        FROM dbo.pago pg
        JOIN dbo.medio_pago mp ON mp.id_medio_pago = pg.id_medio_pago
        WHERE pg.id_pedido = @idPedido
        ORDER BY pg.fecha_pago ASC;
      `;
      const resQuery = `
        SELECT id_reserva, fecha_reserva, nro_personas, estado
        FROM dbo.reserva
        WHERE id_pedido = @idPedido;
      `;

      const pedRes = await executeQuery<any>(pedQuery, { idPedido: { type: sql.BigInt, value: negociacion.id_pedido } });
      const detRes = await executeQuery<any>(pedDetQuery, { idPedido: { type: sql.BigInt, value: negociacion.id_pedido } });
      pagos = await executeQuery<any>(pagoQuery, { idPedido: { type: sql.BigInt, value: negociacion.id_pedido } });
      const rRes = await executeQuery<any>(resQuery, { idPedido: { type: sql.BigInt, value: negociacion.id_pedido } });

      if (pedRes.length > 0) {
        pedidoInfo = {
          ...pedRes[0],
          detalles: detRes,
        };
      }
      if (rRes.length > 0) {
        reservaInfo = rRes[0];
      }
    }

    // 8. Acciones de Auditoría del Agente
    const accionesQuery = `
      SELECT a.id_accion, a.accion, a.detalle, a.resultado, a.fecha_ejecucion,
             per.nombres AS agente_nombres, per.cargo AS agente_cargo
      FROM dbo.accion_agente a
      JOIN dbo.personal per ON per.id_personal = a.id_personal
      WHERE a.id_negociacion = @idNegociacion OR a.id_sesion_whatsapp = @idSesion
      ORDER BY a.fecha_ejecucion DESC;
    `;
    const acciones = await executeQuery<any>(accionesQuery, {
      idNegociacion: { type: sql.BigInt, value: idNegociacion },
      idSesion: { type: sql.BigInt, value: negociacion.id_sesion_whatsapp || 0 },
    });

    return NextResponse.json({
      success: true,
      perfil: {
        negociacion,
        preferencias: prefRes[0] || null,
        formularios,
        recurrencia: {
          vecesFase,
          historialFases,
          todasNegociaciones,
        },
        conversaciones: mensajes,
        ofertas,
        conversion: {
          primerPagoConfirmado: pagos.find(p => p.estado === 'CONFIRMADO') || null,
          pedido: pedidoInfo,
          pagos,
          reserva: reservaInfo,
        },
        acciones,
      },
    });
  } catch (error: any) {
    console.error("[API Lead Detalle Error]:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Error al obtener perfil del lead" },
      { status: 500 }
    );
  }
}

