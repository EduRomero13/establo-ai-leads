import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number | null | undefined): string {
  if (amount === null || amount === undefined) return "S/ 0.00";
  return `S/ ${amount.toFixed(2)}`;
}

export function formatDate(dateString: string | null | undefined): string {
  if (!dateString) return "No registrado";
  try {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return dateString;
    return new Intl.DateTimeFormat("es-PE", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "America/Lima",
    }).format(d);
  } catch {
    return dateString;
  }
}

export function formatDateOnly(dateString: string | null | undefined): string {
  if (!dateString) return "No registrado";
  try {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return dateString;
    return new Intl.DateTimeFormat("es-PE", {
      dateStyle: "medium",
      timeZone: "America/Lima",
    }).format(d);
  } catch {
    return dateString;
  }
}

export function formatHours(hours: number | null | undefined): string {
  if (hours === null || hours === undefined) return "N/D";
  return `${hours.toFixed(1)} h`;
}

export function formatPercent(value: number | null | undefined): string {
  if (value === null || value === undefined) return "0.00%";
  return `${value.toFixed(2)}%`;
}

