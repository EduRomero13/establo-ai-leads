"use client";

import React, { useEffect, useState, useTransition, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  Search,
  Filter,
  Users,
  MessageSquare,
  Eye,
  CheckCircle,
  XCircle,
  Clock,
  Sparkles,
  ChevronRight,
  CreditCard,
  Flame,
  ArrowUpDown,
} from "lucide-react";
import { formatDate, formatHours } from "@/lib/utils";

function LeadsCRMContent() {
  const searchParams = useSearchParams();
  const casoInicial = searchParams.get("caso") || "";

  const [leads, setLeads] = useState<any[]>([]);
  const [segmentos, setSegmentos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState("");
  const [filtroEstado, setFiltroEstado] = useState("TODOS");
  const [filtroSegmento, setFiltroSegmento] = useState("TODOS");
  const [casoSeleccionado, setCasoSeleccionado] = useState(casoInicial);

  const fetchLeads = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (busqueda) params.set("q", busqueda);
      if (filtroEstado !== "TODOS") params.set("estado", filtroEstado);
      if (filtroSegmento !== "TODOS") params.set("segmento", filtroSegmento);
      if (casoSeleccionado) params.set("caso", casoSeleccionado);

      const res = await fetch(`/api/leads?${params.toString()}`);
      const data = await res.json();
      if (data.success) {
        setLeads(data.leads || []);
        if (data.segmentos) setSegmentos(data.segmentos);
      }
    } catch (err) {
      console.error("Error al cargar leads:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeads();
  }, [busqueda, filtroEstado, filtroSegmento, casoSeleccionado]);

  useEffect(() => {
    if (searchParams.get("caso")) {
      setCasoSeleccionado(searchParams.get("caso") || "");
    }
  }, [searchParams]);

  return (
    <div className="space-y-6">
      {/* Cabecera */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl md:text-3xl font-extrabold text-[#241E1A] dark:text-[#F5F3F0] font-display">
              Gestión Comercial de Leads
            </h1>
            <span className="px-2.5 py-0.5 text-xs font-bold rounded-md bg-[#C96D35]/15 text-[#C96D35] dark:text-[#E8A46D] border border-[#C96D35]/30">
              CRM Parrillero
            </span>
          </div>
          <p className="text-xs md:text-sm text-[#746B65] dark:text-[#B3ACA5] mt-1">
            Seguimiento de negociaciones, historial de contacto y conversión de leads en Trujillo.
          </p>
        </div>

        {/* Acceso a casos de prueba */}
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-[#FFFFFF] dark:bg-[#1D2023] border border-[#E8E0D8] dark:border-[#383C40] shadow-xs">
          <span className="text-[11px] font-bold text-[#746B65] dark:text-[#B3ACA5] px-2">Casos:</span>
          {["ana", "luis", "maria", "sofia", "diego", "jorge"].map((c) => (
            <button
              key={c}
              onClick={() => {
                setCasoSeleccionado(casoSeleccionado === c ? "" : c);
              }}
              className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-colors capitalize ${
                casoSeleccionado === c
                  ? "bg-[#C96D35] text-white shadow-xs"
                  : "text-[#746B65] dark:text-[#B3ACA5] hover:text-[#C96D35]"
              }`}
            >
              {c}
            </button>
          ))}
          {casoSeleccionado && (
            <button
              onClick={() => setCasoSeleccionado("")}
              className="text-xs text-rose-500 font-bold hover:underline px-2"
            >
              ×
            </button>
          )}
        </div>
      </div>

      {/* Barra de Filtros y Búsqueda */}
      <div className="p-4 rounded-2xl bg-[#FFFFFF] dark:bg-[#1D2023] border border-[#E8E0D8] dark:border-[#383C40] shadow-sm flex flex-col md:flex-row items-center gap-4">
        {/* Buscador */}
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#746B65] dark:text-[#B3ACA5]" />
          <input
            type="text"
            placeholder="Buscar por nombre, teléfono o email..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl text-xs bg-[#FAF8F5] dark:bg-[#121416] border border-[#E8E0D8] dark:border-[#383C40] text-[#241E1A] dark:text-[#F5F3F0] placeholder-[#746B65]/70 focus:outline-none focus:border-[#C96D35]"
          />
        </div>

        {/* Filtro Estado */}
        <div className="flex items-center gap-2 w-full md:w-auto">
          <select
            value={filtroEstado}
            onChange={(e) => setFiltroEstado(e.target.value)}
            className="w-full md:w-44 px-3 py-2.5 rounded-xl text-xs bg-[#FAF8F5] dark:bg-[#121416] border border-[#E8E0D8] dark:border-[#383C40] text-[#241E1A] dark:text-[#F5F3F0] focus:outline-none focus:border-[#C96D35]"
          >
            <option value="TODOS">Todos los Estados</option>
            <option value="ABIERTA">ABIERTA (En negociación)</option>
            <option value="CONVERTIDA">CONVERTIDA (Payer)</option>
            <option value="PERDIDA">PERDIDA (Rechazo / Timeout)</option>
          </select>

          {/* Filtro Segmento */}
          <select
            value={filtroSegmento}
            onChange={(e) => setFiltroSegmento(e.target.value)}
            className="w-full md:w-40 px-3 py-2.5 rounded-xl text-xs bg-[#FAF8F5] dark:bg-[#121416] border border-[#E8E0D8] dark:border-[#383C40] text-[#241E1A] dark:text-[#F5F3F0] focus:outline-none focus:border-[#C96D35]"
          >
            <option value="TODOS">Todos los Segmentos</option>
            {segmentos.map((s) => (
              <option key={s.id_segmento} value={s.id_segmento}>
                {s.nombre}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Tabla CRM */}
      <div className="rounded-2xl bg-[#FFFFFF] dark:bg-[#1D2023] border border-[#E8E0D8] dark:border-[#383C40] shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#FAF8F5] dark:bg-[#121416] border-b border-[#E8E0D8] dark:border-[#383C40] text-[#746B65] dark:text-[#B3ACA5] font-bold uppercase tracking-wider">
              <tr>
                <th className="py-3.5 px-4">Lead / Negociación</th>
                <th className="py-3.5 px-4">Segmento</th>
                <th className="py-3.5 px-4">Contacto</th>
                <th className="py-3.5 px-4">Fecha Inicio</th>
                <th className="py-3.5 px-4">Estado</th>
                <th className="py-3.5 px-4">Sin Respuesta</th>
                <th className="py-3.5 px-4">Última Actividad</th>
                <th className="py-3.5 px-4 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E8E0D8] dark:divide-[#383C40] text-[#241E1A] dark:text-[#F5F3F0]">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-[#746B65] dark:text-[#B3ACA5]">
                    <div className="w-8 h-8 border-3 border-[#C96D35]/30 border-t-[#C96D35] rounded-full animate-spin mx-auto mb-2" />
                    Consultando base de datos buyer...
                  </td>
                </tr>
              ) : leads.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-[#746B65] dark:text-[#B3ACA5]">
                    No se encontraron negociaciones con los filtros seleccionados.
                  </td>
                </tr>
              ) : (
                leads.map((lead) => {
                  const esConvertida = lead.estado === "CONVERTIDA";
                  const esPerdida = lead.estado === "PERDIDA";
                  const esAbierta = lead.estado === "ABIERTA";

                  return (
                    <tr
                      key={lead.id_negociacion}
                      className="hover:bg-[#FAF8F5] dark:hover:bg-[#292D31]/50 transition-colors"
                    >
                      {/* Lead */}
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-[#241E1A] dark:text-[#F5F3F0] text-sm">
                          {lead.persona_nombre} {lead.persona_apellidos}
                        </div>
                        <div className="text-[11px] text-[#746B65] dark:text-[#B3ACA5] flex items-center gap-1.5 mt-0.5">
                          <span>Neg. #{lead.id_negociacion}</span>
                          <span>•</span>
                          <span>Ciclo {lead.nro_ciclo}</span>
                          {lead.nro_ciclo > 1 && (
                            <span className="px-1.5 py-0.2 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 font-extrabold text-[10px]">
                              Recurrente
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Segmento */}
                      <td className="py-3.5 px-4">
                        <span className="px-2 py-0.5 rounded-md font-semibold text-[11px] bg-[#FAF8F5] dark:bg-[#121416] border border-[#E8E0D8] dark:border-[#383C40] text-[#42291F] dark:text-[#E8A46D]">
                          {lead.segmento_nombre || "No especificado"}
                        </span>
                      </td>

                      {/* Contacto */}
                      <td className="py-3.5 px-4">
                        <p className="font-medium text-[#241E1A] dark:text-[#F5F3F0]">{lead.telefono || "Sin tel."}</p>
                        <p className="text-[11px] text-[#746B65] dark:text-[#B3ACA5] truncate max-w-[140px]">
                          {lead.email || "Sin email"}
                        </p>
                      </td>

                      {/* Fecha Inicio */}
                      <td className="py-3.5 px-4 text-[#746B65] dark:text-[#B3ACA5] whitespace-nowrap">
                        {formatDate(lead.fecha_inicio)}
                      </td>

                      {/* Estado */}
                      <td className="py-3.5 px-4">
                        {esConvertida && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full font-bold text-[11px] bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-800">
                            <CheckCircle className="w-3 h-3" /> CONVERTIDA
                          </span>
                        )}
                        {esPerdida && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full font-bold text-[11px] bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-400 border border-rose-300 dark:border-rose-800">
                            <XCircle className="w-3 h-3" /> PERDIDA ({lead.motivo_perdida})
                          </span>
                        )}
                        {esAbierta && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full font-bold text-[11px] bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-400 border border-blue-300 dark:border-blue-800 animate-pulse">
                            <Clock className="w-3 h-3" /> ABIERTA
                          </span>
                        )}
                      </td>

                      {/* Tiempo sin respuesta */}
                      <td className="py-3.5 px-4 whitespace-nowrap font-medium">
                        {esAbierta ? (
                          <span className={`${(lead.horas_sin_respuesta || 0) > 48 ? "text-rose-600 font-bold" : "text-[#746B65] dark:text-[#B3ACA5]"}`}>
                            {formatHours(lead.horas_sin_respuesta)}
                          </span>
                        ) : esConvertida ? (
                          <span className="text-emerald-600 font-semibold">
                            TCP: {formatHours(lead.horas_conversion)}
                          </span>
                        ) : (
                          <span className="text-neutral-400">Cerrada</span>
                        )}
                      </td>

                      {/* Última Actividad */}
                      <td className="py-3.5 px-4 max-w-[200px]">
                        <p className="truncate text-[#241E1A] dark:text-[#F5F3F0] text-[11px]">
                          {lead.ultima_actividad_texto}
                        </p>
                      </td>

                      {/* Acciones */}
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Perfil 360 */}
                          <Link
                            href={`/leads/${lead.id_negociacion}`}
                            title="Ver Perfil 360°"
                            className="p-1.5 rounded-lg border border-[#E8E0D8] dark:border-[#383C40] hover:bg-[#FAF8F5] dark:hover:bg-[#292D31] text-[#746B65] dark:text-[#B3ACA5] hover:text-[#C96D35] dark:hover:text-[#E8A46D] transition-colors"
                          >
                            <Eye className="w-4 h-4" />
                          </Link>

                          {/* Chat / Agente IA */}
                          <Link
                            href={`/agente?negociacionId=${lead.id_negociacion}`}
                            title="Atender con Agente IA"
                            className="p-1.5 rounded-lg border border-[#C96D35]/30 bg-[#C96D35]/10 text-[#C96D35] dark:text-[#E8A46D] hover:bg-[#C96D35] hover:text-white transition-colors"
                          >
                            <Sparkles className="w-4 h-4" />
                          </Link>

                          {/* Conversión / Pago */}
                          {esConvertida && (
                            <Link
                              href={`/leads/${lead.id_negociacion}#pago`}
                              title="Ver Pago Confirmado"
                              className="p-1.5 rounded-lg border border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-600 hover:text-white transition-colors"
                            >
                              <CreditCard className="w-4 h-4" />
                            </Link>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Footer tabla */}
        <div className="p-3.5 px-4 bg-[#FAF8F5] dark:bg-[#121416] border-t border-[#E8E0D8] dark:border-[#383C40] flex items-center justify-between text-xs text-[#746B65] dark:text-[#B3ACA5]">
          <span>Total de registros mostrados: {leads.length}</span>
          <span className="font-semibold text-[#42291F] dark:text-[#E8A46D]">
            Fase LEADS — Parrilladas El Establo V3
          </span>
        </div>
      </div>
    </div>
  );
}

export default function LeadsCRMPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-xs text-[#746B65]">Cargando CRM de Leads...</div>}>
      <LeadsCRMContent />
    </Suspense>
  );
}

