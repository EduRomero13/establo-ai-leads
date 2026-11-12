// ==============================================================================
// MOTOR DE REGLAS DE NEGOCIO Y HERRAMIENTAS SQL SEGURAS PARA ESTABLO AI
// Arquitectura: Gemini Tool Calling -> Procedimientos Almacenados SQL Server V3
// ==============================================================================

import { getDbPool, sql } from "./db";

// ------------------------------------------------------------------------------
// 1. HERRAMIENTAS DE CONSULTA (10 HERRAMIENTAS DE LECTURA AUTORIZADA)
// ------------------------------------------------------------------------------

/**
 * Consulta 1: Perfil completo del LEAD y su negociación activa
 */
export async function toolConsultarPerfilLead(idPersona: number, idNegociacion?: number) {
  const pool = await getDbPool();
  const req = pool.request().input("id_persona", sql.BigInt, idPersona);
  if (idNegociacion) {
    req.input("id_negociacion", sql.BigInt, idNegociacion);
  }
  const result = await req.execute("dbo.sp_consultar_perfil_lead");
  return result.recordset[0] || null;
}

/**
 * Consulta 2: Producto favorito del LEAD (Distingue declarado de comprado)
 */
export async function toolConsultarProductoFavorito(idPersona: number) {
  const pool = await getDbPool();
  const result = await pool
    .request()
    .input("id_persona", sql.BigInt, idPersona)
    .execute("dbo.sp_consultar_producto_favorito");
  return result.recordset[0] || null;
}

/**
 * Consulta 3: Plato más comprado por cliente en historial transaccional
 */
export async function toolConsultarPlatoMasComprado(idPersona: number) {
  const pool = await getDbPool();
  const result = await pool
    .request()
    .input("id_persona", sql.BigInt, idPersona)
    .execute("dbo.sp_consultar_plato_mas_comprado");
  return result.recordset[0] || { mensaje: "Sin compras previas registradas (Lead nuevo)" };
}

/**
 * Consulta 4: Platos más vendidos por segmento (Cortes y Combos top de V3)
 */
export async function toolConsultarProductosPopularesSegmento(idSegmento: number) {
  const pool = await getDbPool();
  const result = await pool
    .request()
    .input("id_segmento", sql.Int, idSegmento)
    .execute("dbo.sp_consultar_productos_populares_segmento");
  const recordsets = result.recordsets as any;
  return {
    topCortes: recordsets?.[0] || [],
    topCombos: recordsets?.[1] || [],
  };
}

/**
 * Consulta 5: Promociones más solicitadas (Ofrecidas vs Aceptadas vs Facturadas)
 */
export async function toolConsultarPromocionesMasSolicitadas() {
  const pool = await getDbPool();
  const result = await pool.request().execute("dbo.sp_consultar_promociones_mas_solicitadas");
  return result.recordset;
}

/**
 * Consulta 6: Promociones vigentes y elegibles para un LEAD específico
 */
export async function toolConsultarPromocionesElegibles(idPersona: number, idSegmento?: number) {
  const pool = await getDbPool();
  const req = pool.request().input("id_persona", sql.BigInt, idPersona);
  if (idSegmento) {
    req.input("id_segmento", sql.Int, idSegmento);
  }
  const result = await req.execute("dbo.sp_consultar_promociones_elegibles");
  return result.recordset;
}

/**
 * Consulta 7: Gramajes y pesos registrados de carnes (Columnas oficiales V3)
 */
export async function toolConsultarPesoCarneFrecuente(idSegmento?: number) {
  const pool = await getDbPool();
  const req = pool.request();
  if (idSegmento) {
    req.input("id_segmento", sql.Int, idSegmento);
  }
  const result = await req.execute("dbo.sp_consultar_peso_carne_frecuente");
  return result.recordset;
}

/**
 * Consulta 8: Productos y combos según presupuesto y cantidad de comensales
 */
export async function toolConsultarProductosPorPresupuesto(
  presupuestoMaximo: number,
  idSegmento?: number,
  nroPersonas: number = 1
) {
  const pool = await getDbPool();
  const req = pool
    .request()
    .input("presupuesto_maximo", sql.Decimal(10, 2), presupuestoMaximo)
    .input("nro_personas", sql.Int, nroPersonas);
  if (idSegmento) {
    req.input("id_segmento", sql.Int, idSegmento);
  }
  const result = await req.execute("dbo.sp_consultar_productos_por_presupuesto");
  return result.recordset;
}

/**
 * Consulta 9: Historial de ofertas de la negociación
 */
export async function toolConsultarHistorialOfertas(idNegociacion: number) {
  const pool = await getDbPool();
  const result = await pool
    .request()
    .input("id_negociacion", sql.BigInt, idNegociacion)
    .execute("dbo.sp_consultar_historial_ofertas");
  return result.recordset;
}

