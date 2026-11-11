import { executeQuery, sql } from "./db";
import { Persona, ProductoCarta, Combo, Promocion, OfertaNegociacion } from "@/types/database";
import { evaluarPromocion } from "./promotions-engine";

// -------------------------------------------------------------
// HERRAMIENTAS CONTROLADAS DEL AGENTE IA (Consultas a SQL Server)
// -------------------------------------------------------------

export async function toolConsultarLead(idPersona: number) {
  const query = `
    SELECT p.id_persona, p.nombres, p.apellidos, p.telefono, p.email, p.fecha_nacimiento,
           p.id_segmento, s.nombre AS segmento, p.fase_actual, p.fecha_registro
    FROM dbo.persona p
    LEFT JOIN dbo.segmento_cliente s ON s.id_segmento = p.id_segmento
    WHERE p.id_persona = @idPersona;
  `;
  const res = await executeQuery<any>(query, {
    idPersona: { type: sql.BigInt, value: idPersona },
  });
  return res[0] || null;
}

export async function toolConsultarPreferencias(idPersona: number) {
  const query = `
    SELECT * FROM dbo.vw_preferencias_persona WHERE id_persona = @idPersona;
  `;
  const res = await executeQuery<any>(query, {
    idPersona: { type: sql.BigInt, value: idPersona },
  });
  return res[0] || null;
}

export async function toolConsultarHistorial(idPersona: number) {
  const queryFases = `
    SELECT fase, veces, primera_vez, ultima_vez 
    FROM dbo.vw_veces_fase_persona 
    WHERE id_persona = @idPersona
    ORDER BY primera_vez ASC;
  `;
  const queryNegociaciones = `
    SELECT id_negociacion, nro_ciclo, estado, motivo_perdida, fecha_inicio, fecha_fin, fecha_primer_pago, resumen
    FROM dbo.negociacion
    WHERE id_persona = @idPersona
    ORDER BY nro_ciclo DESC;
  `;
  const fases = await executeQuery<any>(queryFases, {
    idPersona: { type: sql.BigInt, value: idPersona },
  });
  const negociaciones = await executeQuery<any>(queryNegociaciones, {
    idPersona: { type: sql.BigInt, value: idPersona },
  });
  return { fases, negociaciones };
}

export async function toolConsultarProductos(soloCortes: boolean = false) {
  let query = `
    SELECT id_producto, nombre, categoria, descripcion, estilo, es_corte, peso_cantidad, peso_unidad, precio
    FROM dbo.producto_carta
    WHERE activo = 1
  `;
  if (soloCortes) {
    query += " AND es_corte = 1";
  }
  query += " ORDER BY precio ASC;";
  return await executeQuery<ProductoCarta>(query);
}

export async function toolConsultarCombos() {
  const queryCombos = `
    SELECT id_combo, nombre, descripcion, precio FROM dbo.combo WHERE activo = 1 ORDER BY precio ASC;
  `;
  const queryDetalles = `
    SELECT cd.id_combo, cd.id_producto, cd.cantidad, pc.nombre AS producto_nombre, pc.es_corte, pc.peso_cantidad, pc.peso_unidad
    FROM dbo.combo_detalle cd
    JOIN dbo.producto_carta pc ON pc.id_producto = cd.id_producto;
  `;
  const combos = await executeQuery<any>(queryCombos);
  const detalles = await executeQuery<any>(queryDetalles);

  return combos.map(c => ({
    ...c,
    detalles: detalles.filter(d => d.id_combo === c.id_combo),
  }));
}

export async function toolConsultarPromocionesElegibles(idPersona: number, fechaRef: Date = new Date()) {
  const persona = await toolConsultarLead(idPersona);
  if (!persona) return [];

  // Obtener promociones con sus aplicables
  const promosQuery = `
    SELECT p.id_promocion, p.nombre_promocion, p.descripcion, p.tipo_beneficio,
           p.valor_beneficio, p.fecha_inicio, p.fecha_fin, p.dias_aplicables,
           p.id_segmento_objetivo, s.nombre AS segmento_nombre, p.activa
    FROM dbo.promocion p
    LEFT JOIN dbo.segmento_cliente s ON s.id_segmento = p.id_segmento_objetivo
    WHERE p.activa = 1;
  `;
  const aplicablesQuery = `
    SELECT pa.id_aplicacion, pa.id_promocion, pa.id_producto, pa.id_combo, pa.categoria,
           pc.nombre AS producto_nombre, c.nombre AS combo_nombre
    FROM dbo.promocion_aplicable pa
    LEFT JOIN dbo.producto_carta pc ON pc.id_producto = pa.id_producto
    LEFT JOIN dbo.combo c ON c.id_combo = pa.id_combo;
  `;

  const promos = await executeQuery<Promocion>(promosQuery);
  const aplicables = await executeQuery<any>(aplicablesQuery);

  const elegibles: any[] = [];

  for (const promo of promos) {
    promo.aplicables = aplicables.filter(a => a.id_promocion === promo.id_promocion);
    const validacion = evaluarPromocion(promo, persona, undefined, fechaRef);
    if (validacion.esElegible) {
      elegibles.push({
        ...promo,
        ahorroEstimado: validacion.ahorroEstimado,
      });
    }
  }

  return elegibles;
}

