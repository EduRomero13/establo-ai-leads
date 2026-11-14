// Mapeo centralizado de imágenes de platos y combos en /public/platos/ (formato AVIF).

export interface PlatoMediaInfo {
  slug: string;
  nombre: string;
  keywords: RegExp;
}

const PLATOS_MEDIA: PlatoMediaInfo[] = [
  {
    slug: "parrilla-familiar",
    nombre: "Parrilla Familiar",
    keywords: /parrilla\s+familiar/i,
  },
  {
    slug: "parrilla-mixta-especial",
    nombre: "Parrilla Mixta Especial",
    keywords: /parrilla\s+mixta(\s+especial)?/i,
  },
  {
    slug: "parrilla-personal",
    nombre: "Parrilla Personal",
    keywords: /parrilla\s+personal/i,
  },
  {
    slug: "combo-amigos",
    nombre: "Combo Amigos",
    keywords: /combo\s+amigos/i,
  },
  {
    slug: "combo-estudiante",
    nombre: "Combo Estudiante",
    keywords: /combo\s+estudiante/i,
  },
  {
    slug: "picana-a-la-parrilla",
    nombre: "Picaña a la Parrilla",
    keywords: /pica[nñ]a/i,
  },
  {
    slug: "bife-ancho",
    nombre: "Bife Ancho",
    keywords: /bife(\s+ancho)?/i,
  },
  {
    slug: "tira-de-cerdo",
    nombre: "Tira de Cerdo",
    keywords: /tira\s+de\s+cerdo|cerdo/i,
  },
  {
    slug: "chorizo-a-la-parrilla",
    nombre: "Chorizo a la Parrilla",
    keywords: /chorizo/i,
  },
  {
    slug: "ensalada-cesar",
    nombre: "Ensalada César",
    keywords: /ensalada(\s+c[eé]sar)?/i,
  },
  {
    slug: "chicha-morada",
    nombre: "Chicha Morada",
    keywords: /chicha(\s+morada)?/i,
  },
  {
    slug: "sangria",
    nombre: "Sangría",
    keywords: /sangr[ií]a/i,
  },
  {
    slug: "torta-de-chocolate",
    nombre: "Torta de Chocolate",
    keywords: /torta(\s+de\s+chocolate)?/i,
  },
];

export function detectarPlatoMediaPorTexto(texto?: string | null): PlatoMediaInfo | null {
  if (!texto) return null;
  for (const item of PLATOS_MEDIA) {
    if (item.keywords.test(texto)) {
      return item;
    }
  }
  return null;
}

export function getPlatoRelativePath(
  slug: string,
  format: "avif" | "jpg" = "avif"
): string {
  return `/platos/${slug}.${format}`;
}

export function getPlatoAbsoluteUrl(
  slug: string,
  format: "avif" | "jpg" = "avif"
): string | null {
  const baseFromEnv = process.env.NEXT_PUBLIC_BASE_URL?.trim();
  let origin = baseFromEnv ? baseFromEnv.replace(/\/+$/, "") : "";

  if (!origin) {
    const captacion = process.env.CAPTACION_URL?.trim();
    if (captacion) {
      try {
        origin = new URL(captacion).origin;
      } catch {
        origin = "";
      }
    }
  }

  if (!origin || !/^https?:\/\//i.test(origin)) {
    return null;
  }

  return `${origin}${getPlatoRelativePath(slug, format)}`;
}