/**
 * Consulta 10: Estado de negociación y elegibilidad de conversión por pago
 */
export async function toolConsultarEstadoConversion(idNegociacion: number) {
  const pool = await getDbPool();
  const result = await pool
    .request()
    .input("id_negociacion", sql.BigInt, idNegociacion)
    .execute("dbo.sp_consultar_estado_conversion");
  return result.recordset[0] || null;
}

// ------------------------------------------------------------------------------
// 2. HERRAMIENTAS DE REGISTRO CONTROLADO (6 OPERACIONES ANTES DEL PAGO)
// ------------------------------------------------------------------------------

/**
 * Registro 1: Preferencia gastronómica expresada por el LEAD
 */
export async function toolRegistrarPreferenciaLead(
  idPersona: number,
  idProductoFavorito: number,
  origen: string = "CONVERSACION_WHATSAPP"
) {
  const pool = await getDbPool();
  const result = await pool
    .request()
    .input("id_persona", sql.BigInt, idPersona)
    .input("id_producto_favorito", sql.Int, idProductoFavorito)
    .input("origen", sql.VarChar(50), origen)
    .execute("dbo.sp_registrar_preferencia_lead");
  return result.recordset[0];
}

/**
 * Registro 2: Necesidad comercial detectada (comensales, presupuesto)
 */
export async function toolRegistrarNecesidadLead(
  idNegociacion: number,
  necesidad: string,
  nroPersonas?: number,
  presupuesto?: number
) {
  const pool = await getDbPool();
  const req = pool
    .request()
    .input("id_negociacion", sql.BigInt, idNegociacion)
    .input("necesidad", sql.NVarChar(300), necesidad);
  if (nroPersonas !== undefined) req.input("nro_personas", sql.Int, nroPersonas);
  if (presupuesto !== undefined) req.input("presupuesto", sql.Decimal(10, 2), presupuesto);

  const result = await req.execute("dbo.sp_registrar_necesidad_lead");
  return result.recordset[0];
}

/**
 * Registro 3: Objeción comercial clasificada
 */
export async function toolRegistrarObjecionLead(
  idNegociacion: number,
  tipoObjecion: "PRECIO" | "PRESUPUESTO" | "INDECISION" | "TAMANO" | "PROMO" | "OTRA",
  detalle: string
) {
  const pool = await getDbPool();
  const result = await pool
    .request()
    .input("id_negociacion", sql.BigInt, idNegociacion)
    .input("tipo_objecion", sql.VarChar(50), tipoObjecion)
    .input("detalle", sql.NVarChar(300), detalle)
    .execute("dbo.sp_registrar_objecion_lead");
  return result.recordset[0];
}

/**
 * Registro 4: Oferta realizada en la negociación (con control anti-duplicados)
 */
export async function toolRegistrarOfertaLead(
  idNegociacion: number,
  params: {
    idProducto?: number;
    idCombo?: number;
    idPromocion?: number;
    detalle?: string;
  }
) {
  const pool = await getDbPool();
  const req = pool.request().input("id_negociacion", sql.BigInt, idNegociacion);
  if (params.idProducto) req.input("id_producto", sql.Int, params.idProducto);
  if (params.idCombo) req.input("id_combo", sql.Int, params.idCombo);
  if (params.idPromocion) req.input("id_promocion", sql.Int, params.idPromocion);
  if (params.detalle) req.input("detalle", sql.NVarChar(300), params.detalle);

  const result = await req.execute("dbo.sp_registrar_oferta_lead");
  return result.recordset[0];
}

/**
 * Registro 5: Respuesta a la oferta realizada
 */
export async function toolRegistrarRespuestaOferta(
  idNegociacion: number,
  respuesta: "ACEPTADA" | "RECHAZADA" | "SIN_RESPUESTA",
  idOferta?: number,
  detalle?: string
) {
  const pool = await getDbPool();
  const req = pool
    .request()
    .input("id_negociacion", sql.BigInt, idNegociacion)
    .input("respuesta", sql.VarChar(15), respuesta);
  if (idOferta) req.input("id_oferta", sql.BigInt, idOferta);
  if (detalle) req.input("detalle", sql.NVarChar(300), detalle);

  const result = await req.execute("dbo.sp_registrar_respuesta_oferta");
  return result.recordset[0];
}

/**
 * Registro 6: Acción de seguimiento comercial (24h, 48h, 72h)
 */