export async function toolGenerarRecomendaciones(idPersona: number) {
  const persona = await toolConsultarLead(idPersona);
  if (!persona) return null;

  const preferencias = await toolConsultarPreferencias(idPersona);
  const idSegmento = persona.id_segmento;

  // 1. Cortes favoritos del segmento
  const cortesSegmentoQuery = `
    SELECT * FROM dbo.vw_top_cortes_segmento 
    WHERE id_segmento = @idSegmento 
    ORDER BY unidades_vendidas DESC;
  `;
  const cortesSegmento = idSegmento ? await executeQuery<any>(cortesSegmentoQuery, {
    idSegmento: { type: sql.Int, value: idSegmento },
  }) : [];

  // 2. Combos del segmento
  const combosSegmentoQuery = `
    SELECT * FROM dbo.vw_top_combos_segmento 
    WHERE id_segmento = @idSegmento 
    ORDER BY unidades_vendidas DESC;
  `;
  const combosSegmento = idSegmento ? await executeQuery<any>(combosSegmentoQuery, {
    idSegmento: { type: sql.Int, value: idSegmento },
  }) : [];

  // 3. Promociones elegibles
  const promocionesElegibles = await toolConsultarPromocionesElegibles(idPersona);

  // 4. Últimas ofertas previas de este lead para no repetir ofertas rechazadas
  const ofertasPreviasQuery = `
    SELECT o.id_producto, o.id_combo, o.id_promocion, o.respuesta, o.fecha_oferta
    FROM dbo.oferta_negociacion o
    JOIN dbo.negociacion n ON n.id_negociacion = o.id_negociacion
    WHERE n.id_persona = @idPersona
    ORDER BY o.fecha_oferta DESC;
  `;
  const ofertasPrevias = await executeQuery<any>(ofertasPreviasQuery, {
    idPersona: { type: sql.BigInt, value: idPersona },
  });

  return {
    persona,
    preferencias,
    topCortes: cortesSegmento,
    topCombos: combosSegmento,
    promocionesElegibles,
    ofertasPrevias,
  };
}

export async function toolRegistrarOferta(
  idNegociacion: number,
  params: {
    id_producto?: number;
    id_combo?: number;
    id_promocion?: number;
    respuesta?: 'ACEPTADA' | 'RECHAZADA' | 'SIN_RESPUESTA';
    detalle?: string;
  }
) {
  const insertQuery = `
    INSERT INTO dbo.oferta_negociacion (id_negociacion, id_producto, id_combo, id_promocion, fecha_oferta, respuesta, detalle)
    VALUES (@idNegociacion, @idProducto, @idCombo, @idPromocion, SYSUTCDATETIME(), @respuesta, @detalle);
    SELECT SCOPE_IDENTITY() AS id_oferta;
  `;

  const res = await executeQuery<{ id_oferta: number }>(insertQuery, {
    idNegociacion: { type: sql.BigInt, value: idNegociacion },
    idProducto: { type: sql.Int, value: params.id_producto || null },
    idCombo: { type: sql.Int, value: params.id_combo || null },
    idPromocion: { type: sql.Int, value: params.id_promocion || null },
    respuesta: { type: sql.VarChar(15), value: params.respuesta || 'SIN_RESPUESTA' },
    detalle: { type: sql.NVarChar(300), value: params.detalle || null },
  });

  // Registrar auditoría de agente
  await toolRegistrarAccionAgente({
    id_negociacion: idNegociacion,
    accion: params.id_combo ? 'OFRECER_COMBO' : params.id_promocion ? 'OFRECER_PROMOCION' : 'OFRECER_PRODUCTO',
    detalle: params.detalle || `Oferta registrada: ${params.respuesta || 'SIN_RESPUESTA'}`,
    resultado: 'EXITOSO',
  });

  return res[0]?.id_oferta;
}

