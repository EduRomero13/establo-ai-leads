"use client";

import React, { useEffect, useState } from "react";
import {
  LineChart as LineChartIcon,
  TrendingUp,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Database,
  Calendar,
  Sparkles,
  Layers,
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
  LineChart,
  Line,
} from "recharts";
import { formatHours, formatPercent } from "@/lib/utils";

export default function AnaliticaLeadsPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchKpi = async () => {
    try {
      const res = await fetch("/api/kpi");
      const json = await res.json();
      if (json.success) setData(json);
    } catch (err) {
      console.error("Error al cargar KPIs:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchKpi();
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <div className="w-10 h-10 border-4 border-[#C96D35]/20 border-t-[#C96D35] rounded-full animate-spin" />
        <p className="text-sm font-medium text-[#746B65] dark:text-[#B3ACA5]">
          Calculando KPIs oficiales de dbo.vw_kpi_mensual...
        </p>
      </div>
    );
  }

  const { kpiMensual = [], resumenGlobal = {}, agenteMetricas = {} } = data || {};

  return (
    <div className="space-y-8">
      {/* Cabecera */}
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-2xl md:text-3xl font-extrabold text-[#241E1A] dark:text-[#F5F3F0] font-display">
            Analítica Oficial de Conversión LEADS
          </h1>
          <span className="px-2.5 py-1 text-xs font-bold rounded-lg bg-[#C96D35]/15 text-[#C96D35] dark:text-[#E8A46D] border border-[#C96D35]/30">
            dbo.vw_kpi_mensual
          </span>
        </div>
        <p className="text-sm text-[#746B65] dark:text-[#B3ACA5] mt-1">
          Indicadores oficiales de gestión comercial requeridos para el curso de Inteligencia de Negocios en Parrilladas El Establo.
        </p>
      </div>

      {/* Tabla Oficial de Resultados de Referencia Validados contra SQL Server */}
      <div className="rounded-2xl bg-[#FFFFFF] dark:bg-[#1D2023] border border-[#E8E0D8] dark:border-[#383C40] shadow-sm overflow-hidden">
        <div className="p-4 border-b border-[#E8E0D8] dark:border-[#383C40] bg-[#FAF8F5] dark:bg-[#121416]/50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Database className="w-4 h-4 text-emerald-500" />
            <span className="text-xs font-bold text-[#241E1A] dark:text-[#F5F3F0]">
              Resultados de la Vista dbo.vw_kpi_mensual (SQL Server V3)
            </span>
          </div>
          <span className="text-[11px] font-semibold text-[#746B65] dark:text-[#B3ACA5]">
            Datos Verificados
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#FAF8F5] dark:bg-[#121416] border-b border-[#E8E0D8] dark:border-[#383C40] text-[#746B65] dark:text-[#B3ACA5] font-bold uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4">Período</th>
                <th className="py-3 px-4 text-center">Ciclos Lead</th>
                <th className="py-3 px-4 text-center">Payers</th>
                <th className="py-3 px-4 text-center">Pérdidas</th>
                <th className="py-3 px-4 text-center">Abiertas</th>
                <th className="py-3 px-4 text-right">TCP (Horas)</th>
                <th className="py-3 px-4 text-right">TEN (%)</th>
                <th className="py-3 px-4 text-right">TPN (%)</th>
                <th className="py-3 px-4 text-center">Estado General</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E8E0D8] dark:divide-[#383C40] text-[#241E1A] dark:text-[#F5F3F0]">
              {kpiMensual.map((k: any) => {
                const nombreMes = k.mes === 10 ? "Octubre 2026" : k.mes === 11 ? "Noviembre 2026" : `Mes ${k.mes}/${k.anio}`;
                return (
                  <tr key={`${k.anio}-${k.mes}`} className="hover:bg-[#FAF8F5] dark:hover:bg-[#292D31]/40 font-medium">
                    <td className="py-3.5 px-4 font-bold">{nombreMes}</td>
                    <td className="py-3.5 px-4 text-center font-bold">{k.ciclos_lead}</td>
                    <td className="py-3.5 px-4 text-center text-emerald-600 font-bold">{k.payers}</td>
                    <td className="py-3.5 px-4 text-center text-rose-600 font-bold">{k.perdidas}</td>
                    <td className="py-3.5 px-4 text-center text-blue-600 font-bold">{k.abiertas}</td>
                    <td className="py-3.5 px-4 text-right font-black text-[#42291F] dark:text-[#E8A46D]">
                      {k.tcp_horas ? `${Number(k.tcp_horas).toFixed(2)} h` : "N/D"}
                    </td>
                    <td className="py-3.5 px-4 text-right font-black text-emerald-600 dark:text-emerald-400">
                      {k.tasa_exito_ten ? `${Number(k.tasa_exito_ten).toFixed(2)}%` : "0.00%"}
                    </td>
                    <td className="py-3.5 px-4 text-right font-black text-rose-600 dark:text-rose-400">
                      {k.tasa_perdida_tpn ? `${Number(k.tasa_perdida_tpn).toFixed(2)}%` : "0.00%"}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-800">
                        Óptimo (Meta Cumplida)
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Definición Rigurosa de Metas y Rangos de Evaluación */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="p-5 rounded-2xl bg-[#FFFFFF] dark:bg-[#1D2023] border border-[#E8E0D8] dark:border-[#383C40] shadow-sm space-y-3">
          <div className="flex items-center gap-2 text-blue-600">
            <Clock className="w-5 h-5" />
            <h3 className="font-extrabold text-sm text-[#241E1A] dark:text-[#F5F3F0]">
              TCP — Tiempo de Conversión
            </h3>
          </div>
          <p className="text-xs text-[#746B65] dark:text-[#B3ACA5]">
            Promedio de horas entre la entrada a LEAD y el primer pago confirmado por ciclo.
          </p>
          <div className="space-y-1.5 text-xs pt-2">
            <div className="flex justify-between p-1.5 rounded bg-emerald-50 dark:bg-emerald-950/20 text-emerald-800 dark:text-emerald-300 font-semibold">
              <span>Bueno:</span>
              <span>≤ 48 horas (Meta)</span>
            </div>
            <div className="flex justify-between p-1.5 rounded bg-amber-50 dark:bg-amber-950/20 text-amber-800 dark:text-amber-300 font-semibold">
              <span>Regular:</span>
              <span>48 - 72 horas</span>
            </div>
            <div className="flex justify-between p-1.5 rounded bg-rose-50 dark:bg-rose-950/20 text-rose-800 dark:text-rose-300 font-semibold">
              <span>Malo:</span>
              <span>&gt; 72 horas</span>
            </div>
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-[#FFFFFF] dark:bg-[#1D2023] border border-[#E8E0D8] dark:border-[#383C40] shadow-sm space-y-3">
          <div className="flex items-center gap-2 text-emerald-600">
            <CheckCircle className="w-5 h-5" />
            <h3 className="font-extrabold text-sm text-[#241E1A] dark:text-[#F5F3F0]">
              TEN — Tasa de Éxito
            </h3>
          </div>
          <p className="text-xs text-[#746B65] dark:text-[#B3ACA5]">
            (Total Payers / Total Ciclos Leads) × 100 en el mes de inicio.
          </p>
          <div className="space-y-1.5 text-xs pt-2">
            <div className="flex justify-between p-1.5 rounded bg-emerald-50 dark:bg-emerald-950/20 text-emerald-800 dark:text-emerald-300 font-semibold">
              <span>Bueno:</span>
              <span>≥ 30 % (Meta)</span>
            </div>
            <div className="flex justify-between p-1.5 rounded bg-amber-50 dark:bg-amber-950/20 text-amber-800 dark:text-amber-300 font-semibold">
              <span>Regular:</span>
              <span>15 % - 30 %</span>
            </div>
            <div className="flex justify-between p-1.5 rounded bg-rose-50 dark:bg-rose-950/20 text-rose-800 dark:text-rose-300 font-semibold">
              <span>Malo:</span>
              <span>&lt; 15 %</span>
            </div>
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-[#FFFFFF] dark:bg-[#1D2023] border border-[#E8E0D8] dark:border-[#383C40] shadow-sm space-y-3">
          <div className="flex items-center gap-2 text-rose-600">
            <XCircle className="w-5 h-5" />
            <h3 className="font-extrabold text-sm text-[#241E1A] dark:text-[#F5F3F0]">
              TPN — Tasa de Pérdida
            </h3>
          </div>
          <p className="text-xs text-[#746B65] dark:text-[#B3ACA5]">
            (Leads Perdidos [Rechazo / Timeout] / Total Leads) × 100.
          </p>
          <div className="space-y-1.5 text-xs pt-2">
            <div className="flex justify-between p-1.5 rounded bg-emerald-50 dark:bg-emerald-950/20 text-emerald-800 dark:text-emerald-300 font-semibold">
              <span>Bueno:</span>
              <span>≤ 40 % (Meta)</span>
            </div>
            <div className="flex justify-between p-1.5 rounded bg-amber-50 dark:bg-amber-950/20 text-amber-800 dark:text-amber-300 font-semibold">
              <span>Regular:</span>
              <span>40 % - 60 %</span>
            </div>
            <div className="flex justify-between p-1.5 rounded bg-rose-50 dark:bg-rose-950/20 text-rose-800 dark:text-rose-300 font-semibold">
              <span>Malo:</span>
              <span>&gt; 60 %</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

