import { executeQuery, sql } from "./db";
import { Persona, ProductoCarta, Combo, Promocion, OfertaNegociacion } from "@/types/database";
import { evaluarPromocion } from "./promotions-engine";
import {
  toolConsultarPerfilLead,
  toolConsultarProductoFavorito,
  toolConsultarPlatoMasComprado,
  toolConsultarProductosPopularesSegmento,
  toolConsultarPromocionesElegibles as toolConsultarPromosElegiblesSQL,
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
} from "./sql-tools-engine";

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
      const modelName = process.env.GEMINI_MODEL || "gemini-3.5-flash";
      const promptSistema = `
Eres 'Agente Establo' 🥩🔥, el maestro parrillero y asesor comercial estrella de 'Parrilladas El Establo' en Trujillo, Perú.
Tu objetivo: responder por WhatsApp de forma dinámica, tentadora, cálida y ULTRA CONCISA para cerrar ventas al instante.

⚡ REGLAS OBLIGATORIAS DE FORMATO WHATSAPP:
1. ULTRA CONCISO: MÁXIMO 2 A 3 LÍNEAS CORTAS. Los clientes en WhatsApp no leen párrafos largos ni testamentos. Sé directo, tentador y rápido.
2. EMOJIS ESTRATÉGICOS: Usa pocos emojis precisos (🥩, 🔥, 🤤, 📲).
3. DATOS Y PRECIOS EN NEGRITA: Resalta platos y precios con asteriscos (ej: *Chorizo Parrillero* *S/ 15.00*). NUNCA inventes platos ni precios.
4. CIERRE RÁPIDO: Termina siempre con una pregunta de cierre corta invitando al pedido por Yape o Plin.
5. TONO PERUANO CÁLIDO: Amable y parrillero, cero texto corporativo aburrido.

Datos del Lead:
- Nombre: ${nombreCliente}
- Segmento: ${estadoNeg.segmento || "Clientes"}
- Ciclo: ${estadoNeg.nro_ciclo} (${esRecurrente ? "Cliente habitual" : "Primer contacto"})
- Favorito declarado: ${recomendaciones?.preferencias?.producto_favorito_declarado || "No registrado"}
- Más comprado: ${recomendaciones?.preferencias?.nombre_mas_comprado || "Ninguno"}
- Promociones elegibles hoy: ${JSON.stringify(recomendaciones?.promocionesElegibles.map((p: any) => ({ nombre: p.nombre_promocion, desc: p.descripcion })))}
- Cortes top del menú: ${JSON.stringify(recomendaciones?.topCortes.map((c: any) => ({ corte: c.corte, estilo: c.estilo, peso: `${c.peso_cantidad} ${c.peso_unidad}` })))}
- Combos activos: ${JSON.stringify(recomendaciones?.topCombos.map((cb: any) => ({ combo: cb.combo, precio: cb.precio })))}

Historial reciente del chat:
${historialPrevio.slice(-3).map(h => `${h.remitente === 'lead' ? 'Cliente' : 'Agente'}: ${h.texto}`).join("\n")}

Mensaje del cliente: "${mensajeCliente}"

EJEMPLO DE ESTILO ESPERADO:
"¡De una, ${nombreCliente}! 🥩🔥 Sale ese *Chorizo a la Parrilla* (*S/ 15.00*) con papitas y ensalada.\n¿Te lo mandamos a preparar? ¡Pagas al toque con Yape! 📲✨"

Genera la respuesta con EXACTAMENTE 2 o 3 líneas cortas, sin viñetas extensas.
`;

      const responseFetch = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: promptSistema }] }],
        }),
      });

      const dataGen = await responseFetch.json();
      if (dataGen.candidates && dataGen.candidates[0]?.content?.parts?.[0]?.text) {
        const aiText = dataGen.candidates[0].content.parts[0].text;

        await toolRegistrarAccionAgente({
          id_negociacion: idNegociacion,
          accion: 'RESPONDER_WHATSAPP',
          detalle: `Respuesta generada con Gemini (${modelName}) para ${nombreCliente}`,
          resultado: 'EXITOSO',
        });

        return {
          mensaje: aiText,
          sugerenciasComerciales: [
            "Confirmar medio de pago (Yape / Plin / Tarjeta)",
            "Consultar si requiere reserva de mesa en Trujillo",
            "Ofrecer guarnición o bebida adicional",
          ],
          accionTomada: `Google Gemini (${modelName}) Response`,
        };
      } else {
        console.warn("[Agente IA] Gemini API sin candidatos válidos, activando heurístico de respaldo:", dataGen.error || dataGen);
      }
    } catch (err) {
      console.warn("[Agente IA] Error con Gemini API, cambiando a motor heurístico:", err);
    }
  }

  // -------------------------------------------------------------------
  // MOTOR HEURÍSTICO INTELIGENTE (Ultra Conciso — Estilo WhatsApp Rápido)
  // -------------------------------------------------------------------
  const tieneHistorial = historialPrevio.length > 0;

  // CASO 1: Puntos, monosílabos o mensajes ultracortos (".", "👍", "ok", "oe", "?")
  if (mensajeNorm.length <= 2 || mensajeNorm === "..." || mensajeNorm === "ok" || mensajeNorm === "ya" || mensajeNorm === "bueno") {
    if (tieneHistorial) {
      return {
        mensaje: `¡Aquí sigo atento, ${nombreCliente}! 🥩🔥 ¿Te preparamos un *Chorizo Parrillero (S/ 15.00)* o prefieres un combo para compartir? ¡Pagas al toque con Yape! 📲`,
        sugerenciasComerciales: [
          `¿Sale un Chorizo a la Parrilla (S/ 15.00)? 🥩`,
          `¿Deseas ver los combos para compartir? 🔥`,
          `¿Confirmas tu pedido por Yape o Plin? 📲`,
        ],
        accionTomada: "Atención ágil a monosílabo",
      };
    }
  }

  // CASO COMERCIAL A: COMPRA GRUPAL CON PRESUPUESTO ACOTADO (Ej: "Quiero una parrillada para cuatro personas, pero solo tengo S/ 120")
  if (
    (mensajeNorm.includes("cuatro personas") || mensajeNorm.includes("4 personas") || mensajeNorm.includes("4 amigos") || mensajeNorm.includes("para cuatro") || mensajeNorm.includes("para 4")) &&
    (mensajeNorm.includes("120") || mensajeNorm.includes("solo tengo") || mensajeNorm.includes("presupuesto") || mensajeNorm.includes("alcanza") || mensajeNorm.includes("plata"))
  ) {
    try {
      await toolRegistrarNecesidadLead(idNegociacion, "Parrillada para 4 comensales", 4, 120.0);
      await toolRegistrarObjecionLead(idNegociacion, "PRESUPUESTO", "Presupuesto acotado a S/ 120 para 4 personas");
      await toolRegistrarOfertaLead(idNegociacion, {
        idCombo: 2, // Combo Amigos
        detalle: "Combo Amigos (S/ 110.00) sugerido para 4 personas dentro de presupuesto S/ 120",
      });
    } catch (e) {
      console.warn("[Agente IA] Error registrando necesidad/oferta:", e);
    }

    return {
      mensaje: `¡De una, ${nombreCliente}! 🥩🔥 Para 4 personas con tu presupuesto de S/ 120, te recomiendo nuestro *Combo Amigos* a solo *S/ 110.00* (¡te sobran S/ 10!). Trae cortes a la brasa, papitas y ensalada.\n¿Te lo mandamos a preparar? ¡Pagas al toque con Yape o Plin! 📲✨`,
      sugerenciasComerciales: [
        `¿Marchamos el Combo Amigos (S/ 110.00)? 🥩`,
        `¿Agregamos una jarra de Chicha Morada (S/ 12.00)? 🥤`,
        `¿Confirmas con Yape al toque? 📲`,
      ],
      ofertaSugerida: {
        tipo: 'COMBO',
        id: 2,
        nombre: 'Combo Amigos',
        precio: 110.0,
        beneficio: 'Parrillada para 4 comensales dentro de presupuesto S/ 120',
      },
      accionTomada: "Negociación grupal con presupuesto ajustado",
    };
  }

  // CASO COMERCIAL B: CONSULTA DE GRAMAJE / PESO DE CARNE (Ej: "¿Tienen cortes de 250 gramos?", "gramos", "peso")
  if (mensajeNorm.includes("250 gramos") || mensajeNorm.includes("250g") || mensajeNorm.includes("250 g")) {
    try {
      await toolRegistrarAccionAgente({
        id_negociacion: idNegociacion,
        accion: 'CONSULTAR_GRAMAJE',
        detalle: `Consulta de gramaje 250g realizada por ${nombreCliente}`,
        resultado: 'EXITOSO',
      });
    } catch (e) {}

    return {
      mensaje: `¡Hola, ${nombreCliente}! 🥩 En carta no manejamos cortes de 250 g, pero tenemos porciones generosas de *350 g* (*Picaña S/ 39.00*, *Bife Ancho S/ 38.00*, *Tira S/ 32.00*) o *Chorizo de 150 g (S/ 15.00)*.\n¿Cuál de 350 g te mandamos a preparar? 📲✨`,
      sugerenciasComerciales: [
        `¿Sale la Picaña de 350 g (S/ 39.00)? 🥩`,
        `¿Sale el Bife Ancho de 350 g (S/ 38.00)? 🔥`,
        `¿Prefieres el Chorizo de 150 g (S/ 15.00)? 🤤`,
      ],
      ofertaSugerida: {
        tipo: 'PRODUCTO',
        id: 2,
        nombre: 'Picaña a la Parrilla 350 g',
        precio: 39.0,
      },
      accionTomada: "Aclaración veraz de gramajes oficiales V3",
    };
  }

  // CASO COMERCIAL C: PREFERENCIA GASTRONÓMICA DECLARADA (Ej: "Me gusta la Tira de Cerdo", "Mi corte favorito es la Picaña")
  if (mensajeNorm.includes("me gusta") || mensajeNorm.includes("mi favorito") || mensajeNorm.includes("mi corte favorito")) {
    let idProd = 1;
    let nombreProd = "Tira de Cerdo";
    let precioProd = 32.0;
    if (mensajeNorm.includes("picana") || mensajeNorm.includes("picaña")) {
      idProd = 2;
      nombreProd = "Picaña a la Parrilla";
      precioProd = 39.0;
    } else if (mensajeNorm.includes("bife")) {
      idProd = 3;
      nombreProd = "Bife Ancho";
      precioProd = 38.0;
    }

    try {
      await toolRegistrarPreferenciaLead(idPersona, idProd, 'CONVERSACION_ACTIVA');
      await toolRegistrarOfertaLead(idNegociacion, { idProducto: idProd, detalle: `Oferta de ${nombreProd} (Preferencia declarada)` });
    } catch (e) {}

    return {
      mensaje: `¡Excelente gusto, ${nombreCliente}! 🥩 Nuestra *${nombreProd}* (*S/ ${precioProd.toFixed(2)}*) sale jugosísima a la leña con papas rústicas y ensalada fresca.\n¿Te la mandamos a preparar calientita? ¡Pagas al toque con Yape! 📲✨`,
      sugerenciasComerciales: [
        `¿Marchamos tu ${nombreProd} (S/ ${precioProd.toFixed(2)})? 🥩`,
        `¿Deseas agregar bebida helada? 🥤`,
        `¿Confirmas por Yape o Plin? 📲`,
      ],
      ofertaSugerida: {
        tipo: 'PRODUCTO',
        id: idProd,
        nombre: `${nombreProd} 350 g`,
        precio: precioProd,
      },
      accionTomada: "Recomendación por preferencia gastronómica declarada",
    };
  }

  // CASO COMERCIAL D: DESISTIMIENTO / RECHAZO EXPLÍCITO ("no voy a comprar", "ya no deseo", "comeré en casa")
  if (mensajeNorm.includes("no voy a comprar") || mensajeNorm.includes("ya no deseo") || mensajeNorm.includes("no deseo comprar") || mensajeNorm.includes("comere en casa") || mensajeNorm.includes("comeré en casa")) {
    try {
      await toolRegistrarRespuestaOferta(idNegociacion, 'RECHAZADA', undefined, 'Cliente manifestó rechazo explícito sin compra');
      await toolRegistrarAccionAgente({
        id_negociacion: idNegociacion,
        accion: 'REGISTRAR_RECHAZO_EXPLICITO',
        detalle: `Rechazo explícito recibido de ${nombreCliente}: preservada cortesía sin insistencia invasiva`,
        resultado: 'EXITOSO',
      });
    } catch (e) {}

    return {
      mensaje: `¡Totalmente comprensible, ${nombreCliente}! 🙏 Gracias por considerarnos hoy. Cuando se te antoje una buena carne a la leña en Trujillo, aquí te esperamos con las brasas listas. ¡Lindo día! 🥩✨`,
      sugerenciasComerciales: [
        `Agradecer al cliente y archivar ciclo`,
        `Registrar motivo de pérdida: RECHAZO`,
      ],
      accionTomada: "Cierre cortés ante rechazo explícito (sin insistir)",
    };
  }

  // CASO 3: El cliente elige o pide un plato concreto ("pedire un chorizo", "quiero el combo amigos")
  if (
    mensajeNorm.includes("pedire") ||
    mensajeNorm.includes("pedir") ||
    mensajeNorm.includes("quiero") ||
    mensajeNorm.includes("dame") ||
    mensajeNorm.includes("mandame") ||
    mensajeNorm.includes("anotame") ||
    mensajeNorm.includes("me animo") ||
    mensajeNorm.includes("voy a pedir") ||
    mensajeNorm.includes("sale un")
  ) {
    if (mensajeNorm.includes("chorizo")) {
      return {
        mensaje: `¡De una, ${nombreCliente}! 🥩🔥 Sale ese *Chorizo a la Parrilla* (*S/ 15.00*) bien doradito con papas rústicas y ensalada.\n¿Te lo mandamos a preparar? ¡Pagas al toque con Yape! 📲✨`,
        sugerenciasComerciales: [
          `¿Marchamos el Chorizo (S/ 15.00) calientito? 🔥`,
          `¿Deseas agregar gaseosa helada? 🥤`,
          `¿Te paso el Yape del restaurante? 📲`,
        ],
        ofertaSugerida: {
          tipo: 'PRODUCTO',
          id: 1,
          nombre: 'Chorizo a la Parrilla',
          precio: 15.0,
          beneficio: 'Chorizo artesanal a la brasa',
        },
        accionTomada: "Confirmación directa de pedido",
      };
    }

    if (mensajeNorm.includes("tira") || mensajeNorm.includes("cerdo")) {
      return {
        mensaje: `¡Excelente, ${nombreCliente}! 🥩 Sale nuestra *Tira de Cerdo 350g* (*S/ 32.00*) jugosa a la leña con papas y ensalada.\n¿Te la mandamos a preparar? ¡Aceptamos Yape y Plin! 📲✨`,
        sugerenciasComerciales: [
          `¿Marchamos la Tira de Cerdo (S/ 32.00)? 🥩`,
          `¿Deseas delivery o para recoger? 🛵`,
          `¿Confirmas por Yape? 📲`,
        ],
        ofertaSugerida: {
          tipo: 'PRODUCTO',
          id: 2,
          nombre: 'Tira de Cerdo 350 g',
          precio: 32.0,
        },
        accionTomada: "Confirmación directa de pedido",
      };
    }

    if (mensajeNorm.includes("amigos")) {
      return {
        mensaje: `¡Golazo, ${nombreCliente}! 🎉 Marchando ese *Combo Amigos* (*S/ 110.00*): bife, chorizos, anticuchos, papas y ensalada 🥩🤤.\n¿Te lo mandamos a preparar calientito? ¡Pagas con Yape al toque! 📲✨`,
        sugerenciasComerciales: [
          `¿Marchamos el Combo Amigos (S/ 110.00)? 🔥`,
          `¿Agregamos una jarra de sangría? 🍷`,
          `¿Confirmas con Yape? 📲`,
        ],
        ofertaSugerida: {
          tipo: 'COMBO',
          id: 2,
          nombre: 'Combo Amigos',
          precio: 110.0,
        },
        accionTomada: "Confirmación Combo Amigos",
      };
    }

    if (mensajeNorm.includes("familiar")) {
      return {
        mensaje: `¡Perfecto, ${nombreCliente}! 👨‍👩‍👧‍👦 Sale la *Parrilla Familiar* (*S/ 149.00*): cuadril, chuleta, chorizos, papas y ensalada para 4 a 5 personas 🥩🔥.\n¿La mandamos a la brasa? ¡Pagas al toque con Yape! 📲✨`,
        sugerenciasComerciales: [
          `¿Marchamos la Parrilla Familiar (S/ 149.00)? 🥩`,
          `¿Para cuántas personas enviamos cubiertos? 🍽️`,
          `¿Te paso el número de Yape? 📲`,
        ],
        ofertaSugerida: {
          tipo: 'COMBO',
          id: 1,
          nombre: 'Parrilla Familiar',
          precio: 149.0,
        },
        accionTomada: "Confirmación Parrilla Familiar",
      };
    }
  }

  // CASO 4: Objeción de Presupuesto / Poco Dinero ("no tengo plata", "estoy misio", "algo económico")
  if (
    mensajeNorm.includes("no tengo mucha plata") ||
    mensajeNorm.includes("no tengo plata") ||
    mensajeNorm.includes("poco dinero") ||
    mensajeNorm.includes("ajustado") ||
    mensajeNorm.includes("misio") ||
    mensajeNorm.includes("lo mas barato") ||
    mensajeNorm.includes("mas comodo") ||
    mensajeNorm.includes("economico") ||
    mensajeNorm.includes("no me alcanza") ||
    mensajeNorm.includes("caro") ||
    mensajeNorm.includes("precio alto") ||
    mensajeNorm.includes("rebaja")
  ) {
    const comboEco = recomendaciones?.topCombos.find((c: any) => c.precio <= 39) || { combo: "Combo Estudiante", precio: 39 };

    return {
      mensaje: `¡Te entiendo, ${nombreCliente}! 🥩 Cuidamos tu bolsillo:\n✨ *Chorizo Parrillero*: solo *S/ 15.00* con papas y ensalada\n🎓 *${comboEco.combo}*: solo *S/ ${comboEco.precio.toFixed(2)}*\n¿Te preparamos el de S/ 15.00? ¡Pagas con Yape! 📲✨`,
      sugerenciasComerciales: [
        `¿Sale el Chorizo a solo S/ 15.00? 🥩`,
        `¿Prefieres el Combo Estudiante a S/ 39.00? 🎓`,
        `¿Pagas con Yape al toque? 📲`,
      ],
      ofertaSugerida: {
        tipo: 'PRODUCTO',
        id: 1,
        nombre: 'Chorizo a la Parrilla',
        precio: 15.0,
      },
      accionTomada: "Manejo ultra conciso de objeción de presupuesto",
    };
  }

  // CASO 5: Medios de pago / Delivery / Ubicación
  if (mensajeNorm.includes("yape") || mensajeNorm.includes("plin") || mensajeNorm.includes("pago") || mensajeNorm.includes("tarjeta") || mensajeNorm.includes("transferencia")) {
    return {
      mensaje: `¡Al toque, ${nombreCliente}! 📲 Aceptamos *Yape, Plin*, tarjeta y efectivo contra entrega 🛵💳.\n¿Te tomo el pedido para pasarte el Yape? 🥩`,
      sugerenciasComerciales: [
        `¿Te paso el número de Yape del restaurante? 📲`,
        `¿Prefieres pagar con tarjeta al recibir? 💳`,
        `¿Coordinamos tu delivery? 🛵`,
      ],
      accionTomada: "Información concisa de pagos",
    };
  }

  if (mensajeNorm.includes("delivery") || mensajeNorm.includes("donde quedan") || mensajeNorm.includes("direccion") || mensajeNorm.includes("ubicacion") || mensajeNorm.includes("huanchaco") || mensajeNorm.includes("california")) {
    return {
      mensaje: `¡Llegamos a todo Trujillo y balnearios, ${nombreCliente}! 🛵🔥 Empaque térmico para que llegue calientito 🥩💨.\n¿A qué dirección te lo enviamos? 📍`,
      sugerenciasComerciales: [
        `¿A qué distrito o calle te lo enviamos? 🛵`,
        `¿Prefieres comer en el local? 📍`,
        `¿Te paso la carta rápida? 📜`,
      ],
      accionTomada: "Atención concisa de delivery",
    };
  }

  // CASO 6: Consulta de Cortes / Precios / Carta
  if (mensajeNorm.includes("corte") || mensajeNorm.includes("carta") || mensajeNorm.includes("precio") || mensajeNorm.includes("cuanto cuesta") || mensajeNorm.includes("a cuanto sale") || mensajeNorm.includes("menu")) {
    return {
      mensaje: `¡Hola, ${nombreCliente}! 🔥 Lo más pedido hoy a la leña:\n🥩 *Chorizo*: *S/ 15.00* | *Tira de Cerdo*: *S/ 32.00* | *Combo Amigos*: *S/ 110.00*\nTodos con papitas y ensalada 🤤. ¿Cuál te mandamos a preparar? 📲`,
      sugerenciasComerciales: [
        `¿Sale una Tira de Cerdo (S/ 32.00)? 🥩`,
        `¿Sale un Combo Amigos (S/ 110.00)? 👥`,
        `¿Confirmas con Yape? 📲`,
      ],
      ofertaSugerida: {
        tipo: 'PRODUCTO',
        id: 1,
        nombre: 'Tira de Cerdo 350 g',
        precio: 32.0,
      },
      accionTomada: "Presentación concisa de carta",
    };
  }

  // CASO 7: Promociones / Descuentos
  if (mensajeNorm.includes("promo") || mensajeNorm.includes("descuento") || mensajeNorm.includes("cumple") || mensajeNorm.includes("oferta")) {
    const promos = recomendaciones?.promocionesElegibles || [];
    const p = promos[0] || { nombre_promocion: "Promo Parrillera", descripcion: "Guarnición extra de papas rústicas" };
    return {
      mensaje: `¡Buenas noticias, ${nombreCliente}! 🎉 Hoy tenemos activa la *${p.nombre_promocion}*: ${p.descripcion} ✨\n¿Te la aplicamos a tu pedido? ¡Pagas con Yape o Plin! 🤤📲`,
      sugerenciasComerciales: [
        `¿Te aplicamos la promoción ${p.nombre_promocion}? 🎉`,
        `¿Para cuántas personas armamos el pedido? 🍽️`,
        `¿Confirmamos por Yape? 📲`,
      ],
      ofertaSugerida: {
        tipo: 'PROMOCION',
        id: p.id_promocion || 1,
        nombre: p.nombre_promocion,
      },
      accionTomada: "Presentación concisa de promociones",
    };
  }

  // CASO 8: Conversación en curso
  if (tieneHistorial) {
    return {
      mensaje: `¡Con gusto, ${nombreCliente}! 🥩 Tenemos cortes desde *S/ 15.00* (*Chorizo*) y combos para compartir desde *S/ 110.00* (*Combo Amigos*).\n¿Cuál se te antoja hoy? 🤤📲`,
      sugerenciasComerciales: [
        `¿Te preparo un corte individual o un combo? 🥩`,
        `¿Sale un Chorizo a la Parrilla (S/ 15.00)? 🔥`,
        `¿Confirmas por Yape? 📲`,
      ],
      ofertaSugerida: {
        tipo: 'PRODUCTO',
        id: 1,
        nombre: 'Chorizo a la Parrilla',
        precio: 15.0,
      },
      accionTomada: "Continuación ágil de diálogo",
    };
  }

  // CASO 9: Saludo inicial
  return {
    mensaje: `¡Hola, ${nombreCliente}! Bienvenido a Parrilladas El Establo 🥩🔥. ¿Buscas un corte personal o un combo para compartir?`,
    sugerenciasComerciales: [
      `¿Para cuántas personas deseas la parrilla? 👥`,
      `¿Te gustaría probar la Tira de Cerdo (S/ 32.00)? 🥩`,
      `¿Prefieres delivery caliente o recoger? 🛵`,
    ],
    accionTomada: "Saludo inicial conciso",
  };
}

