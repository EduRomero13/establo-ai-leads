"use client";

import React, { useEffect, useState, use } from "react";
import Link from "next/link";
import {
  User,
  Heart,
  History,
  MessageSquare,
  Gift,
  CreditCard,
  ShieldCheck,
  ChevronLeft,
  Calendar,
  Phone,
  Mail,
  Flame,
  CheckCircle,
  XCircle,
  Clock,
  Sparkles,
  ArrowRight,
  Receipt,
  UserCheck,
} from "lucide-react";
import { formatCurrency, formatDate, formatDateOnly, formatHours } from "@/lib/utils";

export default function LeadPerfil360Page({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const idNegociacion = resolvedParams.id;

  const [perfil, setPerfil] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadPerfil() {
      setLoading(true);
      try {
        const res = await fetch(`/api/leads/${idNegociacion}`);
        const data = await res.json();
        if (data.success) {
          setPerfil(data.perfil);
        } else {
          setError(data.error || "Error al cargar perfil");
        }
      } catch (err: any) {
        setError(err.message || "Error al conectar con la API");
      } finally {
        setLoading(false);
      }
    }
    loadPerfil();
  }, [idNegociacion]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <div className="w-10 h-10 border-4 border-[#C96D35]/20 border-t-[#C96D35] rounded-full animate-spin" />
        <p className="text-sm font-medium text-[#746B65] dark:text-[#B3ACA5]">
          Generando Ficha Comercial 360° desde SQL Server...
        </p>
      </div>
    );
  }

  if (error || !perfil) {
    return (
      <div className="p-6 rounded-2xl bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/40 text-rose-800 dark:text-rose-200">
        <h3 className="font-bold text-base flex items-center gap-2">
          <XCircle className="w-5 h-5" /> Error al consultar el lead
        </h3>
        <p className="text-sm mt-1">{error}</p>
        <Link
          href="/leads"
          className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#C96D35] text-white text-xs font-semibold"
        >
          <ChevronLeft className="w-4 h-4" /> Volver a Leads
        </Link>
      </div>
    );
  }

  const { negociacion, preferencias, formularios = [], recurrencia, conversaciones = [], ofertas = [], conversion, acciones = [] } = perfil;
  const esConvertida = negociacion.estado === "CONVERTIDA";
  const esPerdida = negociacion.estado === "PERDIDA";
  const esAbierta = negociacion.estado === "ABIERTA";

  return (
    <div className="space-y-6">
      {/* Botón de regreso y encabezado */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            href="/leads"
            className="p-2 rounded-xl bg-[#FFFFFF] dark:bg-[#1D2023] border border-[#E8E0D8] dark:border-[#383C40] text-[#746B65] dark:text-[#B3ACA5] hover:text-[#C96D35] transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl md:text-3xl font-extrabold text-[#241E1A] dark:text-[#F5F3F0] font-display">
                {negociacion.nombres} {negociacion.apellidos}
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#C96D35]/15 text-[#C96D35] dark:text-[#E8A46D] border border-[#C96D35]/20">
                Ciclo #{negociacion.nro_ciclo}
              </span>
            </div>
            <p className="text-xs text-[#746B65] dark:text-[#B3ACA5] mt-0.5">
              Identificador Negociación #{negociacion.id_negociacion} • Persona ID #{negociacion.id_persona}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href={`/agente?negociacionId=${negociacion.id_negociacion}`}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-[#C96D35] hover:bg-[#B65F29] text-white shadow-sm shadow-[#C96D35]/30 transition-colors"
          >
            <Sparkles className="w-4 h-4" />
            <span>Atender en Agente IA</span>
          </Link>
        </div>
      </div>

      {/* Grid de las 7 Secciones del Perfil 360° */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Columna Izquierda: Personal, Preferencias y Recurrencia */}
        <div className="space-y-6">
          {/* 1. Información Personal */}
          <div className="p-5 rounded-2xl bg-[#FFFFFF] dark:bg-[#1D2023] border border-[#E8E0D8] dark:border-[#383C40] shadow-sm">
            <h3 className="font-bold text-sm text-[#241E1A] dark:text-[#F5F3F0] flex items-center gap-2 pb-3 border-b border-[#E8E0D8] dark:border-[#383C40]">
              <User className="w-4 h-4 text-[#C96D35]" />
              <span>1. Información Personal</span>
            </h3>

            <div className="mt-4 space-y-3 text-xs">
              <div className="flex justify-between py-1 border-b border-neutral-100 dark:border-neutral-800">
                <span className="text-[#746B65] dark:text-[#B3ACA5]">Fase Actual:</span>
                <span className="font-extrabold px-2 py-0.5 rounded bg-amber-500/10 text-amber-700 dark:text-amber-400">
                  {negociacion.fase_actual}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-neutral-100 dark:border-neutral-800">
                <span className="text-[#746B65] dark:text-[#B3ACA5]">Segmento:</span>
                <span className="font-bold text-[#241E1A] dark:text-[#F5F3F0]">
                  {negociacion.segmento_nombre || "No registrado"}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-neutral-100 dark:border-neutral-800">
                <span className="text-[#746B65] dark:text-[#B3ACA5]">Teléfono:</span>
                <span className="font-medium text-[#241E1A] dark:text-[#F5F3F0]">
                  {negociacion.telefono || "No registrado"}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-neutral-100 dark:border-neutral-800">
                <span className="text-[#746B65] dark:text-[#B3ACA5]">Email:</span>
                <span className="font-medium text-[#241E1A] dark:text-[#F5F3F0]">
                  {negociacion.email || "No registrado"}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-neutral-100 dark:border-neutral-800">
                <span className="text-[#746B65] dark:text-[#B3ACA5]">Cumpleaños:</span>
                <span className="font-medium text-[#241E1A] dark:text-[#F5F3F0]">
                  {formatDateOnly(negociacion.fecha_nacimiento)}
                </span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-[#746B65] dark:text-[#B3ACA5]">Registro Inicial:</span>
                <span className="font-medium text-[#241E1A] dark:text-[#F5F3F0]">
                  {formatDate(negociacion.fecha_registro)}
                </span>
              </div>
            </div>
          </div>

          {/* 2. Preferencias Gastronómicas */}
          <div className="p-5 rounded-2xl bg-[#FFFFFF] dark:bg-[#1D2023] border border-[#E8E0D8] dark:border-[#383C40] shadow-sm">
            <h3 className="font-bold text-sm text-[#241E1A] dark:text-[#F5F3F0] flex items-center gap-2 pb-3 border-b border-[#E8E0D8] dark:border-[#383C40]">
              <Heart className="w-4 h-4 text-rose-500" />
              <span>2. Preferencias Gastronómicas</span>
            </h3>

            <div className="mt-4 space-y-3 text-xs">
              <div className="p-3 rounded-xl bg-[#FAF8F5] dark:bg-[#121416] border border-[#E8E0D8] dark:border-[#383C40]">
                <p className="text-[11px] font-bold text-[#746B65] dark:text-[#B3ACA5] uppercase">
                  Favorito Declarado (Formulario)
                </p>
                <p className="font-extrabold text-sm text-[#42291F] dark:text-[#E8A46D] mt-0.5">
                  {preferencias?.producto_favorito_declarado || "No registrado"}
                </p>
              </div>

              <div className="p-3 rounded-xl bg-[#FAF8F5] dark:bg-[#121416] border border-[#E8E0D8] dark:border-[#383C40]">
                <p className="text-[11px] font-bold text-[#746B65] dark:text-[#B3ACA5] uppercase">
                  Más Comprado Histórico
                </p>
                <p className="font-extrabold text-sm text-[#241E1A] dark:text-[#F5F3F0] mt-0.5">
                  {preferencias?.nombre_mas_comprado || "Sin compras previas"}
                </p>
                {preferencias?.unidades_mas_comprado && (
                  <p className="text-[11px] text-[#746B65] dark:text-[#B3ACA5] mt-0.5">
                    {preferencias.unidades_mas_comprado} unidades adquiridas en ciclos anteriores
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* 3. Historial de Fases y Recurrencia */}
          <div className="p-5 rounded-2xl bg-[#FFFFFF] dark:bg-[#1D2023] border border-[#E8E0D8] dark:border-[#383C40] shadow-sm">
            <h3 className="font-bold text-sm text-[#241E1A] dark:text-[#F5F3F0] flex items-center gap-2 pb-3 border-b border-[#E8E0D8] dark:border-[#383C40]">
              <History className="w-4 h-4 text-blue-500" />
              <span>3. Historial y Recurrencia</span>
            </h3>

            <div className="mt-4 space-y-3 text-xs">
              <p className="text-[11px] text-[#746B65] dark:text-[#B3ACA5]">
                Veces alcanzada cada fase comercial:
              </p>
              <div className="grid grid-cols-2 gap-2">
                {recurrencia?.vecesFase?.map((vf: any) => (
                  <div
                    key={vf.fase}
                    className="p-2.5 rounded-xl bg-[#FAF8F5] dark:bg-[#121416] border border-[#E8E0D8] dark:border-[#383C40] text-center"
                  >
                    <span className="text-[10px] font-bold text-[#746B65] dark:text-[#B3ACA5] uppercase">
                      {vf.fase}
                    </span>
                    <p className="text-lg font-black text-[#241E1A] dark:text-[#F5F3F0]">
                      {vf.veces} {vf.veces === 1 ? "vez" : "veces"}
                    </p>
                  </div>
                ))}
              </div>

              <div className="pt-2">
                <p className="text-[11px] font-bold text-[#746B65] dark:text-[#B3ACA5] uppercase mb-1">
                  Ciclos de Negociación Previos:
                </p>
                <div className="space-y-1.5">
                  {recurrencia?.todasNegociaciones?.map((neg: any) => (
                    <div
                      key={neg.id_negociacion}
                      className="p-2 rounded-lg bg-[#FAF8F5] dark:bg-[#121416] border border-[#E8E0D8] dark:border-[#383C40] flex items-center justify-between text-[11px]"
                    >
                      <div>
                        <span className="font-bold">Ciclo #{neg.nro_ciclo}</span>
                        <span className="text-[#746B65] dark:text-[#B3ACA5] ml-2">
                          {formatDateOnly(neg.fecha_inicio)}
                        </span>
                      </div>
                      <span
                        className={`px-1.5 py-0.5 rounded font-extrabold text-[10px] ${
                          neg.estado === "CONVERTIDA"
                            ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400"
                            : neg.estado === "PERDIDA"
                            ? "bg-rose-50 text-rose-700 dark:bg-rose-950/30 dark:text-rose-400"
                            : "bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400"
                        }`}
                      >
                        {neg.estado}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Columna Centro y Derecha: Conversaciones, Ofertas, Conversión y Auditoría */}
        <div className="lg:col-span-2 space-y-6">
          {/* Estado del Ciclo Actual */}
          <div className="p-4 rounded-2xl bg-[#FFFFFF] dark:bg-[#1D2023] border border-[#E8E0D8] dark:border-[#383C40] flex items-center justify-between">
            <div className="flex items-center gap-3">
              {esConvertida && <CheckCircle className="w-6 h-6 text-emerald-500" />}
              {esPerdida && <XCircle className="w-6 h-6 text-rose-500" />}
              {esAbierta && <Clock className="w-6 h-6 text-blue-500 animate-pulse" />}
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-[#746B65] dark:text-[#B3ACA5]">
                  Situación de esta Negociación
                </p>
                <h4 className="text-base font-extrabold text-[#241E1A] dark:text-[#F5F3F0]">
                  Estado: {negociacion.estado}
                  {negociacion.motivo_perdida && ` (Motivo: ${negociacion.motivo_perdida})`}
                </h4>
              </div>
            </div>
            {negociacion.resumen && (
              <p className="text-xs text-[#746B65] dark:text-[#B3ACA5] max-w-xs text-right hidden sm:block italic">
                "{negociacion.resumen}"
              </p>
            )}
          </div>

          {/* 4. Conversaciones WhatsApp */}
          <div className="p-5 rounded-2xl bg-[#FFFFFF] dark:bg-[#1D2023] border border-[#E8E0D8] dark:border-[#383C40] shadow-sm">
            <div className="flex items-center justify-between pb-3 border-b border-[#E8E0D8] dark:border-[#383C40]">
              <h3 className="font-bold text-sm text-[#241E1A] dark:text-[#F5F3F0] flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-[#C96D35]" />
                <span>4. Conversaciones Comerciales (WhatsApp)</span>
              </h3>
              <span className="text-xs text-[#746B65] dark:text-[#B3ACA5]">
                {conversaciones.length} mensajes registrados
              </span>
            </div>

            <div className="mt-4 space-y-3 max-h-80 overflow-y-auto pr-2">
              {conversaciones.length === 0 ? (
                <p className="text-xs text-[#746B65] dark:text-[#B3ACA5] py-6 text-center italic">
                  No hay mensajes registrados en esta sesión de WhatsApp.
                </p>
              ) : (
                conversaciones.map((msg: any) => {
                  const esEntrante = msg.direccion === "ENTRANTE";
                  return (
                    <div
                      key={msg.id_mensaje}
                      className={`flex flex-col ${esEntrante ? "items-start" : "items-end"}`}
                    >
                      <div
                        className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-xs shadow-sm ${
                          esEntrante
                            ? "bg-[#FAF8F5] dark:bg-[#121416] border border-[#E8E0D8] dark:border-[#383C40] text-[#241E1A] dark:text-[#F5F3F0]"
                            : "bg-[#C96D35] text-white"
                        }`}
                      >
                        <p className="leading-relaxed whitespace-pre-wrap">{msg.contenido}</p>
                        {msg.opcion_seleccionada && (
                          <span className="inline-block mt-1.5 px-2 py-0.5 rounded bg-black/20 text-[10px] font-bold">
                            Opción: {msg.opcion_seleccionada}
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-[#746B65] dark:text-[#B3ACA5] mt-1 px-1">
                        {esEntrante ? "Cliente" : "Agente Establo"} • {formatDate(msg.fecha_mensaje)}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* 5. Recomendaciones y Ofertas Registradas */}
          <div className="p-5 rounded-2xl bg-[#FFFFFF] dark:bg-[#1D2023] border border-[#E8E0D8] dark:border-[#383C40] shadow-sm">
            <h3 className="font-bold text-sm text-[#241E1A] dark:text-[#F5F3F0] flex items-center gap-2 pb-3 border-b border-[#E8E0D8] dark:border-[#383C40]">
              <Gift className="w-4 h-4 text-amber-500" />
              <span>5. Recomendaciones y Ofertas Ofrecidas</span>
            </h3>

            <div className="mt-4 space-y-2">
              {ofertas.length === 0 ? (
                <p className="text-xs text-[#746B65] dark:text-[#B3ACA5] py-4 text-center italic">
                  No se han registrado ofertas previas en este ciclo de negociación.
                </p>
              ) : (
                ofertas.map((of: any) => (
                  <div
                    key={of.id_oferta}
                    className="p-3 rounded-xl bg-[#FAF8F5] dark:bg-[#121416] border border-[#E8E0D8] dark:border-[#383C40] flex items-center justify-between text-xs"
                  >
                    <div>
                      <p className="font-bold text-[#241E1A] dark:text-[#F5F3F0]">
                        {of.producto_nombre || of.combo_nombre || of.nombre_promocion}
                      </p>
                      <p className="text-[11px] text-[#746B65] dark:text-[#B3ACA5]">
                        {of.promo_desc || of.detalle || `Ofrecido el ${formatDate(of.fecha_oferta)}`}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      {(of.producto_precio || of.combo_precio) && (
                        <span className="font-extrabold text-[#42291F] dark:text-[#E8A46D]">
                          {formatCurrency(of.producto_precio || of.combo_precio)}
                        </span>
                      )}
                      <span
                        className={`px-2 py-0.5 rounded-md font-bold text-[10px] ${
                          of.respuesta === "ACEPTADA"
                            ? "bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400"
                            : of.respuesta === "RECHAZADA"
                            ? "bg-rose-100 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400"
                            : "bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400"
                        }`}
                      >
                        {of.respuesta}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* 6. Conversión a PAYER: Primer Pago Confirmado */}
          <div id="pago" className="p-5 rounded-2xl bg-[#FFFFFF] dark:bg-[#1D2023] border border-[#E8E0D8] dark:border-[#383C40] shadow-sm">
            <h3 className="font-bold text-sm text-[#241E1A] dark:text-[#F5F3F0] flex items-center gap-2 pb-3 border-b border-[#E8E0D8] dark:border-[#383C40]">
              <CreditCard className="w-4 h-4 text-emerald-500" />
              <span>6. Conversión a PAYER (Primer Pago Confirmado)</span>
            </h3>

            {conversion?.primerPagoConfirmado ? (
              <div className="mt-4 space-y-4">
                <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <span className="px-2 py-0.5 rounded bg-emerald-600 text-white font-black text-[10px] uppercase">
                      Primer Pago Confirmado
                    </span>
                    <h4 className="text-xl font-extrabold text-emerald-700 dark:text-emerald-400 mt-1">
                      {formatCurrency(conversion.primerPagoConfirmado.monto)} ({conversion.primerPagoConfirmado.medio_pago_nombre})
                    </h4>
                    <p className="text-xs text-emerald-800 dark:text-emerald-300 mt-0.5">
                      Confirmado el: {formatDate(conversion.primerPagoConfirmado.fecha_pago)} • Ref: {conversion.primerPagoConfirmado.referencia || "Directo"}
                    </p>
                  </div>

                  <div className="text-right">
                    <p className="text-[11px] text-emerald-800 dark:text-emerald-300 font-bold uppercase">
                      Total Pedido #{conversion.pedido?.id_pedido}
                    </p>
                    <p className="text-lg font-black text-[#241E1A] dark:text-[#F5F3F0]">
                      {formatCurrency(conversion.pedido?.total)}
                    </p>
                  </div>
                </div>

                {/* Desglose de ítems del pedido */}
                {conversion.pedido?.detalles && (
                  <div className="text-xs">
                    <p className="font-bold text-[#746B65] dark:text-[#B3ACA5] mb-2 uppercase text-[11px]">
                      Detalle del Pedido Asociado:
                    </p>
                    <div className="space-y-1.5">
                      {conversion.pedido.detalles.map((d: any) => (
                        <div
                          key={d.id_detalle}
                          className="flex justify-between py-1.5 px-3 rounded-lg bg-[#FAF8F5] dark:bg-[#121416] border border-[#E8E0D8] dark:border-[#383C40]"
                        >
                          <span>{d.cantidad}x {d.item_nombre}</span>
                          <span className="font-bold">{formatCurrency(d.precio_unitario * d.cantidad)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="mt-4 p-4 rounded-xl bg-neutral-50 dark:bg-neutral-900 border border-[#E8E0D8] dark:border-[#383C40] text-center text-xs text-[#746B65] dark:text-[#B3ACA5]">
                {esAbierta ? (
                  <p>La negociación está abierta. No se registra primer pago confirmado todavía.</p>
                ) : (
                  <p>Negociación cerrada sin conversión. No existe pago confirmado asociado.</p>
                )}
              </div>
            )}
          </div>

          {/* 7. Seguimiento y Acciones del Agente */}
          <div className="p-5 rounded-2xl bg-[#FFFFFF] dark:bg-[#1D2023] border border-[#E8E0D8] dark:border-[#383C40] shadow-sm">
            <h3 className="font-bold text-sm text-[#241E1A] dark:text-[#F5F3F0] flex items-center gap-2 pb-3 border-b border-[#E8E0D8] dark:border-[#383C40]">
              <ShieldCheck className="w-4 h-4 text-[#C96D35]" />
              <span>7. Auditoría y Acciones del Agente Comercial</span>
            </h3>

            <div className="mt-4 space-y-2">
              {acciones.length === 0 ? (
                <p className="text-xs text-[#746B65] dark:text-[#B3ACA5] py-4 text-center italic">
                  Sin acciones comerciales registradas en auditoría.
                </p>
              ) : (
                acciones.map((acc: any) => (
                  <div
                    key={acc.id_accion}
                    className="p-2.5 rounded-xl bg-[#FAF8F5] dark:bg-[#121416] border border-[#E8E0D8] dark:border-[#383C40] flex items-center justify-between text-xs"
                  >
                    <div>
                      <span className="font-bold text-[#C96D35] dark:text-[#E8A46D]">
                        {acc.accion}
                      </span>
                      <p className="text-[11px] text-[#746B65] dark:text-[#B3ACA5] mt-0.5">
                        {acc.detalle || "Acción ejecutada"}
                      </p>
                    </div>
                    <div className="text-right">
                      <span
                        className={`px-1.5 py-0.5 rounded font-extrabold text-[10px] ${
                          acc.resultado === "EXITOSO"
                            ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/20"
                            : "bg-amber-50 text-amber-600 dark:bg-amber-950/20"
                        }`}
                      >
                        {acc.resultado}
                      </span>
                      <p className="text-[10px] text-[#746B65] dark:text-[#B3ACA5] mt-0.5">
                        {formatDate(acc.fecha_ejecucion)}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

