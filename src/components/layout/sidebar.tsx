"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  MessageSquare,
  Bot,
  Flame,
  ClockAlert,
  UtensilsCrossed,
  LineChart,
  Settings,
  Sparkles,
  X,
  BadgeCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export const navigationItems = [
  {
    name: "Dashboard",
    href: "/",
    icon: LayoutDashboard,
    badge: "Oficial",
  },
  {
    name: "Gestión de Leads",
    href: "/leads",
    icon: Users,
    badge: null,
  },
  {
    name: "Conversaciones",
    href: "/chat",
    icon: MessageSquare,
    badge: "WhatsApp",
  },
  {
    name: "Agente IA",
    href: "/agente",
    icon: Bot,
    badge: "Copiloto",
  },
  {
    name: "Recomendaciones",
    href: "/recomendaciones",
    icon: Flame,
    badge: null,
  },
  {
    name: "Seguimiento",
    href: "/seguimiento",
    icon: ClockAlert,
    badge: "72h",
  },
  {
    name: "Catálogo Comercial",
    href: "/catalogo",
    icon: UtensilsCrossed,
    badge: null,
  },
  {
    name: "Analítica LEADS",
    href: "/analitica",
    icon: LineChart,
    badge: "KPIs",
  },
  {
    name: "Configuración",
    href: "/configuracion",
    icon: Settings,
    badge: null,
  },
];

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  const pathname = usePathname();

  return (
    <>
      {/* Backdrop para móviles */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden transition-opacity"
          onClick={onClose}
        />
      )}

      {/* Contenedor del Sidebar */}
      <aside
        className={cn(
          "fixed top-0 bottom-0 left-0 z-50 flex flex-col w-72 transition-transform duration-300 ease-in-out border-r",
          "bg-[#FFFFFF] dark:bg-[#1D2023] border-[#E8E0D8] dark:border-[#383C40]",
          isOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
      >
        {/* Cabecera del Sidebar */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-[#E8E0D8] dark:border-[#383C40]">
          <Link href="/" className="flex items-center gap-3 group">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-[#42291F] to-[#C96D35] text-white shadow-md shadow-[#C96D35]/20">
              <Flame className="w-5 h-5 text-orange-200 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-extrabold text-base tracking-wider text-[#42291F] dark:text-[#E8A46D] font-display">
                  ESTABLO AI
                </span>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[#C96D35]/15 text-[#C96D35] dark:text-[#E8A46D] border border-[#C96D35]/20">
                  LEADS
                </span>
              </div>
              <p className="text-[11px] text-[#746B65] dark:text-[#B3ACA5] tracking-tight">
                Parrilladas El Establo · Trujillo
              </p>
            </div>
          </Link>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#746B65] dark:text-[#B3ACA5] hover:bg-neutral-100 dark:hover:bg-[#292D31] lg:hidden"
            aria-label="Cerrar menú"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Banner de Ciclo Exclusivo LEADS */}
        <div className="mx-4 mt-4 p-3 rounded-xl bg-[#FAF8F5] dark:bg-[#121416] border border-[#E8E0D8] dark:border-[#383C40]">
          <div className="flex items-center justify-between text-[11px] font-semibold text-[#746B65] dark:text-[#B3ACA5] mb-1.5">
            <span>CICLO COMERCIAL</span>
            <span className="text-[#C96D35] dark:text-[#E8A46D] flex items-center gap-1">
              <BadgeCheck className="w-3.5 h-3.5" /> Enfoque Único
            </span>
          </div>
          <div className="flex items-center justify-between text-[10px] font-bold text-center">
            <span className="text-neutral-400">BUYER</span>
            <span className="text-neutral-400">→</span>
            <span className="px-2 py-0.5 rounded bg-[#C96D35] text-white shadow-sm font-extrabold">
              LEAD
            </span>
            <span className="text-neutral-400">→</span>
            <span className="text-neutral-400">PAYER</span>
            <span className="text-neutral-400">→</span>
            <span className="text-neutral-400">CUST.</span>
          </div>
        </div>

        {/* Lista de Navegación (9 Módulos Obligatorios) */}
        <nav className="flex-1 px-4 py-4 space-y-1 overflow-y-auto">
          {navigationItems.map((item) => {
            const isActive = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
            const Icon = item.icon;
            return (
              <Link
                key={item.name}
                href={item.href}
                onClick={onClose}
                className={cn(
                  "flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all group",
                  isActive
                    ? "bg-gradient-to-r from-[#C96D35] to-[#B65F29] text-white shadow-sm shadow-[#C96D35]/30 font-semibold"
                    : "text-[#241E1A] dark:text-[#F5F3F0] hover:bg-[#FAF8F5] dark:hover:bg-[#292D31] hover:text-[#C96D35] dark:hover:text-[#E8A46D]"
                )}
              >
                <div className="flex items-center gap-3">
                  <Icon
                    className={cn(
                      "w-4 h-4 transition-colors",
                      isActive ? "text-white" : "text-[#746B65] dark:text-[#B3ACA5] group-hover:text-[#C96D35] dark:group-hover:text-[#E8A46D]"
                    )}
                  />
                  <span>{item.name}</span>
                </div>
                {item.badge && (
                  <span
                    className={cn(
                      "text-[10px] px-1.5 py-0.5 rounded-md font-semibold",
                      isActive
                        ? "bg-white/20 text-white"
                        : "bg-[#E8E0D8] dark:bg-[#383C40] text-[#746B65] dark:text-[#B3ACA5]"
                    )}
                  >
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Footer del Sidebar con estado de BD */}
        <div className="p-4 border-t border-[#E8E0D8] dark:border-[#383C40] bg-[#FAF8F5] dark:bg-[#121416]/50">
          <div className="flex items-center gap-2.5">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
            <div className="text-[11px]">
              <p className="font-semibold text-[#241E1A] dark:text-[#F5F3F0]">
                SQL Server V3 Conectado
              </p>
              <p className="text-[#746B65] dark:text-[#B3ACA5] text-[10px]">
                Base: buyer (34 tablas)
              </p>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}