export async function toolRegistrarAccionSeguimiento(
  idNegociacion: number,
  tipoAccion: string,
  detalle: string
) {
  const pool = await getDbPool();
  const result = await pool
    .request()
    .input("id_negociacion", sql.BigInt, idNegociacion)
    .input("tipo_accion", sql.VarChar(50), tipoAccion)
    .input("detalle", sql.NVarChar(300), detalle)
    .execute("dbo.sp_registrar_accion_seguimiento");
  return result.recordset[0];
}

// ------------------------------------------------------------------------------
// 3. OPERACIÓN RESTRINGIDA: VERIFICACIÓN Y APLICACIÓN DE CONVERSIÓN A PAYER
// REGLA CRÍTICA: Exige un primer pago con estado 'CONFIRMADO' en SQL Server V3.
// ------------------------------------------------------------------------------
export async function toolVerificarYAplicarConversion(idNegociacion: number) {
  const pool = await getDbPool();
  const result = await pool
    .request()
    .input("id_negociacion", sql.BigInt, idNegociacion)
    .execute("dbo.sp_verificar_y_aplicar_conversion");
  return result.recordset[0];
}

// ------------------------------------------------------------------------------
// 4. DECLARACIONES DE HERRAMIENTAS PARA GEMINI (FUNCTION CALLING SCHEMAS)
// ------------------------------------------------------------------------------
export const GEMINI_TOOLS_DECLARATIONS = [
  {
    name: "consultar_perfil_lead",
    description: "Consulta el perfil del LEAD, sus preferencias registradas y el estado de su negociación.",
    parameters: {
      type: "OBJECT",
      properties: {
        id_persona: { type: "INTEGER", description: "ID de la persona (LEAD)." },
        id_negociacion: { type: "INTEGER", description: "ID opcional de la negociación abierta." },
      },
      required: ["id_persona"],
    },
  },
  {
    name: "consultar_producto_favorito",
    description: "Identifica la preferencia declarada en el formulario y la distingue del plato más comprado.",
    parameters: {
      type: "OBJECT",
      properties: {
        id_persona: { type: "INTEGER", description: "ID de la persona." },
      },
      required: ["id_persona"],
    },
  },
  {
    name: "consultar_plato_mas_comprado",
    description: "Consulta el historial de pedidos para identificar el plato con mayor frecuencia de compra.",
    parameters: {
      type: "OBJECT",
      properties: {
        id_persona: { type: "INTEGER", description: "ID de la persona." },
      },
      required: ["id_persona"],
    },
  },
  {
    name: "consultar_productos_populares_segmento",
    description: "Obtiene los cortes y combos más vendidos para el segmento del cliente (Familias, Amigos, Estudiantes).",
    parameters: {
      type: "OBJECT",
      properties: {
        id_segmento: { type: "INTEGER", description: "ID del segmento (1=Familias, 2=Estudiantes, 3=Amigos)." },
      },
      required: ["id_segmento"],
    },
  },
  {
    name: "consultar_promociones_elegibles",
    description: "Consulta las promociones vigentes hoy que son elegibles para el segmento del LEAD.",
    parameters: {
      type: "OBJECT",
      properties: {
        id_persona: { type: "INTEGER", description: "ID de la persona." },
        id_segmento: { type: "INTEGER", description: "ID opcional del segmento." },
      },
      required: ["id_persona"],
    },
  },
  {
    name: "consultar_peso_carne_frecuente",
    description: "Consulta los gramajes y pesos registrados de los cortes de carne disponibles en la carta.",
    parameters: {
      type: "OBJECT",
      properties: {
        id_segmento: { type: "INTEGER", description: "ID opcional del segmento para ver preferencias de peso." },
      },
    },
  },
  {
    name: "consultar_productos_por_presupuesto",
    description: "Busca productos y combos reales cuyo precio no exceda el presupuesto indicado por el cliente.",
    parameters: {
      type: "OBJECT",
      properties: {
        presupuesto_maximo: { type: "NUMBER", description: "Monto máximo en Soles (ej: 40.00, 80.00)." },
        id_segmento: { type: "INTEGER", description: "ID del segmento del cliente." },
        nro_personas: { type: "INTEGER", description: "Cantidad estimada de comensales." },
      },
      required: ["presupuesto_maximo"],
    },
  },
  {
    name: "consultar_historial_ofertas",
    description: "Consulta qué productos o combos ya se le ofrecieron al cliente para no repetir ofertas rechazadas.",
    parameters: {
      type: "OBJECT",
      properties: {
        id_negociacion: { type: "INTEGER", description: "ID de la negociación activa." },
      },
      required: ["id_negociacion"],
    },
  },
  {
    name: "registrar_objecion_lead",
    description: "Registra en la base de datos una objeción planteada por el cliente (precio, presupuesto, indecisión).",
    parameters: {
      type: "OBJECT",
      properties: {
        id_negociacion: { type: "INTEGER", description: "ID de la negociación." },
        tipo_objecion: {
          type: "STRING",
          description: "Clasificación de la objeción: PRECIO, PRESUPUESTO, INDECISION, TAMANO, PROMO, OTRA.",
        },
        detalle: { type: "STRING", description: "Detalle textual de la objeción del cliente." },
      },
      required: ["id_negociacion", "tipo_objecion", "detalle"],
    },
  },
  {
    name: "registrar_oferta_lead",
    description: "Registra formalmente una oferta o recomendación presentada al cliente en la negociación.",
    parameters: {
      type: "OBJECT",
      properties: {
        id_negociacion: { type: "INTEGER", description: "ID de la negociación." },
        id_producto: { type: "INTEGER", description: "ID del producto individual ofrecido (si aplica)." },
        id_combo: { type: "INTEGER", description: "ID del combo ofrecido (si aplica)." },
        id_promocion: { type: "INTEGER", description: "ID de la promoción ofrecida (si aplica)." },
        detalle: { type: "STRING", description: "Descripción o precio de la oferta presentada." },
      },
      required: ["id_negociacion"],
    },
  },
  {
    name: "registrar_respuesta_oferta",
    description: "Actualiza la respuesta del cliente ante la oferta presentada (ACEPTADA, RECHAZADA, SIN_RESPUESTA).",
    parameters: {
      type: "OBJECT",
      properties: {
        id_negociacion: { type: "INTEGER", description: "ID de la negociación." },
        respuesta: { type: "STRING", description: "Respuesta del cliente: ACEPTADA, RECHAZADA o SIN_RESPUESTA." },
        detalle: { type: "STRING", description: "Motivo o contexto de la respuesta." },
      },
      required: ["id_negociacion", "respuesta"],
    },
  },
];

