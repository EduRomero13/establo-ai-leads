import { executeQuery, sql } from "./db";
import {
  Persona,
  ProductoCarta,
  Combo,
  Promocion,
  OfertaNegociacion,
} from "@/types/database";
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

  return combos.map((c) => ({
    ...c,
    detalles: detalles.filter((d) => d.id_combo === c.id_combo),
  }));
}

export async function toolConsultarPromocionesElegibles(
  idPersona: number,
  fechaRef: Date = new Date(),
) {
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
    promo.aplicables = aplicables.filter(
      (a) => a.id_promocion === promo.id_promocion,
    );
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
  const cortesSegmento = idSegmento
    ? await executeQuery<any>(cortesSegmentoQuery, {
        idSegmento: { type: sql.Int, value: idSegmento },
      })
    : [];

  // 2. Combos del segmento
  const combosSegmentoQuery = `
    SELECT * FROM dbo.vw_top_combos_segmento 
    WHERE id_segmento = @idSegmento 
    ORDER BY unidades_vendidas DESC;
  `;
  const combosSegmento = idSegmento
    ? await executeQuery<any>(combosSegmentoQuery, {
        idSegmento: { type: sql.Int, value: idSegmento },
      })
    : [];

  // 3. Promociones elegibles
  const promocionesElegibles =
    await toolConsultarPromocionesElegibles(idPersona);

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
    respuesta?: "ACEPTADA" | "RECHAZADA" | "SIN_RESPUESTA";
    detalle?: string;
  },
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
    respuesta: {
      type: sql.VarChar(15),
      value: params.respuesta || "SIN_RESPUESTA",
    },
    detalle: { type: sql.NVarChar(300), value: params.detalle || null },
  });

  // Registrar auditoría de agente
  await toolRegistrarAccionAgente({
    id_negociacion: idNegociacion,
    accion: params.id_combo
      ? "OFRECER_COMBO"
      : params.id_promocion
        ? "OFRECER_PROMOCION"
        : "OFRECER_PRODUCTO",
    detalle:
      params.detalle ||
      `Oferta registrada: ${params.respuesta || "SIN_RESPUESTA"}`,
    resultado: "EXITOSO",
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
  resultado?: "EXITOSO" | "FALLIDO" | "PENDIENTE";
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
    resultado: { type: sql.VarChar(20), value: params.resultado || "EXITOSO" },
  });
}

// -------------------------------------------------------------
// MOTOR CONVERSACIONAL INTELIGENTE (Híbrido Gemini + Copiloto Heurístico)
// -------------------------------------------------------------

export interface AgenteRespuesta {
  mensaje: string;
  sugerenciasComerciales: string[];
  ofertaSugerida?: {
    tipo: "PRODUCTO" | "COMBO" | "PROMOCION";
    id: number;
    nombre: string;
    precio?: number;
    beneficio?: string;
  };
  accionTomada?: string;
  requiereIntervencionHumana?: boolean;
  motor?: "HERMES" | "HEURISTICO";
}

