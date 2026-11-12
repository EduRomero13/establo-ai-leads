"use client";

import React, { useEffect, useState, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import {
  FlaskConical,
  Bot,
  CheckCircle2,
  AlertTriangle,
  Send,
  CreditCard,
  Play,
  RotateCcw,
  Clock,
  Target,
} from "lucide-react";

function LaboratorioContent() {
  const searchParams = useSearchParams();
  const casoUrl = searchParams.get("caso");

  // Estado principal
  const [perfiles, setPerfiles] = useState<any[]>([]);
  const [escenarios, setEscenarios] = useState<any[]>([]);
  const [perfilSeleccionado, setPerfilSeleccionado] = useState<any>(null);
  const [escenarioSeleccionado, setEscenarioSeleccionado] = useState<any>(null);

  // Reloj simulado e interactividad
  const [relojHoras, setRelojHoras] = useState<number>(0);
  const [mensajesChat, setMensajesChat] = useState<{ remitente: "lead" | "agente"; texto: string; hora: string }[]>([]);
  const [inputMensaje, setInputMensaje] = useState("");
  const [cargandoRespuesta, setCargandoRespuesta] = useState(false);
  const [telemetriaUltima, setTelemetriaUltima] = useState<any>(null);
  const [pagoConfirmadoDemo, setPagoConfirmadoDemo] = useState(false);

  const [estadosEscenarios, setEstadosEscenarios] = useState<Record<string, "pendiente" | "ejecutando" | "aprobado">>({});

  const chatContainerRef = useRef<HTMLDivElement>(null);

  // Cargar datos iniciales del backend
  const fetchDatosLaboratorio = async () => {
    try {
      const res = await fetch("/api/laboratorio");
      const data = await res.json();
      if (data.success) {
        setPerfiles(data.perfiles || []);
        setEscenarios(data.escenarios || []);

        if (data.perfiles?.length > 0) {
          const inicial = casoUrl
            ? data.perfiles.find((p: any) => p.claveDemo === casoUrl) || data.perfiles[0]
            : data.perfiles[0];
          setPerfilSeleccionado(inicial);
        }

        if (data.escenarios?.length > 0) {
          setEscenarioSeleccionado(data.escenarios[0]);
          setInputMensaje(data.escenarios[0].promptSugerido || "");
        }
      }
    } catch (err) {
      console.error("Error al cargar datos del laboratorio:", err);
    }
  };

  useEffect(() => {
    fetchDatosLaboratorio();
  }, [casoUrl]);

  // Al cambiar de escenario, actualizar prompt sugerido
  const handleSeleccionarEscenario = (esc: any) => {
    setEscenarioSeleccionado(esc);
    setInputMensaje(esc.promptSugerido || "");

    // Si el escenario sugiere un perfil específico, autoseleccionarlo
    if (esc.perfilSugerido) {
      const pSugerido = perfiles.find((p) => p.claveDemo === esc.perfilSugerido);
      if (pSugerido) {
        setPerfilSeleccionado(pSugerido);
        // Reiniciar chat para aislamiento de prueba
        setMensajesChat([]);
        setPagoConfirmadoDemo(false);
        setTelemetriaUltima(null);
      }
    }
  };

  // Ejecutar un escenario en un solo clic para demostración inmediata
  const handleEjecutarEscenario = async (esc: any) => {
    handleSeleccionarEscenario(esc);
    setEstadosEscenarios((prev) => ({ ...prev, [esc.id]: "ejecutando" }));

    try {
      if (esc.id === "CONVERSION_PAGO") {
        await handleSimularPago();
        setEstadosEscenarios((prev) => ({ ...prev, [esc.id]: "aprobado" }));
        return;
      }

      if (esc.id === "SEGUIMIENTO_RELOJ") {
        setRelojHoras(48);
      }

      const prompt = esc.promptSugerido || "Hola, ¿qué me recomiendas?";
      await handleEnviarMensaje(prompt);
      setEstadosEscenarios((prev) => ({ ...prev, [esc.id]: "aprobado" }));
    } catch (err) {
      console.error("Error probando escenario:", err);
      setEstadosEscenarios((prev) => ({ ...prev, [esc.id]: "pendiente" }));
    }
  };

  // Al cambiar de perfil manualmente
  const handleCambiarPerfil = (clave: string) => {
    const p = perfiles.find((item) => item.claveDemo === clave);
    if (p) {
      setPerfilSeleccionado(p);
      setMensajesChat([]);
      setPagoConfirmadoDemo(false);
      setTelemetriaUltima(null);
      setRelojHoras(0);
    }
  };

  // Scroll automático dentro de la ventana de chat sin mover el scroll de la página principal
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTo({
        top: chatContainerRef.current.scrollHeight,
        behavior: "smooth",
      });
    }
  }, [mensajesChat, cargandoRespuesta]);

  // Ejecutar envío de mensaje en la simulación
  const handleEnviarMensaje = async (textoPersonalizado?: string) => {
    const texto = textoPersonalizado || inputMensaje;
    if (!texto.trim() || !perfilSeleccionado || cargandoRespuesta) return;

    const ahora = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    const nuevoHistorial = [...mensajesChat, { remitente: "lead" as const, texto, hora: ahora }];
    setMensajesChat(nuevoHistorial);
    setInputMensaje("");
    setCargandoRespuesta(true);

    try {
      const res = await fetch("/api/laboratorio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          idPersona: perfilSeleccionado.id_persona,
          idNegociacion: perfilSeleccionado.id_negociacion,
          scenarioId: escenarioSeleccionado?.id,
          mensajeCliente: texto,
          relojHorasSimuladas: relojHoras,
          simularPago: false,
          historialChat: nuevoHistorial,
        }),
      });

      const data = await res.json();
      if (data.success) {
        const horaAgente = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
        setMensajesChat((prev) => [
          ...prev,
          { remitente: "agente" as const, texto: data.respuesta, hora: horaAgente },
        ]);
        setTelemetriaUltima(data.telemetria);
      }
    } catch (err) {
      console.error("Error al procesar mensaje en laboratorio:", err);
    } finally {
      setCargandoRespuesta(false);
    }
  };

  // Simular confirmación de pago
  const handleSimularPago = async () => {
    if (!perfilSeleccionado || cargandoRespuesta) return;
    setCargandoRespuesta(true);

    try {
      const res = await fetch("/api/laboratorio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          idPersona: perfilSeleccionado.id_persona,
          idNegociacion: perfilSeleccionado.id_negociacion,
          simularPago: true,
          relojHorasSimuladas: relojHoras,
        }),
      });

      const data = await res.json();
      if (data.success) {
        const hora = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
        setMensajesChat((prev) => [
          ...prev,
          { remitente: "agente" as const, texto: data.respuesta, hora },
        ]);
        setTelemetriaUltima(data.telemetria);
        setPagoConfirmadoDemo(true);
      }
    } catch (err) {
      console.error("Error simulando pago:", err);
    } finally {
      setCargandoRespuesta(false);
    }
  };

  // Resetear sesión de prueba
  const handleResetPrueba = () => {
    setMensajesChat([]);
    setTelemetriaUltima(null);
    setPagoConfirmadoDemo(false);
    setRelojHoras(0);
    setEstadosEscenarios({});
    if (escenarioSeleccionado) {
      setInputMensaje(escenarioSeleccionado.promptSugerido || "");
    }
  };

  const aprobados = Object.values(estadosEscenarios).filter((e) => e === "aprobado").length;
  const fase = pagoConfirmadoDemo ? "PAYER" : perfilSeleccionado?.fase_actual || "LEAD";
  const riesgo =
    relojHoras >= 72 ? { t: "Crítico", c: "bg-red-500/15 text-red-600" }
    : relojHoras >= 48 ? { t: "Alto", c: "bg-amber-500/15 text-amber-600" }
    : relojHoras >= 24 ? { t: "Medio", c: "bg-amber-500/10 text-amber-600" }
    : { t: "Bajo", c: "bg-emerald-500/15 text-emerald-600" };

  const card = "rounded-2xl bg-[#FFFFFF] dark:bg-[#1D2023] border border-[#E8E0D8] dark:border-[#383C40]";
  const label = "text-[10px] font-bold uppercase tracking-wider text-[#746B65] dark:text-[#B3ACA5]";

  return (
    <div className="space-y-4">
      {/* Cabecera minimalista */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h1 className="text-xl md:text-2xl font-extrabold text-[#241E1A] dark:text-[#F5F3F0] font-display">
            Laboratorio IA
          </h1>
          <span className="px-2 py-0.5 text-[10px] font-bold rounded-md bg-[#C96D35]/10 text-[#C96D35] border border-[#C96D35]/20">
            Sandbox
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-[#746B65] dark:text-[#B3ACA5]">
            <span className="text-emerald-600 font-bold">{aprobados}</span>/{escenarios.length || 10} aprobados
          </span>
          <button
            onClick={handleResetPrueba}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-[#FFFFFF] dark:bg-[#1D2023] border border-[#E8E0D8] dark:border-[#383C40] text-[#746B65] dark:text-[#B3ACA5] hover:text-[#C96D35] transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Reiniciar</span>
          </button>
        </div>
      </div>

      {/* Escenarios como chips compactos */}
      <div className={`${card} p-3`}>
        <div className="flex flex-wrap gap-1.5">
          {escenarios.map((esc) => {
            const isSelected = escenarioSeleccionado?.id === esc.id;
            const estado = estadosEscenarios[esc.id] || "pendiente";
            return (
              <button
                key={esc.id}
                type="button"
                onClick={() => handleEjecutarEscenario(esc)}
                disabled={cargandoRespuesta}
                title={esc.descripcion}
                className={`group flex items-center gap-1.5 pl-1.5 pr-2.5 py-1 rounded-full border text-[11px] font-semibold transition-all disabled:opacity-60 ${
                  isSelected
                    ? "bg-[#C96D35] border-[#C96D35] text-white"
                    : "bg-[#FAF8F5] dark:bg-[#121416] border-[#E8E0D8] dark:border-[#383C40] text-[#241E1A] dark:text-[#F5F3F0] hover:border-[#C96D35]"
                }`}
              >
                <span
                  className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                    estado === "aprobado"
                      ? "bg-emerald-500 text-white"
                      : isSelected
                      ? "bg-white/20 text-white"
                      : "bg-[#E8E0D8] dark:bg-[#292D31] text-[#746B65]"
                  }`}
                >
                  {estado === "aprobado" ? (
                    <CheckCircle2 className="w-3 h-3" />
                  ) : estado === "ejecutando" ? (
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping" />
                  ) : (
                    esc.numero
                  )}
                </span>
                {esc.titulo}
              </button>
            );
          })}
        </div>
      </div>

      {/* Workspace: Configuración | Chat | Resultado */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Columna izquierda: perfil + reloj + pago */}
        <div className={`${card} lg:col-span-3 p-3.5 space-y-4`}>
          <div className="space-y-1.5">
            <span className={label}>Cliente simulado</span>
            <div className="grid grid-cols-2 gap-1.5">
              {perfiles.map((p) => {
                const isSelected = perfilSeleccionado?.claveDemo === p.claveDemo;
                return (
                  <button
                    key={p.claveDemo}
                    onClick={() => handleCambiarPerfil(p.claveDemo)}
                    className={`px-2 py-1.5 rounded-lg text-left border text-xs transition-all ${
                      isSelected
                        ? "bg-[#C96D35]/10 border-[#C96D35] text-[#42291F] dark:text-[#E8A46D] font-bold"
                        : "bg-[#FAF8F5] dark:bg-[#121416] border-[#E8E0D8] dark:border-[#383C40] text-[#746B65] dark:text-[#B3ACA5] hover:border-[#C96D35]/50"
                    }`}
                  >
                    <p className="truncate font-semibold">{p.nombres}</p>
                    <span className="text-[10px] opacity-75 truncate block">{p.segmento_nombre || "General"}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {perfilSeleccionado && (
            <div className="p-2.5 rounded-xl bg-[#FAF8F5] dark:bg-[#121416] border border-[#E8E0D8] dark:border-[#383C40] space-y-1 text-[11px]">
              <div className="flex justify-between">
                <span className="text-[#746B65]">Favorito</span>
                <span className="font-semibold text-[#241E1A] dark:text-[#F5F3F0] truncate ml-2">
                  {perfilSeleccionado.producto_favorito_declarado || "—"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#746B65]">Fase</span>
                <span className={`font-bold px-1.5 rounded text-[10px] ${fase === "PAYER" ? "bg-emerald-500/15 text-emerald-600" : "bg-blue-500/15 text-blue-600"}`}>
                  {fase}
                </span>
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className={`${label} flex items-center gap-1`}>
                <Clock className="w-3 h-3" /> Reloj
              </span>
              <span className="text-[10px] font-bold text-[#C96D35]">+{relojHoras}h</span>
            </div>
            <div className="grid grid-cols-4 gap-1">
              {[0, 24, 48, 72].map((h) => (
                <button
                  key={h}
                  onClick={() => setRelojHoras(h)}
                  className={`py-1 text-[11px] font-bold rounded-md border transition-colors ${
                    relojHoras === h
                      ? "bg-[#C96D35] text-white border-[#C96D35]"
                      : "bg-[#FAF8F5] dark:bg-[#121416] text-[#746B65] border-[#E8E0D8] dark:border-[#383C40] hover:border-[#C96D35]/50"
                  }`}
                >
                  {h}h
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={handleSimularPago}
            disabled={cargandoRespuesta}
            className={`w-full py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors disabled:opacity-60 ${
              pagoConfirmadoDemo
                ? "bg-emerald-600 text-white"
                : "bg-[#241E1A] dark:bg-[#E8A46D] text-white dark:text-[#241E1A] hover:bg-[#C96D35]"
            }`}
          >
            <CreditCard className="w-3.5 h-3.5" />
            {pagoConfirmadoDemo ? "Convertido a PAYER" : "Simular pago"}
          </button>
        </div>

        {/* Columna central: chat */}
        <div className={`${card} lg:col-span-6 flex flex-col overflow-hidden`}>
          <div className="px-4 py-2.5 border-b border-[#E8E0D8] dark:border-[#383C40] flex items-center justify-between bg-[#FAF8F5] dark:bg-[#121416]/50">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-[#C96D35] text-white flex items-center justify-center">
                <Bot className="w-3.5 h-3.5" />
              </div>
              <div>
                <p className="text-xs font-bold text-[#241E1A] dark:text-[#F5F3F0]">Agente Establo</p>
                <p className="text-[10px] text-[#746B65]">con {perfilSeleccionado?.nombres || "—"}</p>
              </div>
            </div>
            {escenarioSeleccionado && (
              <span className="text-[10px] font-semibold text-[#746B65] dark:text-[#B3ACA5]">
                Escenario #{escenarioSeleccionado.numero}
              </span>
            )}
          </div>

          <div
            ref={chatContainerRef}
            className="flex-1 p-4 overflow-y-auto space-y-2.5 bg-[#FAF8F5]/40 dark:bg-[#121416]/20 h-[420px]"
          >
            {mensajesChat.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center text-[#746B65]">
                <FlaskConical className="w-8 h-8 mb-2 text-[#C96D35]/50" />
                <p className="text-xs font-semibold">Elige un escenario o escribe un mensaje</p>
                {escenarioSeleccionado?.promptSugerido && (
                  <button
                    onClick={() => handleEnviarMensaje(escenarioSeleccionado.promptSugerido)}
                    className="mt-3 px-3 py-1.5 rounded-lg bg-[#C96D35] text-white text-xs font-bold hover:bg-[#B65F29] transition-colors flex items-center gap-1"
                  >
                    <Play className="w-3 h-3 fill-current" />
                    Probar
                  </button>
                )}
              </div>
            ) : (
              mensajesChat.map((m, idx) => {
                const esAgente = m.remitente === "agente";
                return (
                  <div key={idx} className={`flex flex-col ${esAgente ? "items-start" : "items-end"}`}>
                    <div
                      className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-xs leading-relaxed whitespace-pre-line ${
                        esAgente
                          ? "bg-[#FFFFFF] dark:bg-[#1D2023] border border-[#E8E0D8] dark:border-[#383C40] text-[#241E1A] dark:text-[#F5F3F0]"
                          : "bg-gradient-to-r from-[#C96D35] to-[#B65F29] text-white"
                      }`}
                    >
                      {m.texto}
                    </div>
                    <span className="text-[9px] text-[#746B65] mt-0.5 px-1">{m.hora}</span>
                  </div>
                );
              })
            )}

            {cargandoRespuesta && (
              <div className="flex items-center gap-1 px-3 py-2 bg-[#FFFFFF] dark:bg-[#1D2023] border border-[#E8E0D8] dark:border-[#383C40] rounded-2xl w-fit">
                <span className="w-1.5 h-1.5 rounded-full bg-[#C96D35] animate-bounce" />
                <span className="w-1.5 h-1.5 rounded-full bg-[#C96D35] animate-bounce [animation-delay:0.2s]" />
                <span className="w-1.5 h-1.5 rounded-full bg-[#C96D35] animate-bounce [animation-delay:0.4s]" />
              </div>
            )}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleEnviarMensaje();
            }}
            className="p-2.5 border-t border-[#E8E0D8] dark:border-[#383C40] flex items-center gap-1.5"
          >
            <input
              type="text"
              value={inputMensaje}
              onChange={(e) => setInputMensaje(e.target.value)}
              placeholder="Escribe como cliente..."
              className="flex-1 px-3.5 py-2 rounded-xl text-xs bg-[#FAF8F5] dark:bg-[#121416] border border-[#E8E0D8] dark:border-[#383C40] text-[#241E1A] dark:text-[#F5F3F0] focus:outline-none focus:border-[#C96D35]"
            />
            <button
              type="submit"
              disabled={!inputMensaje.trim() || cargandoRespuesta}
              className="px-3.5 py-2 rounded-xl bg-[#C96D35] hover:bg-[#B65F29] text-white disabled:opacity-50 transition-colors"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </form>
        </div>

        {/* Columna derecha: resultado del agente */}
        <div className={`${card} lg:col-span-3 p-3.5 space-y-3`}>
          <span className={label}>Lo que detectó la IA</span>

          <div className="space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-[#746B65]">Intención</span>
              <span className="font-bold text-[#42291F] dark:text-[#E8A46D] text-[11px] text-right">
                {telemetriaUltima?.intencionDetectada?.replace(/_/g, " ") || "—"}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[#746B65]">Objeción</span>
              {telemetriaUltima?.objecionDetectada ? (
                <span className="inline-flex items-center gap-1 font-bold text-amber-600 text-[11px]">
                  <AlertTriangle className="w-3 h-3" />
                  {telemetriaUltima.objecionDetectada.replace(/_/g, " ")}
                </span>
              ) : (
                <span className="text-[11px] text-[#746B65]">Ninguna</span>
              )}
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[#746B65]">Riesgo abandono</span>
              <span className={`font-bold px-1.5 py-0.5 rounded text-[10px] ${riesgo.c}`}>{riesgo.t}</span>
            </div>
            {telemetriaUltima?.preferenciaUtilizada && (
              <div className="flex items-center justify-between">
                <span className="text-[#746B65]">Usó preferencia</span>
                <span className="font-semibold text-[11px] text-[#241E1A] dark:text-[#F5F3F0] truncate ml-2">
                  {telemetriaUltima.preferenciaUtilizada}
                </span>
              </div>
            )}
            {telemetriaUltima?.evento === "PRIMER_PAGO_CONFIRMADO" && (
              <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/25 text-[11px] font-bold text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5" />
                LEAD → PAYER (S/ {telemetriaUltima.montoPago?.toFixed(2)})
              </div>
            )}
          </div>

          {escenarioSeleccionado?.criterioExito && (
            <div className="pt-3 border-t border-[#E8E0D8] dark:border-[#383C40] space-y-1">
              <span className={`${label} flex items-center gap-1`}>
                <Target className="w-3 h-3" /> Debe lograr
              </span>
              <p className="text-[11px] text-[#241E1A] dark:text-[#F5F3F0] leading-snug">
                {escenarioSeleccionado.criterioExito}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function LaboratorioPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-xs text-[#746B65]">Cargando Laboratorio...</div>}>
      <LaboratorioContent />
    </Suspense>
  );
}
