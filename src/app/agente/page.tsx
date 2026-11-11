"use client";

import React, { useEffect, useState, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import {
  Send,
  Bot,
  User,
  Sparkles,
  Flame,
  Phone,
  Gift,
  CheckCircle,
  XCircle,
  HelpCircle,
  RefreshCw,
  Clock,
  ArrowRight,
  ShieldCheck,
  ChevronRight,
  SlidersHorizontal,
} from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";

function AgenteIAContent() {
  const searchParams = useSearchParams();
  const negociacionIdParam = searchParams.get("negociacionId");

  const [sesiones, setSesiones] = useState<any[]>([]);
  const [sesionSeleccionada, setSesionSeleccionada] = useState<any | null>(null);
  const [mensajes, setMensajes] = useState<any[]>([]);
  const [nuevoMensaje, setNuevoMensaje] = useState("");
  const [simularComo, setSimularComo] = useState<"lead" | "agente">("lead");
  const [loading, setLoading] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [sugerencias, setSugerencias] = useState<string[]>([]);
  const [ofertaRecomendada, setOfertaRecomendada] = useState<any | null>(null);
  const [perfilLead, setPerfilLead] = useState<any | null>(null);
  const [panelTab, setPanelTab] = useState<"chat" | "perfil" | "sesiones">("chat");

  const chatEndRef = useRef<HTMLDivElement>(null);

  // Cargar lista de sesiones
  const fetchSesiones = async () => {
    try {
      const res = await fetch("/api/chat");
      const data = await res.json();
      if (data.success && data.sesiones) {
        setSesiones(data.sesiones);
        // Si hay parámetro en URL, seleccionar esa sesión
        if (negociacionIdParam) {
          const s = data.sesiones.find((x: any) => x.id_negociacion === parseInt(negociacionIdParam, 10));
          if (s) setSesionSeleccionada(s);
          else if (data.sesiones.length > 0) setSesionSeleccionada(data.sesiones[0]);
        } else if (!sesionSeleccionada && data.sesiones.length > 0) {
          setSesionSeleccionada(data.sesiones[0]);
        }
      }
    } catch (err) {
      console.error("Error al cargar sesiones:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSesiones();
  }, [negociacionIdParam]);

  // Cargar mensajes de la sesión seleccionada
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

  // Cargar perfil completo del lead seleccionado
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

  useEffect(() => {
    if (sesionSeleccionada) {
      fetchMensajes(sesionSeleccionada.id_sesion);
      if (sesionSeleccionada.id_negociacion) {
        fetchPerfil(sesionSeleccionada.id_negociacion);
      }
    }
  }, [sesionSeleccionada]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [mensajes]);

  // Enviar mensaje
  const handleEnviarMensaje = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!nuevoMensaje.trim() || !sesionSeleccionada) return;

    const texto = nuevoMensaje;
    setNuevoMensaje("");
    setEnviando(true);

    try {
      const direccion = simularComo === "lead" ? "ENTRANTE" : "SALIENTE";
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id_sesion: sesionSeleccionada.id_sesion,
          id_negociacion: sesionSeleccionada.id_negociacion,
          direccion,
          contenido: texto,
          autoResponder: simularComo === "lead", // Si el lead habla, el agente responde automáticamente
        }),
      });

      const data = await res.json();
      if (data.success) {
        await fetchMensajes(sesionSeleccionada.id_sesion);
        if (data.respuestaAgente) {
          setSugerencias(data.respuestaAgente.sugerenciasComerciales || []);
          setOfertaRecomendada(data.respuestaAgente.ofertaSugerida || null);
        }
      }
    } catch (err) {
      console.error("Error al enviar mensaje:", err);
    } finally {
      setEnviando(false);
    }
  };

  // Aplicar sugerencia como respuesta rápida
  const aplicarSugerencia = (texto: string) => {
    setNuevoMensaje(texto);
  };

  // Registrar oferta recomendada con un clic
  const handleRegistrarOferta = async (respuesta: "ACEPTADA" | "RECHAZADA") => {
    if (!ofertaRecomendada || !sesionSeleccionada?.id_negociacion) return;
    try {
      await fetch("/api/recommendations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id_negociacion: sesionSeleccionada.id_negociacion,
          id_producto: ofertaRecomendada.tipo === "PRODUCTO" ? ofertaRecomendada.id : undefined,
          id_combo: ofertaRecomendada.tipo === "COMBO" ? ofertaRecomendada.id : undefined,
          id_promocion: ofertaRecomendada.tipo === "PROMOCION" ? ofertaRecomendada.id : undefined,
          respuesta,
          detalle: `Respuesta de lead en chat: ${respuesta}`,
        }),
      });
      // Refrescar perfil
      if (sesionSeleccionada.id_negociacion) {
        fetchPerfil(sesionSeleccionada.id_negociacion);
      }
      setOfertaRecomendada(null);
    } catch (err) {
      console.error("Error al registrar oferta:", err);
    }
  };

  return (
    <div className="space-y-4">
      {/* Cabecera */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl md:text-3xl font-extrabold text-[#241E1A] dark:text-[#F5F3F0] font-display">
              Agente Comercial Inteligente
            </h1>
            <span className="px-2.5 py-1 text-xs font-bold rounded-lg bg-[#C96D35]/15 text-[#C96D35] dark:text-[#E8A46D] border border-[#C96D35]/30">
              WhatsApp Copiloto
            </span>
          </div>
          <p className="text-xs text-[#746B65] dark:text-[#B3ACA5] mt-0.5">
            Atención comercial de LEADS con IA, recomendaciones gastronómicas y gestión de objeciones.
          </p>
        </div>

        {/* Selector de Tabs para Móviles */}
        <div className="flex lg:hidden rounded-xl bg-[#FFFFFF] dark:bg-[#1D2023] border border-[#E8E0D8] dark:border-[#383C40] p-1 text-xs font-bold">
          <button
            onClick={() => setPanelTab("sesiones")}
            className={`flex-1 py-1.5 px-3 rounded-lg ${panelTab === "sesiones" ? "bg-[#C96D35] text-white" : "text-[#746B65]"}`}
          >
            Chats
          </button>
          <button
            onClick={() => setPanelTab("chat")}
            className={`flex-1 py-1.5 px-3 rounded-lg ${panelTab === "chat" ? "bg-[#C96D35] text-white" : "text-[#746B65]"}`}
          >
            Conversación
          </button>
          <button
            onClick={() => setPanelTab("perfil")}
            className={`flex-1 py-1.5 px-3 rounded-lg ${panelTab === "perfil" ? "bg-[#C96D35] text-white" : "text-[#746B65]"}`}
          >
            Contexto Lead
          </button>
        </div>
      </div>

      {/* Workspace de 3 Paneles */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 h-[calc(100vh-12rem)] min-h-[580px]">
        {/* PANEL IZQUIERDO: Lista de Sesiones / Contactos (3 cols) */}
        <div
          className={`lg:col-span-3 rounded-2xl bg-[#FFFFFF] dark:bg-[#1D2023] border border-[#E8E0D8] dark:border-[#383C40] shadow-sm flex flex-col overflow-hidden ${
            panelTab === "sesiones" ? "block" : "hidden lg:flex"
          }`}
        >
          <div className="p-3.5 border-b border-[#E8E0D8] dark:border-[#383C40] flex items-center justify-between bg-[#FAF8F5] dark:bg-[#121416]/50">
            <span className="text-xs font-bold text-[#746B65] dark:text-[#B3ACA5] uppercase tracking-wider">
              Conversaciones ({sesiones.length})
            </span>
            <button
              onClick={fetchSesiones}
              className="p-1 rounded-lg hover:bg-neutral-200 dark:hover:bg-neutral-800 text-[#746B65]"
              title="Refrescar chats"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-[#E8E0D8] dark:divide-[#383C40]">
            {loading ? (
              <p className="text-xs text-[#746B65] p-4 text-center">Cargando sesiones...</p>
            ) : sesiones.length === 0 ? (
              <p className="text-xs text-[#746B65] p-4 text-center">No hay sesiones de WhatsApp.</p>
            ) : (
              sesiones.map((s) => {
                const isSelected = sesionSeleccionada?.id_sesion === s.id_sesion;
                return (
                  <button
                    key={s.id_sesion}
                    onClick={() => {
                      setSesionSeleccionada(s);
                      setPanelTab("chat");
                    }}
                    className={`w-full text-left p-3.5 transition-colors flex items-start gap-3 ${
                      isSelected
                        ? "bg-[#C96D35]/10 dark:bg-[#C96D35]/20 border-l-4 border-l-[#C96D35]"
                        : "hover:bg-[#FAF8F5] dark:hover:bg-[#292D31]/40"
                    }`}
                  >
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#42291F] to-[#C96D35] text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-sm">
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
                      <div className="flex items-center gap-1.5 mt-1.5">
                        <span className="text-[9px] px-1.5 py-0.2 rounded bg-neutral-100 dark:bg-neutral-800 text-[#746B65] dark:text-[#B3ACA5] font-semibold">
                          {s.segmento_nombre || "Lead"}
                        </span>
                        {s.nro_ciclo && (
                          <span className="text-[9px] px-1.5 py-0.2 rounded bg-[#C96D35]/15 text-[#C96D35] dark:text-[#E8A46D] font-bold">
                            Ciclo {s.nro_ciclo}
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

        {/* PANEL CENTRAL: Conversación y Chat Comercial (6 cols) */}
        <div
          className={`lg:col-span-6 rounded-2xl bg-[#FFFFFF] dark:bg-[#1D2023] border border-[#E8E0D8] dark:border-[#383C40] shadow-sm flex flex-col overflow-hidden ${
            panelTab === "chat" ? "block" : "hidden lg:flex"
          }`}
        >
          {/* Header del Chat */}
          <div className="p-3.5 px-4 border-b border-[#E8E0D8] dark:border-[#383C40] flex items-center justify-between bg-[#FAF8F5] dark:bg-[#121416]/50">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-[#C96D35] text-white flex items-center justify-center font-bold text-xs">
                {sesionSeleccionada?.nombres ? sesionSeleccionada.nombres.substring(0, 1) : "L"}
              </div>
              <div>
                <p className="text-xs font-bold text-[#241E1A] dark:text-[#F5F3F0]">
                  {sesionSeleccionada?.nombres ? `${sesionSeleccionada.nombres} ${sesionSeleccionada.apellidos || ""}` : "Chat Comercial"}
                </p>
                <p className="text-[10px] text-[#746B65] dark:text-[#B3ACA5] flex items-center gap-1">
                  <span>Tel: {sesionSeleccionada?.telefono_cliente || "N/D"}</span>
                  <span>•</span>
                  <span className="text-emerald-500 font-semibold">En línea</span>
                </p>
              </div>
            </div>

            {/* Alternador de Modo de Simulación (Lead vs Agente) */}
            <div className="flex items-center gap-1.5 bg-neutral-100 dark:bg-[#292D31] p-1 rounded-xl text-[10px] font-bold">
              <span className="text-[#746B65] px-1 hidden sm:inline">Escribir como:</span>
              <button
                type="button"
                onClick={() => setSimularComo("lead")}
                className={`px-2 py-1 rounded-lg transition-colors ${
                  simularComo === "lead"
                    ? "bg-[#C96D35] text-white shadow-xs"
                    : "text-[#746B65] dark:text-[#B3ACA5]"
                }`}
              >
                Lead (Cliente)
              </button>
              <button
                type="button"
                onClick={() => setSimularComo("agente")}
                className={`px-2 py-1 rounded-lg transition-colors ${
                  simularComo === "agente"
                    ? "bg-[#42291F] text-white shadow-xs"
                    : "text-[#746B65] dark:text-[#B3ACA5]"
                }`}
              >
                Agente IA
              </button>
            </div>
          </div>

          {/* Área de Mensajes */}
          <div className="flex-1 p-4 overflow-y-auto space-y-3 bg-[#FAF8F5]/30 dark:bg-[#121416]/20">
            {mensajes.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center p-6 text-[#746B65] dark:text-[#B3ACA5]">
                <Bot className="w-10 h-10 text-[#C96D35]/50 mb-2" />
                <p className="text-xs font-bold">Inicia la conversación comercial</p>
                <p className="text-[11px] mt-1 max-w-xs">
                  Escribe una consulta como cliente (ej. "¿Cuánto cuesta la picana?", "¿Tienen promos hoy?") y el Agente responderá de inmediato.
                </p>
              </div>
            ) : (
              mensajes.map((m) => {
                const esEntrante = m.direccion === "ENTRANTE";
                return (
                  <div
                    key={m.id_mensaje}
                    className={`flex flex-col ${esEntrante ? "items-start" : "items-end"}`}
                  >
                    <div
                      className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-xs shadow-xs ${
                        esEntrante
                          ? "bg-[#FFFFFF] dark:bg-[#1D2023] border border-[#E8E0D8] dark:border-[#383C40] text-[#241E1A] dark:text-[#F5F3F0]"
                          : "bg-gradient-to-r from-[#C96D35] to-[#B65F29] text-white"
                      }`}
                    >
                      <p className="whitespace-pre-wrap leading-relaxed">{m.contenido}</p>
                    </div>
                    <span className="text-[9px] text-[#746B65] dark:text-[#B3ACA5] mt-1 px-1">
                      {esEntrante ? "Lead" : "Agente Establo"} • {formatDate(m.fecha_mensaje)}
                    </span>
                  </div>
                );
              })
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Sugerencias Rápidas del Agente */}
          {sugerencias.length > 0 && (
            <div className="p-2.5 px-4 bg-amber-500/10 border-t border-[#E8E0D8] dark:border-[#383C40]">
              <p className="text-[10px] font-bold text-[#C96D35] dark:text-[#E8A46D] uppercase flex items-center gap-1 mb-1.5">
                <Sparkles className="w-3 h-3" /> Sugerencias Comerciales del Agente
              </p>
              <div className="flex flex-wrap gap-1.5">
                {sugerencias.map((sug, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => aplicarSugerencia(sug)}
                    className="text-[11px] px-2.5 py-1 rounded-lg bg-white dark:bg-[#292D31] border border-[#E8E0D8] dark:border-[#383C40] text-[#241E1A] dark:text-[#F5F3F0] hover:border-[#C96D35] transition-colors"
                  >
                    {sug}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Caja de Entrada de Texto */}
          <form
            onSubmit={handleEnviarMensaje}
            className="p-3 border-t border-[#E8E0D8] dark:border-[#383C40] bg-[#FFFFFF] dark:bg-[#1D2023] flex items-center gap-2"
          >
            <input
              type="text"
              placeholder={
                simularComo === "lead"
                  ? "Escribe como el cliente (ej. '¿Tienen descuento para estudiantes?')..."
                  : "Escribe como el asesor comercial..."
              }
              value={nuevoMensaje}
              onChange={(e) => setNuevoMensaje(e.target.value)}
              disabled={enviando}
              className="flex-1 px-4 py-2.5 rounded-xl text-xs bg-[#FAF8F5] dark:bg-[#121416] border border-[#E8E0D8] dark:border-[#383C40] text-[#241E1A] dark:text-[#F5F3F0] placeholder-[#746B65]/70 focus:outline-none focus:border-[#C96D35]"
            />
            <button
              type="submit"
              disabled={enviando || !nuevoMensaje.trim()}
              className="px-4 py-2.5 rounded-xl bg-[#C96D35] hover:bg-[#B65F29] text-white text-xs font-bold flex items-center gap-1.5 disabled:opacity-50 transition-colors shadow-sm"
            >
              <Send className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Enviar</span>
            </button>
          </form>
        </div>

        {/* PANEL DERECHO: Perfil, Preferencias y Sugerencias de Oferta (3 cols) */}
        <div
          className={`lg:col-span-3 rounded-2xl bg-[#FFFFFF] dark:bg-[#1D2023] border border-[#E8E0D8] dark:border-[#383C40] shadow-sm flex flex-col overflow-hidden ${
            panelTab === "perfil" ? "block" : "hidden lg:flex"
          }`}
        >
          <div className="p-3.5 border-b border-[#E8E0D8] dark:border-[#383C40] bg-[#FAF8F5] dark:bg-[#121416]/50">
            <span className="text-xs font-bold text-[#746B65] dark:text-[#B3ACA5] uppercase tracking-wider">
              Contexto Comercial en Vivo
            </span>
          </div>

          <div className="flex-1 p-4 overflow-y-auto space-y-4 text-xs">
            {/* Oferta Recomendada Activa en este Turno */}
            {ofertaRecomendada ? (
              <div className="p-3.5 rounded-xl bg-[#C96D35]/15 border border-[#C96D35]/30 space-y-2 animate-in fade-in">
                <div className="flex items-center gap-1.5 text-xs font-bold text-[#C96D35] dark:text-[#E8A46D]">
                  <Flame className="w-4 h-4" />
                  <span>Oferta Clave Sugerida</span>
                </div>
                <p className="font-extrabold text-sm text-[#241E1A] dark:text-[#F5F3F0]">
                  {ofertaRecomendada.nombre}
                </p>
                {ofertaRecomendada.precio && (
                  <p className="text-xs font-black text-[#C96D35] dark:text-[#E8A46D]">
                    {formatCurrency(ofertaRecomendada.precio)}
                  </p>
                )}
                {ofertaRecomendada.beneficio && (
                  <p className="text-[11px] text-[#746B65] dark:text-[#B3ACA5]">
                    {ofertaRecomendada.beneficio}
                  </p>
                )}

                <div className="pt-2 flex items-center gap-2">
                  <button
                    onClick={() => handleRegistrarOferta("ACEPTADA")}
                    className="flex-1 py-1 px-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10px]"
                  >
                    Aceptó oferta
                  </button>
                  <button
                    onClick={() => handleRegistrarOferta("RECHAZADA")}
                    className="flex-1 py-1 px-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold text-[10px]"
                  >
                    Rechazó
                  </button>
                </div>
              </div>
            ) : (
              <div className="p-3 rounded-xl bg-[#FAF8F5] dark:bg-[#121416] border border-[#E8E0D8] dark:border-[#383C40] text-center text-[#746B65] dark:text-[#B3ACA5]">
                <p className="text-[11px]">El Agente identificará la oferta ideal según el diálogo comercial.</p>
              </div>
            )}

            {/* Datos Clave del Lead */}
            {perfilLead && (
              <div className="space-y-3 pt-2">
                <div className="flex justify-between py-1 border-b border-neutral-100 dark:border-neutral-800">
                  <span className="text-[#746B65] dark:text-[#B3ACA5]">Lead:</span>
                  <span className="font-bold text-[#241E1A] dark:text-[#F5F3F0]">
                    {perfilLead.negociacion.nombres} {perfilLead.negociacion.apellidos}
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-neutral-100 dark:border-neutral-800">
                  <span className="text-[#746B65] dark:text-[#B3ACA5]">Segmento:</span>
                  <span className="font-semibold text-[#42291F] dark:text-[#E8A46D]">
                    {perfilLead.negociacion.segmento_nombre || "No definido"}
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-neutral-100 dark:border-neutral-800">
                  <span className="text-[#746B65] dark:text-[#B3ACA5]">Plato Favorito:</span>
                  <span className="font-bold text-[#241E1A] dark:text-[#F5F3F0]">
                    {perfilLead.preferencias?.producto_favorito_declarado || "No registrado"}
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-neutral-100 dark:border-neutral-800">
                  <span className="text-[#746B65] dark:text-[#B3ACA5]">Compras previas:</span>
                  <span className="font-medium text-[#241E1A] dark:text-[#F5F3F0]">
                    {perfilLead.preferencias?.unidades_mas_comprado ? `${perfilLead.preferencias.unidades_mas_comprado} un.` : "0 compras"}
                  </span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-[#746B65] dark:text-[#B3ACA5]">Estado Neg.:</span>
                  <span className="font-bold px-2 py-0.5 rounded bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-400">
                    {perfilLead.negociacion.estado}
                  </span>
                </div>
              </div>
            )}

            {/* Accesos Rápidos del Agente */}
            <div className="pt-2 space-y-2">
              <p className="text-[10px] font-bold text-[#746B65] dark:text-[#B3ACA5] uppercase">
                Plantillas y Guiones de Conversión
              </p>
              <button
                onClick={() => aplicarSugerencia("¿Te gustaría que te reserve una mesa para hoy en nuestro local de Trujillo?")}
                className="w-full text-left p-2 rounded-lg bg-[#FAF8F5] dark:bg-[#121416] border border-[#E8E0D8] dark:border-[#383C40] hover:border-[#C96D35] text-[11px]"
              >
                📍 Ofrecer reserva de mesa
              </button>
              <button
                onClick={() => aplicarSugerencia("Aceptamos Yape, Plin, tarjeta y efectivo al momento de la entrega.")}
                className="w-full text-left p-2 rounded-lg bg-[#FAF8F5] dark:bg-[#121416] border border-[#E8E0D8] dark:border-[#383C40] hover:border-[#C96D35] text-[11px]"
              >
                💳 Confirmar medios de pago
              </button>
              <button
                onClick={() => aplicarSugerencia("Nuestro Combo Parrilla Familiar viene con 4 cortes y sangría a un precio súper especial de S/ 149.")}
                className="w-full text-left p-2 rounded-lg bg-[#FAF8F5] dark:bg-[#121416] border border-[#E8E0D8] dark:border-[#383C40] hover:border-[#C96D35] text-[11px]"
              >
                🥩 Ofrecer Parrilla Familiar
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
    <Suspense fallback={<div className="p-8 text-center text-xs text-[#746B65]">Cargando Agente Comercial IA...</div>}>
      <AgenteIAContent />
    </Suspense>
  );
}