export async function procesarMensajeLead(
  idNegociacion: number,
  mensajeCliente: string,
  historialPrevio: { remitente: "lead" | "agente"; texto: string }[] = [],
): Promise<AgenteRespuesta> {
  const estadoNeg = await toolConsultarEstadoNegociacion(idNegociacion);
  if (!estadoNeg) {
    return {
      mensaje:
        "Hola, gracias por comunicarte con Parrilladas El Establo. En este momento verificamos tu registro comercial.",
      sugerenciasComerciales: ["Verificar datos del cliente"],
    };
  }

  const idPersona = estadoNeg.id_persona;
  const recomendaciones = await toolGenerarRecomendaciones(idPersona);
  const preferencias = await toolConsultarPreferencias(idPersona);
  const nombreCliente = estadoNeg.nombres;
  const esRecurrente = estadoNeg.nro_ciclo > 1;
  const mensajeNorm = mensajeCliente.toLowerCase();

  // -------------------------------------------------------------------
  // INTEGRACIÓN CON AGENTE HERMES (IA EXTERNA)
  // -------------------------------------------------------------------
  const hermesUrl = process.env.HERMES_API_URL?.trim();
  const hermesKey = process.env.HERMES_API_KEY?.trim();
  const hermesModel = process.env.HERMES_MODEL?.trim() || "hermes-agent";
  const hermesTimeoutMs = Number(process.env.HERMES_TIMEOUT_MS || 45000);

  if (hermesUrl && hermesKey) {
    const baseUrl = hermesUrl.replace(/\/+$/, "");
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), hermesTimeoutMs);
    try {
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
${historialPrevio
  .slice(-3)
  .map((h) => `${h.remitente === "lead" ? "Cliente" : "Agente"}: ${h.texto}`)
  .join("\n")}
`;

      const r = await fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        signal: ctrl.signal,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${hermesKey}`,
        },
        body: JSON.stringify({
          model: hermesModel,
          messages: [
            { role: "system", content: promptSistema },
            ...historialPrevio.slice(-3).map((h) => ({
              role: h.remitente === "lead" ? "user" : "assistant",
              content: h.texto,
            })),
            { role: "user", content: mensajeCliente },
          ],
          temperature: 0.7,
        }),
      });

      const rawBody = await r.text();

      if (!r.ok) {
        console.warn(
          `[Agente IA] Hermes respondió HTTP ${r.status}. Revisa URL/KEY/modelo (${hermesModel}):`,
          rawBody.slice(0, 400),
        );
      } else {
        let d: any = null;
        try {
          d = JSON.parse(rawBody);
        } catch {
          d = null;
        }

        const aiText = d?.choices?.[0]?.message?.content;

        if (aiText) {
          console.log(
            `[Agente IA] Hermes OK (modelo ${hermesModel}) para ${nombreCliente}`,
          );

          await toolRegistrarAccionAgente({
            id_negociacion: idNegociacion,
            accion: "RESPONDER_WHATSAPP",
            detalle: `Respuesta generada por Hermes Agent (${hermesModel}) para ${nombreCliente}`,
            resultado: "EXITOSO",
          });

          return {
            mensaje: aiText,
            sugerenciasComerciales: [
              "Confirmar medio de pago (Yape / Plin / Tarjeta)",
              "Consultar si requiere reserva de mesa en Trujillo",
              "Ofrecer guarnición o bebida adicional",
            ],
            accionTomada: `Hermes Agent Response`,
            motor: "HERMES",
          };
        } else {
          console.warn(
            "[Agente IA] Hermes respondió sin choices válidas, activando heurístico de respaldo:",
            rawBody.slice(0, 400),
          );
        }
      }
    } catch (err) {
      console.warn(
        "[Agente IA] Error con Hermes API, cambiando a motor heurístico:",
        err,
      );
    } finally {
      clearTimeout(t);
    }
  }

  // -------------------------------------------------------------------
  // MOTOR HEURÍSTICO INTELIGENTE (Respaldo)
  // -------------------------------------------------------------------
  const tieneHistorial = historialPrevio.length > 0;
  const favDeclarado =
    preferencias?.producto_favorito_declarado ||
    recomendaciones?.preferencias?.producto_favorito_declarado;

  // ===================================================================
  // 1. ESCUDO DE SEGURIDAD / DE-ESCALACIÓN ANTE AGRESIONES O TROLEO
  // ===================================================================
  const esAgresion =
    /estafad|estafa|ladron|malo|fea|feo|asco|porqueria|porquería|basura|mierda|pendejo/i.test(
      mensajeNorm,
    );
  if (esAgresion) {
    return {
      mensaje: `¡Hola, ${nombreCliente}! En El Establo nos tomamos muy en serio la calidad de cada corte y la satisfacción de nuestros comensales 🥩🤝.\nSi tuviste algún inconveniente o duda con tu pedido, cuéntame para solucionarlo de inmediato y darte la experiencia parrillera que mereces. ¿En qué te podemos servir hoy? 📲`,
      sugerenciasComerciales: [
        "Brindar soporte inmediato al cliente",
        "Ofrecer cambio de producto o cortesía",
      ],
      accionTomada: "De-escalación cortés y profesional ante queja/provocación",
    };
  }

  // ===================================================================
  // 2. DEMANDA DE CORTES MÁS CAROS / PREMIUM / TENGO DINERO (HIGH TICKET)
  // ===================================================================
  const esInteresPremium =
    /m[aá]s caro|los m[aá]s caros|el m[aá]s caro|lo m[aá]s caro|corte.*caro|tengo dinero|tengo plata|sin l[ií]mite|presupuesto alto|corte.*premium|cortes.*premium|lo mejor que tengas|lo m[aá]s fino|corte fino|lo m[aá]s top|lo m[aá]s exclusivo|angus/i.test(
      mensajeNorm,
    );
  if (esInteresPremium) {
    try {
      await toolRegistrarNecesidadLead(
        idNegociacion,
        "Cortes Premium / Alto Presupuesto",
        1,
        149.0,
      );
      await toolRegistrarOfertaLead(idNegociacion, {
        idProducto: 5, // Parrilla Mixta Especial (S/ 58.00)
        detalle: "Oferta de opciones premium y de mayor valor de la carta",
      });
    } catch (e) {}

    return {
      mensaje: `¡Excelente, ${nombreCliente}! 🥩👑 Si buscas lo más selecto y de mayor nivel de la casa, te recomendamos:\n✨ *Parrilla Familiar* (*S/ 149.00*): nuestro banquete cumbre con cuadril premium, chuletas y chorizos artesanales.\n✨ *Parrilla Mixta Especial* (*S/ 58.00*): el plato individual más completo con variedad de carnes al carbón de algarrobo.\n✨ *Picaña a la Parrilla 350g* (*S/ 39.00*) o *Bife Ancho 350g* (*S/ 38.00*): cortes importados a término perfecto.\n¿Cuál de estos cortes selectos te mandamos a la brasa? ¡Pagas al toque con Yape o tarjeta! 📲✨`,
      sugerenciasComerciales: [
        `¿Marchamos la Parrilla Familiar (S/ 149.00)? 👑`,
        `¿Marchamos la Parrilla Mixta Especial (S/ 58.00)? 🥩`,
        `¿Prefieres la Picaña a la Parrilla 350g (S/ 39.00)? 🔥`,
      ],
      ofertaSugerida: {
        tipo: "PRODUCTO",
        id: 5,
        nombre: "Parrilla Mixta Especial",
        precio: 58.0,
        beneficio: "Corte individual premium de mayor valor en la carta",
      },
      accionTomada:
        "Atención especializada para cliente de alto valor / premium",
    };
  }

  // ===================================================================
  // 3. IDENTIDAD DEL AGENTE / "¿ERES UNA IA / BOT / HUMANO?"
  // ===================================================================
  const esPreguntaIdentidad =
    /eres (una? )?(ia|bot|humano|robot|inteligencia)|qui[eé]n (habla|eres)|con qui[eé]n hablo|c[oó]mo te llamas|quien me atiende/i.test(
      mensajeNorm,
    );
  if (esPreguntaIdentidad) {
    return {
      mensaje: `¡Hola, ${nombreCliente}! 🤖🥩 Soy el Agente Inteligente oficial de Parrilladas El Establo en Trujillo, conectado en tiempo real a nuestra base de datos SQL Server y cocina a la leña.\nMi trabajo es ayudarte al instante a elegir los mejores cortes según tu gusto, calcular combos y procesar tu pedido sin demoras. ¿Qué corte a la brasa te gustaría disfrutar hoy? 🔥📲`,
      sugerenciasComerciales: [
        "Ver carta de cortes a la brasa 🥩",
        "Ver combos para compartir 👥",
        "Consultar promociones vigentes 🎉",
      ],
      accionTomada: "Explicación transparente de identidad IA del restaurante",
    };
  }

  // ===================================================================
  // 4. PREGUNTAS FUERA DE TEMA (FÚTBOL, POLÍTICA, CULTURA GENERAL, IA GENERAL, ETC.)
  // ===================================================================
  const esFueraDeTema =
    /real madrid|barcelona|alianza|cristal|f[uú]tbol|partido|champions|messi|ronaldo|presidente|pol[ií]tica|elecciones|congreso|descubri[oó]|capital de|cu[aá]nto es|2\s*\+\s*2|poema|chiste|clima|temperatura|d[oó]lar|quien gan[oó]|qui[eé]n gan[oó]|cancion|canci[oó]n|filosof|historia del mundo/i.test(
      mensajeNorm,
    );
  if (esFueraDeTema) {
    return {
      mensaje: `¡Buena esa, ${nombreCliente}! 😄 Sea en el fútbol, el estudio o el día a día cada quien tiene su favorito, ¡pero el verdadero campeón indiscutible siempre se sirve en nuestra parrilla a la leña! 🔥🥩\nPara que disfrutes como se debe: ¿te preparamos una jugosa *Picaña (S/ 39.00)*, una *Tira de Cerdo (S/ 32.00)* o un *Combo Amigos (S/ 110.00)*? ¡Pagas al toque con Yape! 📲✨`,
      sugerenciasComerciales: [
        `¿Sale una Picaña a la Parrilla (S/ 39.00)? 🥩`,
        `¿Sale un Combo Amigos (S/ 110.00)? 🔥`,
        `¿Confirmas con Yape al toque? 📲`,
      ],
      ofertaSugerida: {
        tipo: "PRODUCTO",
        id: 2,
        nombre: "Picaña a la Parrilla 350 g",
        precio: 39.0,
      },
      accionTomada:
        "Pivote elegante y parrillero ante pregunta fuera de dominio",
    };
  }

  // ===================================================================
  // 5. UBICACIÓN EXACTA Y DIRECCIÓN DEL LOCAL
  // ===================================================================
  const esUbicacion =
    /d[oó]nde est[aá]n|d[oó]nde queda|d[oó]nde se ubican|ubicaci[oó]n|direcci[oó]n|c[oó]mo llegar|en qu[eé] parte|d[oó]nde est[aá] el local|d[oó]nde los encuentro|croquis|mapa/i.test(
      mensajeNorm,
    );
  if (esUbicacion) {
    return {
      mensaje: `¡Hola, ${nombreCliente}! 📍 Nuestro restaurante principal está ubicado en pleno corazón de Trujillo:\n🏠 *Av. Víctor Larco Herrera 1245, Trujillo* (a pocas cuadras del óvalo Larco).\nTambién contamos con cocina central para despachos delivery rápidos y calientes a toda la ciudad 🛵🔥.\n¿Nos visitas hoy en el salón o prefieres que te enviemos tu parrillada a domicilio? 📲`,
      sugerenciasComerciales: [
        "Pedir delivery a domicilio 🛵",
        "Reservar mesa en el local 🍽️",
        "Ver carta de cortes disponibles 🥩",
      ],
      accionTomada: "Información veraz de ubicación del local",
    };
  }

  // ===================================================================
  // 6. TIEMPO DE DEMORA Y LOGÍSTICA DE DELIVERY
  // ===================================================================
  const esTiempoDemora =
    /cu[aá]nto demora|tiempo de entrega|tiempo estimado|cu[aá]nto tarda|demora el delivery|a qu[eé] hora llega|demoran mucho/i.test(
      mensajeNorm,
    );
  if (esTiempoDemora) {
    return {
      mensaje: `¡Hola, ${nombreCliente}! ⏱️🛵 Nuestros pedidos a la leña demoran entre *30 a 45 minutos* como máximo.\nSalen recién retirados de las brasas y viajan en empaques térmicos sellados para que te lleguen hirviendo, crujientes y jugosos 🔥🥩.\n¿A qué dirección te lo enviamos? ¡Pásame tu pedido y lo ponemos a la brasa al instante! 📲`,
      sugerenciasComerciales: [
        "Confirmar dirección de envío 📍",
        "Pedir Combo Amigos (S/ 110.00) 👥",
        "Pagar con Yape al toque 📲",
      ],
      accionTomada: "Aclaración precisa de tiempo de entrega delivery",
    };
  }

  // ===================================================================
  // 7. COSTO DE DELIVERY Y COBERTURA (ZONAS, HUANCHACO, EL GOLF, ETC.)
  // ===================================================================
  const esCostoCobertura =
    /cu[aá]nto (cuesta|cobran|sale) el delivery|costo de env[ií]o|precio del delivery|cobertura|llegan a|huanchaco|v[ií]ctor larco|el golf|california|moche|laredo|la esperanza/i.test(
      mensajeNorm,
    );
  if (esCostoCobertura) {
    return {
      mensaje: `¡Llegamos a tu zona, ${nombreCliente}! 🛵🔥\n🛵 *Costo de delivery*: S/ 5.00 para Trujillo urbano, California y Víctor Larco (S/ 8.00 para Huanchaco o zonas periféricas).\n🎉 *¡PROMO DELIVERY!*: ¡Por pedidos desde *S/ 80.00* tu envío te sale totalmente GRATIS! 🎁\n¿A qué dirección exacta te enviamos tu parrillada? 📲✨`,
      sugerenciasComerciales: [
        "Aprovechar delivery gratis (+S/ 80) 🎁",
        "Confirmar dirección de entrega 🛵",
        "Ver combos parrillero 🥩",
      ],
      accionTomada: "Información de costo de delivery y cobertura por zonas",
    };
  }

  // ===================================================================
  // 8. CHIMICHURRI, SALSAS, CREMAS Y GUARNICIONES
  // ===================================================================
  const esSalsasGuarniciones =
    /chimichurri|salsas?|cremas?|aj[ií]|rocoto|vinagreta|papas r[uú]sticas|ensalada fresca|qu[eé] incluye/i.test(
      mensajeNorm,
    );
  if (esSalsasGuarniciones) {
    return {
      mensaje: `¡Por supuesto, ${nombreCliente}! 🤤 En El Establo *todos* nuestros platos y cortes vienen completos:\n✨ Porción abundante de papitas rústicas doradas 🥔\n✨ Ensalada parrillera fresca con vinagreta artesanal 🥗\n✨ Nuestro famoso *chimichurri parrillero de la casa* y ají criollo en salseros sellados 🌶️🔥.\n¿Deseas guarnición extra o te mandamos a preparar tu corte favorito? 📲`,
      sugerenciasComerciales: [
        `¿Sale una Picaña a la Parrilla 350g (S/ 39.00)? 🥩`,
        `¿Sale una Tira de Cerdo 350g (S/ 32.00)? 🔥`,
        `¿Agregar guarnición extra de papas rústicas? 🥔`,
      ],
      accionTomada: "Aclaración detallada de salsas y guarniciones incluidas",
    };
  }

  // ===================================================================
  // 9. TÉRMINO DE COCCIÓN DE LA CARNE (TÉRMINO MEDIO, 3/4, BIEN COCIDO)
  // ===================================================================
  const esTerminoCarne =
    /t[eé]rmino|cocci[oó]n|tres cuartos|t[eé]rmino medio|bien cocid|jugos[oa]|a qu[eé] punto/i.test(
      mensajeNorm,
    );
  if (esTerminoCarne) {
    return {
      mensaje: `¡Al punto exacto que a ti te guste, ${nombreCliente}! 🥩🔥\nNuestros maestros parrilleros dominan cada término al carbón de algarrobo:\n🔴 *Término Medio*: centro rojo jugoso y suave.\n🟠 *Tres Cuartos (3/4)*: el preferido de la casa, sellado perfecto con centro rosado jugoso.\n🟤 *Bien Cocido*: dorado parejo y bien asado sin perder sabor.\n¿En qué término te preparamos tu corte? 🤤📲`,
      sugerenciasComerciales: [
        "Término 3/4 (Recomendado de la casa) 🥩",
        "Término Medio (Súper jugoso) 🔥",
        "Bien cocido 👍",
      ],
      accionTomada:
        "Asesoramiento profesional sobre términos de cocción cárnica",
    };
  }

  // ===================================================================
  // 10. LIBRO DE RECLAMACIONES Y GARANTÍA COMERCIAL
  // ===================================================================
  const esLibroReclamaciones =
    /libro de reclamacion|reclamaciones|queja|indecopi|reclamar/i.test(
      mensajeNorm,
    );
  if (esLibroReclamaciones) {
    return {
      mensaje: `¡Por supuesto, ${nombreCliente}! 📖 Conforme a la normativa de INDECOPI, contamos con Libro de Reclamaciones físico en nuestro local y virtual disponible para todos nuestros clientes.\nAdemás, en El Establo tenemos *Garantía de Satisfacción 100%*: si algo no está a tu gusto, te lo solucionamos de inmediato 🥩🤝.\n¿Tuviste algún inconveniente o deseas realizar un pedido? 📲`,
      sugerenciasComerciales: [
        "Atención personalizada con encargado",
        "Ver carta de cortes a la leña",
      ],
      accionTomada:
        "Respuesta formal y transparente sobre libro de reclamaciones",
    };
  }

  // ===================================================================
  // 11. COMIDA NO PARRILLERA (POLLO A LA BRASA, CHIFA, PIZZA, CEVICHE)
  // ===================================================================
  const esComidaNoParrillera =
    /pollo a la brasa|venden pollo|tienen pollo|chifa|arroz chaufa|pizza|hamburguesa|ceviche|cebiche|marisco|pescado/i.test(
      mensajeNorm,
    );
  if (esComidaNoParrillera) {
    return {
      mensaje: `¡Hola, ${nombreCliente}! 🥩🔥 En El Establo somos un templo especializado 100% en *Carnes y Parrilladas a la Leña de Algarrobo* (cortes finos de res de 350g, tierna tira de cerdo y chorizos parrilleros).\nNo vendemos pollo a la brasa comercial ni chifa, ¡pero te aseguro que un corte a la brasa con papitas rústicas y chimichurri te dejará fascinado! 🤤\n¿Te animas por una jugosa *Picaña (S/ 39.00)* o *Tira de Cerdo (S/ 32.00)*? 📲`,
      sugerenciasComerciales: [
        `¿Sale una Picaña a la Parrilla (S/ 39.00)? 🥩`,
        `¿Sale una Tira de Cerdo (S/ 32.00)? 🔥`,
        `¿Sale un Chorizo Parrillero (S/ 15.00)? 🌭`,
      ],
      accionTomada:
        "Diferenciación de especialidad de la carta frente a comida rápida",
    };
  }

  // ===================================================================
  // 12. CHORIZO PICANTE / ALERGIAS / CONDIMENTOS
  // ===================================================================
  const esPreguntaIngredientes =
    /chorizo.*picante|pica el chorizo|es picante|muy picante|tiene aj[ií]|alergia|gluten|condimento/i.test(
      mensajeNorm,
    );
  if (esPreguntaIngredientes) {
    return {
      mensaje: `¡Para nada, ${nombreCliente}! 🥩 Nuestros chorizos criollos son artesanales y tienen una sazón suave y aromática a finas hierbas, *cero picantes* y aptos para toda la familia y niños 👍.\nLos ajíes criollos y chimichurris picantitos van siempre en salseros por separado para que tú le des el toque que más te guste 🌶️.\n¿Te mandamos a dorar un chorizo a la brasa? ¡Solo S/ 15.00 con papas y ensalada! 📲✨`,
      sugerenciasComerciales: [
        `¿Sale el Chorizo a la Parrilla (S/ 15.00)? 🌭`,
        `¿Prefieres la Picaña 350g (S/ 39.00)? 🥩`,
        `¿Confirmas con Yape? 📲`,
      ],
      accionTomada: "Aclaración de ingredientes y nivel de picor del chorizo",
    };
  }

  // ===================================================================
  // 13. MEDIOS DE PAGO Y CONTRAENTREGA
  // ===================================================================
  const esPreguntaPago =
    /contraentrega|contra entrega|pagar al recibir|efectivo|yape|plin|tarjeta|transferencia|con qu[eé] puedo pagar|medios? de pago|c[oó]mo pago/i.test(
      mensajeNorm,
    );
  if (esPreguntaPago) {
    return {
      mensaje: `¡Al toque, ${nombreCliente}! 📲 Facilitamos tu pago al 100%:\n📱 *Yape y Plin*: pago digital inmediato.\n💳 *Tarjetas*: aceptamos Visa, Mastercard y débito.\n💵 *Contraentrega*: puedes pagar en efectivo o por Yape al repartidor cuando recibas tu pedido caliente en tu puerta 🛵🔥.\n¿Con qué medio te resulta más cómodo pagar hoy? 🥩`,
      sugerenciasComerciales: [
        "Pagar con Yape / Plin al instante 📲",
        "Pagar en efectivo contraentrega 💵",
        "Pagar con tarjeta de crédito/débito 💳",
      ],
      accionTomada:
        "Presentación completa y clara de métodos de pago autorizados",
    };
  }

  // ===================================================================
  // 14. COMPROBANTES DE PAGO: BOLETA, FACTURA Y RUC
  // ===================================================================
  const esComprobante = /boleta|factura|ruc|comprobante|raz[oó]n social/i.test(
    mensajeNorm,
  );
  if (esComprobante) {
    return {
      mensaje: `¡Por supuesto, ${nombreCliente}! 📄 Emitimos *Boleta de Venta* electrónica y *Factura con RUC* para empresas de forma automática.\nSolo nos envías tu número de DNI o RUC con la razón social al confirmar tu pedido y te enviamos el PDF al WhatsApp 📑✨.\n¿Qué cortes o combos te facturamos hoy? 🥩📲`,
      sugerenciasComerciales: [
        "Solicitar Boleta electrónica 🧾",
        "Solicitar Factura con RUC 🏢",
        "Confirmar pedido parrillero 🥩",
      ],
      accionTomada: "Garantía de comprobantes tributarios formales",
    };
  }

  // ===================================================================
  // 15. TÁPERS Y EMPAQUES PARA LLEVAR (¿COBRAN TÁPER?)
  // ===================================================================
  const esEmpaque =
    /t[aá]per|cobran t[aá]per|empaque|descartable|para llevar|caja/i.test(
      mensajeNorm,
    );
  if (esEmpaque) {
    return {
      mensaje: `¡Cero costo extra, ${nombreCliente}! 📦🔥 En El Establo los empaques térmicos sellados de alta densidad van *totalmente incluidos sin costo adicional*.\nGarantizan que tu carne, guarniciones y papitas lleguen humeantes y perfectas a tu mesa como si estuvieras en el local 🥩✨.\n¿Qué parrillada te empacamos hoy? 📲`,
      sugerenciasComerciales: [
        `¿Sale la Parrilla Familiar (S/ 149.00)? 👨‍👩‍👧‍👦`,
        `¿Sale el Combo Amigos (S/ 110.00)? 👥`,
        `¿Sale la Picaña 350g (S/ 39.00)? 🥩`,
      ],
      accionTomada: "Aclaración sobre gratuidad de empaques térmicos",
    };
  }

  // ===================================================================
  // 16. PREGUNTAS SOBRE EL DUEÑO, HISTORIA Y DIFERENCIAL
  // ===================================================================
  const esDiferencialDuenio =
    /qui[eé]n es el due[nñ]o|de qui[eé]n es|por qu[eé].*(comprar|elegir|preferir|ustedes|el establo)|qu[eé] los diferencia|por qu[eé] son mejores|por qu[eé] deber[ií]a|competencia/i.test(
      mensajeNorm,
    );
  if (esDiferencialDuenio) {
    return {
      mensaje: `¡Parrilladas El Establo es tradición trujillana a la leña, ${nombreCliente}! 🥩🔥 Fundada por apasionados maestros parrilleros, nos diferenciamos por:\n1️⃣ Leña 100% de algarrobo que brinda un aroma ahumado único.\n2️⃣ Cortes madurados de 350g reales, suaves y jugosos.\n3️⃣ Guarnición abundante de papas rústicas y ensalada fresca incluida.\n4️⃣ Entregas calientes en menos de 45 minutos ⏱️.\n¡Haz la prueba hoy y siente la diferencia! ¿Qué corte te marchamos? 📲`,
      sugerenciasComerciales: [
        `¿Sale una Picaña a la Parrilla (S/ 39.00)? 🥩`,
        `¿Sale una Tira de Cerdo (S/ 32.00)? 🔥`,
        `¿Pagas con Yape al toque? 📲`,
      ],
      accionTomada: "Presentación de propuesta de valor y origen empresarial",
    };
  }

  // ===================================================================
  // 17. SERVICIOS DEL LOCAL: COCHERA, PET-FRIENDLY, WIFI
  // ===================================================================
  if (/estacionamiento|cochera|parqueo|donde cuadrar/i.test(mensajeNorm)) {
    return {
      mensaje: `¡Hola, ${nombreCliente}! 🚗🅿️ Sí, en nuestro local de Av. Larco contamos con *estacionamiento privado vigilado gratuito* para la comodidad de todos nuestros comensales.\n¿Nos visitas hoy para disfrutar de las mejores carnes al carbón? 🥩🔥`,
      sugerenciasComerciales: [
        "Reservar mesa en el local 🍽️",
        "Ver carta de cortes disponibles 🥩",
      ],
      accionTomada: "Información de estacionamiento del local",
    };
  }

  if (/pet friendly|mascota|perro|gato/i.test(mensajeNorm)) {
    return {
      mensaje: `¡Totalmente, ${nombreCliente}! 🐾🥩 Nuestra terraza parrillera es *100% Pet-Friendly*, así que tu engreído de 4 patas es más que bienvenido a acompañarte.\n¿Te reservamos una mesa en la terraza para hoy? 📲`,
      sugerenciasComerciales: [
        "Reservar en terraza pet-friendly 🐕",
        "Ver carta de cortes a la leña 🥩",
      ],
      accionTomada: "Aclaración política pet-friendly",
    };
  }

  // ===================================================================
  // 18. HORARIOS DE ATENCIÓN
  // ===================================================================
  if (
    /horario|a qu[eé] hora (abren|cierran|atienden)|atienden hoy|abierto hoy|hasta qu[eé] hora/i.test(
      mensajeNorm,
    )
  ) {
    return {
      mensaje: `¡Hola, ${nombreCliente}! ⏰ Atendemos de *Lunes a Domingo de 12:00 m. a 11:00 p.m.* ininterrumpidamente.\n¡Las brasas ya están encendidas y las carnes listas! ¿Te mandamos tu pedido por delivery o pasas a disfrutarlo en nuestro local? 🥩🔥`,
      sugerenciasComerciales: [
        "Pedir delivery a domicilio 🛵",
        "Consultar ubicación del local 📍",
        "Ver cortes disponibles 🥩",
      ],
      accionTomada: "Información veraz de horario comercial",
    };
  }

  // ===================================================================
  // 18. DIETAS VEGETARIANAS O MARISCOS
  // ===================================================================
  if (
    /vegetari|vegan|no como carne|pescado|ceviche|cebiche|mariscos/i.test(
      mensajeNorm,
    )
  ) {
    return {
      mensaje: `¡Hola, ${nombreCliente}! 🥩 Nuestra pasión y especialidad son 100% las carnes finas a la leña (res, cerdo y chorizos artesanales). Si buscas una alternativa fresca, tenemos nuestra deliciosa *Ensalada César (S/ 18.00)*, papas rústicas doradas y bebidas naturales como Chicha Morada (S/ 12.00) 🥗✨.\n¿Te gustaría probarlas o prefieres ver la carta parrillera? 🔥`,
      sugerenciasComerciales: [
        `¿Sale una Ensalada César (S/ 18.00)? 🥗`,
        `¿Deseas una Chicha Morada de 1L (S/ 12.00)? 🥤`,
        `Ver carta parrillera completa 🥩`,
      ],
      ofertaSugerida: {
        tipo: "PRODUCTO",
        id: 7,
        nombre: "Ensalada César",
        precio: 18.0,
      },
      accionTomada:
        "Aclaración de especialidad gastronómica y opciones complementarias",
    };
  }

  // ===================================================================
  // 19. RESERVAS Y EVENTOS
  // ===================================================================
  if (
    /reserva|reservar|cumplea[nñ]os|evento|reuni[oó]n|fiesta|grupo grande/i.test(
      mensajeNorm,
    )
  ) {
    return {
      mensaje: `¡Claro que sí, ${nombreCliente}! 🎉 Celebramos cumpleaños y reuniones con la mejor parrilla de Trujillo.\nPodemos prepararte banquetes completos como la *Parrilla Familiar (S/ 149.00)* o *Combo Amigos (S/ 110.00)* con atención preferencial 🥩🥳.\n¿Para cuántas personas sería y para qué fecha lo estás planificando? 📲`,
      sugerenciasComerciales: [
        "Cotizar para grupo de 4 a 6 personas 👥",
        "Cotizar para evento de 10+ personas 🥳",
        "Consultar disponibilidad de mesas 🍽️",
      ],
      accionTomada: "Atención comercial para reservas y eventos grupales",
    };
  }

  // ===================================================================
  // 20. BEBIDAS Y LICORES
  // ===================================================================
  if (
    /cerveza|vino|sangr[ií]a|chicha|gaseosa|bebida|trago|licor/i.test(
      mensajeNorm,
    )
  ) {
    return {
      mensaje: `¡Salud, ${nombreCliente}! 🍷 Para acompañar tus carnes al carbón tenemos nuestra refrescante jarra de *Sangría de 1L (S/ 22.00)*, *Chicha Morada de 1L (S/ 12.00)*, cervezas bien frías y gaseosas ❄️🍻.\n¿Te agregamos una jarra a tu pedido? 🥩`,
      sugerenciasComerciales: [
        `¿Agregamos Sangría de 1L (S/ 22.00)? 🍷`,
        `¿Agregamos Chicha Morada de 1L (S/ 12.00)? 🥤`,
        `¿Confirmas por Yape? 📲`,
      ],
      ofertaSugerida: {
        tipo: "PRODUCTO",
        id: 9,
        nombre: "Sangría 1L",
        precio: 22.0,
      },
      accionTomada: "Sugerencia de maridaje y bebidas",
    };
  }

  // ===================================================================
  // 21. AGRADECIMIENTOS Y DESPEDIDAS CORTESES
  // ===================================================================
  if (
    /^(gracias|muchas gracias|te agradezco|mil gracias|chau|adi[oó]s|hasta luego|nos vemos|buenas noches|buenos d[ií]as|buenas tardes)/i.test(
      mensajeNorm.trim(),
    )
  ) {
    return {
      mensaje: `¡A ti, ${nombreCliente}! 🙌 Siempre un placer atenderte. Cuando el cuerpo te pida una buena carne a la leña en Trujillo, aquí te esperamos con las brasas encendidas. ¡Que tengas un excelente día! 🥩🔥`,
      sugerenciasComerciales: [
        "Agradecer al cliente y cerrar ciclo",
        "Registrar interacción positiva",
      ],
      accionTomada: "Despedida y agradecimiento cortés",
    };
  }

  // ===================================================================
  // 22. GIBBERISH / TECLAZO / MENSAJES SIN SENTIDO O RANDOM STRINGS
  // ===================================================================
  const soloLetrasLimpias = mensajeNorm.replace(/[^a-záéíóú]/gi, "");
  const esTeclazoPatron =
    /(?:asdf|sdfg|dfgh|fghj|ghjk|hjkl|jklñ|qwer|wert|erty|rtyu|tyui|yuio|uiop|zxcv|xcvb|cvbn|vbnm|1234|2345|3456|4567|5678|6789|asda|sada|dasd)/i.test(
      mensajeNorm,
    );
  const esGibberish =
    esTeclazoPatron ||
    (soloLetrasLimpias.length >= 4 &&
      !/[aeiouáéíóú]/i.test(soloLetrasLimpias)) ||
    /^([^a-zA-Z0-9]+)$/.test(mensajeNorm.trim()) ||
    /(.)\1{4,}/.test(mensajeNorm.trim());

  if (esGibberish) {
    return {
      mensaje: `¡Hola, ${nombreCliente}! 🥩🔥 Parece que tu mensaje llegó con un poquito de humo de la parrilla o se cruzaron los dedos en el teclado 😄.\nComo asesor parrillero de El Establo, estoy aquí para mostrarte nuestros cortes finos a la leña, combos para compartir o promociones del día. ¿Qué se te antoja disfrutar hoy? 📲✨`,
      sugerenciasComerciales: [
        "Ver cortes a la brasa 🥩",
        "Ver combos para compartir 👥",
        "Consultar promociones 🎉",
      ],
      accionTomada:
        "Manejo amigable y profesional de texto no legible / sin sentido",
    };
  }

  // CASO COMERCIAL 3: RECOMENDACIÓN PARA FAMILIA / GRUPO (ESCENARIO 3)
  if (
    mensajeNorm.includes("familia") &&
    (mensajeNorm.includes("recomiendas") ||
      mensajeNorm.includes("parrillada") ||
      mensajeNorm.includes("abundante") ||
      mensajeNorm.includes("4 personas") ||
      mensajeNorm.includes("cuatro"))
  ) {
    return {
      mensaje: `¡Hola, ${nombreCliente}! 👨‍👩‍👧‍👦🔥 Para disfrutar en familia te recomiendo a ojos cerrados nuestra *Parrilla Familiar* a solo *S/ 149.00*: cuadril premium, chuleta parrillera jugosa, chorizos artesanales, papas doradas crocantes y ensalada fresca (rinde perfecto para 4 a 5 personas 🥩🤤).\n¿Te la mandamos a la brasa? ¡Pagas al toque con Yape o Plin! 📲✨`,
      sugerenciasComerciales: [
        `¿Marchamos la Parrilla Familiar (S/ 149.00)? 👨‍👩‍👧‍👦`,
        `¿Prefieres la Parrilla Mixta Especial (S/ 58.00)? 🥩`,
        `¿Confirmas con Yape al toque? 📲`,
      ],
      ofertaSugerida: {
        tipo: "COMBO",
        id: 1,
        nombre: "Parrilla Familiar",
        precio: 149.0,
        beneficio:
          "Parrillada abundante para 4 a 5 personas con guarniciones completas",
      },
      accionTomada:
        "Recomendación especializada para segmento Familia (Regla 3)",
    };
  }

  // CASO COMERCIAL 6: SEGUIMIENTO COMERCIAL Y REACTIVACIÓN (ESCENARIO 6)
  if (
    mensajeNorm.includes("me quede pensando") ||
    mensajeNorm.includes("me quedé pensando") ||
    mensajeNorm.includes("estaba pensando") ||
    mensajeNorm.includes("sigo pensando")
  ) {
    const fav = favDeclarado || "Tira de Cerdo";
    return {
      mensaje: `¡Hola, ${nombreCliente}! 🥩🔥 ¡Qué bueno que me escribas! Las brasas siguen prendidas y podemos prepararte esa *${fav}* o un combo parrillero calientito al toque.\n¿Te animas a que lo marchemos ahora mismo? ¡Pagas fácil con Yape! 🤤📲`,
      sugerenciasComerciales: [
        `¿Marchamos tu pedido calientito hoy? 🥩`,
        `¿Deseas delivery o pasar a recoger? 🛵`,
        `¿Confirmamos por Yape? 📲`,
      ],
      ofertaSugerida: {
        tipo: "PRODUCTO",
        id: preferencias?.id_producto_favorito || 1,
        nombre: fav,
      },
      accionTomada: "Reactivación y seguimiento inteligente (Regla 6)",
    };
  }

  // CASO 1: Puntos, monosílabos o mensajes ultracortos (".", "👍", "ok", "oe", "?")
  if (
    mensajeNorm.length <= 2 ||
    mensajeNorm === "..." ||
    mensajeNorm === "ok" ||
    mensajeNorm === "ya" ||
    mensajeNorm === "bueno"
  ) {
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

  // CASO COMERCIAL 1: PREGUNTA POR RECOMENDACIÓN / QUÉ COMER HOY (ESCENARIO 1)
  if (
    mensajeNorm.includes("que me recomiendas") ||
    mensajeNorm.includes("qué me recomiendas") ||
    mensajeNorm.includes("que recomiendas") ||
    mensajeNorm.includes("qué recomiendas") ||
    mensajeNorm.includes("recomiendame") ||
    mensajeNorm.includes("recomiéndame") ||
    mensajeNorm.includes("que comer") ||
    mensajeNorm.includes("qué comer") ||
    mensajeNorm.includes("que hay de bueno") ||
    mensajeNorm.includes("que me sugieres")
  ) {
    const fav = favDeclarado;
    if (fav) {
      let precioFav = 32.0;
      if (
        fav.toLowerCase().includes("picana") ||
        fav.toLowerCase().includes("picaña")
      )
        precioFav = 39.0;
      else if (fav.toLowerCase().includes("bife")) precioFav = 38.0;
      else if (fav.toLowerCase().includes("chorizo")) precioFav = 15.0;
      else if (fav.toLowerCase().includes("mixta")) precioFav = 58.0;
      else if (fav.toLowerCase().includes("personal")) precioFav = 35.0;

      try {
        await toolRegistrarOfertaLead(idNegociacion, {
          detalle: `Recomendación personalizada basada en favorito SQL: ${fav} (S/ ${precioFav.toFixed(2)})`,
        });
      } catch (e) {}

      return {
        mensaje: `¡Hola, ${nombreCliente}! 🥩🔥 Como sé que tu corte favorito es la *${fav}* (*S/ ${precioFav.toFixed(2)}*), hoy sale jugosísima a la brasa con papas rústicas y ensalada fresca.\n¿Te la mandamos a preparar calientita? ¡Pagas al toque con Yape o Plin! 📲✨`,
        sugerenciasComerciales: [
          `¿Marchamos tu ${fav} (S/ ${precioFav.toFixed(2)})? 🥩`,
          `¿Prefieres probar otro corte hoy? 🔥`,
          `¿Confirmas con Yape al toque? 📲`,
        ],
        ofertaSugerida: {
          tipo: "PRODUCTO",
          id: preferencias?.id_producto_favorito || 1,
          nombre: fav,
          precio: precioFav,
          beneficio: "Tu corte favorito registrado en SQL Server V3",
        },
        accionTomada:
          "Recomendación personalizada por corte favorito (Regla 1)",
      };
    } else {
      // Sin favorito declarado: recomendar top corte del segmento
      return {
        mensaje: `¡Hola, ${nombreCliente}! 🥩🔥 Te recomiendo nuestra estrella a la leña: *Tira de Cerdo 350g* (*S/ 32.00*) o *Combo Amigos* (*S/ 110.00*) con papas rústicas y ensalada fresca.\n¿Cuál se te antoja hoy? ¡Pagas al toque con Yape! 📲✨`,
        sugerenciasComerciales: [
          `¿Sale la Tira de Cerdo (S/ 32.00)? 🥩`,
          `¿Sale el Combo Amigos (S/ 110.00)? 🔥`,
          `¿Confirmas por Yape? 📲`,
        ],
        ofertaSugerida: {
          tipo: "PRODUCTO",
          id: 1,
          nombre: "Tira de Cerdo 350 g",
          precio: 32.0,
        },
        accionTomada: "Recomendación por corte popular de segmento",
      };
    }
  }

  // CASO COMERCIAL 9: CONSULTA DE CORTE FAVORITO / HISTORIAL REGISTRADO (ESCENARIO 9)
  if (
    mensajeNorm.includes("cual era mi corte favorito") ||
    mensajeNorm.includes("cuál era mi corte favorito") ||
    mensajeNorm.includes("mi corte favorito de la ultima vez") ||
    mensajeNorm.includes("mi corte favorito de la última vez") ||
    mensajeNorm.includes("cual es mi favorito") ||
    mensajeNorm.includes("cuál es mi favorito")
  ) {
    const fav = favDeclarado || "Tira de Cerdo";
    return {
      mensaje: `¡Hola, ${nombreCliente}! 🥩 En tu ficha registrada en SQL Server, tu corte favorito es la *${fav}*.\n¿Te la mandamos a preparar hoy calientita a la brasa? ¡Pagas al toque con Yape! 📲✨`,
      sugerenciasComerciales: [
        `¿Sale tu ${fav} hoy? 🥩`,
        `¿Deseas probar otro corte de la carta? 🔥`,
        `¿Confirmas por Yape? 📲`,
      ],
      ofertaSugerida: {
        tipo: "PRODUCTO",
        id: preferencias?.id_producto_favorito || 1,
        nombre: fav,
      },
      accionTomada: "Aislamiento e independencia de perfil comercial (Regla 9)",
    };
  }

  // CASO COMERCIAL 5: SOLICITUD DE PROMOCIÓN NO ELEGIBLE (ESCENARIO 5)
  if (
    (mensajeNorm.includes("15%") || mensajeNorm.includes("estudiante")) &&
    (mensajeNorm.includes("familiar") ||
      mensajeNorm.includes("fin de semana") ||
      mensajeNorm.includes("domingo") ||
      mensajeNorm.includes("sabado") ||
      mensajeNorm.includes("sábado"))
  ) {
    return {
      mensaje: `¡Hola, ${nombreCliente}! 🥩 El *Descuento Estudiante (15%)* aplica exclusivamente de lunes a jueves en cortes individuales. Para tu pedido familiar te recomiendo nuestra *Parrilla Familiar (S/ 149.00)* o *Parrilla Mixta Especial (S/ 58.00)* que ya vienen con guarnición abundante.\n¿Te la mandamos a la brasa? ¡Pagas al toque con Yape! 👨‍👩‍👧‍👦📲`,
      sugerenciasComerciales: [
        `¿Marchamos la Parrilla Familiar (S/ 149.00)? 🥩`,
        `¿Prefieres la Parrilla Mixta Especial (S/ 58.00)? 🔥`,
        `¿Confirmamos por Yape? 📲`,
      ],
      ofertaSugerida: {
        tipo: "COMBO",
        id: 1,
        nombre: "Parrilla Familiar",
        precio: 149.0,
      },
      accionTomada: "Explicación cortés de promoción no elegible (Regla 5)",
    };
  }

  // CASO COMERCIAL 10: COMPROBACIÓN DE CANAL WHATSAPP OFICIAL (ESCENARIO 10)
  if (
    mensajeNorm.includes("conectado con la parrilla") ||
    mensajeNorm.includes("canal oficial") ||
    mensajeNorm.includes("este canal esta conectado") ||
    mensajeNorm.includes("este canal está conectado")
  ) {
    return {
      mensaje: `¡Totalmente confirmado, ${nombreCliente}! 🥩📲 Este es el canal oficial de WhatsApp Cloud API de Parrilladas El Establo en Trujillo, conectado directamente a nuestro sistema y cocina a la leña.\n¿En qué te podemos consentir hoy? ¡Te mandamos tu pedido al toque! 🔥`,
      sugerenciasComerciales: [
        `Ver cortes a la brasa 🥩`,
        `Ver combos para compartir 👥`,
        `Consultar promociones vigentes 🎉`,
      ],
      accionTomada:
        "Validación de conectividad WhatsApp Cloud API Meta (Regla 10)",
    };
  }

  // CASO DIRECTO: ELECCIÓN DE PLATO O COMBO (Ej: "Combo Amigos", "Chorizo", "Tira de Cerdo")
  if (
    mensajeNorm.includes("combo amigos") ||
    (mensajeNorm.includes("amigos") &&
      !mensajeNorm.includes("somos") &&
      !mensajeNorm.includes("personas"))
  ) {
    try {
      await toolRegistrarOfertaLead(idNegociacion, {
        idCombo: 2,
        detalle: "Combo Amigos (S/ 110.00) confirmado por el cliente",
      });
    } catch (e) {}

    return {
      mensaje: `¡Golazo, ${nombreCliente}! 🎉 Marchando ese *Combo Amigos* (*S/ 110.00*): bife ancho, chorizos artesanales, anticuchos, papas rústicas y ensalada fresca 🥩🤤.\n¿Te lo mandamos a preparar calientito? ¡Pagas al toque con Yape o Plin! 📲✨`,
      sugerenciasComerciales: [
        `¿Marchamos el Combo Amigos (S/ 110.00)? 🔥`,
        `¿Agregamos una jarra de sangría o chicha? 🍷`,
        `¿Confirmas con Yape al toque? 📲`,
      ],
      ofertaSugerida: {
        tipo: "COMBO",
        id: 2,
        nombre: "Combo Amigos",
        precio: 110.0,
      },
      accionTomada: "Confirmación directa Combo Amigos",
    };
  }

  if (
    mensajeNorm.includes("parrilla familiar") ||
    mensajeNorm.includes("combo familiar")
  ) {
    return {
      mensaje: `¡Perfecto, ${nombreCliente}! 👨‍👩‍👧‍👦 Sale la *Parrilla Familiar* (*S/ 149.00*): cuadril, chuleta, chorizos, papas y ensalada para 4 a 5 personas 🥩🔥.\n¿La mandamos a la brasa? ¡Pagas al toque con Yape! 📲✨`,
      sugerenciasComerciales: [
        `¿Marchamos la Parrilla Familiar (S/ 149.00)? 🥩`,
        `¿Para cuántas personas enviamos cubiertos? 🍽️`,
        `¿Te paso el número de Yape? 📲`,
      ],
      ofertaSugerida: {
        tipo: "COMBO",
        id: 1,
        nombre: "Parrilla Familiar",
        precio: 149.0,
      },
      accionTomada: "Confirmación Parrilla Familiar",
    };
  }

  if (mensajeNorm.includes("chorizo")) {
    return {
      mensaje: `¡De una, ${nombreCliente}! 🥩🔥 Sale ese *Chorizo a la Parrilla* (*S/ 15.00*) bien doradito con papas rústicas y ensalada.\n¿Te lo mandamos a preparar? ¡Pagas al toque con Yape! 📲✨`,
      sugerenciasComerciales: [
        `¿Marchamos el Chorizo (S/ 15.00) calientito? 🔥`,
        `¿Deseas agregar gaseosa helada? 🥤`,
        `¿Te paso el Yape del restaurante? 📲`,
      ],
      ofertaSugerida: {
        tipo: "PRODUCTO",
        id: 1,
        nombre: "Chorizo a la Parrilla",
        precio: 15.0,
        beneficio: "Chorizo artesanal a la brasa",
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
        tipo: "PRODUCTO",
        id: 2,
        nombre: "Tira de Cerdo 350 g",
        precio: 32.0,
      },
      accionTomada: "Confirmación directa de pedido",
    };
  }

  if (mensajeNorm.includes("picana") || mensajeNorm.includes("picaña")) {
    return {
      mensaje: `¡Excelente elección, ${nombreCliente}! 🥩 Nuestra *Picaña a la Parrilla 350g* (*S/ 39.00*) sale con su grasita dorada a punto, papas y ensalada.\n¿Te la mandamos a preparar calientita? ¡Pagas al toque con Yape! 📲✨`,
      sugerenciasComerciales: [
        `¿Marchamos la Picaña (S/ 39.00)? 🥩`,
        `¿Deseas agregar bebida helada? 🥤`,
        `¿Confirmas con Yape? 📲`,
      ],
      ofertaSugerida: {
        tipo: "PRODUCTO",
        id: 2,
        nombre: "Picaña a la Parrilla 350 g",
        precio: 39.0,
      },
      accionTomada: "Confirmación directa Picaña",
    };
  }

  // CASO COMERCIAL A: COMPRA GRUPAL CON PRESUPUESTO ACOTADO (Ej: "Quiero una parrillada para cuatro personas, pero solo tengo S/ 120")
  if (
    (mensajeNorm.includes("cuatro personas") ||
      mensajeNorm.includes("4 personas") ||
      mensajeNorm.includes("4 amigos") ||
      mensajeNorm.includes("para cuatro") ||
      mensajeNorm.includes("para 4")) &&
    (mensajeNorm.includes("120") ||
      mensajeNorm.includes("solo tengo") ||
      mensajeNorm.includes("presupuesto") ||
      mensajeNorm.includes("alcanza") ||
      mensajeNorm.includes("plata"))
  ) {
    try {
      await toolRegistrarNecesidadLead(
        idNegociacion,
        "Parrillada para 4 comensales",
        4,
        120.0,
      );
      await toolRegistrarObjecionLead(
        idNegociacion,
        "PRESUPUESTO",
        "Presupuesto acotado a S/ 120 para 4 personas",
      );
      await toolRegistrarOfertaLead(idNegociacion, {
        idCombo: 2, // Combo Amigos
        detalle:
          "Combo Amigos (S/ 110.00) sugerido para 4 personas dentro de presupuesto S/ 120",
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
        tipo: "COMBO",
        id: 2,
        nombre: "Combo Amigos",
        precio: 110.0,
        beneficio: "Parrillada para 4 comensales dentro de presupuesto S/ 120",
      },
      accionTomada: "Negociación grupal con presupuesto ajustado",
    };
  }

  // CASO COMERCIAL B: CONSULTA DE GRAMAJE / PESO DE CARNE (Ej: "¿Tienen cortes de 250 gramos?", "gramos", "peso")
  if (
    mensajeNorm.includes("250 gramos") ||
    mensajeNorm.includes("250g") ||
    mensajeNorm.includes("250 g")
  ) {
    try {
      await toolRegistrarAccionAgente({
        id_negociacion: idNegociacion,
        accion: "CONSULTAR_GRAMAJE",
        detalle: `Consulta de gramaje 250g realizada por ${nombreCliente}`,
        resultado: "EXITOSO",
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
        tipo: "PRODUCTO",
        id: 2,
        nombre: "Picaña a la Parrilla 350 g",
        precio: 39.0,
      },
      accionTomada: "Aclaración veraz de gramajes oficiales V3",
    };
  }

  // CASO COMERCIAL C: PREFERENCIA GASTRONÓMICA DECLARADA (Ej: "Me gusta la Tira de Cerdo", "Mi corte favorito es la Picaña")
  if (
    mensajeNorm.includes("me gusta") ||
    mensajeNorm.includes("mi favorito") ||
    mensajeNorm.includes("mi corte favorito")
  ) {
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
      await toolRegistrarPreferenciaLead(
        idPersona,
        idProd,
        "CONVERSACION_ACTIVA",
      );
      await toolRegistrarOfertaLead(idNegociacion, {
        idProducto: idProd,
        detalle: `Oferta de ${nombreProd} (Preferencia declarada)`,
      });
    } catch (e) {}

    return {
      mensaje: `¡Excelente gusto, ${nombreCliente}! 🥩 Nuestra *${nombreProd}* (*S/ ${precioProd.toFixed(2)}*) sale jugosísima a la leña con papas rústicas y ensalada fresca.\n¿Te la mandamos a preparar calientita? ¡Pagas al toque con Yape! 📲✨`,
      sugerenciasComerciales: [
        `¿Marchamos tu ${nombreProd} (S/ ${precioProd.toFixed(2)})? 🥩`,
        `¿Deseas agregar bebida helada? 🥤`,
        `¿Confirmas por Yape o Plin? 📲`,
      ],
      ofertaSugerida: {
        tipo: "PRODUCTO",
        id: idProd,
        nombre: `${nombreProd} 350 g`,
        precio: precioProd,
      },
      accionTomada: "Recomendación por preferencia gastronómica declarada",
    };
  }

  // CASO COMERCIAL D: DESISTIMIENTO / RECHAZO EXPLÍCITO ("no voy a comprar", "ya no deseo", "comeré en casa")
  if (
    mensajeNorm.includes("no voy a comprar") ||
    mensajeNorm.includes("ya no deseo") ||
    mensajeNorm.includes("no deseo comprar") ||
    mensajeNorm.includes("comere en casa") ||
    mensajeNorm.includes("comeré en casa")
  ) {
    try {
      await toolRegistrarRespuestaOferta(
        idNegociacion,
        "RECHAZADA",
        undefined,
        "Cliente manifestó rechazo explícito sin compra",
      );
      await toolRegistrarAccionAgente({
        id_negociacion: idNegociacion,
        accion: "REGISTRAR_RECHAZO_EXPLICITO",
        detalle: `Rechazo explícito recibido de ${nombreCliente}: preservada cortesía sin insistencia invasiva`,
        resultado: "EXITOSO",
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
          tipo: "PRODUCTO",
          id: 1,
          nombre: "Chorizo a la Parrilla",
          precio: 15.0,
          beneficio: "Chorizo artesanal a la brasa",
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
          tipo: "PRODUCTO",
          id: 2,
          nombre: "Tira de Cerdo 350 g",
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
          tipo: "COMBO",
          id: 2,
          nombre: "Combo Amigos",
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
          tipo: "COMBO",
          id: 1,
          nombre: "Parrilla Familiar",
          precio: 149.0,
        },
        accionTomada: "Confirmación Parrilla Familiar",
      };
    }
  }

  // CASO 4: Objeción de Presupuesto / Poco Dinero (Solo si NO pidió algo más caro / premium)
  const esObjecionPresupuesto =
    !esInteresPremium &&
    (mensajeNorm.includes("no tengo mucha plata") ||
      mensajeNorm.includes("no tengo plata") ||
      mensajeNorm.includes("poco dinero") ||
      mensajeNorm.includes("ajustado") ||
      mensajeNorm.includes("misio") ||
      mensajeNorm.includes("lo mas barato") ||
      mensajeNorm.includes("lo más barato") ||
      mensajeNorm.includes("mas comodo") ||
      mensajeNorm.includes("más cómodo") ||
      mensajeNorm.includes("economico") ||
      mensajeNorm.includes("económico") ||
      mensajeNorm.includes("no me alcanza") ||
      mensajeNorm.includes("muy caro") ||
      mensajeNorm.includes("esta caro") ||
      mensajeNorm.includes("está caro") ||
      mensajeNorm.includes("es caro") ||
      mensajeNorm.includes("precio alto") ||
      mensajeNorm.includes("rebaja") ||
      mensajeNorm.includes("descuentito"));

  if (esObjecionPresupuesto) {
    const comboEco = recomendaciones?.topCombos.find(
      (c: any) => c.precio <= 39,
    ) || { combo: "Combo Estudiante", precio: 39 };

    return {
      mensaje: `¡Te entiendo, ${nombreCliente}! 🥩 Cuidamos tu bolsillo:\n✨ *Chorizo Parrillero*: solo *S/ 15.00* con papas y ensalada\n🎓 *${comboEco.combo}*: solo *S/ ${comboEco.precio.toFixed(2)}*\n¿Te preparamos el de S/ 15.00? ¡Pagas con Yape! 📲✨`,
      sugerenciasComerciales: [
        `¿Sale el Chorizo a solo S/ 15.00? 🥩`,
        `¿Prefieres el Combo Estudiante a S/ 39.00? 🎓`,
        `¿Pagas con Yape al toque? 📲`,
      ],
      ofertaSugerida: {
        tipo: "PRODUCTO",
        id: 1,
        nombre: "Chorizo a la Parrilla",
        precio: 15.0,
      },
      accionTomada: "Manejo ultra conciso de objeción de presupuesto",
    };
  }

  // CASO 5: Medios de pago / Delivery / Ubicación
  if (
    mensajeNorm.includes("yape") ||
    mensajeNorm.includes("plin") ||
    mensajeNorm.includes("pago") ||
    mensajeNorm.includes("tarjeta") ||
    mensajeNorm.includes("transferencia")
  ) {
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

  if (
    mensajeNorm.includes("delivery") ||
    mensajeNorm.includes("donde quedan") ||
    mensajeNorm.includes("direccion") ||
    mensajeNorm.includes("ubicacion") ||
    mensajeNorm.includes("huanchaco") ||
    mensajeNorm.includes("california")
  ) {
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
  if (
    mensajeNorm.includes("corte") ||
    mensajeNorm.includes("carta") ||
    mensajeNorm.includes("precio") ||
    mensajeNorm.includes("cuanto cuesta") ||
    mensajeNorm.includes("a cuanto sale") ||
    mensajeNorm.includes("menu") ||
    mensajeNorm.includes("menú") ||
    mensajeNorm.includes("que tienen") ||
    mensajeNorm.includes("qué tienen") ||
    mensajeNorm.includes("que venden") ||
    mensajeNorm.includes("qué venden") ||
    mensajeNorm.includes("que platos") ||
    mensajeNorm.includes("qué platos") ||
    mensajeNorm.includes("que ofrecen") ||
    mensajeNorm.includes("qué ofrecen")
  ) {
    return {
      mensaje: `¡Hola, ${nombreCliente}! 🔥 Lo más pedido hoy a la leña:\n🥩 *Chorizo*: *S/ 15.00* | *Tira de Cerdo*: *S/ 32.00* | *Combo Amigos*: *S/ 110.00*\nTodos con papitas y ensalada 🤤. ¿Cuál te mandamos a preparar? 📲`,
      sugerenciasComerciales: [
        `¿Sale una Tira de Cerdo (S/ 32.00)? 🥩`,
        `¿Sale un Combo Amigos (S/ 110.00)? 👥`,
        `¿Confirmas con Yape? 📲`,
      ],
      ofertaSugerida: {
        tipo: "PRODUCTO",
        id: 1,
        nombre: "Tira de Cerdo 350 g",
        precio: 32.0,
      },
      accionTomada: "Presentación concisa de carta",
    };
  }

  // CASO 7: Promociones / Descuentos
  if (
    mensajeNorm.includes("promo") ||
    mensajeNorm.includes("descuento") ||
    mensajeNorm.includes("cumple") ||
    mensajeNorm.includes("oferta")
  ) {
    const promos = recomendaciones?.promocionesElegibles || [];
    const p = promos[0] || {
      nombre_promocion: "Promo Parrillera",
      descripcion: "Guarnición extra de papas rústicas",
    };
    return {
      mensaje: `¡Buenas noticias, ${nombreCliente}! 🎉 Hoy tenemos activa la *${p.nombre_promocion}*: ${p.descripcion} ✨\n¿Te la aplicamos a tu pedido? ¡Pagas con Yape o Plin! 🤤📲`,
      sugerenciasComerciales: [
        `¿Te aplicamos la promoción ${p.nombre_promocion}? 🎉`,
        `¿Para cuántas personas armamos el pedido? 🍽️`,
        `¿Confirmamos por Yape? 📲`,
      ],
      ofertaSugerida: {
        tipo: "PROMOCION",
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
        tipo: "PRODUCTO",
        id: 1,
        nombre: "Chorizo a la Parrilla",
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
