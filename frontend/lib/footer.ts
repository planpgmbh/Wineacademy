import { buildApiUrl, getApiBaseUrl, mediaUrl } from "./api";

export type FooterLink = {
  label: string;
  href: string | null;
  target: "_self" | "_blank";
};

export type FooterLogo = {
  name: string | null;
  href: string | null;
  src: string | null;
  alt: string | null;
  width: number | null;
  height: number | null;
};

export type FooterSection = {
  title: string;
  type: "kontakt" | "links" | "logos";
  text: string | null;
  links: FooterLink[];
  logos: FooterLogo[];
};

type FooterResponse = {
  sections?: unknown;
};

function normaliseLink(entry: any): FooterLink | null {
  if (typeof entry?.label !== "string") {
    return null;
  }

  const href = typeof entry?.href === "string" && entry.href.length > 0 ? entry.href : null;
  const target = entry?.ziel === "_blank" ? "_blank" : "_self";

  return {
    label: entry.label,
    href,
    target,
  };
}

function normaliseLogo(entry: any): FooterLogo | null {
  if (!entry) {
    return null;
  }

  const logoMedia = entry?.logo;
  const srcCandidate = typeof logoMedia?.url === "string" ? mediaUrl(logoMedia.url) : null;

  return {
    name: typeof entry?.name === "string" ? entry.name : null,
    href: typeof entry?.href === "string" && entry.href.length > 0 ? entry.href : null,
    src: srcCandidate,
    alt:
      typeof logoMedia?.alternativeText === "string" && logoMedia.alternativeText.length > 0
        ? logoMedia.alternativeText
        : typeof entry?.name === "string" && entry.name.length > 0
          ? entry.name
          : null,
    width: Number.isFinite(logoMedia?.width) ? Number(logoMedia.width) : null,
    height: Number.isFinite(logoMedia?.height) ? Number(logoMedia.height) : null,
  };
}

function normaliseSection(entry: any): FooterSection | null {
  if (typeof entry?.titel !== "string") {
    return null;
  }

  const typeValues = ["kontakt", "links", "logos"] as const;
  const type = typeValues.includes(entry?.typ) ? entry.typ : "links";

  const text =
    typeof entry?.text === "string" && entry.text.trim().length > 0 ? entry.text.trim() : null;

  const linksRaw = Array.isArray(entry?.links) ? entry.links : [];
  const links = linksRaw
    .map(normaliseLink)
    .filter((item: FooterLink | null): item is FooterLink => item !== null);

  const logosRaw = Array.isArray(entry?.logos) ? entry.logos : [];
  const logos = logosRaw
    .map(normaliseLogo)
    .filter((item: FooterLogo | null): item is FooterLogo => item !== null);

  return {
    title: entry.titel,
    type,
    text,
    links,
    logos,
  };
}

function normaliseSections(raw: unknown): FooterSection[] {
  if (!Array.isArray(raw)) {
    return [];
  }

  return raw
    .map(normaliseSection)
    .filter((section: FooterSection | null): section is FooterSection => section !== null);
}

const FALLBACK_SECTIONS: FooterSection[] = [];

export async function getFooterSections(): Promise<FooterSection[]> {
  const baseUrl = getApiBaseUrl();
  if (!baseUrl) {
    console.warn("[footer] Kein API-Basis-URL konfiguriert (API_INTERNAL_URL oder NEXT_PUBLIC_API_URL).");
    return FALLBACK_SECTIONS;
  }

  try {
    const response = await fetch(buildApiUrl("/public/footer"), {
      next: { revalidate: 120 },
      cache: "force-cache",
      headers: { Accept: "application/json" },
    });

    if (!response.ok) {
      console.warn(`[footer] Fetch fehlgeschlagen (${response.status}) – Footer wird leer gerendert.`);
      return FALLBACK_SECTIONS;
    }

    const data = (await response.json()) as FooterResponse;
    const sections = normaliseSections((data as any)?.sections);
    return sections.length > 0 ? sections : FALLBACK_SECTIONS;
  } catch (error) {
    console.error("[footer] Fehler beim Laden des Footers:", error);
    return FALLBACK_SECTIONS;
  }
}
