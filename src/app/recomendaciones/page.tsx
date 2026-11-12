"use client";

import React, { useEffect, useState } from "react";
import {
  Flame,
  Award,
  Gift,
  Layers,
  Sparkles,
  CheckCircle,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Send,
  User,
  ShoppingBag,
  Clock,
  ArrowRight,
  UtensilsCrossed,
  Tag,
  Calendar,
  Percent,
} from "lucide-react";
import { formatCurrency, formatHours, formatDateOnly } from "@/lib/utils";

export default function RecomendacionesPage() {
  const [data, setData] = useState<any>(null);
  const [catalogoData, setCatalogoData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [tabVista, setTabVista] = useState<"recomendaciones" | "catalogo">("recomendaciones");
  const [tabCatalogo, setTabCatalogo] = useState<"productos" | "combos" | "promociones">("productos");
  const [filtroCategoria, setFiltroCategoria] = useState<string>("TODAS");

  const [leads, setLeads] = useState<any[]>([]);
  const [leadSeleccionado, setLeadSeleccionado] = useState<any | null>(null);
  const [recLead, setRecLead] = useState<any | null>(null);
  const [loadingRec, setLoadingRec] = useState(false);
  const [mensajeExito, setMensajeExito] = useState<string | null>(null);

  // Cargar datos panorámicos de recomendaciones y catálogo oficial
  const fetchData = async () => {
    try {
      const [resRec, resLeads, resCat] = await Promise.all([
        fetch("/api/recommendations"),
        fetch("/api/leads"),
        fetch("/api/catalog"),
      ]);

      const [jsonRec, jsonLeads, jsonCat] = await Promise.all([
        resRec.json(),
        resLeads.json(),
        resCat.json(),
      ]);

      if (jsonRec.success) setData(jsonRec);
      if (jsonCat.success) setCatalogoData(jsonCat);

      if (jsonLeads.success && jsonLeads.leads) {
        setLeads(jsonLeads.leads);
        if (jsonLeads.leads.length > 0) {
          setLeadSeleccionado(jsonLeads.leads[0]);
        }
      }
    } catch (err) {
      console.error("Error al cargar recomendaciones y catálogo:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Cargar recomendaciones para un lead seleccionado
  const fetchLeadRec = async (idPersona: number | string) => {
    setLoadingRec(true);
    setMensajeExito(null);
    try {
      const res = await fetch(`/api/recommendations?personaId=${idPersona}`);
      const json = await res.json();
      if (json.success) {
        setRecLead(json.recomendaciones);
      }
    } catch (err) {
      console.error("Error al cargar rec de lead:", err);
    } finally {
      setLoadingRec(false);
    }
  };

  useEffect(() => {
    if (leadSeleccionado?.id_persona) {
      fetchLeadRec(leadSeleccionado.id_persona);
    }
  }, [leadSeleccionado]);

  // Registrar oferta en dbo.oferta_negociacion
  const handleRegistrarOferta = async (
    tipo: "PRODUCTO" | "COMBO" | "PROMOCION",
    id: number,
    respuesta: "ACEPTADA" | "RECHAZADA" | "SIN_RESPUESTA",
    nombre: string
  ) => {
    if (!leadSeleccionado?.id_negociacion) return;
    try {
      const res = await fetch("/api/recommendations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id_negociacion: leadSeleccionado.id_negociacion,
          id_producto: tipo === "PRODUCTO" ? id : undefined,
          id_combo: tipo === "COMBO" ? id : undefined,
          id_promocion: tipo === "PROMOCION" ? id : undefined,
          respuesta,
          detalle: `Recomendación comercial ofrecida: ${nombre}`,
        }),
      });
      const json = await res.json();
      if (json.success) {
        setMensajeExito(`Oferta registrada exitosamente en SQL Server como '${respuesta}' (#${json.id_oferta})`);
        fetchLeadRec(leadSeleccionado.id_persona);
      }
    } catch (err) {
      console.error("Error al registrar oferta:", err);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <div className="w-10 h-10 border-4 border-[#C96D35]/20 border-t-[#C96D35] rounded-full animate-spin" />
        <p className="text-sm font-medium text-[#746B65] dark:text-[#B3ACA5]">
          Calculando matrices de recomendación y cargando catálogo desde SQL Server...
        </p>
      </div>
    );
  }

  const { topCortes = [], topCombos = [], promosVigentes = [] } = data || {};
  const { productos = [], combos = [], promociones = [] } = catalogoData || {};

  const productosFiltrados = productos.filter((p: any) => {
    if (filtroCategoria === "TODAS") return true;
    if (filtroCategoria === "CORTES") return p.es_corte;
    return p.categoria === filtroCategoria;
  });

  return (
    <div className="space-y-6">
      {/* Cabecera Principal con Selector de Modos Integrados */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-[#E8E0D8] dark:border-[#383C40]">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl md:text-3xl font-extrabold text-[#241E1A] dark:text-[#F5F3F0] font-display">
              Recomendaciones y Catálogo Comercial
            </h1>
            <span className="px-2.5 py-1 text-xs font-bold rounded-lg bg-[#C96D35]/15 text-[#C96D35] dark:text-[#E8A46D] border border-[#C96D35]/30">
              Ventas Personalizadas
            </span>
          </div>
          <p className="text-sm text-[#746B65] dark:text-[#B3ACA5] mt-1">
            Estrategias gastronómicas basadas en cortes por segmento, catálogo oficial de la carta, combos y reglas de promociones para el Agente IA.
          </p>
        </div>

        {/* Pestañas Principales: Motor IA vs Catálogo Oficial */}
        <div className="flex rounded-2xl bg-[#FFFFFF] dark:bg-[#1D2023] border border-[#E8E0D8] dark:border-[#383C40] p-1.5 shadow-sm text-xs font-bold shrink-0">
          <button
            onClick={() => setTabVista("recomendaciones")}
            className={`py-2 px-4 rounded-xl flex items-center gap-2 transition-all ${
              tabVista === "recomendaciones"
                ? "bg-[#C96D35] text-white shadow-xs font-extrabold"
                : "text-[#746B65] dark:text-[#B3ACA5] hover:text-[#241E1A] dark:hover:text-[#F5F3F0]"
            }`}
          >
            <Flame className="w-4 h-4" />
            <span>Motor de Recomendaciones IA</span>
          </button>
          <button
            onClick={() => setTabVista("catalogo")}
            className={`py-2 px-4 rounded-xl flex items-center gap-2 transition-all ${
              tabVista === "catalogo"
                ? "bg-[#C96D35] text-white shadow-xs font-extrabold"
                : "text-[#746B65] dark:text-[#B3ACA5] hover:text-[#241E1A] dark:hover:text-[#F5F3F0]"
            }`}
          >
            <UtensilsCrossed className="w-4 h-4" />
            <span>Catálogo Comercial Oficial ({productos.length + combos.length})</span>
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* VISTA 1: MOTOR DE RECOMENDACIONES PERSONALIZADAS (IA + SQL)              */}
      {/* ========================================================================= */}
      {tabVista === "recomendaciones" && (
        <div className="space-y-8 animate-in fade-in duration-200">
          {/* SECCIÓN 1: Simulador Interactivo de Recomendación por Lead */}
          <div className="p-6 rounded-2xl bg-[#FFFFFF] dark:bg-[#1D2023] border border-[#E8E0D8] dark:border-[#383C40] shadow-sm space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-[#E8E0D8] dark:border-[#383C40]">
              <div>
                <h3 className="font-extrabold text-base text-[#241E1A] dark:text-[#F5F3F0] flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-[#C96D35]" />
                  <span>Simulador Comercial de Recomendación Personalizada</span>
                </h3>
                <p className="text-xs text-[#746B65] dark:text-[#B3ACA5]">
                  Selecciona un lead real de SQL Server para calcular su propuesta de valor personalizada y registrar ofertas en dbo.oferta_negociacion.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-[#746B65] dark:text-[#B3ACA5]">Lead a Evaluar:</span>
                <select
                  value={leadSeleccionado ? String(leadSeleccionado.id_negociacion) : ""}
                  onChange={(e) => {
                    const val = e.target.value;
                    const found = leads.find((l) => String(l.id_negociacion) === String(val));
                    if (found) {
                      setLeadSeleccionado(found);
                      fetchLeadRec(found.id_persona);
                    }
                  }}
                  className="px-3 py-2 rounded-xl text-xs bg-[#FAF8F5] dark:bg-[#121416] border border-[#E8E0D8] dark:border-[#383C40] font-bold text-[#241E1A] dark:text-[#F5F3F0] focus:outline-none focus:border-[#C96D35]"
                >
                  {leads.map((l) => (
                    <option key={String(l.id_negociacion)} value={String(l.id_negociacion)}>
                      {l.persona_nombre} {l.persona_apellidos} (Neg #{l.id_negociacion} - {l.segmento_nombre || "Lead"})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {mensajeExito && (
              <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs font-semibold flex items-center gap-2 animate-in fade-in">
                <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />
                <span>{mensajeExito}</span>
              </div>
            )}

            {loadingRec ? (
              <p className="text-xs text-[#746B65] py-6 text-center">Analizando perfil comercial con Gemini y SQL Server...</p>
            ) : recLead ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-xs">
                {/* Contexto del Lead */}
                <div className="p-4 rounded-xl bg-[#FAF8F5] dark:bg-[#121416] border border-[#E8E0D8] dark:border-[#383C40] space-y-3">
                  <span className="text-[10px] font-bold text-[#746B65] dark:text-[#B3ACA5] uppercase tracking-wider">
                    Diagnóstico Comercial del Lead
                  </span>
                  <div className="space-y-1.5">
                    <p className="font-extrabold text-sm text-[#241E1A] dark:text-[#F5F3F0]">
                      {recLead.persona.nombres} {recLead.persona.apellidos}
                    </p>
                    <p className="text-[11px] text-[#C96D35] dark:text-[#E8A46D] font-bold">
                      Segmento: {recLead.persona.segmento || "No definido"}
                    </p>
                    <p className="text-[11px] text-[#746B65] dark:text-[#B3ACA5]">
                      Favorito declarado: <strong>{recLead.preferencias?.producto_favorito_declarado || "No registrado"}</strong>
                    </p>
                    <p className="text-[11px] text-[#746B65] dark:text-[#B3ACA5]">
                      Historial: {recLead.preferencias?.ciclos_convertidos || 0} compras exitosas
                    </p>
                  </div>
                </div>

                {/* Sugerencias de Cortes y Combos */}
                <div className="p-4 rounded-xl bg-[#FAF8F5] dark:bg-[#121416] border border-[#E8E0D8] dark:border-[#383C40] space-y-3">
                  <span className="text-[10px] font-bold text-[#746B65] dark:text-[#B3ACA5] uppercase tracking-wider">
                    Cortes y Combos Ideales
                  </span>
                  <div className="space-y-2">
                    {recLead.topCortes?.slice(0, 2).map((c: any) => (
                      <div key={c.id_producto} className="p-2 rounded-lg bg-white dark:bg-[#1D2023] border border-[#E8E0D8] dark:border-[#383C40] flex items-center justify-between">
                        <div>
                          <p className="font-bold text-[#241E1A] dark:text-[#F5F3F0]">{c.corte}</p>
                          <p className="text-[10px] text-[#746B65] dark:text-[#B3ACA5]">{c.estilo} • {c.unidades_vendidas} vendidas en su segmento</p>
                        </div>
                        <button
                          onClick={() => handleRegistrarOferta("PRODUCTO", c.id_producto, "ACEPTADA", c.corte)}
                          className="px-2 py-1 rounded bg-[#C96D35] hover:bg-[#B65F29] text-white font-bold text-[10px]"
                        >
                          Ofrecer
                        </button>
                      </div>
                    ))}

                    {recLead.topCombos?.slice(0, 1).map((cb: any) => (
                      <div key={cb.id_combo} className="p-2 rounded-lg bg-white dark:bg-[#1D2023] border border-[#E8E0D8] dark:border-[#383C40] flex items-center justify-between">
                        <div>
                          <p className="font-bold text-[#241E1A] dark:text-[#F5F3F0]">{cb.combo}</p>
                          <p className="text-[10px] text-[#C96D35] dark:text-[#E8A46D] font-bold">{formatCurrency(cb.precio)}</p>
                        </div>
                        <button
                          onClick={() => handleRegistrarOferta("COMBO", cb.id_combo, "ACEPTADA", cb.combo)}
                          className="px-2 py-1 rounded bg-[#C96D35] hover:bg-[#B65F29] text-white font-bold text-[10px]"
                        >
                          Ofrecer
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Promociones Elegibles Validadas */}
                <div className="p-4 rounded-xl bg-[#FAF8F5] dark:bg-[#121416] border border-[#E8E0D8] dark:border-[#383C40] space-y-3">
                  <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
                    Promociones Elegibles Hoy
                  </span>
                  <div className="space-y-2">
                    {recLead.promocionesElegibles?.length === 0 ? (
                      <p className="text-[11px] text-[#746B65] italic py-2">
                        No hay promociones aplicables para este cliente hoy (por día de semana o segmento).
                      </p>
                    ) : (
                      recLead.promocionesElegibles?.map((p: any) => (
                        <div key={p.id_promocion} className="p-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/40">
                          <p className="font-bold text-emerald-800 dark:text-emerald-300">{p.nombre_promocion}</p>
                          <p className="text-[10px] text-emerald-700 dark:text-emerald-400 mt-0.5">{p.descripcion}</p>
                          <div className="mt-2 flex items-center gap-1.5">
                            <button
                              onClick={() => handleRegistrarOferta("PROMOCION", p.id_promocion, "ACEPTADA", p.nombre_promocion)}
                              className="px-2 py-1 rounded bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10px]"
                            >
                              Aceptada
                            </button>
                            <button
                              onClick={() => handleRegistrarOferta("PROMOCION", p.id_promocion, "RECHAZADA", p.nombre_promocion)}
                              className="px-2 py-1 rounded bg-rose-600 hover:bg-rose-700 text-white font-bold text-[10px]"
                            >
                              Rechazada
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            ) : null}
          </div>

          {/* SECCIÓN 2: Vistas Oficiales de Preferencias Gastronómicas */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Cortes Más Vendidos por Segmento */}
            <div className="p-6 rounded-2xl bg-[#FFFFFF] dark:bg-[#1D2023] border border-[#E8E0D8] dark:border-[#383C40] shadow-sm">
              <h3 className="font-bold text-base text-[#241E1A] dark:text-[#F5F3F0] flex items-center gap-2 mb-1">
                <Award className="w-5 h-5 text-amber-500" />
                <span>Top Cortes de Parrilla por Segmento</span>
              </h3>
              <p className="text-xs text-[#746B65] dark:text-[#B3ACA5] mb-4">
                Fuente SQL: dbo.vw_top_cortes_segmento (incluye cortes servidos dentro de combos)
              </p>

              <div className="space-y-2.5">
                {topCortes.map((c: any, idx: number) => (
                  <div
                    key={idx}
                    className="p-3 rounded-xl bg-[#FAF8F5] dark:bg-[#121416] border border-[#E8E0D8] dark:border-[#383C40] flex items-center justify-between text-xs"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-[#241E1A] dark:text-[#F5F3F0]">{c.corte}</span>
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-neutral-200 dark:bg-neutral-800 font-semibold text-[#746B65] dark:text-[#B3ACA5]">
                          {c.segmento}
                        </span>
                      </div>
                      <p className="text-[11px] text-[#746B65] dark:text-[#B3ACA5] mt-0.5">
                        Estilo: {c.estilo || "Criollo"} • {c.peso_cantidad} {c.peso_unidad}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="font-extrabold text-[#C96D35] dark:text-[#E8A46D] text-sm">
                        {c.unidades_vendidas} un.
                      </span>
                      <p className="text-[10px] text-[#746B65] dark:text-[#B3ACA5]">vendidas</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Combos Más Pedidos por Segmento */}
            <div className="p-6 rounded-2xl bg-[#FFFFFF] dark:bg-[#1D2023] border border-[#E8E0D8] dark:border-[#383C40] shadow-sm">
              <h3 className="font-bold text-base text-[#241E1A] dark:text-[#F5F3F0] flex items-center gap-2 mb-1">
                <Layers className="w-5 h-5 text-[#C96D35]" />
                <span>Top Combos Parrilleros por Segmento</span>
              </h3>
              <p className="text-xs text-[#746B65] dark:text-[#B3ACA5] mb-4">
                Fuente SQL: dbo.vw_top_combos_segmento (paquetes cerrados de alta conversión)
              </p>

              <div className="space-y-2.5">
                {topCombos.map((cb: any, idx: number) => (
                  <div
                    key={idx}
                    className="p-3 rounded-xl bg-[#FAF8F5] dark:bg-[#121416] border border-[#E8E0D8] dark:border-[#383C40] flex items-center justify-between text-xs"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-[#241E1A] dark:text-[#F5F3F0]">{cb.combo}</span>
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-neutral-200 dark:bg-neutral-800 font-semibold text-[#746B65] dark:text-[#B3ACA5]">
                          {cb.segmento}
                        </span>
                      </div>
                      <p className="text-[11px] text-[#746B65] dark:text-[#B3ACA5] mt-0.5">
                        {cb.pedidos} pedidos confirmados
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="font-extrabold text-emerald-600 dark:text-emerald-400 text-sm">
                        {formatCurrency(cb.precio)}
                      </span>
                      <p className="text-[10px] text-[#746B65] dark:text-[#B3ACA5]">{cb.unidades_vendidas} unidades</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* VISTA 2: CATÁLOGO COMERCIAL OFICIAL INTEGRADO                             */}
      {/* ========================================================================= */}
      {tabVista === "catalogo" && (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* Sub-selector de Pestañas del Catálogo */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl bg-[#FFFFFF] dark:bg-[#1D2023] border border-[#E8E0D8] dark:border-[#383C40] shadow-sm">
            <div>
              <p className="font-extrabold text-sm text-[#241E1A] dark:text-[#F5F3F0]">
                Base de Productos y Ofertas de Parrilladas El Establo
              </p>
              <p className="text-xs text-[#746B65] dark:text-[#B3ACA5]">
                Datos transaccionales oficiales consultados por el agente para cotizar sin inventar precios.
              </p>
            </div>

            <div className="flex rounded-xl bg-[#FAF8F5] dark:bg-[#121416] border border-[#E8E0D8] dark:border-[#383C40] p-1 text-xs font-bold shrink-0">
              <button
                onClick={() => setTabCatalogo("productos")}
                className={`py-1.5 px-3 rounded-lg flex items-center gap-1.5 transition-colors ${
                  tabCatalogo === "productos" ? "bg-[#C96D35] text-white shadow-xs" : "text-[#746B65] dark:text-[#B3ACA5]"
                }`}
              >
                <UtensilsCrossed className="w-3.5 h-3.5" />
                <span>Carta ({productos.length})</span>
              </button>
              <button
                onClick={() => setTabCatalogo("combos")}
                className={`py-1.5 px-3 rounded-lg flex items-center gap-1.5 transition-colors ${
                  tabCatalogo === "combos" ? "bg-[#C96D35] text-white shadow-xs" : "text-[#746B65] dark:text-[#B3ACA5]"
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Combos ({combos.length})</span>
              </button>
              <button
                onClick={() => setTabCatalogo("promociones")}
                className={`py-1.5 px-3 rounded-lg flex items-center gap-1.5 transition-colors ${
                  tabCatalogo === "promociones" ? "bg-[#C96D35] text-white shadow-xs" : "text-[#746B65] dark:text-[#B3ACA5]"
                }`}
              >
                <Gift className="w-3.5 h-3.5" />
                <span>Promociones ({promociones.length})</span>
              </button>
            </div>
          </div>

          {/* SUB-PESTAÑA 1: PRODUCTOS DE LA CARTA */}
          {tabCatalogo === "productos" && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 flex-wrap">
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

          {/* SUB-PESTAÑA 2: COMBOS */}
          {tabCatalogo === "combos" && (
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

          {/* SUB-PESTAÑA 3: PROMOCIONES Y REGLAS */}
          {tabCatalogo === "promociones" && (
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
      )}
    </div>
  );
}
