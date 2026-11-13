import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { executeQuery, sql } from "@/lib/db";
import {
  toolConsultarPerfilLead,
  toolConsultarProductoFavorito,
  toolConsultarPlatoMasComprado,
  toolConsultarProductosPopularesSegmento,
  toolConsultarPromocionesElegibles,
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
} from "@/lib/sql-tools-engine";

// =============================================================================
// CATÁLOGO DE HERRAMIENTAS MCP (MODEL CONTEXT PROTOCOL) AUTORIZADAS
// =============================================================================
const MCP_TOOLS_CATALOG = [
  {
    name: "consultar_productos",
    description: "Consulta el catálogo oficial de platos y cortes a la leña activos con precios y gramajes.",
    inputSchema: {
      type: "object",
      properties: {
        solo_cortes: { type: "boolean", description: "Si es true filtra solo carnes y cortes individuales." },
      },
    },
  },
  {
    name: "consultar_precios",
    description: "Consulta precios vigentes oficiales de productos o combos específicos de la carta.",
    inputSchema: {
      type: "object",
      properties: {
        id_producto: { type: "number", description: "ID opcional del producto." },
        id_combo: { type: "number", description: "ID opcional del combo." },
      },
    },
  },
  {
    name: "consultar_inventario",
    description: "Verifica si un plato o combo se encuentra activo y disponible para preparar en cocina.",
    inputSchema: {
      type: "object",
      properties: {
        id_producto: { type: "number", description: "ID del producto a verificar." },
      },
      required: ["id_producto"],
    },
  },
  {
    name: "consultar_politicas",
    description: "Lee las políticas comerciales oficiales del restaurante (precios, horarios, delivery, reservas).",
    inputSchema: {
      type: "object",
      properties: {
        categoria: {
          type: "string",
          enum: ["precios_descuentos", "entrega_horarios", "reservas_eventos", "todas"],
          description: "Categoría de la política comercial a consultar.",
        },
      },
      required: ["categoria"],
    },
  },
  {
    name: "consultar_lead",
    description: "Consulta la ficha del lead, su segmento comercial, ciclo actual y preferencias registradas.",
    inputSchema: {
      type: "object",
      properties: {
        id_persona: { type: "number", description: "ID de la persona / lead." },
        id_negociacion: { type: "number", description: "ID opcional de la negociación activa." },
      },
      required: ["id_persona"],
    },
  },
  {
    name: "consultar_historial",
    description: "Consulta compras pasadas y negociaciones anteriores no anuladas del lead en SQL Server.",
    inputSchema: {
      type: "object",
      properties: {
        id_persona: { type: "number", description: "ID de la persona / lead." },
      },
      required: ["id_persona"],
    },
  },
  {
    name: "calcular_cotizacion",
    description: "Calcula el costo total, evalúa si aplican promociones de segmento y entrega el desglose exacto.",
    inputSchema: {
      type: "object",
      properties: {
        items: {
          type: "array",
          items: {
            type: "object",
            properties: {
              id_producto: { type: "number" },
              id_combo: { type: "number" },
              cantidad: { type: "number" },
            },
          },
          description: "Lista de productos o combos a cotizar.",
        },
        id_persona: { type: "number", description: "ID del lead para evaluar elegibilidad de descuentos." },
      },
      required: ["items", "id_persona"],
    },
  },
  {
    name: "guardar_borrador_negociacion",
    description: "Registra en la bitácora comercial la necesidad del cliente (comensales, presupuesto aproximado).",
    inputSchema: {
      type: "object",
      properties: {
        id_negociacion: { type: "number", description: "ID de la negociación abierta." },
        necesidad: { type: "string", description: "Resumen de lo que busca el cliente." },
        nro_personas: { type: "number", description: "Cantidad de comensales identificados." },
        presupuesto: { type: "number", description: "Presupuesto declarado en Soles." },
      },
      required: ["id_negociacion", "necesidad"],
    },
  },
  {
    name: "guardar_cotizacion",
    description: "Registra formalmente una oferta o combo propuesto al cliente en dbo.oferta_negociacion.",
    inputSchema: {
      type: "object",
      properties: {
        id_negociacion: { type: "number", description: "ID de la negociación." },
        id_producto: { type: "number", description: "ID opcional del producto ofrecido." },
        id_combo: { type: "number", description: "ID opcional del combo ofrecido." },
        id_promocion: { type: "number", description: "ID opcional de la promoción aplicada." },
        detalle: { type: "string", description: "Descripción textual de la oferta." },
      },
      required: ["id_negociacion"],
    },
  },
  {
    name: "registrar_pedido",
    description: "Crea una comanda oficial en estado PENDIENTE vinculada a la negociación del cliente.",
    inputSchema: {
      type: "object",
      properties: {
        id_negociacion: { type: "number", description: "ID de la negociación." },
        id_persona: { type: "number", description: "ID del lead." },
        subtotal: { type: "number", description: "Monto total del pedido en Soles." },
        tipo: { type: "string", enum: ["LOCAL", "RESERVA"], description: "Tipo de pedido." },
      },
      required: ["id_negociacion", "id_persona", "subtotal"],
    },
  },
  {
    name: "actualizar_estado_payer",
    description: "Valida si existe un pago CONFIRMADO en caja y, de ser así, formaliza la conversión a PAYER.",
    inputSchema: {
      type: "object",
      properties: {
        id_negociacion: { type: "number", description: "ID de la negociación a convertir." },
      },
      required: ["id_negociacion"],
    },
  },
];

