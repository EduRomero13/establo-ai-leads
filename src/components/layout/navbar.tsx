"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Menu,
  Sun,
  Moon,
  Sparkles,
  Database,
  UserCheck,
  ChevronDown,
  Layers,
} from "lucide-react";
import { useTheme } from "@/components/theme-provider";

interface NavbarProps {
  onOpenSidebar: () => void;
}

const CASOS_DEMO = [
  { id: "ana", nombre: "Ana Ramírez", detalle: "Recurrente (3 ciclos)", segmento: "Estudiantes" },
  { id: "luis", nombre: "Luis Torres", detalle: "Recurrente (2 reservas)", segmento: "Familias" },
  { id: "maria", nombre: "María Paredes", detalle: "Pago parcial (PAYER)", segmento: "Amigos" },
  { id: "sofia", nombre: "Sofía Vargas", detalle: "Perdida por RECHAZO", segmento: "Estudiantes" },
  { id: "diego", nombre: "Diego Flores", detalle: "Perdida por TIMEOUT_72H", segmento: "Familias" },
  { id: "jorge", nombre: "Jorge Mendoza", detalle: "Negociación ABIERTA", segmento: "Estudiantes" },
];

export function Navbar({ onOpenSidebar }: NavbarProps) {
  const { theme, toggleTheme } = useTheme();
  const router = useRouter();
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const handleSeleccionarCaso = (casoId: string) => {
    setDropdownOpen(false);
    router.push(`/leads?caso=${casoId}`);
  };

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between h-16 px-4 md:px-8 border-b bg-[#FFFFFF]/90 dark:bg-[#1D2023]/90 backdrop-blur-md border-[#E8E0D8] dark:border-[#383C40] transition-colors">
      <div className="flex items-center gap-3">
        <button
          onClick={onOpenSidebar}
          className="p-2 rounded-xl text-[#746B65] dark:text-[#B3ACA5] hover:bg-[#FAF8F5] dark:hover:bg-[#292D31] lg:hidden"
          aria-label="Abrir menú"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="hidden sm:flex items-center gap-2">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#FAF8F5] dark:bg-[#121416] border border-[#E8E0D8] dark:border-[#383C40] text-xs font-semibold text-[#241E1A] dark:text-[#F5F3F0]">
            <Database className="w-3.5 h-3.5 text-emerald-500" />
            <span>SQL Server V3</span>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
          </div>

          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#C96D35]/10 dark:bg-[#E8A46D]/10 border border-[#C96D35]/20 dark:border-[#E8A46D]/20 text-xs font-semibold text-[#C96D35] dark:text-[#E8A46D]">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Agente Comercial IA</span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        {/* Selector de Casos de Demostración */}
        <div className="relative">
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold bg-[#FAF8F5] dark:bg-[#292D31] border border-[#E8E0D8] dark:border-[#383C40] text-[#42291F] dark:text-[#E8A46D] hover:border-[#C96D35] transition-colors"
          >
            <UserCheck className="w-4 h-4 text-[#C96D35] dark:text-[#E8A46D]" />
            <span className="hidden md:inline">Casos de Prueba</span>
            <ChevronDown className="w-3.5 h-3.5 opacity-70" />
          </button>

          {dropdownOpen && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setDropdownOpen(false)}
              />
              <div className="absolute right-0 mt-2 w-72 p-2 rounded-2xl shadow-xl z-50 bg-[#FFFFFF] dark:bg-[#1D2023] border border-[#E8E0D8] dark:border-[#383C40] animate-in fade-in slide-in-from-top-2 duration-150">
                <div className="px-3 py-2 border-b border-[#E8E0D8] dark:border-[#383C40] mb-1">
                  <p className="text-[11px] font-bold text-[#746B65] dark:text-[#B3ACA5] uppercase tracking-wider">
                    Casos Sintéticos Validados V3
                  </p>
                </div>
                <div className="space-y-1">
                  {CASOS_DEMO.map((caso) => (
                    <button
                      key={caso.id}
                      onClick={() => handleSeleccionarCaso(caso.id)}
                      className="w-full text-left px-3 py-2 rounded-xl text-xs hover:bg-[#FAF8F5] dark:hover:bg-[#292D31] transition-colors flex items-center justify-between group"
                    >
                      <div>
                        <p className="font-bold text-[#241E1A] dark:text-[#F5F3F0] group-hover:text-[#C96D35] dark:group-hover:text-[#E8A46D]">
                          {caso.nombre}
                        </p>
                        <p className="text-[11px] text-[#746B65] dark:text-[#B3ACA5]">
                          {caso.detalle}
                        </p>
                      </div>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#FAF8F5] dark:bg-[#121416] text-[#746B65] dark:text-[#B3ACA5] border border-[#E8E0D8] dark:border-[#383C40]">
                        {caso.segmento}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Botón Selector de Tema Modo Claro / Modo Oscuro */}
        <button
          onClick={toggleTheme}
          className="flex items-center justify-center w-10 h-10 rounded-xl bg-[#FAF8F5] dark:bg-[#292D31] border border-[#E8E0D8] dark:border-[#383C40] text-[#241E1A] dark:text-[#F5F3F0] hover:text-[#C96D35] dark:hover:text-[#E8A46D] transition-colors"
          title={`Cambiar a modo ${theme === "dark" ? "claro" : "oscuro"}`}
          aria-label="Cambiar tema"
        >
          {theme === "dark" ? (
            <Sun className="w-5 h-5 text-amber-400 transition-transform rotate-0 scale-100" />
          ) : (
            <Moon className="w-5 h-5 text-[#42291F] transition-transform rotate-0 scale-100" />
          )}
        </button>
      </div>
    </header>
  );
}

