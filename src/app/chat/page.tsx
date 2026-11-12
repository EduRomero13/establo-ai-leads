"use client";

import React, { useEffect, useState, useRef } from "react";
import Link from "next/link";
import {
  MessageSquare,
  Search,
  Phone,
  Calendar,
  Clock,
  Send,
  User,
  CheckCheck,
  Flame,
  ArrowUpRight,
  RefreshCw,
  ExternalLink,
} from "lucide-react";
import { formatDate } from "@/lib/utils";

export default function ConversacionesInboxPage() {
  const [sesiones, setSesiones] = useState<any[]>([]);
  const [sesionSeleccionada, setSesionSeleccionada] = useState<any | null>(null);
  const [mensajes, setMensajes] = useState<any[]>([]);
  const [busqueda, setBusqueda] = useState("");
  const [filtroEstado, setFiltroEstado] = useState<"todas" | "ABIERTA" | "GANADA" | "PERDIDA">("todas");
  const [nuevoMensaje, setNuevoMensaje] = useState("");
  const [loading, setLoading] = useState(true);
  const [enviando, setEnviando] = useState(false);

  const chatEndRef = useRef<HTMLDivElement>(null);

  const fetchSesiones = async () => {
    try {
      const res = await fetch("/api/chat");
      const data = await res.json();
      if (data.success && data.sesiones) {
        setSesiones(data.sesiones);
        if (!sesionSeleccionada && data.sesiones.length > 0) {
          setSesionSeleccionada(data.sesiones[0]);
        }
      }
    } catch (err) {
      console.error("Error al cargar sesiones:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchMensajes = async (idSesion: number) => {
    try {
      const res = await fetch(`/api/chat?sesionId=${idSesion}`);
      const data = await res.json();
      if (data.success) {
        setMensajes(data.mensajes || []);
      }
    } catch (err) {
      console.error("Error al cargar mensajes:", err);
    }
  };

  useEffect(() => {
    fetchSesiones();
  }, []);

  useEffect(() => {
    if (sesionSeleccionada) {
      fetchMensajes(sesionSeleccionada.id_sesion);
    }
  }, [sesionSeleccionada]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [mensajes]);

  const handleEnviar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nuevoMensaje.trim() || !sesionSeleccionada) return;

    setEnviando(true);
    const texto = nuevoMensaje;
    setNuevoMensaje("");

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id_sesion: sesionSeleccionada.id_sesion,
          id_negociacion: sesionSeleccionada.id_negociacion,
          direccion: "SALIENTE",
          contenido: texto,
          autoResponder: false,
        }),
      });
      const data = await res.json();
      if (data.success) {
        await fetchMensajes(sesionSeleccionada.id_sesion);
        await fetchSesiones();
      }
    } catch (err) {
      console.error("Error al enviar mensaje:", err);
    } finally {
      setEnviando(false);
    }
  };

  // Filtrado de sesiones
  const sesionesFiltradas = sesiones.filter((s) => {
    const coincideTexto =
      `${s.nombres || ""} ${s.apellidos || ""} ${s.telefono_cliente || ""}`
        .toLowerCase()
        .includes(busqueda.toLowerCase());
    const coincideEstado =
      filtroEstado === "todas" ? true : s.estado_negociacion === filtroEstado;
    return coincideTexto && coincideEstado;
  });

  return (
    <div className="space-y-4">
      {/* Cabecera Minimalista */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <h1 className="text-xl md:text-2xl font-extrabold text-[#241E1A] dark:text-[#F5F3F0] font-display">
            WhatsApp
          </h1>
          <span className="px-2 py-0.5 text-[10px] font-bold rounded-md bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
            En vivo
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              fetchSesiones();
              if (sesionSeleccionada) fetchMensajes(sesionSeleccionada.id_sesion);
            }}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-[#FFFFFF] dark:bg-[#1D2023] border border-[#E8E0D8] dark:border-[#383C40] hover:text-[#C96D35] transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Refrescar</span>
          </button>
          <Link
            href="/agente"
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold bg-[#C96D35] hover:bg-[#B65F29] text-white transition-colors"
          >
            <span>Modo Agente</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>

      {/* Grid Principal: Bandeja (Lista) + Visor de Conversación */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 h-[calc(100vh-12rem)] min-h-[550px]">
        {/* Columna Izquierda: Lista de Chats (4 cols) */}
        <div className="lg:col-span-5 xl:col-span-4 flex flex-col rounded-2xl bg-[#FFFFFF] dark:bg-[#1D2023] border border-[#E8E0D8] dark:border-[#383C40] shadow-xs overflow-hidden">
          {/* Barra de búsqueda y filtros */}
          <div className="p-3.5 border-b border-[#E8E0D8] dark:border-[#383C40] space-y-2.5">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#746B65] dark:text-[#B3ACA5]" />
              <input
                type="text"
                placeholder="Buscar por cliente o teléfono..."
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl bg-[#FAF8F5] dark:bg-[#121416] border border-[#E8E0D8] dark:border-[#383C40] focus:outline-none focus:border-[#C96D35]"
              />
            </div>

            <div className="flex items-center gap-1 overflow-x-auto text-[11px] font-bold pb-0.5">
              {(["todas", "ABIERTA", "GANADA", "PERDIDA"] as const).map((estado) => (
                <button
                  key={estado}
                  onClick={() => setFiltroEstado(estado)}
                  className={`px-2.5 py-1 rounded-lg capitalize transition-colors ${
                    filtroEstado === estado
                      ? "bg-[#C96D35] text-white"
                      : "bg-[#FAF8F5] dark:bg-[#121416] text-[#746B65] dark:text-[#B3ACA5] hover:text-[#C96D35]"
                  }`}
                >
                  {estado === "todas" ? "Todas" : estado.toLowerCase()}
                </button>
              ))}
            </div>
          </div>

          {/* Lista scrolleable de chats */}
          <div className="flex-1 overflow-y-auto divide-y divide-[#E8E0D8]/60 dark:divide-[#383C40]/60">
            {loading ? (
              <div className="p-6 text-center text-xs text-[#746B65] dark:text-[#B3ACA5]">
                Cargando conversaciones...
              </div>
            ) : sesionesFiltradas.length === 0 ? (
              <div className="p-6 text-center text-xs text-[#746B65] dark:text-[#B3ACA5]">
                No hay conversaciones que coincidan.
              </div>
            ) : (
              sesionesFiltradas.map((s) => {
                const activo = sesionSeleccionada?.id_sesion === s.id_sesion;
                return (
                  <button
                    key={s.id_sesion}
                    onClick={() => setSesionSeleccionada(s)}
                    className={`w-full text-left p-3.5 transition-colors flex items-start gap-3 ${
                      activo
                        ? "bg-[#FAF8F5] dark:bg-[#292D31] border-l-4 border-[#C96D35]"
                        : "hover:bg-[#FAF8F5]/60 dark:hover:bg-[#292D31]/40"
                    }`}
                  >
                    <div className="w-10 h-10 rounded-full bg-[#C96D35]/10 text-[#C96D35] flex items-center justify-center font-bold text-sm shrink-0">
                      {s.nombres ? s.nombres.charAt(0) : "C"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <p className="text-xs font-bold text-[#241E1A] dark:text-[#F5F3F0] truncate">
                          {s.nombres} {s.apellidos}
                        </p>
                        <span className="text-[10px] text-[#746B65] dark:text-[#B3ACA5] shrink-0 font-medium">
                          {formatDate(s.fecha_ultimo_mensaje || s.fecha_inicio)}
                        </span>
                      </div>
                      <p className="text-[11px] text-[#746B65] dark:text-[#B3ACA5] truncate mt-0.5">
                        {s.ultimo_mensaje_texto || "Sin mensajes registrados"}
                      </p>
                      <div className="flex items-center gap-1.5 mt-1.5">
                        <span
                          className={`text-[9px] font-bold px-1.5 py-0.5 rounded-sm uppercase ${
                            s.estado_negociacion === "GANADA"
                              ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
                              : s.estado_negociacion === "PERDIDA"
                              ? "bg-rose-500/15 text-rose-700 dark:text-rose-400"
                              : "bg-blue-500/15 text-blue-700 dark:text-blue-400"
                          }`}
                        >
                          {s.estado_negociacion || "LEAD"}
                        </span>
                        {s.segmento_nombre && (
                          <span className="text-[9px] font-medium px-1.5 py-0.5 rounded-sm bg-[#FAF8F5] dark:bg-[#121416] text-[#746B65] dark:text-[#B3ACA5]">
                            {s.segmento_nombre}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Columna Derecha: Chat Activo + Detalle Rápido (8 cols) */}
        <div className="lg:col-span-7 xl:col-span-8 flex flex-col rounded-2xl bg-[#FFFFFF] dark:bg-[#1D2023] border border-[#E8E0D8] dark:border-[#383C40] shadow-xs overflow-hidden">
          {sesionSeleccionada ? (
            <>
              {/* Barra superior de la conversación */}
              <div className="p-3.5 px-4 border-b border-[#E8E0D8] dark:border-[#383C40] flex items-center justify-between bg-[#FAF8F5]/60 dark:bg-[#121416]/40">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-[#C96D35] text-white flex items-center justify-center font-bold text-sm">
                    {sesionSeleccionada.nombres ? sesionSeleccionada.nombres.charAt(0) : "C"}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-bold text-[#241E1A] dark:text-[#F5F3F0]">
                        {sesionSeleccionada.nombres} {sesionSeleccionada.apellidos}
                      </h3>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-400">
                        {sesionSeleccionada.telefono_cliente}
                      </span>
                    </div>
                    <p className="text-[11px] text-[#746B65] dark:text-[#B3ACA5]">
                      Segmento: {sesionSeleccionada.segmento_nombre || "Sin segmento"} • Ciclo #{sesionSeleccionada.nro_ciclo || 1}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Link
                    href={`/leads/${sesionSeleccionada.id_negociacion}`}
                    className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg bg-[#FFFFFF] dark:bg-[#1D2023] border border-[#E8E0D8] dark:border-[#383C40] hover:text-[#C96D35] transition-colors"
                  >
                    <span>Ficha 360°</span>
                    <ExternalLink className="w-3 h-3" />
                  </Link>
                  <Link
                    href={`/agente?negociacionId=${sesionSeleccionada.id_negociacion}`}
                    className="flex items-center gap-1 px-2.5 py-1 text-xs font-bold rounded-lg bg-[#C96D35] text-white hover:bg-[#B65F29] transition-colors"
                  >
                    <span>Modo Agente</span>
                    <ArrowUpRight className="w-3 h-3" />
                  </Link>
                </div>
              </div>

              {/* Área de mensajes con scroll */}
              <div className="flex-1 p-4 overflow-y-auto space-y-3 bg-[#FAF8F5]/30 dark:bg-[#121416]/20">
                {mensajes.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-xs text-[#746B65] dark:text-[#B3ACA5]">
                    No hay mensajes en esta sesión de WhatsApp.
                  </div>
                ) : (
                  mensajes.map((m) => {
                    const esSaliente = m.direccion === "SALIENTE";
                    return (
                      <div
                        key={m.id_mensaje}
                        className={`flex ${esSaliente ? "justify-end" : "justify-start"}`}
                      >
                        <div
                          className={`max-w-[78%] rounded-2xl px-4 py-2.5 text-xs shadow-2xs ${
                            esSaliente
                              ? "bg-[#C96D35] text-white rounded-br-xs"
                              : "bg-[#FFFFFF] dark:bg-[#292D31] text-[#241E1A] dark:text-[#F5F3F0] border border-[#E8E0D8] dark:border-[#383C40] rounded-bl-xs"
                          }`}
                        >
                          <p className="whitespace-pre-line leading-relaxed">{m.contenido}</p>
                          <div
                            className={`flex items-center justify-end gap-1 mt-1 text-[10px] ${
                              esSaliente ? "text-white/80" : "text-[#746B65] dark:text-[#B3ACA5]"
                            }`}
                          >
                            <span>{formatDate(m.fecha_mensaje)}</span>
                            {esSaliente && <CheckCheck className="w-3 h-3" />}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={chatEndRef} />
              </div>

              {/* Formulario de envío manual de mensaje */}
              <form onSubmit={handleEnviar} className="p-3 border-t border-[#E8E0D8] dark:border-[#383C40] bg-[#FFFFFF] dark:bg-[#1D2023] flex items-center gap-2">
                <input
                  type="text"
                  placeholder="Escribe una respuesta para el lead..."
                  value={nuevoMensaje}
                  onChange={(e) => setNuevoMensaje(e.target.value)}
                  disabled={enviando}
                  className="flex-1 px-4 py-2 text-xs rounded-xl bg-[#FAF8F5] dark:bg-[#121416] border border-[#E8E0D8] dark:border-[#383C40] focus:outline-none focus:border-[#C96D35]"
                />
                <button
                  type="submit"
                  disabled={enviando || !nuevoMensaje.trim()}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-[#C96D35] hover:bg-[#B65F29] disabled:opacity-50 text-white flex items-center gap-1.5 transition-colors"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Enviar</span>
                </button>
              </form>
            </>
          ) : (
            <div className="h-full flex flex-col items-center justify-center p-8 text-center text-[#746B65] dark:text-[#B3ACA5]">
              <MessageSquare className="w-12 h-12 text-[#C96D35]/40 mb-3" />
              <p className="text-sm font-bold text-[#241E1A] dark:text-[#F5F3F0]">Selecciona una conversación</p>
              <p className="text-xs mt-1 max-w-sm">
                Elige un contacto de la columna izquierda para revisar el historial completo de mensajes y responderle.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
