"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  ClockAlert,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  Sparkles,
  MessageSquare,
  HelpCircle,
  ShieldAlert,
  ChevronRight,
  Flame,
} from "lucide-react";
import { formatHours, formatDate } from "@/lib/utils";

export default function SeguimientoPage() {
  const [negociaciones, setNegociaciones] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalCierre, setModalCierre] = useState<any | null>(null);
  const [motivoPerdida, setMotivoPerdida] = useState<"RECHAZO" | "TIMEOUT_72H">("TIMEOUT_72H");
  const [detallePerdida, setDetallePerdida] = useState("");
  const [procesando, setProcesando] = useState(false);
  const [mensajeResultado, setMensajeResultado] = useState<string | null>(null);

  const fetchSeguimiento = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/followup");
      const json = await res.json();
      if (json.success) {
        setNegociaciones(json.negociaciones || []);
      }
    } catch (err) {
      console.error("Error al cargar seguimiento:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSeguimiento();
  }, []);

  const handleConfirmarCierre = async () => {
    if (!modalCierre) return;
    setProcesando(true);
    try {
      const res = await fetch("/api/followup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id_negociacion: modalCierre.id_negociacion,
          motivo: motivoPerdida,
          detalle: detallePerdida || (motivoPerdida === "TIMEOUT_72H" ? "Cierre autorizado por superar 72 horas sin interacción" : "Cliente confirmó rechazo de la propuesta"),
        }),
      });
      const data = await res.json();
      if (data.success) {
        setMensajeResultado(data.mensaje);
        setModalCierre(null);
        setDetallePerdida("");
        fetchSeguimiento();
      }
    } catch (err) {
      console.error("Error al cerrar negociación:", err);
    } finally {
      setProcesando(false);
    }
  };

  const getSeveridadBadge = (sev: string) => {
    switch (sev) {
      case "normal":
        return "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 border-emerald-300 dark:border-emerald-800";
      case "advertencia":
        return "bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 border-amber-300 dark:border-amber-800";
      case "riesgo":
        return "bg-orange-50 dark:bg-orange-950/30 text-orange-700 dark:text-orange-400 border-orange-300 dark:border-orange-800";
      case "critico":
        return "bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-400 border-rose-300 dark:border-rose-800 font-extrabold animate-pulse";
      default:
        return "bg-neutral-100 text-neutral-700";
    }
  };

  return (
    <div className="space-y-6">
      {/* Cabecera */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl md:text-3xl font-extrabold text-[#241E1A] dark:text-[#F5F3F0] font-display">
              Seguimiento y Gestión de Abandono
            </h1>
            <span className="px-2.5 py-0.5 text-xs font-bold rounded-md bg-[#C96D35]/15 text-[#C96D35] dark:text-[#E8A46D] border border-[#C96D35]/30">
              Regla 72 Horas
            </span>
          </div>
          <p className="text-xs md:text-sm text-[#746B65] dark:text-[#B3ACA5] mt-1">
            Monitoreo preventivo de negociaciones abiertas para evitar leads desatendidos.
          </p>
        </div>
      </div>

      {/* Explicación de la Política de Seguimiento */}
      <div className="p-4 rounded-2xl bg-[#FFFFFF] dark:bg-[#1D2023] border border-[#E8E0D8] dark:border-[#383C40] shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4 text-xs">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-[#C96D35]/15 text-[#C96D35] dark:text-[#E8A46D]">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <p className="font-bold text-[#241E1A] dark:text-[#F5F3F0]">
              Semáforo Operativo de Respuesta
            </p>
            <p className="text-[#746B65] dark:text-[#B3ACA5] mt-0.5">
              Se calcula desde la última interacción entrante del lead. No se cierra automáticamente: exige revisión del operador comercial.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 font-bold text-[11px]">
          <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400">0-2h Normal</span>
          <span className="px-2 py-0.5 rounded bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400">2-6h Demora</span>
          <span className="px-2 py-0.5 rounded bg-orange-50 text-orange-700 dark:bg-orange-950/30 dark:text-orange-400">6-24h Desinterés</span>
          <span className="px-2 py-0.5 rounded bg-rose-50 text-rose-700 dark:bg-rose-950/30 dark:text-rose-400">&gt;72h Timeout</span>
        </div>
      </div>

      {mensajeResultado && (
        <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs font-semibold flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-emerald-500" />
            <span>{mensajeResultado}</span>
          </div>
          <button onClick={() => setMensajeResultado(null)} className="text-emerald-900 font-bold hover:underline">
            Cerrar
          </button>
        </div>
      )}

      {/* Lista de Negociaciones Abiertas con Semáforo */}
      <div className="rounded-2xl bg-[#FFFFFF] dark:bg-[#1D2023] border border-[#E8E0D8] dark:border-[#383C40] shadow-sm overflow-hidden">
        <div className="p-4 border-b border-[#E8E0D8] dark:border-[#383C40] flex items-center justify-between bg-[#FAF8F5] dark:bg-[#121416]/50">
          <span className="text-xs font-bold text-[#746B65] dark:text-[#B3ACA5] uppercase tracking-wider">
            Negociaciones Abiertas en Monitoreo ({negociaciones.length})
          </span>
          <span className="text-xs text-[#746B65] dark:text-[#B3ACA5]">
            Ordenadas por mayor tiempo sin respuesta
          </span>
        </div>

        <div className="divide-y divide-[#E8E0D8] dark:divide-[#383C40]">
          {loading ? (
            <p className="text-xs text-[#746B65] py-12 text-center">Consultando negociaciones abiertas...</p>
          ) : negociaciones.length === 0 ? (
            <div className="p-12 text-center text-xs text-[#746B65] dark:text-[#B3ACA5]">
              <CheckCircle className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
              <p className="font-bold text-sm text-[#241E1A] dark:text-[#F5F3F0]">¡Todo al día!</p>
              <p className="mt-1">No hay negociaciones abiertas en riesgo de abandono en este momento.</p>
            </div>
          ) : (
            negociaciones.map((neg) => (
              <div
                key={neg.id_negociacion}
                className="p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-[#FAF8F5] dark:hover:bg-[#292D31]/40 transition-colors"
              >
                <div className="space-y-1.5 flex-1 min-w-0">
                  <div className="flex items-center gap-2.5">
                    <span className="font-extrabold text-sm text-[#241E1A] dark:text-[#F5F3F0]">
                      {neg.nombres} {neg.apellidos}
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded-md font-semibold bg-[#FAF8F5] dark:bg-[#121416] border border-[#E8E0D8] dark:border-[#383C40] text-[#42291F] dark:text-[#E8A46D]">
                      {neg.segmento_nombre || "Lead"}
                    </span>
                    <span className="text-[11px] text-[#746B65] dark:text-[#B3ACA5]">
                      • Neg. #{neg.id_negociacion}
                    </span>
                  </div>

                  <p className="text-xs text-[#746B65] dark:text-[#B3ACA5] truncate">
                    Último mensaje: "{neg.ultimo_mensaje_texto || neg.resumen || "Sin interacciones recientes"}"
                  </p>

                  <div className="flex items-center gap-2 text-[11px]">
                    <span className="text-[#746B65] dark:text-[#B3ACA5]">Acción recomendada:</span>
                    <strong className="text-[#241E1A] dark:text-[#F5F3F0]">{neg.accionSugerida}</strong>
                  </div>
                </div>

                {/* Badge de Tiempo y Acciones */}
                <div className="flex items-center gap-3 shrink-0">
                  <div className="text-right">
                    <span
                      className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs border ${getSeveridadBadge(
                        neg.severidad
                      )}`}
                    >
                      <Clock className="w-3.5 h-3.5" />
                      {neg.clasificacion} ({formatHours(neg.horas_sin_respuesta)})
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <Link
                      href={`/agente?negociacionId=${neg.id_negociacion}`}
                      className="px-3 py-1.5 rounded-xl text-xs font-bold bg-[#C96D35] hover:bg-[#B65F29] text-white flex items-center gap-1 transition-colors"
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                      <span>Chat</span>
                    </Link>

                    {/* Botón de Cierre Controlado */}
                    <button
                      onClick={() => {
                        setModalCierre(neg);
                        setMotivoPerdida(neg.horas_sin_respuesta >= 72 ? "TIMEOUT_72H" : "RECHAZO");
                      }}
                      className="px-3 py-1.5 rounded-xl text-xs font-bold bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-900/50 hover:bg-rose-600 hover:text-white transition-colors"
                    >
                      Cerrar Pérdida
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Modal de Confirmación Humana para Cierre de Pérdida */}
      {modalCierre && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md rounded-2xl bg-[#FFFFFF] dark:bg-[#1D2023] border border-[#E8E0D8] dark:border-[#383C40] p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-rose-600 dark:text-rose-400">
              <ShieldAlert className="w-6 h-6" />
              <h3 className="font-extrabold text-base text-[#241E1A] dark:text-[#F5F3F0]">
                Confirmación de Cierre Comercial
              </h3>
            </div>

            <p className="text-xs text-[#746B65] dark:text-[#B3ACA5]">
              Vas a registrar formalmente la pérdida de la negociación #{modalCierre.id_negociacion} con{" "}
              <strong>{modalCierre.nombres} {modalCierre.apellidos}</strong>. Esta acción alimentará la tasa oficial TPN de SQL Server.
            </p>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-[#241E1A] dark:text-[#F5F3F0] block mb-1">
                  Motivo de Pérdida Oficial:
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setMotivoPerdida("RECHAZO")}
                    className={`p-2.5 rounded-xl border text-center font-bold transition-colors ${
                      motivoPerdida === "RECHAZO"
                        ? "border-[#C96D35] bg-[#C96D35]/10 text-[#C96D35] dark:text-[#E8A46D]"
                        : "border-[#E8E0D8] dark:border-[#383C40] text-[#746B65]"
                    }`}
                  >
                    RECHAZO
                    <span className="block text-[10px] font-normal mt-0.5">El lead desistió explícitamente</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setMotivoPerdida("TIMEOUT_72H")}
                    className={`p-2.5 rounded-xl border text-center font-bold transition-colors ${
                      motivoPerdida === "TIMEOUT_72H"
                        ? "border-[#C96D35] bg-[#C96D35]/10 text-[#C96D35] dark:text-[#E8A46D]"
                        : "border-[#E8E0D8] dark:border-[#383C40] text-[#746B65]"
                    }`}
                  >
                    TIMEOUT_72H
                    <span className="block text-[10px] font-normal mt-0.5">&gt; 72 horas sin interacción</span>
                  </button>
                </div>
              </div>

              <div>
                <label className="font-bold text-[#241E1A] dark:text-[#F5F3F0] block mb-1">
                  Detalle del Cierre (Auditoría):
                </label>
                <textarea
                  rows={3}
                  value={detallePerdida}
                  onChange={(e) => setDetallePerdida(e.target.value)}
                  placeholder="Explica la razón del cierre para la memoria comercial..."
                  className="w-full p-2.5 rounded-xl bg-[#FAF8F5] dark:bg-[#121416] border border-[#E8E0D8] dark:border-[#383C40] text-[#241E1A] dark:text-[#F5F3F0] placeholder-[#746B65]/70 focus:outline-none focus:border-[#C96D35]"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setModalCierre(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-[#746B65] dark:text-[#B3ACA5] hover:bg-neutral-100 dark:hover:bg-[#292D31]"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmarCierre}
                disabled={procesando}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white disabled:opacity-50"
              >
                {procesando ? "Guardando..." : "Confirmar Cierre"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

