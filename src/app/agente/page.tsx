"use client";

import React, { useEffect, useState, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import {
  Send,
  Bot,
  Sparkles,
  Flame,
  Phone,
  CheckCircle,
  RefreshCw,
  CreditCard,
  MessageSquare,
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  User,
} from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";
import { detectarPlatoMediaPorTexto, getPlatoRelativePath } from "@/lib/platos-media";

interface TelemetriaCopiloto {
  propuestaMensaje?: string;
  intencionDetectada?: string;
  objecionDetectada?: string | null;
  tecnicaSuperacion?: string;
  estrategiaComercial?: string;
  ofertaSugerida?: {
    tipo: "PRODUCTO" | "COMBO" | "PROMOCION";
    id: number;
    nombre: string;
    precio?: number;
    beneficio?: string;
  } | null;
  imagenUrl?: string | null;
  sugerenciasComerciales?: string[];
}

function AgenteIAContent() {
  const searchParams = useSearchParams();
  const negociacionIdParam = searchParams.get("negociacionId");

  const [sesiones, setSesiones] = useState<any[]>([]);
  const [sesionSeleccionada, setSesionSeleccionada] = useState<any | null>(null);
  const [mensajes, setMensajes] = useState<any[]>([]);
  const [cargandoMensajes, setCargandoMensajes] = useState(false);
  const [nuevoMensaje, setNuevoMensaje] = useState("");
  const [enviarWhatsAppReal, setEnviarWhatsAppReal] = useState(true);
  const [loading, setLoading] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [analizandoIA, setAnalizandoIA] = useState(false);
  const [perfilLead, setPerfilLead] = useState<any | null>(null);
  const [telemetria, setTelemetria] = useState<TelemetriaCopiloto | null>(null);
  const [conversionStatus, setConversionStatus] = useState<string | null>(null);
  const [panelTab, setPanelTab] = useState<"chat" | "perfil" | "sesiones">("chat");

  const chatEndRef = useRef<HTMLDivElement>(null);
  const chatScrollContainerRef = useRef<HTMLDivElement>(null);

  // Cargar lista de sesiones
  const fetchSesiones = async () => {
    try {
      const res = await fetch("/api/chat");
      const data = await res.json();
      if (data.success && data.sesiones) {
        setSesiones(data.sesiones);
        if (!sesionSeleccionada) {
          const target = negociacionIdParam
            ? data.sesiones.find((x: any) => String(x.id_negociacion) === String(negociacionIdParam)) || data.sesiones[0]
            : data.sesiones[0];
          if (target) {
            seleccionarSesion(target);
          }
        }
      }
    } catch (err) {
      console.error("Error cargando sesiones:", err);
    } finally {
      setLoading(false);
    }
  };

  const seleccionarSesion = (s: any) => {
    setSesionSeleccionada(s);
    fetchMensajes(s.id_sesion);
    if (s.id_negociacion) {
      fetchPerfil(s.id_negociacion);
      ejecutarCopiloto(s.id_sesion, s.id_negociacion);
    }
  };

  useEffect(() => {
    fetchSesiones();
    const interval = setInterval(fetchSesiones, 10000);
    return () => clearInterval(interval);
  }, [negociacionIdParam]);

  // Cargar mensajes de la sesión
  const fetchMensajes = async (idSesion: number) => {
    setCargandoMensajes(true);
    try {
      const res = await fetch(`/api/chat?sesionId=${idSesion}`);
      const data = await res.json();
      if (data.success) {
        setMensajes(data.mensajes || []);
      }
    } catch (err) {
      console.error("Error al cargar mensajes:", err);
    } finally {
      setCargandoMensajes(false);
    }
  };

  // Cargar perfil del lead
  const fetchPerfil = async (idNegociacion: number) => {
    try {
      const res = await fetch(`/api/leads/${idNegociacion}`);
      const data = await res.json();
      if (data.success) {
        setPerfilLead(data.perfil);
      }
    } catch (err) {
      console.error("Error al cargar perfil:", err);
    }
  };

  // Copiloto IA (Gemini)
  const ejecutarCopiloto = async (idSesionParam?: number, idNegParam?: number) => {
    const idNeg = idNegParam || sesionSeleccionada?.id_negociacion;
    const idSes = idSesionParam || sesionSeleccionada?.id_sesion;
    if (!idNeg) return;

    setAnalizandoIA(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "copiloto_assist",
          id_sesion: idSes,
          id_negociacion: idNeg,
        }),
      });
      const data = await res.json();
      if (data.success && data.copiloto) {
        setTelemetria(data.copiloto);
        if (data.copiloto.propuestaMensaje) {
          setNuevoMensaje(data.copiloto.propuestaMensaje);
        }
      }
    } catch (err) {
      console.error("Error ejecutando copiloto:", err);
    } finally {
      setAnalizandoIA(false);
    }
  };

  // Auto-scroll contenedor de chat
  useEffect(() => {
    if (chatScrollContainerRef.current) {
      chatScrollContainerRef.current.scrollTo({
        top: chatScrollContainerRef.current.scrollHeight,
        behavior: "smooth",
      });
    }
  }, [mensajes]);

  // Enviar mensaje
  const handleEnviarMensaje = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!nuevoMensaje.trim() || !sesionSeleccionada) return;

    const texto = nuevoMensaje;
    setNuevoMensaje("");
    setEnviando(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id_sesion: sesionSeleccionada.id_sesion,
          id_negociacion: sesionSeleccionada.id_negociacion,
          direccion: "SALIENTE",
          contenido: texto,
          enviarWhatsAppReal: true,
          autoResponder: false,
        }),
      });

      const data = await res.json();
      if (data.success) {
        await fetchMensajes(sesionSeleccionada.id_sesion);
        ejecutarCopiloto();
      }
    } catch (err) {
      console.error("Error al enviar mensaje:", err);
    } finally {
      setEnviando(false);
    }
  };

  // Registrar oferta
  const handleRegistrarOferta = async (respuesta: "ACEPTADA" | "RECHAZADA") => {
    if (!telemetria?.ofertaSugerida || !sesionSeleccionada?.id_negociacion) return;
    try {
      await fetch("/api/recommendations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id_negociacion: sesionSeleccionada.id_negociacion,
          id_producto: telemetria.ofertaSugerida.tipo === "PRODUCTO" ? telemetria.ofertaSugerida.id : undefined,
          id_combo: telemetria.ofertaSugerida.tipo === "COMBO" ? telemetria.ofertaSugerida.id : undefined,
          id_promocion: telemetria.ofertaSugerida.tipo === "PROMOCION" ? telemetria.ofertaSugerida.id : undefined,
          respuesta,
          detalle: `Evaluado por asesor en Agente IA: ${respuesta}`,
        }),
      });
      if (sesionSeleccionada.id_negociacion) {
        fetchPerfil(sesionSeleccionada.id_negociacion);
      }
    } catch (err) {
      console.error("Error al registrar oferta:", err);
    }
  };

  // Confirmar Conversión en SQL
  const handleConfirmarConversion = async () => {
    if (!sesionSeleccionada?.id_negociacion) return;
    setConversionStatus("procesando");
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "confirmar_conversion",
          id_negociacion: sesionSeleccionada.id_negociacion,
          monto: 50.0,
          medioPago: "YAPE",
          enviarWhatsAppReal: true,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setConversionStatus("exito");
        await fetchPerfil(sesionSeleccionada.id_negociacion);
        await fetchMensajes(sesionSeleccionada.id_sesion);
        setTimeout(() => setConversionStatus(null), 4000);
      } else {
        setConversionStatus("error");
      }
    } catch (err) {
      console.error("Error en conversión:", err);
      setConversionStatus("error");
    }
  };

  return (
    <div className="space-y-3">
      {/* Cabecera Limpia */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h1 className="text-xl md:text-2xl font-extrabold text-[#241E1A] dark:text-[#F5F3F0] font-display">
            Agente IA
          </h1>
          <span className="flex items-center gap-1.5 px-2 py-0.5 text-[10px] font-bold rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            WhatsApp En línea
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              fetchSesiones();
              if (sesionSeleccionada) fetchMensajes(sesionSeleccionada.id_sesion);
            }}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-[#E8E0D8] dark:border-[#383C40] bg-[#FFFFFF] dark:bg-[#1D2023] text-xs font-semibold text-[#746B65] dark:text-[#B3ACA5] hover:border-[#C96D35] transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Refrescar</span>
          </button>

          {/* Tabs Móviles */}
          <div className="flex lg:hidden rounded-lg bg-[#FFFFFF] dark:bg-[#1D2023] border border-[#E8E0D8] dark:border-[#383C40] p-0.5 text-xs font-bold">
            <button
              onClick={() => setPanelTab("sesiones")}
              className={`py-1 px-2 rounded-md ${panelTab === "sesiones" ? "bg-[#C96D35] text-white" : "text-[#746B65]"}`}
            >
              Chats
            </button>
            <button
              onClick={() => setPanelTab("chat")}
              className={`py-1 px-2 rounded-md ${panelTab === "chat" ? "bg-[#C96D35] text-white" : "text-[#746B65]"}`}
            >
              Chat
            </button>
            <button
              onClick={() => setPanelTab("perfil")}
              className={`py-1 px-2 rounded-md ${panelTab === "perfil" ? "bg-[#C96D35] text-white" : "text-[#746B65]"}`}
            >
              IA
            </button>
          </div>
        </div>
      </div>

      {/* Espacio de Trabajo Principal (3 Columnas) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5 h-[calc(100vh-11.5rem)] min-h-[520px]">
        
        {/* PANEL IZQUIERDO: Leads (3 cols) */}
        <div
          className={`lg:col-span-3 rounded-2xl bg-[#FFFFFF] dark:bg-[#1D2023] border border-[#E8E0D8] dark:border-[#383C40] shadow-2xs flex flex-col overflow-hidden ${
            panelTab === "sesiones" ? "block" : "hidden lg:flex"
          }`}
        >
          <div className="p-3 border-b border-[#E8E0D8] dark:border-[#383C40] flex items-center justify-between bg-[#FAF8F5] dark:bg-[#121416]/50">
            <span className="text-[11px] font-bold text-[#746B65] dark:text-[#B3ACA5] uppercase tracking-wider">
              Leads ({sesiones.length})
            </span>
            <span className="text-[10px] font-semibold text-[#C96D35]">WhatsApp</span>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-[#E8E0D8] dark:divide-[#383C40]">
            {loading ? (
              <p className="text-xs text-[#746B65] p-4 text-center">Cargando...</p>
            ) : (
              sesiones.map((s) => {
                const isSelected = sesionSeleccionada?.id_sesion === s.id_sesion;
                return (
                  <button
                    key={s.id_sesion}
                    onClick={() => {
                      seleccionarSesion(s);
                      setPanelTab("chat");
                    }}
                    className={`w-full text-left p-3 transition-colors flex items-start gap-2.5 ${
                      isSelected
                        ? "bg-[#C96D35]/10 dark:bg-[#C96D35]/20 border-l-4 border-l-[#C96D35]"
                        : "hover:bg-[#FAF8F5] dark:hover:bg-[#292D31]/40"
                    }`}
                  >
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#42291F] to-[#C96D35] text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-2xs">
                      {s.nombres ? s.nombres.substring(0, 1) : "L"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-bold text-[#241E1A] dark:text-[#F5F3F0] truncate">
                          {s.nombres ? `${s.nombres} ${s.apellidos || ""}` : s.telefono_cliente}
                        </p>
                        <span className="text-[10px] text-[#746B65] dark:text-[#B3ACA5]">
                          {s.ultimo_mensaje_fecha ? formatDate(s.ultimo_mensaje_fecha).split(",")[1] : ""}
                        </span>
                      </div>
                      <p className="text-[11px] text-[#746B65] dark:text-[#B3ACA5] truncate mt-0.5">
                        {s.ultimo_mensaje_texto || "Sin mensajes"}
                      </p>
                      <div className="flex items-center gap-1.5 mt-1">
                        <span className="text-[9px] px-1.5 py-0.2 rounded bg-neutral-100 dark:bg-neutral-800 text-[#746B65] dark:text-[#B3ACA5] font-semibold">
                          {s.segmento_nombre || "Lead"}
                        </span>
                        <span className={`text-[9px] px-1.5 py-0.2 rounded font-bold ${
                          s.estado_negociacion === "CONVERTIDA" 
                            ? "bg-emerald-500/15 text-emerald-600" 
                            : "bg-amber-500/15 text-amber-600"
                        }`}>
                          {s.estado_negociacion || "ABIERTA"}
                        </span>
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* PANEL CENTRAL: Conversación (6 cols) */}
        <div
          className={`lg:col-span-6 rounded-2xl bg-[#FFFFFF] dark:bg-[#1D2023] border border-[#E8E0D8] dark:border-[#383C40] shadow-2xs flex flex-col overflow-hidden ${
            panelTab === "chat" ? "block" : "hidden lg:flex"
          }`}
        >
          {/* Header del Chat */}
          <div className="p-3 px-4 border-b border-[#E8E0D8] dark:border-[#383C40] flex items-center justify-between bg-[#FAF8F5] dark:bg-[#121416]/50">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-[#C96D35] text-white flex items-center justify-center font-bold text-xs shadow-2xs">
                {sesionSeleccionada?.nombres ? sesionSeleccionada.nombres.substring(0, 1) : "L"}
              </div>
              <div>
                <p className="text-xs font-bold text-[#241E1A] dark:text-[#F5F3F0]">
                  {sesionSeleccionada?.nombres ? `${sesionSeleccionada.nombres} ${sesionSeleccionada.apellidos || ""}` : "Chat"}
                </p>
                <p className="text-[10px] text-[#746B65] dark:text-[#B3ACA5]">
                  {sesionSeleccionada?.telefono_cliente || "N/D"}
                </p>
              </div>
            </div>

            {/* Canal y Modo Asesor */}
            <div className="flex items-center gap-1.5">
              <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-[#C96D35]/15 text-[#C96D35] border border-[#C96D35]/30">
                Asesor Comercial (Saliente)
              </span>
            </div>
          </div>

          {/* Área de Mensajes */}
          <div
            ref={chatScrollContainerRef}
            className="flex-1 p-3.5 overflow-y-auto space-y-2.5 bg-[#FAF8F5]/40 dark:bg-[#121416]/20"
          >
            {cargandoMensajes ? (
              <div className="flex items-center justify-center h-full text-xs text-[#746B65]">
                Cargando conversación...
              </div>
            ) : mensajes.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center p-6 text-[#746B65]">
                <Bot className="w-8 h-8 text-[#C96D35]/50 mb-1.5" />
                <p className="text-xs font-bold">Sin mensajes registrados</p>
              </div>
            ) : (
              mensajes.map((m) => {
                const esEntrante = m.direccion === "ENTRANTE";
                const platoMedia =
                  m.tipo === "IMAGEN" || !esEntrante
                    ? detectarPlatoMediaPorTexto(m.contenido)
                    : null;
                return (
                  <div
                    key={m.id_mensaje}
                    className={`flex flex-col ${esEntrante ? "items-start" : "items-end"}`}
                  >
                    <div
                      className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-xs shadow-2xs ${
                        esEntrante
                          ? "bg-[#FFFFFF] dark:bg-[#1D2023] border border-[#E8E0D8] dark:border-[#383C40] text-[#241E1A] dark:text-[#F5F3F0]"
                          : "bg-gradient-to-r from-[#C96D35] to-[#B65F29] text-white"
                      }`}
                    >
                      {platoMedia && (
                        <div className="mb-2 overflow-hidden rounded-xl border border-black/10 dark:border-white/10 bg-black/5">
                          <img
                            src={getPlatoRelativePath(platoMedia.slug, "avif")}
                            alt={platoMedia.nombre}
                            className="w-full max-w-[240px] max-h-40 object-cover"
                            loading="lazy"
                          />
                        </div>
                      )}
                      <p className="whitespace-pre-wrap leading-relaxed">{m.contenido}</p>
                    </div>
                    <span className="text-[9px] text-[#746B65] dark:text-[#B3ACA5] mt-0.5 px-1 flex items-center gap-1">
                      <span>{formatDate(m.fecha_mensaje).split(",")[1]}</span>
                      {!esEntrante && <CheckCircle2 className="w-2.5 h-2.5 text-emerald-500 inline" />}
                    </span>
                  </div>
                );
              })
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Sugerencias Rápidas en Pills Discretos */}
          {telemetria?.sugerenciasComerciales && telemetria.sugerenciasComerciales.length > 0 && (
            <div className="px-3 py-1.5 bg-neutral-50 dark:bg-[#121416]/50 border-t border-[#E8E0D8] dark:border-[#383C40] flex items-center gap-1.5 overflow-x-auto no-scrollbar">
              <Sparkles className="w-3 h-3 text-[#C96D35] shrink-0" />
              {telemetria.sugerenciasComerciales.slice(0, 3).map((sug, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setNuevoMensaje(sug)}
                  className="text-[10px] px-2 py-0.5 rounded-full bg-white dark:bg-[#292D31] border border-[#E8E0D8] dark:border-[#383C40] text-[#241E1A] dark:text-[#F5F3F0] hover:border-[#C96D35] whitespace-nowrap transition-colors"
                >
                  {sug}
                </button>
              ))}
            </div>
          )}

          {/* Input de Envío */}
          <form
            onSubmit={handleEnviarMensaje}
            className="p-2.5 border-t border-[#E8E0D8] dark:border-[#383C40] bg-[#FFFFFF] dark:bg-[#1D2023] space-y-1.5"
          >
            <div className="flex items-center gap-1.5">
              <input
                type="text"
                placeholder="Escribe una respuesta o pulsa Copiloto para sugerencia..."
                value={nuevoMensaje}
                onChange={(e) => setNuevoMensaje(e.target.value)}
                disabled={enviando}
                className="flex-1 px-3.5 py-2 rounded-xl text-xs bg-[#FAF8F5] dark:bg-[#121416] border border-[#E8E0D8] dark:border-[#383C40] text-[#241E1A] dark:text-[#F5F3F0] placeholder-[#746B65]/70 focus:outline-none focus:border-[#C96D35]"
              />

              <button
                type="button"
                onClick={() => ejecutarCopiloto()}
                disabled={analizandoIA}
                title="Generar propuesta con IA"
                className="px-2.5 py-2 rounded-xl border border-[#C96D35]/30 bg-[#C96D35]/10 hover:bg-[#C96D35]/20 text-[#C96D35] text-xs font-bold flex items-center gap-1 transition-colors"
              >
                <Sparkles className={`w-3.5 h-3.5 ${analizandoIA ? "animate-spin" : ""}`} />
                <span className="hidden sm:inline">Copiloto</span>
              </button>

              <button
                type="submit"
                disabled={enviando || !nuevoMensaje.trim()}
                className="px-3.5 py-2 rounded-xl bg-[#C96D35] hover:bg-[#B65F29] text-white text-xs font-bold flex items-center gap-1 disabled:opacity-50 transition-colors shadow-2xs"
              >
                <Send className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Enviar</span>
              </button>
            </div>

            <div className="flex items-center justify-between text-[10px] px-1 text-emerald-600 dark:text-emerald-400 font-semibold">
              <span className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Conectado a WhatsApp Cloud API (Envío Real)
              </span>
            </div>
          </form>
        </div>

        {/* PANEL DERECHO: Inteligencia Comercial & Conversión (3 cols) */}
        <div
          className={`lg:col-span-3 rounded-2xl bg-[#FFFFFF] dark:bg-[#1D2023] border border-[#E8E0D8] dark:border-[#383C40] shadow-2xs flex flex-col overflow-hidden ${
            panelTab === "perfil" ? "block" : "hidden lg:flex"
          }`}
        >
          <div className="p-3 border-b border-[#E8E0D8] dark:border-[#383C40] bg-[#FAF8F5] dark:bg-[#121416]/50 flex items-center justify-between">
            <span className="text-[11px] font-bold text-[#746B65] dark:text-[#B3ACA5] uppercase tracking-wider flex items-center gap-1">
              <Bot className="w-3 h-3 text-[#C96D35]" />
              IA Comercial
            </span>
            <span className="text-[9px] px-1.5 py-0.2 rounded bg-emerald-500/10 text-emerald-600 font-bold">
              En vivo
            </span>
          </div>

          <div className="flex-1 p-3 overflow-y-auto space-y-2.5 text-xs">
            {/* Alerta de Conversión */}
            {conversionStatus === "exito" && (
              <div className="p-2.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-700 dark:text-emerald-400 flex items-start gap-1.5 animate-in fade-in">
                <CheckCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                <p className="font-bold text-xs">¡Lead convertido a PAYER en SQL!</p>
              </div>
            )}

            {/* Estrategia Comercial */}
            <div className="p-2.5 rounded-xl bg-neutral-50 dark:bg-[#121416] border border-[#E8E0D8] dark:border-[#383C40] space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[9px] font-bold text-[#746B65] uppercase">Estrategia</span>
                <span className="text-[8px] px-1.5 py-0.2 rounded-full bg-[#C96D35]/15 text-[#C96D35] font-bold">
                  {telemetria?.intencionDetectada || "CONSULTA"}
                </span>
              </div>
              <p className="text-[11px] text-[#241E1A] dark:text-[#F5F3F0] font-medium leading-snug">
                {telemetria?.estrategiaComercial || "Venta consultiva personalizada"}
              </p>
            </div>

            {/* Objeción */}
            {telemetria?.objecionDetectada && (
              <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/25 space-y-0.5">
                <span className="text-[9px] font-bold text-amber-700 dark:text-amber-400 uppercase">
                  Objeción: {telemetria.objecionDetectada}
                </span>
                <p className="text-[10px] text-[#746B65] dark:text-[#B3ACA5] leading-snug">
                  {telemetria.tecnicaSuperacion}
                </p>
              </div>
            )}

            {/* Oferta Sugerida */}
            {telemetria?.ofertaSugerida && (
              <div className="p-3 rounded-xl bg-[#C96D35]/10 border border-[#C96D35]/25 space-y-1.5 animate-in fade-in">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-[#C96D35] flex items-center gap-1">
                    <Flame className="w-3 h-3" /> Oferta Sugerida
                  </span>
                  <span className="text-[9px] font-bold text-[#C96D35]">
                    {formatCurrency(telemetria.ofertaSugerida.precio || 0)}
                  </span>
                </div>

                <p className="font-extrabold text-xs text-[#241E1A] dark:text-[#F5F3F0]">
                  {telemetria.ofertaSugerida.nombre}
                </p>

                {telemetria.imagenUrl && (
                  <div className="overflow-hidden rounded-lg border border-[#C96D35]/20">
                    <img
                      src={telemetria.imagenUrl}
                      alt={telemetria.ofertaSugerida.nombre}
                      className="w-full h-32 object-cover"
                    />
                  </div>
                )}

                <div className="pt-1 flex items-center gap-1.5">
                  <button
                    onClick={() => handleRegistrarOferta("ACEPTADA")}
                    className="flex-1 py-1 px-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10px] transition-colors"
                  >
                    Aceptó
                  </button>
                  <button
                    onClick={() => handleRegistrarOferta("RECHAZADA")}
                    className="flex-1 py-1 px-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold text-[10px] transition-colors"
                  >
                    Rechazó
                  </button>
                </div>
              </div>
            )}

            {/* Ficha Rápida del Lead */}
            {perfilLead && (
              <div className="p-2.5 rounded-xl bg-neutral-50 dark:bg-[#121416] border border-[#E8E0D8] dark:border-[#383C40] space-y-1 text-[11px]">
                <div className="flex justify-between">
                  <span className="text-[#746B65]">Cliente:</span>
                  <span className="font-bold text-[#241E1A] dark:text-[#F5F3F0]">
                    {perfilLead.negociacion.nombres}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#746B65]">Segmento:</span>
                  <span className="font-semibold text-[#C96D35]">
                    {perfilLead.negociacion.segmento_nombre || "Lead"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#746B65]">Fase:</span>
                  <span className={`font-bold px-1.5 py-0.2 rounded text-[9px] ${
                    perfilLead.negociacion.fase_actual === "PAYER"
                      ? "bg-emerald-500/15 text-emerald-600"
                      : "bg-blue-500/15 text-blue-600"
                  }`}>
                    {perfilLead.negociacion.fase_actual || "LEAD"}
                  </span>
                </div>
              </div>
            )}

            {/* Botón de Conversión Comercial (Regla 5) */}
            <div className="pt-1">
              <button
                onClick={handleConfirmarConversion}
                disabled={conversionStatus === "procesando"}
                className="w-full py-2 px-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-2xs transition-all"
              >
                <CreditCard className="w-3.5 h-3.5" />
                <span>Confirmar Pago (Yape/Plin)</span>
              </button>
            </div>

          </div>
        </div>

      </div>
    </div>
  );
}

export default function AgenteIAPage() {
  return (
    <Suspense fallback={<div className="p-6 text-center text-xs text-[#746B65]">Cargando Agente IA...</div>}>
      <AgenteIAContent />
    </Suspense>
  );
}