export async function toolConsultarEstadoNegociacion(idNegociacion: number) {
  const query = `
    SELECT n.*, p.nombres, p.apellidos, p.telefono, p.email, p.id_segmento, s.nombre AS segmento,
           CAST(DATEDIFF(MINUTE, n.fecha_inicio, SYSUTCDATETIME()) / 60.0 AS DECIMAL(10,2)) AS horas_desde_inicio
    FROM dbo.negociacion n
    JOIN dbo.persona p ON p.id_persona = n.id_persona
    LEFT JOIN dbo.segmento_cliente s ON s.id_segmento = p.id_segmento
    WHERE n.id_negociacion = @idNegociacion;
  `;
  const res = await executeQuery<any>(query, {
    idNegociacion: { type: sql.BigInt, value: idNegociacion },
  });
  return res[0] || null;
}

export async function toolConsultarPrimerPago(idNegociacion: number) {
  const query = `
    SELECT pd.id_pedido, pd.id_negociacion, pd.estado AS estado_pedido, pd.total,
           pg.id_pago, pg.monto, pg.fecha_pago, pg.estado AS estado_pago, mp.codigo AS medio_pago
    FROM dbo.pedido pd
    LEFT JOIN dbo.pago pg ON pg.id_pedido = pd.id_pedido AND pg.estado IN ('CONFIRMADO', 'REEMBOLSADO')
    LEFT JOIN dbo.medio_pago mp ON mp.id_medio_pago = pg.id_medio_pago
    WHERE pd.id_negociacion = @idNegociacion
    ORDER BY pg.fecha_pago ASC;
  `;
  const res = await executeQuery<any>(query, {
    idNegociacion: { type: sql.BigInt, value: idNegociacion },
  });
  return res;
}

export async function toolRegistrarAccionAgente(params: {
  id_personal?: number;
  id_negociacion?: number;
  id_buyer?: number;
  id_sesion_whatsapp?: number;
  accion: string;
  detalle?: string;
  resultado?: 'EXITOSO' | 'FALLIDO' | 'PENDIENTE';
}) {
  const query = `
    INSERT INTO dbo.accion_agente (id_personal, id_negociacion, id_buyer, id_sesion_whatsapp, accion, detalle, resultado, fecha_ejecucion)
    VALUES (@idPersonal, @idNegociacion, @idBuyer, @idSesion, @accion, @detalle, @resultado, SYSUTCDATETIME());
  `;
  await executeQuery(query, {
    idPersonal: { type: sql.Int, value: params.id_personal || 1 }, // 1 = Agente Establo IA
    idNegociacion: { type: sql.BigInt, value: params.id_negociacion || null },
    idBuyer: { type: sql.BigInt, value: params.id_buyer || null },
    idSesion: { type: sql.BigInt, value: params.id_sesion_whatsapp || null },
    accion: { type: sql.VarChar(50), value: params.accion },
    detalle: { type: sql.NVarChar(500), value: params.detalle || null },
    resultado: { type: sql.VarChar(20), value: params.resultado || 'EXITOSO' },
  });
}

// -------------------------------------------------------------
// MOTOR CONVERSACIONAL INTELIGENTE (Híbrido Gemini + Copiloto Heurístico)
// -------------------------------------------------------------

export interface AgenteRespuesta {
  mensaje: string;
  sugerenciasComerciales: string[];
  ofertaSugerida?: {
    tipo: 'PRODUCTO' | 'COMBO' | 'PROMOCION';
    id: number;
    nombre: string;
    precio?: number;
    beneficio?: string;
  };
  accionTomada?: string;
  requiereIntervencionHumana?: boolean;
}

