"use client";

import React, { useEffect, useState } from "react";
import {
  Flame,
  Award,
  Gift,
  Layers,
  Sparkles,
  CheckCircle,
  XCircle,
  HelpCircle,
  Send,
  User,
  ShoppingBag,
  Clock,
  ArrowRight,
} from "lucide-react";
import { formatCurrency, formatHours } from "@/lib/utils";

export default function RecomendacionesPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [leads, setLeads] = useState<any[]>([]);
  const [leadSeleccionado, setLeadSeleccionado] = useState<any | null>(null);
  const [recLead, setRecLead] = useState<any | null>(null);
  const [loadingRec, setLoadingRec] = useState(false);
  const [mensajeExito, setMensajeExito] = useState<string | null>(null);

  // Cargar datos panorámicos
  const fetchData = async () => {
    try {
      const res = await fetch("/api/recommendations");
      const json = await res.json();
      if (json.success) setData(json);

      const resLeads = await fetch("/api/leads");
      const jsonLeads = await resLeads.json();
      if (jsonLeads.success && jsonLeads.leads) {
        setLeads(jsonLeads.leads);
        if (jsonLeads.leads.length > 0) {
          setLeadSeleccionado(jsonLeads.leads[0]);
        }
      }
    } catch (err) {
      console.error("Error al cargar recomendaciones:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Cargar recomendaciones para un lead seleccionado
  const fetchLeadRec = async (idPersona: number) => {
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
          Calculando matrices de recomendación por segmento...
        </p>
      </div>
    );
  }

  const { topCortes = [], topCombos = [], promosVigentes = [] } = data || {};

  return (
    <div className="space-y-8">
      {/* Cabecera */}
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-2xl md:text-3xl font-extrabold text-[#241E1A] dark:text-[#F5F3F0] font-display">
            Motor de Recomendaciones Personalizadas
          </h1>
          <span className="px-2.5 py-1 text-xs font-bold rounded-lg bg-[#C96D35]/15 text-[#C96D35] dark:text-[#E8A46D] border border-[#C96D35]/30">
            Híbrido IA + Vistas SQL
          </span>
        </div>
        <p className="text-sm text-[#746B65] dark:text-[#B3ACA5] mt-1">
          Estrategias gastronómicas basadas en cortes más pedidos por segmento, historial de compras y promociones elegibles validadas en tiempo real.
        </p>
      </div>

      {/* SECCIÓN 1: Simulador Interactivo de Recomendación por Lead */}
      <div className="p-6 rounded-2xl bg-[#FFFFFF] dark:bg-[#1D2023] border border-[#E8E0D8] dark:border-[#383C40] shadow-sm space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-[#E8E0D8] dark:border-[#383C40]">
          <div>
            <h3 className="font-extrabold text-base text-[#241E1A] dark:text-[#F5F3F0] flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-[#C96D35]" />
              <span>Simulador Comercial de Recomendación Personalizada</span>
            </h3>
            <p className="text-xs text-[#746B65] dark:text-[#B3ACA5]">
              Selecciona un lead real para ejecutar el algoritmo de recomendación y registrar ofertas en dbo.oferta_negociacion.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-[#746B65] dark:text-[#B3ACA5]">Lead a Evaluar:</span>
            <select
              value={leadSeleccionado?.id_negociacion || ""}
              onChange={(e) => {
                const found = leads.find((l) => l.id_negociacion === parseInt(e.target.value, 10));
                if (found) setLeadSeleccionado(found);
              }}
              className="px-3 py-2 rounded-xl text-xs bg-[#FAF8F5] dark:bg-[#121416] border border-[#E8E0D8] dark:border-[#383C40] font-bold text-[#241E1A] dark:text-[#F5F3F0] focus:outline-none focus:border-[#C96D35]"
            >
              {leads.map((l) => (
                <option key={l.id_negociacion} value={l.id_negociacion}>
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
          <p className="text-xs text-[#746B65] py-6 text-center">Analizando perfil comercial...</p>
        ) : recLead ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-xs">
            {/* Contexto del Lead */}
            <div className="p-4 rounded-xl bg-[#FAF8F5] dark:bg-[#121416] border border-[#E8E0D8] dark:border-[#383C40] space-y-3">
              <span className="text-[10px] font-bold text-[#746B65] dark:text-[#B3ACA5] uppercase tracking-wider">
                Diagnóstico Comercial
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
                    No hay promociones aplicables para este cliente hoy (por día o segmento).
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
  );
}