// ------------------------------------------------------------------------------
// 5. DESPACHADOR CENTRAL DE HERRAMIENTAS (TOOL DISPATCHER)
// ------------------------------------------------------------------------------
export async function despacharHerramientaSegura(nombre: string, args: any) {
  switch (nombre) {
    case "consultar_perfil_lead":
      return await toolConsultarPerfilLead(args.id_persona, args.id_negociacion);
    case "consultar_producto_favorito":
      return await toolConsultarProductoFavorito(args.id_persona);
    case "consultar_plato_mas_comprado":
      return await toolConsultarPlatoMasComprado(args.id_persona);
    case "consultar_productos_populares_segmento":
      return await toolConsultarProductosPopularesSegmento(args.id_segmento);
    case "consultar_promociones_mas_solicitadas":
      return await toolConsultarPromocionesMasSolicitadas();
    case "consultar_promociones_elegibles":
      return await toolConsultarPromocionesElegibles(args.id_persona, args.id_segmento);
    case "consultar_peso_carne_frecuente":
      return await toolConsultarPesoCarneFrecuente(args.id_segmento);
    case "consultar_productos_por_presupuesto":
      return await toolConsultarProductosPorPresupuesto(
        args.presupuesto_maximo,
        args.id_segmento,
        args.nro_personas
      );
    case "consultar_historial_ofertas":
      return await toolConsultarHistorialOfertas(args.id_negociacion);
    case "consultar_estado_conversion":
      return await toolConsultarEstadoConversion(args.id_negociacion);
    case "registrar_preferencia_lead":
      return await toolRegistrarPreferenciaLead(args.id_persona, args.id_producto_favorito, args.origen);
    case "registrar_necesidad_lead":
      return await toolRegistrarNecesidadLead(
        args.id_negociacion,
        args.necesidad,
        args.nro_personas,
        args.presupuesto
      );
    case "registrar_objecion_lead":
      return await toolRegistrarObjecionLead(args.id_negociacion, args.tipo_objecion, args.detalle);
    case "registrar_oferta_lead":
      return await toolRegistrarOfertaLead(args.id_negociacion, {
        idProducto: args.id_producto,
        idCombo: args.id_combo,
        idPromocion: args.id_promocion,
        detalle: args.detalle,
      });
    case "registrar_respuesta_oferta":
      return await toolRegistrarRespuestaOferta(
        args.id_negociacion,
        args.respuesta,
        args.id_oferta,
        args.detalle
      );
    case "registrar_accion_seguimiento":
      return await toolRegistrarAccionSeguimiento(args.id_negociacion, args.tipo_accion, args.detalle);
    case "verificar_y_aplicar_conversion":
      return await toolVerificarYAplicarConversion(args.id_negociacion);
    default:
      throw new Error(`Herramienta no autorizada o no reconocida: ${nombre}`);
  }
}
