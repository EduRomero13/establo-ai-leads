"use client";

import React, { useEffect, useState } from "react";
import {
  UtensilsCrossed,
  Flame,
  Layers,
  Gift,
  CheckCircle2,
  XCircle,
  Tag,
  Calendar,
  Percent,
  Sparkles,
} from "lucide-react";
import { formatCurrency, formatDateOnly } from "@/lib/utils";

export default function CatalogoComercialPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"productos" | "combos" | "promociones">("productos");
  const [filtroCategoria, setFiltroCategoria] = useState<string>("TODAS");

  const fetchCatalogo = async () => {
    try {
      const res = await fetch("/api/catalog");
      const json = await res.json();
      if (json.success) {
        setData(json);
      }
    } catch (err) {
      console.error("Error al cargar catálogo:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCatalogo();
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <div className="w-10 h-10 border-4 border-[#C96D35]/20 border-t-[#C96D35] rounded-full animate-spin" />
        <p className="text-sm font-medium text-[#746B65] dark:text-[#B3ACA5]">
          Cargando catálogo comercial desde SQL Server...
        </p>
      </div>
    );
  }

  const { productos = [], combos = [], promociones = [] } = data || {};

  const productosFiltrados = productos.filter((p: any) => {
    if (filtroCategoria === "TODAS") return true;
    if (filtroCategoria === "CORTES") return p.es_corte;
    return p.categoria === filtroCategoria;
  });

  return (
    <div className="space-y-6">
      {/* Cabecera */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl md:text-3xl font-extrabold text-[#241E1A] dark:text-[#F5F3F0] font-display">
              Catálogo Comercial Parrillero
            </h1>
            <span className="px-2.5 py-1 text-xs font-bold rounded-lg bg-[#C96D35]/15 text-[#C96D35] dark:text-[#E8A46D] border border-[#C96D35]/30">
              Datos Transaccionales
            </span>
          </div>
          <p className="text-sm text-[#746B65] dark:text-[#B3ACA5] mt-1">
            Carta oficial, combos paquetizados y reglas de promociones validadas para el Agente IA de Parrilladas El Establo.
          </p>
        </div>

        {/* Selector de Pestañas */}
        <div className="flex rounded-xl bg-[#FFFFFF] dark:bg-[#1D2023] border border-[#E8E0D8] dark:border-[#383C40] p-1 text-xs font-bold">
          <button
            onClick={() => setTab("productos")}
            className={`py-2 px-4 rounded-lg flex items-center gap-1.5 transition-colors ${
              tab === "productos" ? "bg-[#C96D35] text-white shadow-xs" : "text-[#746B65] dark:text-[#B3ACA5]"
            }`}
          >
            <UtensilsCrossed className="w-4 h-4" />
            <span>Productos Carta ({productos.length})</span>
          </button>
          <button
            onClick={() => setTab("combos")}
            className={`py-2 px-4 rounded-lg flex items-center gap-1.5 transition-colors ${
              tab === "combos" ? "bg-[#C96D35] text-white shadow-xs" : "text-[#746B65] dark:text-[#B3ACA5]"
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>Combos ({combos.length})</span>
          </button>
          <button
            onClick={() => setTab("promociones")}
            className={`py-2 px-4 rounded-lg flex items-center gap-1.5 transition-colors ${
              tab === "promociones" ? "bg-[#C96D35] text-white shadow-xs" : "text-[#746B65] dark:text-[#B3ACA5]"
            }`}
          >
            <Gift className="w-4 h-4" />
            <span>Promociones ({promociones.length})</span>
          </button>
        </div>
      </div>

      {/* PESTAÑA 1: PRODUCTOS DE LA CARTA */}
      {tab === "productos" && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            {["TODAS", "CORTES", "COMIDA", "BEBIDA", "POSTRE"].map((cat) => (
              <button
                key={cat}
                onClick={() => setFiltroCategoria(cat)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors ${
                  filtroCategoria === cat
                    ? "bg-[#42291F] text-white dark:bg-[#E8A46D] dark:text-[#121416]"
                    : "bg-[#FFFFFF] dark:bg-[#1D2023] border border-[#E8E0D8] dark:border-[#383C40] text-[#746B65] dark:text-[#B3ACA5]"
                }`}
              >
                {cat === "CORTES" ? "🥩 Solo Cortes Parrilleros" : cat}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {productosFiltrados.map((prod: any) => (
              <div
                key={prod.id_producto}
                className="p-5 rounded-2xl bg-[#FFFFFF] dark:bg-[#1D2023] border border-[#E8E0D8] dark:border-[#383C40] shadow-sm flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-extrabold text-base text-[#241E1A] dark:text-[#F5F3F0]">
                      {prod.nombre}
                    </span>
                    <span className="font-black text-base text-[#C96D35] dark:text-[#E8A46D] shrink-0">
                      {formatCurrency(prod.precio)}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 mt-1.5">
                    <span className="text-[10px] px-2 py-0.5 rounded font-bold bg-neutral-100 dark:bg-neutral-800 text-[#746B65] dark:text-[#B3ACA5]">
                      {prod.categoria}
                    </span>
                    {prod.es_corte && (
                      <span className="text-[10px] px-2 py-0.5 rounded font-black bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30 flex items-center gap-0.5">
                        <Flame className="w-3 h-3 text-amber-500" /> Corte de Brasa
                      </span>
                    )}
                  </div>

                  <p className="text-xs text-[#746B65] dark:text-[#B3ACA5] mt-2.5">
                    {prod.descripcion || "Plato tradicional de la carta parrillera de Trujillo."}
                  </p>
                </div>

                <div className="pt-3 mt-3 border-t border-[#E8E0D8] dark:border-[#383C40] flex items-center justify-between text-[11px] text-[#746B65] dark:text-[#B3ACA5]">
                  <span>
                    {prod.peso_cantidad ? `${prod.peso_cantidad} ${prod.peso_unidad}` : "Porción personal"}
                  </span>
                  <span>Estilo: {prod.estilo || "Criollo"}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* PESTAÑA 2: COMBOS */}
      {tab === "combos" && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {combos.map((c: any) => (
            <div
              key={c.id_combo}
              className="p-6 rounded-2xl bg-[#FFFFFF] dark:bg-[#1D2023] border border-[#E8E0D8] dark:border-[#383C40] shadow-sm flex flex-col justify-between relative overflow-hidden"
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between">
                  <span className="px-2 py-0.5 rounded bg-[#C96D35]/15 text-[#C96D35] dark:text-[#E8A46D] font-extrabold text-[10px] uppercase">
                    Paquete Parrillero
                  </span>
                  <span className="text-xl font-black text-emerald-600 dark:text-emerald-400">
                    {formatCurrency(c.precio)}
                  </span>
                </div>

                <h3 className="text-lg font-black text-[#241E1A] dark:text-[#F5F3F0]">
                  {c.nombre}
                </h3>
                <p className="text-xs text-[#746B65] dark:text-[#B3ACA5]">
                  {c.descripcion}
                </p>

                <div className="pt-3 border-t border-[#E8E0D8] dark:border-[#383C40]">
                  <p className="text-[11px] font-bold text-[#746B65] dark:text-[#B3ACA5] uppercase mb-2">
                    Componentes Incluidos:
                  </p>
                  <div className="space-y-1.5 text-xs">
                    {c.detalles?.map((d: any) => (
                      <div
                        key={d.id_producto}
                        className="flex items-center justify-between p-2 rounded-lg bg-[#FAF8F5] dark:bg-[#121416] border border-[#E8E0D8] dark:border-[#383C40]"
                      >
                        <span className="font-medium text-[#241E1A] dark:text-[#F5F3F0]">
                          {d.cantidad}x {d.producto_nombre}
                        </span>
                        {d.es_corte && (
                          <span className="text-[10px] text-amber-600 dark:text-amber-400 font-bold">
                            Corte
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* PESTAÑA 3: PROMOCIONES Y REGLAS */}
      {tab === "promociones" && (
        <div className="space-y-6">
          <div className="p-4 rounded-xl bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900/40 text-blue-900 dark:text-blue-200 text-xs">
            <p className="font-bold flex items-center gap-1.5 mb-1">
              <Sparkles className="w-4 h-4 text-blue-600" />
              Reglas Comerciales de Promociones (Hora Oficial Perú: America/Lima)
            </p>
            <p>
              El Agente IA valida rigurosamente: 1) Que esté activa, 2) Rango de fechas, 3) Día permitido de la semana (L,M,X,J,V,S,D), 4) Segmento objetivo, 5) Producto aplicable, 6) Cumpleaños (±3 días) y 7) Límite de 1 promoción por pedido.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {promociones.map((p: any) => (
              <div
                key={p.id_promocion}
                className="p-6 rounded-2xl bg-[#FFFFFF] dark:bg-[#1D2023] border border-[#E8E0D8] dark:border-[#383C40] shadow-sm flex flex-col justify-between"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] px-2 py-0.5 rounded font-black bg-[#C96D35]/15 text-[#C96D35] dark:text-[#E8A46D] uppercase">
                      {p.tipo_beneficio}
                    </span>

                    {p.vigenteHoy ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Vigente Hoy ({p.diaActualPeru})
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-neutral-400">
                        <XCircle className="w-3.5 h-3.5" /> No aplica hoy
                      </span>
                    )}
                  </div>

                  <h3 className="text-lg font-black text-[#241E1A] dark:text-[#F5F3F0]">
                    {p.nombre_promocion}
                  </h3>

                  <p className="text-xs text-[#746B65] dark:text-[#B3ACA5]">
                    {p.descripcion}
                  </p>

                  <div className="p-3 rounded-xl bg-[#FAF8F5] dark:bg-[#121416] border border-[#E8E0D8] dark:border-[#383C40] text-xs space-y-2">
                    <div className="flex justify-between">
                      <span className="text-[#746B65] dark:text-[#B3ACA5]">Días permitidos:</span>
                      <strong className="text-[#241E1A] dark:text-[#F5F3F0]">{p.dias_aplicables}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#746B65] dark:text-[#B3ACA5]">Segmento:</span>
                      <strong>{p.segmento_objetivo_nombre || "Cualquiera"}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#746B65] dark:text-[#B3ACA5]">Vigencia:</span>
                      <span>{formatDateOnly(p.fecha_inicio)} al {p.fecha_fin ? formatDateOnly(p.fecha_fin) : "Indefinida"}</span>
                    </div>
                  </div>

                  <div className="pt-2">
                    <p className="text-[10px] font-bold text-[#746B65] dark:text-[#B3ACA5] uppercase mb-1">
                      Ítems con Descuento Directo:
                    </p>
                    <div className="flex flex-wrap gap-1 text-[11px]">
                      {p.aplicables?.map((a: any, idx: number) => (
                        <span
                          key={idx}
                          className="px-2 py-0.5 rounded bg-neutral-100 dark:bg-neutral-800 text-[#241E1A] dark:text-[#F5F3F0]"
                        >
                          {a.producto_nombre || a.combo_nombre || a.categoria}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

