"use client";

import React, { useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import {
  Menu,
  Sun,
  Moon,
  Sparkles,
  Database,
  UserCheck,
  ChevronDown,
  Layers,
  FlaskConical,
  ShieldCheck,
  User,
} from "lucide-react";
import { useTheme } from "@/components/theme-provider";

interface NavbarProps {
  onOpenSidebar: () => void;
}

const SECCIONES_TITULOS: Record<string, { titulo: string; badge: string }> = {
  "/": { titulo: "Inicio", badge: "Centro de Control" },
  "/leads": { titulo: "Leads", badge: "Gestión Comercial" },
  "/chat": { titulo: "WhatsApp", badge: "En Vivo" },
  "/agente": { titulo: "Agente IA", badge: "Copiloto" },
  "/seguimiento": { titulo: "Seguimiento", badge: "Ventana 72h" },
  "/recomendaciones": { titulo: "Carta y Combos", badge: "Menú Oficial" },
  "/catalogo": { titulo: "Catálogo", badge: "Oficial" },
  "/analitica": { titulo: "Indicadores", badge: "KPIs" },
  "/configuracion": { titulo: "Configuración", badge: "Meta API" },
};

export function Navbar({ onOpenSidebar }: NavbarProps) {
  const { theme, toggleTheme } = useTheme();
  const pathname = usePathname();

  const seccionActual = SECCIONES_TITULOS[pathname] || {
    titulo: pathname.replace("/", "").toUpperCase() || "ESTABLO AI",
    badge: "Plataforma",
  };

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between h-16 px-4 md:px-8 border-b bg-[#FFFFFF]/95 dark:bg-[#1D2023]/95 backdrop-blur-md border-[#E8E0D8] dark:border-[#383C40] transition-colors">
      <div className="flex items-center gap-3">
        <button
          onClick={onOpenSidebar}
          className="p-2 rounded-xl text-[#746B65] dark:text-[#B3ACA5] hover:bg-[#FAF8F5] dark:hover:bg-[#292D31] lg:hidden"
          aria-label="Abrir menú"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Título de la sección actual (Limpio y directo) */}
        <div className="flex items-center gap-2.5">
          <h2 className="text-base font-extrabold text-[#241E1A] dark:text-[#F5F3F0] font-display">
            {seccionActual.titulo}
          </h2>
          <span className="hidden sm:inline-flex px-2 py-0.5 text-[10px] font-bold rounded-md bg-[#C96D35]/10 dark:bg-[#E8A46D]/15 text-[#C96D35] dark:text-[#E8A46D] border border-[#C96D35]/20">
            {seccionActual.badge}
          </span>
          <span className="hidden md:inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[11px] font-semibold border border-emerald-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            En línea
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2.5">
        {/* Botón Selector de Tema Modo Claro / Modo Oscuro */}
        <button
          onClick={toggleTheme}
          className="flex items-center justify-center w-9 h-9 rounded-xl bg-[#FAF8F5] dark:bg-[#292D31] border border-[#E8E0D8] dark:border-[#383C40] text-[#241E1A] dark:text-[#F5F3F0] hover:text-[#C96D35] dark:hover:text-[#E8A46D] transition-colors"
          title={`Cambiar a modo ${theme === "dark" ? "claro" : "oscuro"}`}
          aria-label="Cambiar tema"
        >
          {theme === "dark" ? (
            <Sun className="w-4 h-4 text-amber-400 transition-transform rotate-0 scale-100" />
          ) : (
            <Moon className="w-4 h-4 text-[#42291F] transition-transform rotate-0 scale-100" />
          )}
        </button>

        {/* Perfil de Usuario Administrador (Discreto y Elegante) */}
        <div className="hidden sm:flex items-center gap-2 pl-2 border-l border-[#E8E0D8] dark:border-[#383C40]">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#42291F] to-[#C96D35] text-white flex items-center justify-center font-bold text-xs shadow-xs">
            PE
          </div>
          <div className="hidden lg:block text-left text-xs">
            <p className="font-bold text-[#241E1A] dark:text-[#F5F3F0] leading-none">Admin</p>
            <p className="text-[10px] text-[#746B65] dark:text-[#B3ACA5] leading-tight mt-0.5">El Establo</p>
          </div>
        </div>
      </div>
    </header>
  );
}

