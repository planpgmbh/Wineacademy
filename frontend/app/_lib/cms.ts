function normalizeApiBase(input?: string | null): string {
  if (!input) {
    throw new Error("API base URL ist nicht konfiguriert (API_INTERNAL_URL oder NEXT_PUBLIC_API_URL)");
  }
  const trimmed = input.replace(/\/$/, "");
  return trimmed.endsWith("/api") ? trimmed : `${trimmed}/api`;
}

function getApiBase(): string {
  if (typeof process === "undefined") {
    throw new Error("Server-seitiger Kontext erforderlich");
  }
  try {
    return normalizeApiBase(process.env.API_INTERNAL_URL ?? process.env.NEXT_PUBLIC_API_URL ?? undefined);
  } catch (error) {
    console.error("[cms] API-Basis konnte nicht ermittelt werden", error);
    throw error;
  }
}

async function cmsFetch<T>(path: string): Promise<T> {
  const base = getApiBase();
  const url = `${base}${path}`;

  const response = await fetch(url, {
    headers: { Accept: "application/json" },
    cache: "no-store",
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`CMS-Request fehlgeschlagen (${response.status}): ${message}`);
  }

  return (await response.json()) as T;
}

export type NavigationSubItem = {
  titel: string;
  link: string | null;
  ziel: "_self" | "_blank";
};

export type NavigationItem = NavigationSubItem & {
  unterpunkte: NavigationSubItem[];
};

export type NavigationResponse = {
  items: NavigationItem[];
  updatedAt: string | null;
};

export async function fetchNavigation(): Promise<NavigationResponse> {
  try {
    return await cmsFetch<NavigationResponse>("/public/navigation");
  } catch (error) {
    console.error("[cms] Navigation konnte nicht geladen werden", error);
    return { items: [], updatedAt: null };
  }
}

export type FooterLink = {
  label: string;
  href: string;
  ziel: "_self" | "_blank";
};

export type FooterLogo = {
  name: string | null;
  href: string | null;
  logo: {
    url: string | null;
    alternativeText: string | null;
    width: number | null;
    height: number | null;
  } | null;
};

export type FooterSection = {
  titel: string;
  typ: "kontakt" | "links" | "logos";
  text: string | null;
  links: FooterLink[];
  logos: FooterLogo[];
};

export type FooterResponse = {
  sections: FooterSection[];
  updatedAt: string | null;
};

export async function fetchFooter(): Promise<FooterResponse> {
  try {
    return await cmsFetch<FooterResponse>("/public/footer");
  } catch (error) {
    console.error("[cms] Footer konnte nicht geladen werden", error);
    return { sections: [], updatedAt: null };
  }
}

function normalizeAssetsBase(): string | null {
  const explicit = process.env.NEXT_PUBLIC_ASSETS_URL ?? process.env.ASSETS_INTERNAL_URL;
  if (explicit) {
    return explicit.replace(/\/$/, "");
  }
  const apiBase = process.env.NEXT_PUBLIC_API_URL ?? process.env.API_INTERNAL_URL;
  if (!apiBase) return null;
  const normalized = apiBase.replace(/\/$/, "");
  return normalized.endsWith("/api") ? normalized.slice(0, -4) : normalized;
}

const ASSETS_BASE = normalizeAssetsBase();

export function resolveMediaUrl(path: string | null): string | null {
  if (!path || path.length === 0) {
    return null;
  }
  if (path.startsWith("http")) {
    return path;
  }
  if (!ASSETS_BASE) {
    return path;
  }
  return `${ASSETS_BASE}${path.startsWith("/") ? path : `/${path}`}`;
}

export type LandingHeroSection = {
  __component: "landing.hero";
  titel: string;
  text?: string | null;
  videoUrl?: string | null;
  posterUrl?: string | null;
  buttonLabel?: string | null;
  buttonLink?: string | null;
};

export type LandingCard = {
  titel: string;
  untertitel?: string | null;
  link?: string | null;
};

export type LandingCardGridSection = {
  __component: "landing.card-grid";
  titel?: string | null;
  beschreibung?: string | null;
  karten: LandingCard[];
};

export type LandingTextBlockSection = {
  __component: "landing.text-block";
  titel: string;
  text?: string | null;
  buttonLabel?: string | null;
  buttonLink?: string | null;
};

export type LandingIconItem = {
  icon: string;
  titel: string;
  text?: string | null;
};

export type LandingIconGridSection = {
  __component: "landing.icon-grid";
  titel?: string | null;
  beschreibung?: string | null;
  items: LandingIconItem[];
};

export type LandingSection =
  | LandingHeroSection
  | LandingCardGridSection
  | LandingTextBlockSection
  | LandingIconGridSection;

export type LandingPageResponse = {
  id: number;
  titel: string;
  slug: string;
  abschnitte: LandingSection[];
  updatedAt: string | null;
};

export async function fetchLandingPage(slug: string): Promise<LandingPageResponse | null> {
  try {
    return await cmsFetch<LandingPageResponse>(`/public/landing-pages/${slug}`);
  } catch (error) {
    console.error("[cms] Landingpage konnte nicht geladen werden", error);
    return null;
  }
}