export async function procesarMensajeLead(
  idNegociacion: number,
  mensajeCliente: string,
  historialPrevio: { remitente: 'lead' | 'agente'; texto: string }[] = []
): Promise<AgenteRespuesta> {
  const estadoNeg = await toolConsultarEstadoNegociacion(idNegociacion);
  if (!estadoNeg) {
    return {
      mensaje: "Hola, gracias por comunicarte con Parrilladas El Establo. En este momento verificamos tu registro comercial.",
      sugerenciasComerciales: ["Verificar datos del cliente"],
    };
  }

  const idPersona = estadoNeg.id_persona;
  const recomendaciones = await toolGenerarRecomendaciones(idPersona);
  const nombreCliente = estadoNeg.nombres;
  const esRecurrente = estadoNeg.nro_ciclo > 1;
  const mensajeNorm = mensajeCliente.toLowerCase();

  // Evaluar con Gemini si la API Key está disponible
  const apiKey = process.env.GEMINI_API_KEY;
  if (apiKey && apiKey.trim() !== "" && apiKey !== "DEMO") {
    try {
      const { GoogleGenerativeAI } = await import("@google/generative-ai");
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: process.env.GEMINI_MODEL || "gemini-1.5-flash" });

      const promptSistema = `
Eres 'Agente Establo', el asesor comercial inteligente de la prestigiosa startup gastronómica 'Parrilladas El Establo' en Trujillo, Perú.
Tu misión exclusiva es atender y convertir LEADS en compradores satisfechos.
Hablas en español peruano natural, amable, cálido, experto en carnes y respetuoso (utiliza términos como 'gusto saludarte', 'nuestros cortes a la leña', 'tenemos Yape y Plin').
No inventes platos ni promociones que no estén en los datos proporcionados.
Datos del Lead:
- Nombre: ${nombreCliente} ${estadoNeg.apellidos}
- Segmento: ${estadoNeg.segmento || "No especificado"}
- Ciclo: ${estadoNeg.nro_ciclo} (${esRecurrente ? "Cliente recurrente" : "Primer contacto"})
- Favorito declarado: ${recomendaciones?.preferencias?.producto_favorito_declarado || "No registrado"}
- Más comprado: ${recomendaciones?.preferencias?.nombre_mas_comprado || "Ninguno"}
- Promociones elegibles hoy: ${JSON.stringify(recomendaciones?.promocionesElegibles.map((p: any) => ({ id: p.id_promocion, nombre: p.nombre_promocion, desc: p.descripcion })))}
- Cortes top del segmento: ${JSON.stringify(recomendaciones?.topCortes.map((c: any) => ({ corte: c.corte, estilo: c.estilo, peso: `${c.peso_cantidad} ${c.peso_unidad}` })))}
- Combos recomendados: ${JSON.stringify(recomendaciones?.topCombos.map((cb: any) => ({ id: cb.id_combo, combo: cb.combo, precio: cb.precio })))}

Historial reciente:
${historialPrevio.slice(-4).map(h => `${h.remitente === 'lead' ? 'Cliente' : 'Agente'}: ${h.texto}`).join("\n")}

Mensaje del cliente: "${mensajeCliente}"

Responde como el asesor en un mensaje conciso (máximo 3 párrafos), resolviendo su duda, resaltando el sabor y calidad de los cortes a la brasa, y ofreciendo un llamado a la acción claro para confirmar su pedido.
`;

      const response = await model.generateContent(promptSistema);
      const aiText = response.response.text();

      // Registrar auditoría
      await toolRegistrarAccionAgente({
        id_negociacion: idNegociacion,
        accion: 'RESPONDER_WHATSAPP',
        detalle: `Respuesta generada con Gemini para ${nombreCliente}`,
        resultado: 'EXITOSO',
      });

      return {
        mensaje: aiText,
        sugerenciasComerciales: [
          "Confirmar medio de pago (Yape / Plin / Tarjeta)",
          "Consultar si requiere reserva de mesa en Trujillo",
          "Ofrecer guarnición o bebida adicional",
        ],
        accionTomada: "Gemini AI Response",
      };
    } catch (err) {
      console.warn("[Agente IA] Error con Gemini API, cambiando a motor heurístico:", err);
    }
  }

  // -------------------------------------------------------------------
  // MOTOR HEURÍSTICO EXPERTO (Garantiza funcionamiento offline 100% real)
  // -------------------------------------------------------------------

  // 1. Manejo de Objeción de Precio ("caro", "precio alto", "descuento", "mucho dinero", "cocinar en casa")
  if (mensajeNorm.includes("caro") || mensajeNorm.includes("precio alto") || mensajeNorm.includes("cocinar") || mensajeNorm.includes("muy caro") || mensajeNorm.includes("rebaja")) {
    const promoEst = recomendaciones?.promocionesElegibles.find((p: any) => p.nombre_promocion.toLowerCase().includes("estudiante"));
    const comboEco = recomendaciones?.topCombos.find((c: any) => c.precio <= 39) || { combo: "Combo Estudiante", precio: 39 };

    const respuesta = `Entiendo perfectamente, ${nombreCliente}. En Parrilladas El Establo cuidamos cada sol: nuestros cortes son de 350 g de carne premium importada, sellados a la brasa con guarnición completa incluida.
Si buscas una opción súper rendidora, te recomiendo el **${comboEco.combo}** a solo **S/ ${comboEco.precio.toFixed(2)}** ${promoEst ? "o puedes aprovechar nuestro descuento especial del 15% en cortes" : ""}. ¿Te gustaría que te reserve una porción para hoy?`;

    return {
      mensaje: respuesta,
      sugerenciasComerciales: [
        "Ofrecer Combo Estudiante (S/ 39.00)",
        "Aplicar Descuento Estudiante 15% (L-J)",
        "Proponer pago contra entrega o Yape",
      ],
      ofertaSugerida: {
        tipo: 'COMBO',
        id: comboEco.id_combo || 3,
        nombre: comboEco.combo,
        precio: comboEco.precio,
      },
      accionTomada: "Manejo de objeción de precio",
    };
  }

  // 2. Consulta de Cortes / Carta / Precios
  if (mensajeNorm.includes("corte") || mensajeNorm.includes("carta") || mensajeNorm.includes("precio") || mensajeNorm.includes("cuanto cuesta") || mensajeNorm.includes("menu")) {
    const cortes = await toolConsultarProductos(true);
    const listaCortes = cortes.slice(0, 4).map(c => `• **${c.nombre}** (${c.peso_cantidad || 350} ${c.peso_unidad || 'g'}): S/ ${c.precio.toFixed(2)}`).join("\n");

    const respuesta = `¡Con mucho gusto, ${nombreCliente}! Aquí tienes nuestros cortes estrella preparados a la parrilla con leña de algarrobo:\n\n${listaCortes}\n\nTodos vienen con papas rústicas y ensalada fresca. ¿Cuál de estos te provoca probar hoy?`;

    return {
      mensaje: respuesta,
      sugerenciasComerciales: [
        "Recomendar Tira de Cerdo (S/ 32.00)",
        "Recomendar Picana a la Parrilla (S/ 39.00)",
        "Sugerir Combo Amigos o Familiar para grupos",
      ],
      ofertaSugerida: {
        tipo: 'PRODUCTO',
        id: cortes[0]?.id_producto || 1,
        nombre: cortes[0]?.nombre || "Tira de Cerdo",
        precio: cortes[0]?.precio || 32,
      },
      accionTomada: "Presentación de carta y cortes",
    };
  }

  // 3. Promociones / Cumpleaños / Descuentos
  if (mensajeNorm.includes("promo") || mensajeNorm.includes("descuento") || mensajeNorm.includes("cumple") || mensajeNorm.includes("oferta")) {
    const promos = recomendaciones?.promocionesElegibles || [];
    if (promos.length > 0) {
      const p = promos[0];
      const respuesta = `¡Sí, ${nombreCliente}! Hoy tenemos activa la **${p.nombre_promocion}**: ${p.descripcion}.
Aplica directamente a tu pedido de hoy. ¿Te la aplicamos de una vez a tu cuenta para que no te la pierdas?`;

      return {
        mensaje: respuesta,
        sugerenciasComerciales: [
          `Aplicar ${p.nombre_promocion}`,
          "Registrar oferta en oferta_negociacion",
          "Solicitar dirección o mesa para Trujillo",
        ],
        ofertaSugerida: {
          tipo: 'PROMOCION',
          id: p.id_promocion,
          nombre: p.nombre_promocion,
          beneficio: p.descripcion,
        },
        accionTomada: "Presentación de promociones elegibles",
      };
    }
  }

  // 4. Clientes Recurrentes (Ana Ramírez, Luis Torres, etc.)
  if (esRecurrente) {
    const platoHabitual = recomendaciones?.preferencias?.nombre_mas_comprado || recomendaciones?.preferencias?.producto_favorito_declarado || "tu corte favorito";
    const respuesta = `¡Hola de nuevo, ${nombreCliente}! Qué alegría tenerte de vuelta en El Establo. ¿Te preparamos **${platoHabitual}** como la última vez o deseas probar uno de nuestros combos especiales de temporada?`;

    return {
      mensaje: respuesta,
      sugerenciasComerciales: [
        `Recomendar plato habitual: ${platoHabitual}`,
        "Ofrecer reserva de mesa preferencial",
        "Ofrecer sangría o bebida de cortesía",
      ],
      accionTomada: "Reconocimiento de cliente recurrente",
    };
  }

  // 5. Saludo General o Consulta Inicial
  return {
    mensaje: `¡Hola ${nombreCliente}! Bienvenido a Parrilladas El Establo en Trujillo. Me alegra mucho atenderte. ¿Buscas un corte personal para disfrutar hoy o vienes acompañado de amigos o familia para armarte la mejor parrilla?`,
    sugerenciasComerciales: [
      "Indagar número de comensales",
      "Recomendar Tira de Cerdo 350 g (S/ 32.00)",
      "Recomendar Parrilla Familiar (S/ 149.00)",
    ],
    accionTomada: "Saludo inicial y sondeo de necesidades",
  };
}