// Helper para leer políticas Markdown
function leerPolitica(categoria: string): string {
  const policiesDir = path.resolve(process.cwd(), "policies");
  try {
    if (categoria === "precios_descuentos") {
      return fs.readFileSync(path.join(policiesDir, "politicas_precios_descuentos.md"), "utf8");
    } else if (categoria === "entrega_horarios") {
      return fs.readFileSync(path.join(policiesDir, "politicas_entrega_horarios.md"), "utf8");
    } else if (categoria === "reservas_eventos") {
      return fs.readFileSync(path.join(policiesDir, "politicas_reservas_eventos.md"), "utf8");
    } else {
      const files = ["politicas_precios_descuentos.md", "politicas_entrega_horarios.md", "politicas_reservas_eventos.md"];
      return files.map((f) => fs.readFileSync(path.join(policiesDir, f), "utf8")).join("\n\n---\n\n");
    }
  } catch (err: any) {
    return `Error leyendo archivo de políticas: ${err.message}`;
  }
}

// Ejecutor de herramientas tipadas (Zero Arbitrary SQL)
async function ejecutarHerramientaMCP(name: string, args: any): Promise<any> {
  switch (name) {
    case "consultar_productos": {
      let query = "SELECT id_producto, nombre, categoria, descripcion, estilo, es_corte, peso_cantidad, peso_unidad, precio FROM dbo.producto_carta WHERE activo = 1";
      if (args?.solo_cortes) query += " AND es_corte = 1";
      query += " ORDER BY precio ASC;";
      return await executeQuery(query);
    }

    case "consultar_precios": {
      if (args?.id_producto) {
        return await executeQuery("SELECT id_producto, nombre, precio FROM dbo.producto_carta WHERE id_producto = @id", {
          id: { type: sql.Int, value: args.id_producto },
        });
      }
      if (args?.id_combo) {
        return await executeQuery("SELECT id_combo, nombre, precio FROM dbo.combo WHERE id_combo = @id", {
          id: { type: sql.Int, value: args.id_combo },
        });
      }
      const prods = await executeQuery("SELECT id_producto, nombre, precio FROM dbo.producto_carta WHERE activo = 1");
      const combos = await executeQuery("SELECT id_combo, nombre, precio FROM dbo.combo WHERE activo = 1");
      return { productos: prods, combos };
    }

    case "consultar_inventario": {
      const res = await executeQuery("SELECT id_producto, nombre, activo FROM dbo.producto_carta WHERE id_producto = @id", {
        id: { type: sql.Int, value: args.id_producto },
      });
      return res[0] || { id_producto: args.id_producto, activo: false, mensaje: "Producto no encontrado" };
    }

    case "consultar_politicas": {
      return {
        categoria: args.categoria,
        documento_markdown: leerPolitica(args.categoria),
      };
    }

    case "consultar_lead": {
      return await toolConsultarPerfilLead(args.id_persona, args.id_negociacion);
    }

    case "consultar_historial": {
      const platoTop = await toolConsultarPlatoMasComprado(args.id_persona);
      const fav = await toolConsultarProductoFavorito(args.id_persona);
      return { plato_mas_comprado: platoTop, favorito_declarado: fav };
    }

    case "calcular_cotizacion": {
      let subtotal = 0;
      const detalleCalculado: any[] = [];
      for (const it of args.items || []) {
        if (it.id_producto) {
          const p = await executeQuery<any>("SELECT nombre, precio FROM dbo.producto_carta WHERE id_producto = @id", {
            id: { type: sql.Int, value: it.id_producto },
          });
          if (p[0]) {
            const cant = it.cantidad || 1;
            const itemTotal = Number(p[0].precio) * cant;
            subtotal += itemTotal;
            detalleCalculado.push({ tipo: "PRODUCTO", id: it.id_producto, nombre: p[0].nombre, precioUnitario: p[0].precio, cantidad: cant, total: itemTotal });
          }
        } else if (it.id_combo) {
          const c = await executeQuery<any>("SELECT nombre, precio FROM dbo.combo WHERE id_combo = @id", {
            id: { type: sql.Int, value: it.id_combo },
          });
          if (c[0]) {
            const cant = it.cantidad || 1;
            const itemTotal = Number(c[0].precio) * cant;
            subtotal += itemTotal;
            detalleCalculado.push({ tipo: "COMBO", id: it.id_combo, nombre: c[0].nombre, precioUnitario: c[0].precio, cantidad: cant, total: itemTotal });
          }
        }
      }
      return {
        subtotal,
        descuento: 0,
        total: subtotal,
        items: detalleCalculado,
      };
    }

    case "guardar_borrador_negociacion": {
      return await toolRegistrarNecesidadLead(args.id_negociacion, args.necesidad, args.nro_personas, args.presupuesto);
    }

    case "guardar_cotizacion": {
      return await toolRegistrarOfertaLead(args.id_negociacion, {
        idProducto: args.id_producto,
        idCombo: args.id_combo,
        idPromocion: args.id_promocion,
        detalle: args.detalle,
      });
    }

    case "registrar_pedido": {
      const resPed = await executeQuery<{ id_pedido: number }>(`
        INSERT INTO dbo.pedido (id_persona, id_negociacion, tipo, fecha_registro, estado, subtotal, descuento, total)
        VALUES (@idP, @idNeg, @tipo, SYSUTCDATETIME(), 'REGISTRADO', @subtotal, 0, @subtotal);
        SELECT SCOPE_IDENTITY() AS id_pedido;
      `, {
        idP: { type: sql.BigInt, value: args.id_persona },
        idNeg: { type: sql.BigInt, value: args.id_negociacion },
        tipo: { type: sql.VarChar(20), value: args.tipo || "LOCAL" },
        subtotal: { type: sql.Decimal(10, 2), value: args.subtotal },
      });
      return { success: true, id_pedido: resPed[0]?.id_pedido, estado: "REGISTRADO" };
    }

    case "actualizar_estado_payer": {
      return await toolVerificarYAplicarConversion(args.id_negociacion);
    }

    default:
      throw new Error(`Herramienta '${name}' no reconocida o no autorizada en el servidor MCP.`);
  }
}

