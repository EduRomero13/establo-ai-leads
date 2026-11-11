import { Promocion, Persona, ProductoCarta, Combo } from "@/types/database";

export interface ValidacionPromocionResultado {
  esElegible: boolean;
  motivoInvalidez?: string;
  promocion: Promocion;
  ahorroEstimado?: number;
}

// Obtener letra del día en español para Trujillo, Perú (zona horaria America/Lima)
export function getDiaLetraPeru(fecha: Date = new Date()): 'L' | 'M' | 'X' | 'J' | 'V' | 'S' | 'D' {
  // Opciones con zona horaria America/Lima
  const formatter = new Intl.DateTimeFormat("es-PE", {
    timeZone: "America/Lima",
    weekday: "short",
  });
  
  const diaTexto = formatter.format(fecha).toLowerCase().trim();
  
  // mapeo: lun -> L, mar -> M, mié/mie -> X, jue -> J, vie -> V, sáb/sab -> S, dom -> D
  if (diaTexto.startsWith("lun")) return "L";
  if (diaTexto.startsWith("mar")) return "M";
  if (diaTexto.startsWith("mi")) return "X";
  if (diaTexto.startsWith("jue")) return "J";
  if (diaTexto.startsWith("vie")) return "V";
  if (diaTexto.startsWith("s") && diaTexto.includes("b")) return "S";
  if (diaTexto.startsWith("dom")) return "D";

  // Fallback por día de semana numérico
  const dayNum = fecha.getDay(); // 0 dom, 1 lun, 2 mar, etc.
  const map: Record<number, 'L' | 'M' | 'X' | 'J' | 'V' | 'S' | 'D'> = {
    0: 'D', 1: 'L', 2: 'M', 3: 'X', 4: 'J', 5: 'V', 6: 'S'
  };
  return map[dayNum] || 'L';
}

// Obtener fecha actual en formato YYYY-MM-DD en Perú
export function getFechaHoyPeru(fecha: Date = new Date()): string {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Lima",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return formatter.format(fecha);
}

// Verificar si una persona está de cumpleaños (+/- 3 días) respecto a una fecha
export function esVentanaCumpleanos(fechaNacimientoStr?: string | null, fechaReferencia: Date = new Date()): boolean {
  if (!fechaNacimientoStr) return false;
  try {
    const fn = new Date(fechaNacimientoStr);
    if (isNaN(fn.getTime())) return false;

    const mesNac = fn.getUTCMonth();
    const diaNac = fn.getUTCDate();

    // Fecha en Perú para año de referencia
    const refYear = fechaReferencia.getFullYear();
    const cumpleEsteAno = new Date(refYear, mesNac, diaNac);

    const diferenciaMs = Math.abs(fechaReferencia.getTime() - cumpleEsteAno.getTime());
    const diferenciaDias = diferenciaMs / (1000 * 60 * 60 * 24);

    return diferenciaDias <= 3.5;
  } catch {
    return false;
  }
}

// Evaluar una promoción para un Lead específico y opcionalmente un ítem
export function evaluarPromocion(
  promo: Promocion,
  persona: Persona,
  item?: { producto?: ProductoCarta; combo?: Combo },
  fechaReferencia: Date = new Date()
): ValidacionPromocionResultado {
  // 1. Activa
  if (!promo.activa) {
    return { esElegible: false, motivoInvalidez: "La promoción está inactiva en el sistema.", promocion: promo };
  }

  // 2. Rango de fechas
  const hoyStr = getFechaHoyPeru(fechaReferencia);
  const inicioStr = (typeof promo.fecha_inicio === "string" 
    ? promo.fecha_inicio 
    : (promo.fecha_inicio as any)?.toISOString?.() || String(promo.fecha_inicio)).substring(0, 10);
    
  if (hoyStr < inicioStr) {
    return { esElegible: false, motivoInvalidez: `Promoción válida a partir del ${inicioStr}.`, promocion: promo };
  }
  if (promo.fecha_fin) {
    const finStr = (typeof promo.fecha_fin === "string" 
      ? promo.fecha_fin 
      : (promo.fecha_fin as any)?.toISOString?.() || String(promo.fecha_fin)).substring(0, 10);
    if (hoyStr > finStr) {
      return { esElegible: false, motivoInvalidez: `Promoción venció el ${finStr}.`, promocion: promo };
    }
  }

  // 3. Días aplicables
  const diasConfig = promo.dias_aplicables.trim().toUpperCase();
  if (diasConfig !== "TODOS") {
    const diaActualLetra = getDiaLetraPeru(fechaReferencia);
    const diasPermitidos = diasConfig.split(",").map(d => d.trim());
    if (!diasPermitidos.includes(diaActualLetra)) {
      return {
        esElegible: false,
        motivoInvalidez: `Válida únicamente los días [${diasConfig}]. Hoy es ${diaActualLetra}.`,
        promocion: promo,
      };
    }
  }

  // 4. Segmento objetivo (si es NULL aplica a cualquier segmento)
  if (promo.id_segmento_objetivo !== null && promo.id_segmento_objetivo !== undefined) {
    if (persona.id_segmento !== promo.id_segmento_objetivo) {
      return {
        esElegible: false,
        motivoInvalidez: `Exclusiva para el segmento '${promo.segmento_nombre || "Segmento específico"}'.`,
        promocion: promo,
      };
    }
  }

  // 5. Regla especial de cumpleaños ("Promo Cumpleanero")
  const nombreNorm = promo.nombre_promocion.toLowerCase();
  if (nombreNorm.includes("cumplea") || nombreNorm.includes("cumple")) {
    const tieneCumple = esVentanaCumpleanos(persona.fecha_nacimiento, fechaReferencia);
    if (!tieneCumple) {
      return {
        esElegible: false,
        motivoInvalidez: "Válida únicamente durante la semana de tu cumpleaños (±3 días).",
        promocion: promo,
      };
    }
  }

  // 6. Validación de ítem aplicable (si se especificó ítem)
  let ahorroCalculado = 0;
  if (item && promo.aplicables && promo.aplicables.length > 0) {
    let aplicaAItem = false;
    for (const aplicable of promo.aplicables) {
      if (item.producto && aplicable.id_producto === item.producto.id_producto) {
        aplicaAItem = true;
        break;
      }
      if (item.combo && aplicable.id_combo === item.combo.id_combo) {
        aplicaAItem = true;
        break;
      }
      if (item.producto && aplicable.categoria === item.producto.categoria) {
        aplicaAItem = true;
        break;
      }
    }

    if (!aplicaAItem) {
      return {
        esElegible: false,
        motivoInvalidez: `La promoción no aplica para el ítem seleccionado.`,
        promocion: promo,
      };
    }

    // Calcular ahorro estimado
    const precioBase = item.producto?.precio || item.combo?.precio || 0;
    if (promo.tipo_beneficio === "PORCENTAJE" && promo.valor_beneficio) {
      ahorroCalculado = (precioBase * promo.valor_beneficio) / 100;
    } else if (promo.tipo_beneficio === "MONTO_FIJO" && promo.valor_beneficio) {
      ahorroCalculado = promo.valor_beneficio;
    } else if (promo.tipo_beneficio === "PRODUCTO_GRATIS") {
      ahorroCalculado = 26; // Chicha + Torta aprox
    }
  }

  return {
    esElegible: true,
    promocion: promo,
    ahorroEstimado: ahorroCalculado,
  };
}

