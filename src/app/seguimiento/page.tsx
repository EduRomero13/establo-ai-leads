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
  Send,
  User,
  Trophy,
  BadgeDollarSign,
  TrendingUp,
  Award,
  Phone,
  FileCheck,
} from "lucide-react";
import { formatHours, formatDate, formatCurrency } from "@/lib/utils";

interface VendedorRanking {
  id_personal: number;
  vendedor: string;
  cargo: string;
  area: string;
  ventas_cerradas: number;
  monto_total: number;
  ticket_promedio: number;
  ultimo_cierre: string | null;
}

interface Vendedor {
  id_personal: number;
  nombres: string;
  apellidos: string;
  cargo: string;
  area: string;
}

export default function SeguimientoPage() {
  const [negociaciones, setNegociaciones] = useState<any[]>([]);
  const [vendedores, setVendedores] = useState<Vendedor[]>([]);
  const [ranking, setRanking] = useState<VendedorRanking[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal 1: Trabajador envía mensaje de seguimiento por WhatsApp Real
  const [modalMensaje, setModalMensaje] = useState<any | null>(null);
  const [vendedorSeleccionado, setVendedorSeleccionado] = useState<number>(3); // Default: Carlos Mendoza
  const [textoMensaje, setTextoMensaje] = useState("");
  const [enviandoMensaje, setEnviandoMensaje] = useState(false);

  // Modal 2: Vendedor cierra la venta (Registra información de vendedor y venta)
  const [modalVenta, setModalVenta] = useState<any | null>(null);
  const [vendedorCierre, setVendedorCierre] = useState<number>(3);
  const [montoVenta, setMontoVenta] = useState("110.00");
  const [detalleVenta, setDetalleVenta] = useState("Combo Amigos (S/ 110.00)");
  const [medioPagoVenta, setMedioPagoVenta] = useState("YAPE");
  const [referenciaVenta, setReferenciaVenta] = useState("");
  const [cerrandoVenta, setCerrandoVenta] = useState(false);

  // Modal 3: Cierre de Pérdida
  const [modalCierre, setModalCierre] = useState<any | null>(null);
  const [motivoPerdida, setMotivoPerdida] = useState<"RECHAZO" | "TIMEOUT_72H">("TIMEOUT_72H");
  const [detallePerdida, setDetallePerdida] = useState("");
  const [procesandoPerdida, setProcesandoPerdida] = useState(false);

  const [mensajeResultado, setMensajeResultado] = useState<{ tipo: "exito" | "error"; texto: string } | null>(null);

  const fetchSeguimiento = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/followup");
      const json = await res.json();
      if (json.success) {
        setNegociaciones(json.negociaciones || []);
        if (json.vendedores && json.vendedores.length > 0) {
          setVendedores(json.vendedores);
          setVendedorSeleccionado(json.vendedores[0].id_personal);
          setVendedorCierre(json.vendedores[0].id_personal);
        }
        if (json.rankingVendedores) {
          setRanking(json.rankingVendedores);
        }
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

  // Abrir Modal de Envío de Mensaje con plantilla sugerida
  const handleAbrirModalMensaje = (neg: any) => {
    setModalMensaje(neg);
    const trabajador = vendedores.find((v) => v.id_personal === vendedorSeleccionado) || vendedores[0] || { nombres: "Asesor Comercial" };
    const primerNombreTrabajador = trabajador.nombres.split(" ")[0];

    // Plantilla según las horas sin respuesta
    let plantilla = "";
    if (neg.horas_sin_respuesta < 6) {
      plantilla = `¡Hola, ${neg.nombres}! 🥩 Te saluda ${primerNombreTrabajador} de Parrilladas El Establo en Trujillo. ¿Pudiste revisar nuestra carta de carnes a la brasa? Avísame si tienes alguna duda para atenderte de inmediato. 🔥📲`;
    } else if (neg.horas_sin_respuesta < 24) {
      plantilla = `¡Hola, ${neg.nombres}! 🥩🔥 ${primerNombreTrabajador} por aquí de Parrilladas El Establo. ¿Te gustaría que te reservemos tu pedido a la leña para hoy? ¡Aceptamos Yape y Plin! 🤤📲`;
    } else if (neg.horas_sin_respuesta < 48) {
      plantilla = `¡Hola, ${neg.nombres}! Te saluda ${primerNombreTrabajador} de El Establo. Para tu pedido de hoy tenemos una cortesía parrillera especial en papas rústicas crocantes. ¿Te animas a disfrutarlo caliente a domicilio? 🛵✨`;
    } else {
      plantilla = `¡Hola, ${neg.nombres}! Te saluda ${primerNombreTrabajador} de Parrilladas El Establo. Queríamos consultar si todavía deseas que preparemos tu pedido o si prefieres que archivemos tu consulta. ¡Siempre estamos a tu orden! 🙌🥩`;
    }

    setTextoMensaje(plantilla);
  };

  // Enviar mensaje al WhatsApp real del lead por el trabajador
  const handleEnviarMensajeWhatsApp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalMensaje || !textoMensaje.trim()) return;

    setEnviandoMensaje(true);
    try {
      const res = await fetch("/api/followup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "enviar_mensaje",
          id_negociacion: modalMensaje.id_negociacion,
          id_personal: vendedorSeleccionado,
          mensaje: textoMensaje.trim(),
        }),
      });

      const data = await res.json();
      if (data.success) {
        setMensajeResultado({ tipo: "exito", texto: data.mensaje || "Mensaje enviado exitosamente al WhatsApp real." });
        setModalMensaje(null);
        setTextoMensaje("");
        fetchSeguimiento();
      } else {
        setMensajeResultado({ tipo: "error", texto: data.error || "No se pudo enviar el mensaje." });
      }
    } catch (err: any) {
      setMensajeResultado({ tipo: "error", texto: `Error de red: ${err.message}` });
    } finally {
      setEnviandoMensaje(false);
    }
  };

  // Abrir Modal de Cierre de Venta
  const handleAbrirModalVenta = (neg: any) => {
    setModalVenta(neg);
    setMontoVenta("110.00");
    setDetalleVenta("Combo Amigos (S/ 110.00)");
    setMedioPagoVenta("YAPE");
    setReferenciaVenta(`YAPE-${Math.floor(100000 + Math.random() * 900000)}`);
  };

  // Ejecutar cierre de venta con el vendedor seleccionado
  const handleConfirmarVenta = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalVenta) return;

    setCerrandoVenta(true);
    try {
      const res = await fetch("/api/followup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "cerrar_venta",
          id_negociacion: modalVenta.id_negociacion,
          id_personal: vendedorCierre,
          monto: parseFloat(montoVenta) || 110.0,
          detalleVenta,
          medioPago: medioPagoVenta,
          referenciaPago: referenciaVenta,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setMensajeResultado({ tipo: "exito", texto: data.mensaje });
        setModalVenta(null);
        fetchSeguimiento();
      } else {
        setMensajeResultado({ tipo: "error", texto: data.error || "Error al registrar la venta." });
      }
    } catch (err: any) {
      setMensajeResultado({ tipo: "error", texto: `Error: ${err.message}` });
    } finally {
      setCerrandoVenta(false);
    }
  };

  // Confirmar Cierre por Pérdida
  const handleConfirmarCierrePerdida = async () => {
    if (!modalCierre) return;
    setProcesandoPerdida(true);
    try {
      const res = await fetch("/api/followup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "cerrar_perdida",
          id_negociacion: modalCierre.id_negociacion,
          motivo: motivoPerdida,
          detalle: detallePerdida || (motivoPerdida === "TIMEOUT_72H" ? "Cierre autorizado por superar 72 horas sin interacción" : "Cliente confirmó rechazo de la propuesta"),
        }),
      });
      const data = await res.json();
      if (data.success) {
        setMensajeResultado({ tipo: "exito", texto: data.mensaje });
        setModalCierre(null);
        setDetallePerdida("");
        fetchSeguimiento();
      } else {
        setMensajeResultado({ tipo: "error", texto: data.error || "Error al cerrar negociación." });
      }
    } catch (err: any) {
      setMensajeResultado({ tipo: "error", texto: `Error: ${err.message}` });
    } finally {
      setProcesandoPerdida(false);
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

  const topVendedor = ranking.length > 0 ? ranking[0] : null;
  const totalVentasEquipo = ranking.reduce((acc, curr) => acc + (Number(curr.ventas_cerradas) || 0), 0);
  const totalMontoEquipo = ranking.reduce((acc, curr) => acc + (Number(curr.monto_total) || 0), 0);

  return (
    <div className="space-y-6">
      {/* Cabecera */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl md:text-3xl font-extrabold text-[#241E1A] dark:text-[#F5F3F0] font-display">
              Seguimiento Comercial y Cierres de Venta
            </h1>
            <span className="px-2.5 py-0.5 text-xs font-bold rounded-md bg-[#C96D35]/15 text-[#C96D35] dark:text-[#E8A46D] border border-[#C96D35]/30">
              Operación Humana & WhatsApp Real
            </span>
          </div>
          <p className="text-xs md:text-sm text-[#746B65] dark:text-[#B3ACA5] mt-1">
            Gestión de leads en riesgo, envío de mensajes por trabajadores y registro de ventas por vendedor.
          </p>
        </div>
      </div>

      {/* Banner de Mensaje de Resultado */}
      {mensajeResultado && (
        <div
          className={`p-4 rounded-2xl border text-xs font-semibold flex items-center justify-between animate-in fade-in ${
            mensajeResultado.tipo === "exito"
              ? "bg-emerald-50 dark:bg-emerald-950/20 border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300"
              : "bg-rose-50 dark:bg-rose-950/20 border-rose-300 dark:border-rose-800 text-rose-800 dark:text-rose-300"
          }`}
        >
          <div className="flex items-center gap-2">
            {mensajeResultado.tipo === "exito" ? (
              <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0" />
            )}
            <span>{mensajeResultado.texto}</span>
          </div>
          <button
            onClick={() => setMensajeResultado(null)}
            className="font-bold underline hover:opacity-80 ml-4"
          >
            Entendido
          </button>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SECCIÓN 1: INDICADOR DE RENDIMIENTO — ¿QUÉ VENDEDOR CIERRA MÁS VENTAS? */}
      {/* ========================================================================= */}
      <div className="rounded-2xl bg-[#FFFFFF] dark:bg-[#1D2023] border border-[#E8E0D8] dark:border-[#383C40] p-5 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#E8E0D8] dark:border-[#383C40]">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <Trophy className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-[#241E1A] dark:text-[#F5F3F0]">
                Indicador: Ranking de Cierres por Vendedor
              </h2>
              <p className="text-xs text-[#746B65] dark:text-[#B3ACA5]">
                Métricas oficiales de efectividad comercial registradas en SQL Server V3.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 text-xs">
            <div className="px-3 py-1.5 rounded-xl bg-[#FAF8F5] dark:bg-[#121416] border border-[#E8E0D8] dark:border-[#383C40]">
              <span className="text-[#746B65] dark:text-[#B3ACA5]">Ventas Totales: </span>
              <strong className="text-[#C96D35] dark:text-[#E8A46D]">{totalVentasEquipo} pedidos</strong>
            </div>
            <div className="px-3 py-1.5 rounded-xl bg-[#FAF8F5] dark:bg-[#121416] border border-[#E8E0D8] dark:border-[#383C40]">
              <span className="text-[#746B65] dark:text-[#B3ACA5]">Monto Recaudado: </span>
              <strong className="text-emerald-600 dark:text-emerald-400 font-extrabold">
                S/ {totalMontoEquipo.toFixed(2)}
              </strong>
            </div>
          </div>
        </div>

        {/* Tabla de Vendedores */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-[#E8E0D8] dark:border-[#383C40] text-[#746B65] dark:text-[#B3ACA5]">
                <th className="py-2.5 px-3 font-bold uppercase tracking-wider text-[10px]">Posición</th>
                <th className="py-2.5 px-3 font-bold uppercase tracking-wider text-[10px]">Vendedor / Asesor</th>
                <th className="py-2.5 px-3 font-bold uppercase tracking-wider text-[10px]">Área / Cargo</th>
                <th className="py-2.5 px-3 font-bold uppercase tracking-wider text-[10px] text-center">Ventas Cerradas</th>
                <th className="py-2.5 px-3 font-bold uppercase tracking-wider text-[10px] text-right">Monto Total</th>
                <th className="py-2.5 px-3 font-bold uppercase tracking-wider text-[10px] text-right">Ticket Promedio</th>
                <th className="py-2.5 px-3 font-bold uppercase tracking-wider text-[10px]">Último Cierre</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E8E0D8]/60 dark:divide-[#383C40]/60">
              {ranking.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-6 text-center text-[#746B65]">
                    Cargando ranking de vendedores...
                  </td>
                </tr>
              ) : (
                ranking.map((vend, idx) => {
                  const esTop = idx === 0 && vend.ventas_cerradas > 0;
                  return (
                    <tr
                      key={vend.id_personal}
                      className={`hover:bg-[#FAF8F5] dark:hover:bg-[#292D31]/40 transition-colors ${
                        esTop ? "bg-amber-500/5 font-semibold" : ""
                      }`}
                    >
                      <td className="py-3 px-3">
                        {idx === 0 ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-700 dark:text-amber-300 font-extrabold text-[11px]">
                            🥇 1° Lugar
                          </span>
                        ) : idx === 1 ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-[11px]">
                            🥈 2° Lugar
                          </span>
                        ) : idx === 2 ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-700/10 text-amber-800 dark:text-amber-500 font-bold text-[11px]">
                            🥉 3° Lugar
                          </span>
                        ) : (
                          <span className="text-[#746B65] dark:text-[#B3ACA5] px-2">{idx + 1}°</span>
                        )}
                      </td>
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-[#C96D35]/15 text-[#C96D35] font-extrabold flex items-center justify-center text-xs">
                            {vend.vendedor.charAt(0)}
                          </div>
                          <div>
                            <p className="font-extrabold text-[#241E1A] dark:text-[#F5F3F0]">
                              {vend.vendedor}
                            </p>
                            {esTop && (
                              <span className="text-[10px] text-amber-600 dark:text-amber-400 font-bold">
                                ⭐ Mayor cerrador de ventas
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-3 text-[#746B65] dark:text-[#B3ACA5]">
                        <span>{vend.cargo}</span>
                        <span className="block text-[10px] opacity-75">{vend.area}</span>
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span className="inline-block px-2.5 py-0.5 rounded-full font-extrabold bg-[#C96D35]/10 text-[#C96D35] dark:text-[#E8A46D]">
                          {vend.ventas_cerradas}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right font-extrabold text-emerald-600 dark:text-emerald-400">
                        S/ {Number(vend.monto_total).toFixed(2)}
                      </td>
                      <td className="py-3 px-3 text-right text-[#746B65] dark:text-[#B3ACA5]">
                        S/ {Number(vend.ticket_promedio).toFixed(2)}
                      </td>
                      <td className="py-3 px-3 text-[#746B65] dark:text-[#B3ACA5] text-[11px]">
                        {vend.ultimo_cierre ? formatDate(vend.ultimo_cierre).split(",")[0] : "Sin cierres aún"}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* SECCIÓN 2: NEGOCIACIONES EN MONITOREO CON ACCIONES DE TRABAJADOR Y CIERRE */}
      {/* ========================================================================= */}
      <div className="rounded-2xl bg-[#FFFFFF] dark:bg-[#1D2023] border border-[#E8E0D8] dark:border-[#383C40] shadow-sm overflow-hidden">
        <div className="p-4 border-b border-[#E8E0D8] dark:border-[#383C40] flex items-center justify-between bg-[#FAF8F5] dark:bg-[#121416]/50">
          <div>
            <span className="text-xs font-bold text-[#746B65] dark:text-[#B3ACA5] uppercase tracking-wider">
              Negociaciones Abiertas en Monitoreo ({negociaciones.length})
            </span>
            <p className="text-[11px] text-[#746B65] dark:text-[#B3ACA5] mt-0.5">
              Haz clic en <strong>Contactar</strong> para que el trabajador envíe un mensaje a WhatsApp real, o en <strong>Cerrar Venta</strong> para registrar la venta a nombre del vendedor.
            </p>
          </div>
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
                    <span className="text-[11px] text-[#746B65] dark:text-[#B3ACA5] font-mono">
                      📞 {neg.telefono || "Sin teléfono"}
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

                {/* Badge de Tiempo y Acciones Operativas */}
                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <span
                    className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs border ${getSeveridadBadge(
                      neg.severidad
                    )}`}
                  >
                    <Clock className="w-3.5 h-3.5" />
                    {neg.clasificacion} ({formatHours(neg.horas_sin_respuesta)})
                  </span>

                  {/* 1. Botón Trabajador Envía Mensaje a WhatsApp Real */}
                  <button
                    onClick={() => handleAbrirModalMensaje(neg)}
                    className="px-3 py-1.5 rounded-xl text-xs font-bold bg-[#C96D35] hover:bg-[#B65F29] text-white flex items-center gap-1.5 transition-colors shadow-2xs"
                    title="Enviar mensaje por WhatsApp real"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Contactar (WhatsApp Real)</span>
                  </button>

                  {/* 2. Botón Vendedor Cierra la Venta */}
                  <button
                    onClick={() => handleAbrirModalVenta(neg)}
                    className="px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1.5 transition-colors shadow-2xs"
                    title="Registrar venta cerrada por un vendedor"
                  >
                    <Award className="w-3.5 h-3.5" />
                    <span>Cerrar Venta (Vendedor)</span>
                  </button>

                  {/* 3. Botón de Cierre por Pérdida */}
                  <button
                    onClick={() => {
                      setModalCierre(neg);
                      setMotivoPerdida(neg.horas_sin_respuesta >= 72 ? "TIMEOUT_72H" : "RECHAZO");
                    }}
                    className="px-2.5 py-1.5 rounded-xl text-xs font-semibold bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-900/50 hover:bg-rose-600 hover:text-white transition-colors"
                    title="Cerrar como pérdida"
                  >
                    Pérdida
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* MODAL 1: TRABAJADOR ENVÍA MENSAJE AL WHATSAPP REAL DEL LEAD */}
      {/* ========================================================================= */}
      {modalMensaje && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-lg rounded-2xl bg-[#FFFFFF] dark:bg-[#1D2023] border border-[#E8E0D8] dark:border-[#383C40] p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-[#E8E0D8] dark:border-[#383C40] pb-3">
              <div className="flex items-center gap-2.5 text-[#C96D35]">
                <Send className="w-5 h-5" />
                <h3 className="font-extrabold text-base text-[#241E1A] dark:text-[#F5F3F0]">
                  Envío de Mensaje por Trabajador
                </h3>
              </div>
              <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                WhatsApp Cloud API Real
              </span>
            </div>

            <div className="p-3 rounded-xl bg-[#FAF8F5] dark:bg-[#121416] border border-[#E8E0D8] dark:border-[#383C40] text-xs space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[#746B65] dark:text-[#B3ACA5]">Destinatario (Lead):</span>
                <strong className="text-[#241E1A] dark:text-[#F5F3F0]">
                  {modalMensaje.nombres} {modalMensaje.apellidos}
                </strong>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#746B65] dark:text-[#B3ACA5]">Teléfono WhatsApp:</span>
                <strong className="font-mono text-[#C96D35] dark:text-[#E8A46D]">
                  {modalMensaje.telefono}
                </strong>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#746B65] dark:text-[#B3ACA5]">Inactividad:</span>
                <span>{formatHours(modalMensaje.horas_sin_respuesta)} sin respuesta</span>
              </div>
            </div>

            <form onSubmit={handleEnviarMensajeWhatsApp} className="space-y-3.5 text-xs">
              {/* Selección del Trabajador que envía */}
              <div>
                <label className="font-bold text-[#241E1A] dark:text-[#F5F3F0] block mb-1">
                  Trabajador / Asesor que realiza el contacto:
                </label>
                <select
                  value={vendedorSeleccionado}
                  onChange={(e) => setVendedorSeleccionado(Number(e.target.value))}
                  className="w-full p-2.5 rounded-xl bg-[#FAF8F5] dark:bg-[#121416] border border-[#E8E0D8] dark:border-[#383C40] text-[#241E1A] dark:text-[#F5F3F0] font-semibold focus:outline-none focus:border-[#C96D35]"
                >
                  {vendedores.map((v) => (
                    <option key={v.id_personal} value={v.id_personal}>
                      {v.nombres} {v.apellidos} — {v.cargo} ({v.area})
                    </option>
                  ))}
                </select>
              </div>

              {/* Mensaje a enviar */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="font-bold text-[#241E1A] dark:text-[#F5F3F0]">
                    Mensaje de Seguimiento:
                  </label>
                  <span className="text-[10px] text-[#746B65]">Se enviará al celular del cliente</span>
                </div>
                <textarea
                  rows={4}
                  value={textoMensaje}
                  onChange={(e) => setTextoMensaje(e.target.value)}
                  placeholder="Escribe el mensaje de seguimiento que recibirá el cliente en su WhatsApp..."
                  className="w-full p-3 rounded-xl bg-[#FAF8F5] dark:bg-[#121416] border border-[#E8E0D8] dark:border-[#383C40] text-[#241E1A] dark:text-[#F5F3F0] placeholder-[#746B65]/70 focus:outline-none focus:border-[#C96D35] leading-relaxed"
                  required
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-[#E8E0D8] dark:border-[#383C40]">
                <button
                  type="button"
                  onClick={() => setModalMensaje(null)}
                  disabled={enviandoMensaje}
                  className="px-4 py-2 rounded-xl font-bold text-[#746B65] dark:text-[#B3ACA5] hover:bg-neutral-100 dark:hover:bg-[#292D31]"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={enviandoMensaje || !textoMensaje.trim()}
                  className="px-4 py-2 rounded-xl font-bold bg-[#C96D35] hover:bg-[#B65F29] text-white flex items-center gap-2 shadow-2xs disabled:opacity-50"
                >
                  <Send className={`w-3.5 h-3.5 ${enviandoMensaje ? "animate-spin" : ""}`} />
                  <span>{enviandoMensaje ? "Enviando a WhatsApp..." : "Enviar a WhatsApp Real"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: VENDEDOR REGISTRA EL CIERRE DE VENTA (ALIMENTA INDICADOR) */}
      {/* ========================================================================= */}
      {modalVenta && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-lg rounded-2xl bg-[#FFFFFF] dark:bg-[#1D2023] border border-[#E8E0D8] dark:border-[#383C40] p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-[#E8E0D8] dark:border-[#383C40] pb-3">
              <div className="flex items-center gap-2.5 text-emerald-600 dark:text-emerald-400">
                <Trophy className="w-5 h-5" />
                <h3 className="font-extrabold text-base text-[#241E1A] dark:text-[#F5F3F0]">
                  Registrar Cierre Exitoso de Venta
                </h3>
              </div>
              <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                Conversión a PAYER
              </span>
            </div>

            <p className="text-xs text-[#746B65] dark:text-[#B3ACA5]">
              Registra los datos del vendedor y el pedido cerrado con <strong>{modalVenta.nombres} {modalVenta.apellidos}</strong>. Esta venta sumará puntos al indicador de rendimiento del vendedor.
            </p>

            <form onSubmit={handleConfirmarVenta} className="space-y-3.5 text-xs">
              {/* Selección del Vendedor que cerró */}
              <div>
                <label className="font-bold text-[#241E1A] dark:text-[#F5F3F0] block mb-1">
                  Vendedor que realizó el cierre:
                </label>
                <select
                  value={vendedorCierre}
                  onChange={(e) => setVendedorCierre(Number(e.target.value))}
                  className="w-full p-2.5 rounded-xl bg-[#FAF8F5] dark:bg-[#121416] border border-[#E8E0D8] dark:border-[#383C40] text-[#241E1A] dark:text-[#F5F3F0] font-bold focus:outline-none focus:border-[#C96D35]"
                >
                  {vendedores.map((v) => (
                    <option key={v.id_personal} value={v.id_personal}>
                      {v.nombres} {v.apellidos} ({v.cargo})
                    </option>
                  ))}
                </select>
              </div>

              {/* Monto y Medio de Pago en 2 columnas */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-[#241E1A] dark:text-[#F5F3F0] block mb-1">
                    Monto de Venta (S/):
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="1"
                    value={montoVenta}
                    onChange={(e) => setMontoVenta(e.target.value)}
                    placeholder="110.00"
                    className="w-full p-2.5 rounded-xl bg-[#FAF8F5] dark:bg-[#121416] border border-[#E8E0D8] dark:border-[#383C40] text-[#241E1A] dark:text-[#F5F3F0] font-bold text-sm focus:outline-none focus:border-[#C96D35]"
                    required
                  />
                </div>

                <div>
                  <label className="font-bold text-[#241E1A] dark:text-[#F5F3F0] block mb-1">
                    Medio de Pago:
                  </label>
                  <select
                    value={medioPagoVenta}
                    onChange={(e) => setMedioPagoVenta(e.target.value)}
                    className="w-full p-2.5 rounded-xl bg-[#FAF8F5] dark:bg-[#121416] border border-[#E8E0D8] dark:border-[#383C40] text-[#241E1A] dark:text-[#F5F3F0] font-semibold focus:outline-none focus:border-[#C96D35]"
                  >
                    <option value="YAPE">Yape</option>
                    <option value="PLIN">Plin</option>
                    <option value="TARJETA">Tarjeta</option>
                    <option value="EFECTIVO">Efectivo</option>
                  </select>
                </div>
              </div>

              {/* Plato / Combo Vendido */}
              <div>
                <label className="font-bold text-[#241E1A] dark:text-[#F5F3F0] block mb-1">
                  Plato o Combo Vendido:
                </label>
                <input
                  type="text"
                  value={detalleVenta}
                  onChange={(e) => setDetalleVenta(e.target.value)}
                  placeholder="Ej: Combo Amigos (S/ 110.00) o Parrilla Familiar"
                  className="w-full p-2.5 rounded-xl bg-[#FAF8F5] dark:bg-[#121416] border border-[#E8E0D8] dark:border-[#383C40] text-[#241E1A] dark:text-[#F5F3F0] focus:outline-none focus:border-[#C96D35]"
                  required
                />
              </div>

              {/* Referencia de Pago */}
              <div>
                <label className="font-bold text-[#241E1A] dark:text-[#F5F3F0] block mb-1">
                  Referencia de Pago / Comprobante (Opcional):
                </label>
                <input
                  type="text"
                  value={referenciaVenta}
                  onChange={(e) => setReferenciaVenta(e.target.value)}
                  placeholder="Ej: YAPE-849201"
                  className="w-full p-2.5 rounded-xl bg-[#FAF8F5] dark:bg-[#121416] border border-[#E8E0D8] dark:border-[#383C40] text-[#241E1A] dark:text-[#F5F3F0] focus:outline-none focus:border-[#C96D35]"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-[#E8E0D8] dark:border-[#383C40]">
                <button
                  type="button"
                  onClick={() => setModalVenta(null)}
                  disabled={cerrandoVenta}
                  className="px-4 py-2 rounded-xl font-bold text-[#746B65] dark:text-[#B3ACA5] hover:bg-neutral-100 dark:hover:bg-[#292D31]"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={cerrandoVenta}
                  className="px-4 py-2 rounded-xl font-bold bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-2 shadow-2xs disabled:opacity-50"
                >
                  <Award className={`w-3.5 h-3.5 ${cerrandoVenta ? "animate-spin" : ""}`} />
                  <span>{cerrandoVenta ? "Registrando Venta..." : "Confirmar Venta y Cierre"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: CONFIRMACIÓN DE CIERRE POR PÉRDIDA */}
      {/* ========================================================================= */}
      {modalCierre && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md rounded-2xl bg-[#FFFFFF] dark:bg-[#1D2023] border border-[#E8E0D8] dark:border-[#383C40] p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-rose-600 dark:text-rose-400">
              <ShieldAlert className="w-6 h-6" />
              <h3 className="font-extrabold text-base text-[#241E1A] dark:text-[#F5F3F0]">
                Confirmación de Cierre por Pérdida
              </h3>
            </div>

            <p className="text-xs text-[#746B65] dark:text-[#B3ACA5]">
              Vas a registrar formalmente la pérdida de la negociación #{modalCierre.id_negociacion} con{" "}
              <strong>{modalCierre.nombres} {modalCierre.apellidos}</strong>.
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
                onClick={handleConfirmarCierrePerdida}
                disabled={procesandoPerdida}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white disabled:opacity-50"
              >
                {procesandoPerdida ? "Guardando..." : "Confirmar Cierre"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