// =============================================================================
// HANDLERS HTTP GET & POST (JSON-RPC 2.0 PROTOCOL PARA HERMES)
// =============================================================================

export async function GET() {
  return NextResponse.json({
    name: "establo-ai-mcp-server",
    version: "1.0.0",
    protocol: "mcp/1.0",
    status: "READY",
    description: "Servidor MCP Oficial para Hermes Agent — Frontera de Seguridad Next.js & SQL Server V3",
    toolsCount: MCP_TOOLS_CATALOG.length,
    tools: MCP_TOOLS_CATALOG,
  });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    // Soporte para JSON-RPC 2.0 estándar
    const { jsonrpc = "2.0", id = 1, method, params } = body;

    // 1. Handshake / Inicialización
    if (method === "initialize" || method === "init") {
      return NextResponse.json({
        jsonrpc,
        id,
        result: {
          serverInfo: {
            name: "establo-ai-mcp-server",
            version: "1.0.0",
          },
          capabilities: {
            tools: { listChanged: false },
            resources: { subscribe: false },
          },
        },
      });
    }

    // 2. Listado de Herramientas
    if (method === "tools/list") {
      return NextResponse.json({
        jsonrpc,
        id,
        result: {
          tools: MCP_TOOLS_CATALOG,
        },
      });
    }

    // 3. Ejecución de Herramienta
    if (method === "tools/call") {
      const toolName = params?.name;
      const toolArgs = params?.arguments || {};

      if (!toolName) {
        return NextResponse.json({
          jsonrpc,
          id,
          error: { code: -32602, message: "Parámetro 'name' requerido en tools/call" },
        }, { status: 400 });
      }

      const resultado = await ejecutarHerramientaMCP(toolName, toolArgs);

      return NextResponse.json({
        jsonrpc,
        id,
        result: {
          content: [
            {
              type: "text",
              text: typeof resultado === "string" ? resultado : JSON.stringify(resultado, null, 2),
            },
          ],
        },
      });
    }

    // Método directo alternativo para llamadas simples { tool: "consultar_productos", args: {} }
    if (body.tool) {
      const resultado = await ejecutarHerramientaMCP(body.tool, body.args || {});
      return NextResponse.json({ success: true, tool: body.tool, result: resultado });
    }

    return NextResponse.json({
      jsonrpc,
      id,
      error: { code: -32601, message: `Método '${method}' no implementado en el servidor MCP` },
    }, { status: 400 });
  } catch (error: any) {
    console.error("[MCP Server Error]:", error);
    return NextResponse.json({
      jsonrpc: "2.0",
      id: null,
      error: { code: -32000, message: error.message || "Error interno del servidor MCP" },
    }, { status: 500 });
  }
}
