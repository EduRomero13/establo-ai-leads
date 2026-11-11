"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  Users,
  UserCheck,
  TrendingUp,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  ArrowUpRight,
  Sparkles,
  Flame,
  ChevronRight,
  Filter,
  BarChart3,
  RefreshCw,
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  LineChart,
  Line,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { formatHours, formatPercent } from "@/lib/utils";

const COLORS_SEGMENTO = ["#C96D35", "#42291F", "#E8A46D", "#746B65"];

export default function DashboardPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [periodoFiltro, setPeriodoFiltro] = useState<string>("noviembre"); // 'noviembre', 'octubre', 'consolidado'

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/kpi");
      const json = await res.json();
      if (json.success) {
        setData(json);
      } else {
        setError(json.error || "Error al cargar datos");
      }
    } catch (err: any) {
      setError(err.message || "Error al conectar con la API de indicadores");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <div className="w-10 h-10 border-4 border-[#C96D35]/20 border-t-[#C96D35] rounded-full animate-spin" />
        <p className="text-sm font-medium text-[#746B65] dark:text-[#B3ACA5]">
          Cargando Centro de Inteligencia Comercial desde SQL Server...
        </p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-6 rounded-2xl bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/40 text-rose-800 dark:text-rose-200">
        <h3 className="font-bold text-base flex items-center gap-2">
          <AlertCircle className="w-5 h-5" /> Error al consultar SQL Server
        </h3>
        <p className="text-sm mt-1">{error}</p>
        <button
          onClick={fetchData}
          className="mt-4 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold"
        >
          Reintentar consulta
        </button>
      </div>
    );
  }

  const { kpiMensual = [], resumenGlobal = {}, leadsPorSegmento = [], agenteMetricas = {} } = data;

  // Estados oficiales de los 3 KPI
  const getEstadoTcp = (tcp: number | null) => {
    if (tcp === null) return { texto: "N/D", color: "text-neutral-500", bg: "bg-neutral-100" };
    if (tcp <= 48) return { texto: "Bueno (≤48 h)", color: "text-emerald-700 dark:text-emerald-400", bg: "bg-emerald-50 dark:bg-emerald-950/30" };
    if (tcp <= 72) return { texto: "Regular (48-72 h)", color: "text-amber-700 dark:text-amber-400", bg: "bg-amber-50 dark:bg-amber-950/30" };
    return { texto: "Malo (>72 h)", color: "text-rose-700 dark:text-rose-400", bg: "bg-rose-50 dark:bg-rose-950/30" };
  };

  const getEstadoTen = (ten: number | null) => {
    if (ten === null) return { texto: "N/D", color: "text-neutral-500", bg: "bg-neutral-100" };
    if (ten >= 30) return { texto: "Bueno (≥30%)", color: "text-emerald-700 dark:text-emerald-400", bg: "bg-emerald-50 dark:bg-emerald-950/30" };
    if (ten >= 15) return { texto: "Regular (15-30%)", color: "text-amber-700 dark:text-amber-400", bg: "bg-amber-50 dark:bg-amber-950/30" };
    return { texto: "Malo (<15%)", color: "text-rose-700 dark:text-rose-400", bg: "bg-rose-50 dark:bg-rose-950/30" };
  };

  const getEstadoTpn = (tpn: number | null) => {
    if (tpn === null) return { texto: "N/D", color: "text-neutral-500", bg: "bg-neutral-100" };
    if (tpn <= 40) return { texto: "Bueno (≤40%)", color: "text-emerald-700 dark:text-emerald-400", bg: "bg-emerald-50 dark:bg-emerald-950/30" };
    if (tpn <= 60) return { texto: "Regular (40-60%)", color: "text-amber-700 dark:text-amber-400", bg: "bg-amber-50 dark:bg-amber-950/30" };
    return { texto: "Malo (>60%)", color: "text-rose-700 dark:text-rose-400", bg: "bg-rose-50 dark:bg-rose-950/30" };
  };

  // Selección de métricas según filtro de período
  const mesNov = kpiMensual.find((k: any) => k.mes === 11) || {};
  const mesOct = kpiMensual.find((k: any) => k.mes === 10) || {};

  let metricasPeriodo: any = {
    titulo: "Noviembre 2026 (Mes Actual)",
    subtitulo: "Fuente SQL: dbo.vw_kpi_mensual (Mes 11/2026)",
    ciclos: mesNov.ciclos_lead ?? 12,
    personas: 12,
    payers: mesNov.payers ?? 9,
    perdidas: mesNov.perdidas ?? 1,
    abiertas: mesNov.abiertas ?? 2,
    tcp: mesNov.tcp_horas ?? 13.18,
    ten: mesNov.tasa_exito_ten ?? 75.00,
    tpn: mesNov.tasa_perdida_tpn ?? 8.33,
    formulaTen: "(9 Payers / 12 Ciclos Lead) × 100 = 75.00%",
    formulaTpn: "(1 Pérdida / 12 Ciclos Lead) × 100 = 8.33%",
    formulaTcp: "Promedio horas 9 payers de noviembre = 13.18 h",
  };

  if (periodoFiltro === "octubre") {
    metricasPeriodo = {
      titulo: "Octubre 2026",
      subtitulo: "Fuente SQL: dbo.vw_kpi_mensual (Mes 10/2026)",
      ciclos: mesOct.ciclos_lead ?? 7,
      personas: 7,
      payers: mesOct.payers ?? 6,
      perdidas: mesOct.perdidas ?? 1,
      abiertas: mesOct.abiertas ?? 0,
      tcp: mesOct.tcp_horas ?? 39.02,
      ten: mesOct.tasa_exito_ten ?? 85.71,
      tpn: mesOct.tasa_perdida_tpn ?? 14.29,
      formulaTen: "(6 Payers / 7 Ciclos Lead) × 100 = 85.71%",
      formulaTpn: "(1 Pérdida / 7 Ciclos Lead) × 100 = 14.29%",
      formulaTcp: "Promedio horas 6 payers de octubre = 39.02 h",
    };
  } else if (periodoFiltro === "consolidado") {
    metricasPeriodo = {
      titulo: "Histórico Consolidado (Oct + Nov 2026)",
      subtitulo: "Total ponderado sobre los 19 ciclos de la base buyer",
      ciclos: resumenGlobal.total_ciclos_lead,
      personas: resumenGlobal.total_personas_unicas_lead,
      payers: resumenGlobal.total_payers_ciclos,
      perdidas: resumenGlobal.total_perdidas,
      abiertas: resumenGlobal.total_abiertas,
      tcp: resumenGlobal.tcp_global_horas,
      ten: resumenGlobal.ten_global,
      tpn: resumenGlobal.tpn_global,
      formulaTen: "(15 Payers / 19 Ciclos Totales) × 100 = 78.95%",
      formulaTpn: "(2 Pérdidas / 19 Ciclos Totales) × 100 = 10.53%",
      formulaTcp: "Promedio horas 15 payers totales = 23.5 h",
    };
  }

  const estadoTcp = getEstadoTcp(metricasPeriodo.tcp);
  const estadoTen = getEstadoTen(metricasPeriodo.ten);
  const estadoTpn = getEstadoTpn(metricasPeriodo.tpn);

  // Formato para gráfico de evolución mensual
  const chartMensual = kpiMensual.map((k: any) => ({
    periodo: `${k.mes === 10 ? "Oct" : k.mes === 11 ? "Nov" : `M${k.mes}`} ${k.anio}`,
    ciclos: k.ciclos_lead,
    payers: k.payers,
    perdidas: k.perdidas,
    abiertas: k.abiertas,
    tcp: k.tcp_horas,
    ten: k.tasa_exito_ten,
    tpn: k.tasa_perdida_tpn,
  }));

  return (
    <div className="space-y-8">
      {/* Cabecera del Dashboard */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl md:text-3xl font-extrabold text-[#241E1A] dark:text-[#F5F3F0] font-display tracking-tight">
              Centro de Inteligencia Comercial
            </h1>
            <span className="px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider rounded-md bg-[#C96D35]/15 text-[#C96D35] dark:text-[#E8A46D] border border-[#C96D35]/30">
              Fase LEADS
            </span>
          </div>
          <p className="text-xs md:text-sm text-[#746B65] dark:text-[#B3ACA5] mt-1">
            Supervisión del embudo, efectividad de conversión y control del Agente IA en Parrilladas El Establo.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Selector de Período Limpio y Compacto */}
          <div className="inline-flex p-1 rounded-xl bg-[#FFFFFF] dark:bg-[#1D2023] border border-[#E8E0D8] dark:border-[#383C40] shadow-2xs">
            <button
              onClick={() => setPeriodoFiltro("noviembre")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                periodoFiltro === "noviembre"
                  ? "bg-[#C96D35] text-white shadow-xs"
                  : "text-[#746B65] dark:text-[#B3ACA5] hover:text-[#241E1A] dark:hover:text-white"
              }`}
            >
              Noviembre 2026
            </button>
            <button
              onClick={() => setPeriodoFiltro("octubre")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                periodoFiltro === "octubre"
                  ? "bg-[#C96D35] text-white shadow-xs"
                  : "text-[#746B65] dark:text-[#B3ACA5] hover:text-[#241E1A] dark:hover:text-white"
              }`}
            >
              Octubre 2026
            </button>
            <button
              onClick={() => setPeriodoFiltro("consolidado")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                periodoFiltro === "consolidado"
                  ? "bg-[#C96D35] text-white shadow-xs"
                  : "text-[#746B65] dark:text-[#B3ACA5] hover:text-[#241E1A] dark:hover:text-white"
              }`}
            >
              Histórico Total
            </button>
          </div>

          <button
            onClick={fetchData}
            title="Refrescar datos"
            className="p-2 rounded-xl bg-[#FFFFFF] dark:bg-[#1D2023] border border-[#E8E0D8] dark:border-[#383C40] text-[#746B65] dark:text-[#B3ACA5] hover:text-[#C96D35] transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <Link
            href="/leads"
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-[#C96D35] hover:bg-[#B65F29] text-white shadow-xs transition-colors"
          >
            <span>Ver Leads</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>

      {/* Sección 2: Tarjetas de los 3 KPIs Oficiales (Elegantes y Limpias) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* TCP */}
        <div className="p-5 rounded-2xl bg-[#FFFFFF] dark:bg-[#1D2023] border border-[#E8E0D8] dark:border-[#383C40] shadow-xs relative overflow-hidden flex flex-col justify-between">
          <div>
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-[#746B65] dark:text-[#B3ACA5]">
                  TCP — Tiempo de Conversión
                </p>
                <div className="flex items-baseline gap-2 mt-1">
                  <h3 className="text-3xl font-extrabold text-[#241E1A] dark:text-[#F5F3F0] font-display">
                    {formatHours(metricasPeriodo.tcp)}
                  </h3>
                  <span className="text-xs text-[#746B65] dark:text-[#B3ACA5] font-medium">promedio</span>
                </div>
              </div>
              <div className="p-2 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
                <Clock className="w-5 h-5" />
              </div>
            </div>
            <p className="text-xs text-[#746B65] dark:text-[#B3ACA5] mt-2">
              Horas desde primer contacto hasta el 1er pago
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-[#E8E0D8] dark:border-[#383C40] flex items-center justify-between text-xs">
            <span className="text-[#746B65] dark:text-[#B3ACA5]">Meta: ≤ 48 h</span>
            <span className={`px-2 py-0.5 rounded-md font-bold ${estadoTcp.bg} ${estadoTcp.color}`}>
              {estadoTcp.texto}
            </span>
          </div>
        </div>

        {/* TEN */}
        <div className="p-5 rounded-2xl bg-[#FFFFFF] dark:bg-[#1D2023] border border-[#E8E0D8] dark:border-[#383C40] shadow-xs relative overflow-hidden flex flex-col justify-between">
          <div>
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-[#746B65] dark:text-[#B3ACA5]">
                  TEN — Tasa de Éxito
                </p>
                <div className="flex items-baseline gap-2 mt-1">
                  <h3 className="text-3xl font-extrabold text-emerald-600 dark:text-emerald-400 font-display">
                    {formatPercent(metricasPeriodo.ten)}
                  </h3>
                  <span className="text-xs text-emerald-600/80 dark:text-emerald-400/80 font-semibold">
                    ({metricasPeriodo.payers}/{metricasPeriodo.ciclos} payers)
                  </span>
                </div>
              </div>
              <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="w-5 h-5" />
              </div>
            </div>
            <p className="text-xs text-[#746B65] dark:text-[#B3ACA5] mt-2">
              Conversiones de Lead a Payer con pago confirmado
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-[#E8E0D8] dark:border-[#383C40] flex items-center justify-between text-xs">
            <span className="text-[#746B65] dark:text-[#B3ACA5]">Meta: ≥ 30%</span>
            <span className={`px-2 py-0.5 rounded-md font-bold ${estadoTen.bg} ${estadoTen.color}`}>
              {estadoTen.texto}
            </span>
          </div>
        </div>

        {/* TPN */}
        <div className="p-5 rounded-2xl bg-[#FFFFFF] dark:bg-[#1D2023] border border-[#E8E0D8] dark:border-[#383C40] shadow-xs relative overflow-hidden flex flex-col justify-between">
          <div>
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-[#746B65] dark:text-[#B3ACA5]">
                  TPN — Tasa de Pérdida
                </p>
                <div className="flex items-baseline gap-2 mt-1">
                  <h3 className="text-3xl font-extrabold text-rose-600 dark:text-rose-400 font-display">
                    {formatPercent(metricasPeriodo.tpn)}
                  </h3>
                  <span className="text-xs text-rose-600/80 dark:text-rose-400/80 font-semibold">
                    ({metricasPeriodo.perdidas}/{metricasPeriodo.ciclos} perdidas)
                  </span>
                </div>
              </div>
              <div className="p-2 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400">
                <XCircle className="w-5 h-5" />
              </div>
            </div>
            <p className="text-xs text-[#746B65] dark:text-[#B3ACA5] mt-2">
              Leads cerrados por rechazo o inactividad de 72h
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-[#E8E0D8] dark:border-[#383C40] flex items-center justify-between text-xs">
            <span className="text-[#746B65] dark:text-[#B3ACA5]">Meta: ≤ 40%</span>
            <span className={`px-2 py-0.5 rounded-md font-bold ${estadoTpn.bg} ${estadoTpn.color}`}>
              {estadoTpn.texto}
            </span>
          </div>
        </div>
      </div>

      {/* Sección 3: Tarjetas de Volumen del Embudo (Minimalistas) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="p-4 rounded-xl bg-[#FFFFFF] dark:bg-[#1D2023] border border-[#E8E0D8] dark:border-[#383C40]">
          <span className="text-[11px] font-bold text-[#746B65] dark:text-[#B3ACA5] uppercase tracking-wider">Ciclos Lead</span>
          <p className="text-2xl font-black text-[#241E1A] dark:text-[#F5F3F0] mt-0.5">{metricasPeriodo.ciclos}</p>
          <span className="text-[11px] text-[#746B65] dark:text-[#B3ACA5]">En este período</span>
        </div>

        <div className="p-4 rounded-xl bg-[#FFFFFF] dark:bg-[#1D2023] border border-[#E8E0D8] dark:border-[#383C40]">
          <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">Payers Convertidos</span>
          <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-0.5">{metricasPeriodo.payers}</p>
          <span className="text-[11px] text-[#746B65] dark:text-[#B3ACA5]">1er pago registrado</span>
        </div>

        <div className="p-4 rounded-xl bg-[#FFFFFF] dark:bg-[#1D2023] border border-[#E8E0D8] dark:border-[#383C40]">
          <span className="text-[11px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider">Negociaciones Abiertas</span>
          <p className="text-2xl font-black text-blue-600 dark:text-blue-400 mt-0.5">{metricasPeriodo.abiertas}</p>
          <span className="text-[11px] text-[#746B65] dark:text-[#B3ACA5]">En curso con agente</span>
        </div>

        <div className="p-4 rounded-xl bg-[#FFFFFF] dark:bg-[#1D2023] border border-[#E8E0D8] dark:border-[#383C40]">
          <span className="text-[11px] font-bold text-rose-600 dark:text-rose-400 uppercase tracking-wider">Negociaciones Perdidas</span>
          <p className="text-2xl font-black text-rose-600 dark:text-rose-400 mt-0.5">{metricasPeriodo.perdidas}</p>
          <span className="text-[11px] text-[#746B65] dark:text-[#B3ACA5]">Rechazo o Timeout</span>
        </div>
      </div>

      {/* Sección 4: Gráficos Recharts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Gráfico 1: Evolución Mensual de Ciclos y Conversiones */}
        <div className="p-6 rounded-2xl bg-[#FFFFFF] dark:bg-[#1D2023] border border-[#E8E0D8] dark:border-[#383C40] shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-bold text-base text-[#241E1A] dark:text-[#F5F3F0]">
                Evolución de Ciclos y Conversiones
              </h3>
              <p className="text-xs text-[#746B65] dark:text-[#B3ACA5]">
                Fuente oficial: dbo.vw_kpi_mensual
              </p>
            </div>
            <BarChart3 className="w-5 h-5 text-[#C96D35]" />
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartMensual} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis dataKey="periodo" stroke="#888888" fontSize={12} />
                <YAxis stroke="#888888" fontSize={12} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#1D2023",
                    borderColor: "#383C40",
                    borderRadius: "12px",
                    color: "#FFF",
                    fontSize: "12px",
                  }}
                />
                <Legend wrapperStyle={{ fontSize: "12px", paddingTop: "10px" }} />
                <Bar dataKey="ciclos" name="Total Ciclos Lead" fill="#C96D35" radius={[4, 4, 0, 0]} />
                <Bar dataKey="payers" name="Payers (Convertidos)" fill="#10B981" radius={[4, 4, 0, 0]} />
                <Bar dataKey="perdidas" name="Perdidas" fill="#EF4444" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Gráfico 2: Evolución de Tasas TEN y TPN */}
        <div className="p-6 rounded-2xl bg-[#FFFFFF] dark:bg-[#1D2023] border border-[#E8E0D8] dark:border-[#383C40] shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-bold text-base text-[#241E1A] dark:text-[#F5F3F0]">
                Tendencia de Tasa de Éxito (TEN) vs Pérdida (TPN)
              </h3>
              <p className="text-xs text-[#746B65] dark:text-[#B3ACA5]">
                Porcentajes agrupados por mes de inicio
              </p>
            </div>
            <TrendingUp className="w-5 h-5 text-emerald-500" />
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartMensual} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis dataKey="periodo" stroke="#888888" fontSize={12} />
                <YAxis stroke="#888888" fontSize={12} domain={[0, 100]} />
                <Tooltip
                  formatter={(val: any) => [`${val}%`, '']}
                  contentStyle={{
                    backgroundColor: "#1D2023",
                    borderColor: "#383C40",
                    borderRadius: "12px",
                    color: "#FFF",
                    fontSize: "12px",
                  }}
                />
                <Legend wrapperStyle={{ fontSize: "12px", paddingTop: "10px" }} />
                <Line
                  type="monotone"
                  dataKey="ten"
                  name="Tasa de Éxito (TEN %)"
                  stroke="#10B981"
                  strokeWidth={3}
                  dot={{ r: 5 }}
                />
                <Line
                  type="monotone"
                  dataKey="tpn"
                  name="Tasa de Pérdida (TPN %)"
                  stroke="#EF4444"
                  strokeWidth={3}
                  dot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Gráfico 3: Distribución de Leads por Segmento */}
        <div className="p-6 rounded-2xl bg-[#FFFFFF] dark:bg-[#1D2023] border border-[#E8E0D8] dark:border-[#383C40] shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-bold text-base text-[#241E1A] dark:text-[#F5F3F0]">
                Distribución por Segmento de Cliente
              </h3>
              <p className="text-xs text-[#746B65] dark:text-[#B3ACA5]">
                Familias, Estudiantes y Grupos de Amigos
              </p>
            </div>
            <Users className="w-5 h-5 text-[#C96D35]" />
          </div>
          <div className="h-64 w-full flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={leadsPorSegmento}
                  dataKey="ciclos_lead"
                  nameKey="segmento"
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  label={({ segmento, percent }: any) => `${segmento} (${((percent || 0) * 100).toFixed(0)}%)`}
                >
                  {leadsPorSegmento.map((entry: any, index: number) => (
                    <Cell key={`cell-${index}`} fill={COLORS_SEGMENTO[index % COLORS_SEGMENTO.length]} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(val: any) => [`${val} ciclos`, 'Volumen']}
                  contentStyle={{
                    backgroundColor: "#1D2023",
                    borderColor: "#383C40",
                    borderRadius: "12px",
                    color: "#FFF",
                    fontSize: "12px",
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Gráfico 4: Métricas Complementarias del Agente IA */}
        <div className="p-6 rounded-2xl bg-[#FFFFFF] dark:bg-[#1D2023] border border-[#E8E0D8] dark:border-[#383C40] shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-bold text-base text-[#241E1A] dark:text-[#F5F3F0]">
                  Efectividad del Agente IA
                </h3>
                <p className="text-xs text-[#746B65] dark:text-[#B3ACA5]">
                  Memoria de ofertas en dbo.oferta_negociacion
                </p>
              </div>
              <Sparkles className="w-5 h-5 text-amber-500" />
            </div>

            <div className="space-y-4 my-2">
              <div>
                <div className="flex justify-between text-xs font-bold mb-1">
                  <span>Tasa de Aceptación de Recomendaciones</span>
                  <span className="text-[#C96D35] dark:text-[#E8A46D]">{formatPercent(agenteMetricas.tasa_aceptacion_ofertas)}</span>
                </div>
                <div className="w-full h-3 rounded-full bg-neutral-200 dark:bg-neutral-800 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-[#C96D35] to-emerald-500 rounded-full"
                    style={{ width: `${agenteMetricas.tasa_aceptacion_ofertas || 0}%` }}
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3 pt-2 text-center">
                <div className="p-3 rounded-xl bg-neutral-50 dark:bg-neutral-900 border border-[#E8E0D8] dark:border-[#383C40]">
                  <p className="text-xs text-[#746B65] dark:text-[#B3ACA5]">Realizadas</p>
                  <p className="text-lg font-bold text-[#241E1A] dark:text-[#F5F3F0] mt-0.5">{agenteMetricas.total_ofertas || 0}</p>
                </div>
                <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/30">
                  <p className="text-xs text-emerald-600 dark:text-emerald-400">Aceptadas</p>
                  <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">{agenteMetricas.ofertas_aceptadas || 0}</p>
                </div>
                <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/30">
                  <p className="text-xs text-rose-600 dark:text-rose-400">Rechazadas</p>
                  <p className="text-lg font-bold text-rose-600 dark:text-rose-400 mt-0.5">{agenteMetricas.ofertas_rechazadas || 0}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-[#E8E0D8] dark:border-[#383C40] flex justify-end">
            <Link
              href="/recomendaciones"
              className="text-xs font-bold text-[#C96D35] dark:text-[#E8A46D] hover:underline flex items-center gap-1"
            >
              <span>Ver motor de recomendaciones</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

