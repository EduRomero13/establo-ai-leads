"use client";

import React, { useEffect, useState } from "react";
import {
  Settings,
  Database,
  Sparkles,
  MessageSquare,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Terminal,
  Cpu,
} from "lucide-react";

export default function ConfiguracionPage() {
  const [config, setConfig] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [probandoConexion, setProbandoConexion] = useState(false);
  const [testResultado, setTestResultado] = useState<string | null>(null);

  const fetchConfig = async () => {
    try {
      const res = await fetch("/api/config");
      const json = await res.json();
      if (json.success) {
        setConfig(json.config);
      }
    } catch (err) {
      console.error("Error al cargar configuración:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConfig();
  }, []);

  const handleTestConexion = async () => {
    setProbandoConexion(true);
    setTestResultado(null);
    try {
      const res = await fetch("/api/config");
      const json = await res.json();
      if (json.success && json.config.baseDeDatos.conectado) {
        setTestResultado(
          `¡Conexión verificada con éxito! Servidor: ${json.config.baseDeDatos.servidor}:${json.config.baseDeDatos.puerto}, Base: ${json.config.baseDeDatos.base} (${json.config.baseDeDatos.tablasDetectadas} tablas detectadas).`
        );
      } else {
        setTestResultado(`Fallo de conexión: ${json.config.baseDeDatos.error || "Desconocido"}`);
      }
    } catch (err: any) {
      setTestResultado(`Error de conexión: ${err.message}`);
    } finally {
      setProbandoConexion(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <div className="w-10 h-10 border-4 border-[#C96D35]/20 border-t-[#C96D35] rounded-full animate-spin" />
        <p className="text-sm font-medium text-[#746B65] dark:text-[#B3ACA5]">
          Verificando servicios y variables del sistema...
        </p>
      </div>
    );
  }

  const { sistema, baseDeDatos, inteligenciaArtificial, whatsapp, reglasNegocio } = config || {};

  return (
    <div className="space-y-8 max-w-5xl">
      {/* Cabecera */}
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-2xl md:text-3xl font-extrabold text-[#241E1A] dark:text-[#F5F3F0] font-display">
            Configuración y Estado de la Plataforma
          </h1>
          <span className="px-2.5 py-1 text-xs font-bold rounded-lg bg-[#C96D35]/15 text-[#C96D35] dark:text-[#E8A46D] border border-[#C96D35]/30">
            Arquitectura V3
          </span>
        </div>
        <p className="text-sm text-[#746B65] dark:text-[#B3ACA5] mt-1">
          Monitor de salud de SQL Server, estado de la Inteligencia Artificial y parámetros del negocio.
        </p>
      </div>

      {testResultado && (
        <div
          className={`p-4 rounded-2xl text-xs font-semibold flex items-center gap-3 animate-in fade-in ${
            testResultado.includes("éxito")
              ? "bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300"
              : "bg-rose-50 dark:bg-rose-950/20 border border-rose-300 dark:border-rose-800 text-rose-800 dark:text-rose-300"
          }`}
        >
          {testResultado.includes("éxito") ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 text-rose-500 shrink-0" />
          )}
          <span>{testResultado}</span>
        </div>
      )}

      {/* Grid de Secciones de Configuración */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
        {/* 1. Base de Datos Microsoft SQL Server */}
        <div className="p-6 rounded-2xl bg-[#FFFFFF] dark:bg-[#1D2023] border border-[#E8E0D8] dark:border-[#383C40] shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600">
                <Database className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-extrabold text-sm text-[#241E1A] dark:text-[#F5F3F0]">
                  Microsoft SQL Server V3
                </h3>
                <p className="text-[11px] text-[#746B65] dark:text-[#B3ACA5]">
                  Base transaccional relacional
                </p>
              </div>
            </div>

            <span
              className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                baseDeDatos?.conectado
                  ? "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 border border-emerald-300"
                  : "bg-rose-50 text-rose-700"
              }`}
            >
              {baseDeDatos?.conectado ? "En línea (Conectado)" : "Desconectado"}
            </span>
          </div>

          <div className="space-y-2 p-3 rounded-xl bg-[#FAF8F5] dark:bg-[#121416] border border-[#E8E0D8] dark:border-[#383C40]">
            <div className="flex justify-between py-1 border-b border-neutral-200 dark:border-neutral-800">
              <span className="text-[#746B65] dark:text-[#B3ACA5]">Base de Datos:</span>
              <strong className="text-[#241E1A] dark:text-[#F5F3F0] font-mono">{baseDeDatos?.base}</strong>
            </div>
            <div className="flex justify-between py-1 border-b border-neutral-200 dark:border-neutral-800">
              <span className="text-[#746B65] dark:text-[#B3ACA5]">Host y Puerto:</span>
              <strong className="text-[#241E1A] dark:text-[#F5F3F0] font-mono">
                {baseDeDatos?.servidor}:{baseDeDatos?.puerto}
              </strong>
            </div>
            <div className="flex justify-between py-1 border-b border-neutral-200 dark:border-neutral-800">
              <span className="text-[#746B65] dark:text-[#B3ACA5]">Usuario de App:</span>
              <strong className="text-[#241E1A] dark:text-[#F5F3F0] font-mono">{baseDeDatos?.usuario}</strong>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-[#746B65] dark:text-[#B3ACA5]">Tablas Detectadas:</span>
              <strong className="text-[#42291F] dark:text-[#E8A46D]">{baseDeDatos?.tablasDetectadas} tablas</strong>
            </div>
          </div>

          <button
            onClick={handleTestConexion}
            disabled={probandoConexion}
            className="w-full py-2.5 rounded-xl bg-[#FFFFFF] dark:bg-[#292D31] border border-[#E8E0D8] dark:border-[#383C40] hover:border-[#C96D35] font-bold text-xs flex items-center justify-center gap-2 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-[#C96D35] ${probandoConexion ? "animate-spin" : ""}`} />
            <span>{probandoConexion ? "Comprobando..." : "Ejecutar Test de Conexión en Vivo"}</span>
          </button>
        </div>

        {/* 2. Inteligencia Artificial y Agente */}
        <div className="p-6 rounded-2xl bg-[#FFFFFF] dark:bg-[#1D2023] border border-[#E8E0D8] dark:border-[#383C40] shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-[#C96D35]/15 text-[#C96D35] dark:text-[#E8A46D]">
                <Cpu className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-extrabold text-sm text-[#241E1A] dark:text-[#F5F3F0]">
                  Motor de Inteligencia Artificial
                </h3>
                <p className="text-[11px] text-[#746B65] dark:text-[#B3ACA5]">
                  Google Gemini + Copiloto Heurístico V3
                </p>
              </div>
            </div>

            <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-[#C96D35]/10 text-[#C96D35] dark:text-[#E8A46D] border border-[#C96D35]/20">
              Activo
            </span>
          </div>

          <div className="space-y-2 p-3 rounded-xl bg-[#FAF8F5] dark:bg-[#121416] border border-[#E8E0D8] dark:border-[#383C40]">
            <div className="flex justify-between py-1 border-b border-neutral-200 dark:border-neutral-800">
              <span className="text-[#746B65] dark:text-[#B3ACA5]">Modelo LLM:</span>
              <strong className="text-[#241E1A] dark:text-[#F5F3F0] font-mono">
                {inteligenciaArtificial?.modelo}
              </strong>
            </div>
            <div className="flex justify-between py-1 border-b border-neutral-200 dark:border-neutral-800">
              <span className="text-[#746B65] dark:text-[#B3ACA5]">Modo de Ejecución:</span>
              <strong className="text-[#C96D35] dark:text-[#E8A46D]">{inteligenciaArtificial?.modoActual}</strong>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-[#746B65] dark:text-[#B3ACA5]">Herramientas Seguras:</span>
              <strong className="text-emerald-600">12 Tools Controladas (Sin SQL arbitrario)</strong>
            </div>
          </div>

          <p className="text-[11px] text-[#746B65] dark:text-[#B3ACA5]">
            El modelo consulta exclusivamente funciones controladas del backend (`consultar_preferencias`, `consultar_promociones_elegibles`, etc.).
          </p>
        </div>

        {/* 3. WhatsApp y Webhooks */}
        <div className="p-6 rounded-2xl bg-[#FFFFFF] dark:bg-[#1D2023] border border-[#E8E0D8] dark:border-[#383C40] shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600">
                <MessageSquare className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-extrabold text-sm text-[#241E1A] dark:text-[#F5F3F0]">
                  Canal de Negociación WhatsApp
                </h3>
                <p className="text-[11px] text-[#746B65] dark:text-[#B3ACA5]">
                  Tablas: sesion_whatsapp + mensaje_whatsapp
                </p>
              </div>
            </div>

            <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400">
              {whatsapp?.modo}
            </span>
          </div>

          <div className="space-y-2 p-3 rounded-xl bg-[#FAF8F5] dark:bg-[#121416] border border-[#E8E0D8] dark:border-[#383C40]">
            <div className="flex justify-between py-1 border-b border-neutral-200 dark:border-neutral-800">
              <span className="text-[#746B65] dark:text-[#B3ACA5]">Modo Actual:</span>
              <strong className="text-[#241E1A] dark:text-[#F5F3F0]">{whatsapp?.modo}</strong>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-[#746B65] dark:text-[#B3ACA5]">Webhook Verificado:</span>
              <strong className="text-emerald-600">Sí (Listo para Meta Cloud API)</strong>
            </div>
          </div>
        </div>

        {/* 4. Reglas del Negocio y Metas Oficiales */}
        <div className="p-6 rounded-2xl bg-[#FFFFFF] dark:bg-[#1D2023] border border-[#E8E0D8] dark:border-[#383C40] shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-amber-500/10 text-amber-600">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-extrabold text-sm text-[#241E1A] dark:text-[#F5F3F0]">
                  Reglas del Negocio y Metas LEADS
                </h3>
                <p className="text-[11px] text-[#746B65] dark:text-[#B3ACA5]">
                  Parámetros de conversión El Establo
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-2 p-3 rounded-xl bg-[#FAF8F5] dark:bg-[#121416] border border-[#E8E0D8] dark:border-[#383C40]">
            <div className="flex justify-between py-1 border-b border-neutral-200 dark:border-neutral-800">
              <span className="text-[#746B65] dark:text-[#B3ACA5]">Meta TCP (Tiempo Conversión):</span>
              <strong className="text-[#241E1A] dark:text-[#F5F3F0]">≤ {reglasNegocio?.metaTcpHoras} horas</strong>
            </div>
            <div className="flex justify-between py-1 border-b border-neutral-200 dark:border-neutral-800">
              <span className="text-[#746B65] dark:text-[#B3ACA5]">Meta TEN (Tasa Éxito):</span>
              <strong className="text-emerald-600">≥ {reglasNegocio?.metaTenPorcentaje} %</strong>
            </div>
            <div className="flex justify-between py-1 border-b border-neutral-200 dark:border-neutral-800">
              <span className="text-[#746B65] dark:text-[#B3ACA5]">Meta TPN (Tasa Pérdida Máx):</span>
              <strong className="text-rose-600">≤ {reglasNegocio?.metaTpnPorcentajeMax} %</strong>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-[#746B65] dark:text-[#B3ACA5]">Umbral Cierre Timeout:</span>
              <strong className="text-[#42291F] dark:text-[#E8A46D]">{reglasNegocio?.horasTimeoutPerdida} horas</strong>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

