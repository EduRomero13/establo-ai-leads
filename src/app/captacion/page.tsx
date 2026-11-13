"use client";

import React, { useEffect, useState } from "react";
import { CheckCircle2, Flame, Loader2, Send } from "lucide-react";

interface SegmentoOption {
  id_segmento: number;
  nombre: string;
  descripcion: string | null;
}

interface ProductoOption {
  id_producto: number;
  nombre: string;
  categoria: string;
  es_corte: boolean;
  precio: number;
}

export default function CaptacionPage() {
  const [segmentos, setSegmentos] = useState<SegmentoOption[]>([]);
  const [productos, setProductos] = useState<ProductoOption[]>([]);
  const [loadingOptions, setLoadingOptions] = useState(true);

  const [nombres, setNombres] = useState("");
  const [apellidos, setApellidos] = useState("");
  const [telefono, setTelefono] = useState("");
  const [email, setEmail] = useState("");
  const [fechaNacimiento, setFechaNacimiento] = useState("");
  const [idSegmento, setIdSegmento] = useState("");
  const [idProductoFavorito, setIdProductoFavorito] = useState("");
  const [nroPersonas, setNroPersonas] = useState("");
  const [notas, setNotas] = useState("");
  const [consentimientoDatos, setConsentimientoDatos] = useState(false);
  const [consentimientoMarketing, setConsentimientoMarketing] = useState(false);
  const [website, setWebsite] = useState(""); // honeypot

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    let active = true;
    fetch("/api/captacion")
      .then((res) => res.json())
      .then((data) => {
        if (!active) return;
        if (data.success) {
          setSegmentos(data.segmentos || []);
          setProductos(data.productos || []);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (active) setLoadingOptions(false);
      });
    return () => {
      active = false;
    };
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const res = await fetch("/api/captacion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombres,
          apellidos,
          telefono,
          email,
          fecha_nacimiento: fechaNacimiento || null,
          id_segmento: idSegmento ? Number(idSegmento) : null,
          id_producto_favorito: idProductoFavorito ? Number(idProductoFavorito) : null,
          nro_personas: nroPersonas ? Number(nroPersonas) : null,
          notas,
          consentimiento_datos: consentimientoDatos,
          consentimiento_marketing: consentimientoMarketing,
          website,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error || "No pudimos completar tu registro. Intenta nuevamente.");
        return;
      }

      setSubmitted(true);
    } catch {
      setError("Error de conexión. Verifica tu internet e inténtalo nuevamente.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#FAF8F5] dark:bg-[#121416] text-stone-900 dark:text-stone-100 py-8 px-4 sm:py-12">
      <div className="max-w-xl mx-auto">
        {/* Cabecera */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-[#C96D35]/15 text-[#C96D35] mb-4">
            <Flame className="w-7 h-7" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
            Parrilladas El Establo
          </h1>
          <p className="mt-2 text-sm sm:text-base text-stone-600 dark:text-stone-400">
            Déjanos tus datos para prepararte promociones personalizadas y atenderte al instante.
          </p>
        </div>

        {/* Tarjeta principal */}
        <div className="bg-white dark:bg-[#1B1E22] border border-stone-200 dark:border-stone-800 rounded-2xl shadow-sm p-6 sm:p-8">
          {submitted ? (
            <div className="text-center py-6 space-y-4">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h2 className="text-xl font-semibold">¡Registro completado!</h2>
              <p className="text-sm text-stone-600 dark:text-stone-400 max-w-md mx-auto">
                Gracias, <span className="font-medium text-stone-900 dark:text-stone-100">{nombres}</span>.
                Ya tenemos tus preferencias listas. Nuestro asesor comercial te atenderá por WhatsApp con las mejores opciones para ti.
              </p>
              <button
                type="button"
                onClick={() => {
                  setSubmitted(false);
                  setNombres("");
                  setApellidos("");
                  setTelefono("");
                  setEmail("");
                  setFechaNacimiento("");
                  setIdSegmento("");
                  setIdProductoFavorito("");
                  setNroPersonas("");
                  setNotas("");
                  setConsentimientoDatos(false);
                  setConsentimientoMarketing(false);
                }}
                className="mt-4 inline-flex items-center justify-center px-4 py-2 text-sm font-medium rounded-xl border border-stone-300 dark:border-stone-700 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
              >
                Registrar otra persona
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Honeypot invisible */}
              <input
                type="text"
                name="website"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                tabIndex={-1}
                autoComplete="off"
                className="hidden"
                aria-hidden="true"
              />

              {error && (
                <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 text-sm text-red-600 dark:text-red-400">
                  {error}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1.5">
                    Nombres <span className="text-[#C96D35]">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={nombres}
                    onChange={(e) => setNombres(e.target.value)}
                    placeholder="Ej. Ana"
                    className="w-full rounded-xl border border-stone-300 dark:border-stone-700 bg-transparent px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#C96D35]/40 focus:border-[#C96D35]"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5">
                    Apellidos <span className="text-[#C96D35]">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={apellidos}
                    onChange={(e) => setApellidos(e.target.value)}
                    placeholder="Ej. Ramirez"
                    className="w-full rounded-xl border border-stone-300 dark:border-stone-700 bg-transparent px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#C96D35]/40 focus:border-[#C96D35]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1.5">
                    WhatsApp / Teléfono <span className="text-[#C96D35]">*</span>
                  </label>
                  <input
                    type="tel"
                    required
                    value={telefono}
                    onChange={(e) => setTelefono(e.target.value)}
                    placeholder="Ej. 987654321"
                    className="w-full rounded-xl border border-stone-300 dark:border-stone-700 bg-transparent px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#C96D35]/40 focus:border-[#C96D35]"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5">
                    Correo electrónico
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="opcional@correo.com"
                    className="w-full rounded-xl border border-stone-300 dark:border-stone-700 bg-transparent px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#C96D35]/40 focus:border-[#C96D35]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1.5">
                    ¿Con quién nos visitas?
                  </label>
                  <select
                    value={idSegmento}
                    onChange={(e) => setIdSegmento(e.target.value)}
                    disabled={loadingOptions}
                    className="w-full rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-[#1B1E22] px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#C96D35]/40 focus:border-[#C96D35]"
                  >
                    <option value="">Selecciona una opción</option>
                    {segmentos.map((s) => (
                      <option key={s.id_segmento} value={s.id_segmento}>
                        {s.nombre}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5">
                    Personas estimadas
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={nroPersonas}
                    onChange={(e) => setNroPersonas(e.target.value)}
                    placeholder="Ej. 4"
                    className="w-full rounded-xl border border-stone-300 dark:border-stone-700 bg-transparent px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#C96D35]/40 focus:border-[#C96D35]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1.5">
                    Corte o plato favorito
                  </label>
                  <select
                    value={idProductoFavorito}
                    onChange={(e) => setIdProductoFavorito(e.target.value)}
                    disabled={loadingOptions}
                    className="w-full rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-[#1B1E22] px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#C96D35]/40 focus:border-[#C96D35]"
                  >
                    <option value="">Selecciona un plato (opcional)</option>
                    {productos.map((p) => (
                      <option key={p.id_producto} value={p.id_producto}>
                        {p.nombre} — S/ {Number(p.precio).toFixed(2)}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5">
                    Fecha de nacimiento
                  </label>
                  <input
                    type="date"
                    value={fechaNacimiento}
                    onChange={(e) => setFechaNacimiento(e.target.value)}
                    className="w-full rounded-xl border border-stone-300 dark:border-stone-700 bg-transparent px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#C96D35]/40 focus:border-[#C96D35]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1.5">
                  ¿Qué estás buscando o cuándo nos visitas?
                </label>
                <textarea
                  rows={3}
                  value={notas}
                  onChange={(e) => setNotas(e.target.value)}
                  placeholder="Ej. Cena de aniversario este sábado por la noche, buscamos parrilla para compartir..."
                  className="w-full rounded-xl border border-stone-300 dark:border-stone-700 bg-transparent px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#C96D35]/40 focus:border-[#C96D35]"
                />
              </div>

              <div className="space-y-3 pt-1">
                <label className="flex items-start gap-2.5 text-xs sm:text-sm text-stone-600 dark:text-stone-400 cursor-pointer">
                  <input
                    type="checkbox"
                    required
                    checked={consentimientoDatos}
                    onChange={(e) => setConsentimientoDatos(e.target.checked)}
                    className="mt-0.5 rounded border-stone-300 text-[#C96D35] focus:ring-[#C96D35]"
                  />
                  <span>
                    Autorizo el tratamiento de mis datos personales para recibir asesoría comercial y cotizaciones.{" "}
                    <span className="text-[#C96D35]">*</span>
                  </span>
                </label>

                <label className="flex items-start gap-2.5 text-xs sm:text-sm text-stone-600 dark:text-stone-400 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={consentimientoMarketing}
                    onChange={(e) => setConsentimientoMarketing(e.target.checked)}
                    className="mt-0.5 rounded border-stone-300 text-[#C96D35] focus:ring-[#C96D35]"
                  />
                  <span>
                    Deseo recibir promociones, descuentos por cumpleaños y novedades de El Establo.
                  </span>
                </label>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-[#C96D35] hover:bg-[#B45E2A] disabled:opacity-60 text-white font-semibold py-3 px-4 text-sm transition-colors shadow-sm"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Registrando...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    Enviar y recibir atención
                  </>
                )}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
