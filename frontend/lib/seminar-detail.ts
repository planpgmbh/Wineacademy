import { fetchJson, mediaUrl } from "./api";

type StrapiMedia = {
  url?: string | null;
  alternativeText?: string | null;
};

type StrapiCategory = {
  id?: number | string;
  name?: string | null;
  slug?: string | null;
};

type StrapiTab = {
  id?: number | string;
  titel?: string | null;
  inhalt?: string | null;
};

type StrapiTermin = {
  id: number;
  starttag?: string | null;
  standort?: {
    name?: string | null;
    stadt?: string | null;
  } | null;
};

type StrapiSeminarDetail = {
  id: number;
  name: string;
  slug: string;
  kurzbeschreibung?: string | null;
  beschreibung?: string | null;
  infos?: string | null;
  preis?: string | number | null;
  mwst?: boolean | null;
  bookingbox_topline?: string | null;
  bookingbox_headline?: string | null;
  bookingbox_body?: string | null;
  hintergrundbild?: StrapiMedia | null;
  bild?: StrapiMedia | null;
  seminarinhalte?: StrapiTab[] | null;
  termine?: (StrapiTermin & { preis?: string | number | null })[];
  kategorien?: StrapiCategory[] | null;
};

export type SeminarDateOption = {
  id: string;
  label: string;
};

export type SeminarContentTab = {
  id: string;
  title: string;
  contentHtml: string;
};

export type SeminarDetail = {
  id: number;
  slug: string;
  title: string;
  price: string;
  hero: {
    title: string;
    paragraphs: string[];
    backgroundImageUrl: string | null;
    backgroundImageAlt: string | null;
  };
  bookingBox: {
    highlightLabel?: string | null;
    headline: string;
    description: string;
    ctaLabel: string;
  };
  tabs: SeminarContentTab[];
  dates: SeminarDateOption[];
  categories: { id: number; name: string; slug: string | null }[];
  primaryCategoryName: string | null;
};

const PRICE_FORMATTER = new Intl.NumberFormat("de-DE", {
  style: "currency",
  currency: "EUR",
});

function parsePriceValue(value: string | number | null | undefined): number | null {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === "string") {
    const parsed = Number.parseFloat(value.replace(",", "."));
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function formatPrice(value: string | number | null | undefined): string {
  const parsed = parsePriceValue(value);
  if (parsed === null) {
    return "Preis auf Anfrage";
  }
  return PRICE_FORMATTER.format(parsed);
}

function splitParagraphs(text: string | null | undefined): string[] {
  if (!text) {
    return [];
  }
  return text
    .split(/\r?\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter((paragraph) => paragraph.length > 0);
}

function ensureHtmlContent(text: string | null | undefined): string {
  if (!text) {
    return "";
  }

  const trimmed = text.trim();
  if (trimmed.length === 0) {
    return "";
  }

  if (/<[a-z][\s\S]*>/i.test(trimmed)) {
    return trimmed;
  }

  const paragraphs = trimmed
    .split(/\r?\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter((paragraph) => paragraph.length > 0)
    .map((paragraph) => paragraph.replace(/\r?\n/g, "<br />"));

  if (paragraphs.length === 0) {
    return "";
  }

  return paragraphs.map((paragraph) => `<p>${paragraph}</p>`).join("");
}

function toContentTabs(
  rawTabs: StrapiTab[] | null | undefined,
  fallback: { id: string; title: string; html: string }[]
): SeminarContentTab[] {
  const tabs = Array.isArray(rawTabs)
    ? rawTabs
        .map((tab, index) => {
          const title = typeof tab?.titel === "string" && tab.titel.trim().length > 0 ? tab.titel.trim() : `Abschnitt ${index + 1}`;
          const contentHtml = ensureHtmlContent(tab?.inhalt);
          if (contentHtml.length === 0) {
            return null;
          }
          const tabId = typeof tab?.id === "number" || typeof tab?.id === "string" ? String(tab.id) : `tab-${index}`;
          return { id: tabId, title, contentHtml };
        })
        .filter((tab): tab is SeminarContentTab => Boolean(tab))
    : [];

  if (tabs.length > 0) {
    return tabs;
  }

  return fallback
    .filter((entry) => entry.html.length > 0)
    .map((entry, index) => ({
      id: `fallback-${index}`,
      title: entry.title,
      contentHtml: entry.html,
    }));
}

function formatDateLabel(termin: StrapiTermin): string | null {
  if (!termin.starttag) {
    return null;
  }

  const date = new Date(termin.starttag);
  if (Number.isNaN(date.valueOf())) {
    return null;
  }

  const dateLabel = new Intl.DateTimeFormat("de-DE", {
    weekday: "short",
    day: "numeric",
    month: "long",
  }).format(date);

  const locationRaw = termin.standort?.stadt ?? termin.standort?.name ?? "";
  const location = locationRaw.trim();

  return location.length > 0 ? `${dateLabel} · ${location}` : dateLabel;
}

function mapDateOptions(termine: StrapiSeminarDetail["termine"]): SeminarDateOption[] {
  if (!Array.isArray(termine)) {
    return [];
  }

  return termine
    .map((termin) => {
      const label = formatDateLabel(termin);
      if (!label) {
        return null;
      }
      return { id: String(termin.id), label };
    })
    .filter((option): option is SeminarDateOption => Boolean(option));
}

function extractHeroParagraphs(seminar: StrapiSeminarDetail, fallbackTabs: SeminarContentTab[]): string[] {
  const fromShortDescription = splitParagraphs(seminar.kurzbeschreibung);
  if (fromShortDescription.length > 0) {
    return fromShortDescription;
  }

  if (fallbackTabs.length > 0) {
    return fallbackTabs
      .map((tab) =>
        tab.contentHtml
          .replace(/<br\s*\/?>/gi, " ")
          .replace(/<\/p>/gi, "\n")
          .replace(/<[^>]*>/g, " ")
      )
      .join("\n")
      .split(/\n+/)
      .map((paragraph) => paragraph.trim())
      .filter((paragraph) => paragraph.length > 0)
      .slice(0, 2);
  }

  return [];
}

function fallbackTabsFromTexts(seminar: StrapiSeminarDetail): { id: string; title: string; html: string }[] {
  const entries: { id: string; title: string; html: string }[] = [];

  const beschreibung = ensureHtmlContent(seminar.beschreibung);
  if (beschreibung.length > 0) {
    entries.push({ id: "beschreibung", title: "Überblick", html: beschreibung });
  }

  const infos = ensureHtmlContent(seminar.infos);
  if (infos.length > 0) {
    entries.push({ id: "infos", title: "Weitere Infos", html: infos });
  }

  return entries;
}

export async function getSeminarDetail(slug: string): Promise<SeminarDetail | null> {
  try {
    const payload = await fetchJson<StrapiSeminarDetail>(`/public/seminare/${encodeURIComponent(slug)}`, {
      next: { revalidate: 60 },
      cache: "force-cache",
    });
    return normaliseSeminarPayload(payload);
  } catch (error) {
    if (typeof error === "object" && error !== null && "status" in error && (error as { status?: number }).status === 404) {
      return null;
    }
    console.warn("[seminar-detail] API nicht erreichbar, verwende Fallback-Inhalt:", error);
    return createFallbackSeminar(slug);
  }
}

function normaliseSeminarPayload(payload: StrapiSeminarDetail): SeminarDetail {
  const categories = Array.isArray(payload.kategorien)
    ? payload.kategorien
        .map((category) => {
          const name = typeof category?.name === "string" ? category.name.trim() : "";
          if (name.length === 0) {
            return null;
          }
          const idRaw = typeof category?.id === "number" ? category.id : Number.parseInt(String(category?.id ?? "0"), 10);
          return {
            id: Number.isFinite(idRaw) ? idRaw : 0,
            name,
            slug: typeof category?.slug === "string" && category.slug.length > 0 ? category.slug : null,
          };
        })
        .filter((category): category is { id: number; name: string; slug: string | null } => Boolean(category))
    : [];

  const fallbackTabs = fallbackTabsFromTexts(payload);
  const tabs = toContentTabs(payload.seminarinhalte, fallbackTabs);
  const dates = mapDateOptions(payload.termine);

  const heroParagraphs = extractHeroParagraphs(payload, tabs);

  const highlightLabel = payload.bookingbox_topline?.trim() ?? undefined;
  const bookingHeadline =
    payload.bookingbox_headline?.trim() && payload.bookingbox_headline.trim().length > 0
      ? payload.bookingbox_headline.trim()
      : "Sichere dir deinen Platz";
  const bookingDescription =
    payload.bookingbox_body?.trim() && payload.bookingbox_body.trim().length > 0
      ? payload.bookingbox_body.trim()
      : payload.kurzbeschreibung?.trim() ?? "";

  const backgroundImageUrl = mediaUrl(payload.hintergrundbild?.url) ?? mediaUrl(payload.bild?.url);
  const primaryCategoryName = categories[0]?.name ?? null;

  return {
    id: payload.id,
    slug: payload.slug,
    title: payload.name,
    price: formatPrice(payload.preis),
    hero: {
      title: payload.name,
      paragraphs: heroParagraphs,
      backgroundImageUrl,
      backgroundImageAlt: payload.hintergrundbild?.alternativeText ?? payload.bild?.alternativeText ?? null,
    },
    bookingBox: {
      highlightLabel,
      headline: bookingHeadline,
      description: bookingDescription,
      ctaLabel: "Jetzt anmelden",
    },
    tabs,
    dates,
    categories,
    primaryCategoryName,
  };
}

function createFallbackSeminar(slug: string): SeminarDetail {
  const title = "Assistant Sommelier (inkl. WSET® Level 2 Weine)";
  const paragraphs = [
    "Ob Gastronomie, Weinhandel, Tourismus oder Weinliebhaber:innen – der Lehrgang zum Assistant Sommelier inkl. WSET® Level 2 bietet die perfekte Weiterbildung für alle, die ihr Fachwissen erweitern und ihre Erfahrung im Weinservice verbessern möchten.",
    "Unsere kompakten Lehrmodule verbinden fundiertes Wissen mit praxisnahen Tastings, damit du das Gelernte sofort anwenden kannst. Die Plätze sind begrenzt, weshalb wir eine frühzeitige Buchung empfehlen.",
  ];

  const tabs: SeminarContentTab[] = [
    {
      id: "overview",
      title: "Überblick",
      contentHtml: `<p>${paragraphs[0]}</p><p>${paragraphs[1]}</p>`,
    },
    {
      id: "agenda",
      title: "Ablauf & Termine",
      contentHtml:
        "<p>Der Kurs erstreckt sich über drei Tage inklusive Prüfung. Jeder Tag fokussiert sich auf einen Themenblock: Sensorik, Herkunft & Stilistik sowie Service & Prüfungstraining.</p><p>Für jedes Datum stellen wir rechtzeitig eine detaillierte Agenda, Pausenplanung und optionale Zusatztermine zur Verfügung.</p>",
    },
    {
      id: "infos",
      title: "Weitere Infos",
      contentHtml:
        "<p>Im Preis sind alle Tasting-Weine, Unterlagen sowie die Prüfungsgebühren enthalten. Nach erfolgreichem Abschluss erhältst du ein Zertifikat der Wine Academy Hamburg.</p><p>Für Unternehmen bieten wir auf Anfrage Sammelbuchungen und Inhouse-Schulungen an. Sprich uns gern an, wenn du individuelle Wünsche hast.</p>",
    },
  ];

  return {
    id: 0,
    slug,
    title,
    price: "249,00 €",
    hero: {
      title,
      paragraphs,
      backgroundImageUrl: "/img/product_detail.jpg",
      backgroundImageAlt: null,
    },
    bookingBox: {
      highlightLabel: "Highlight Batch",
      headline: "Sichere dir deinen Platz.",
      description:
        "Hier steht die Kurzbeschreibung des Seminars mit allen wichtigen Eckdaten und Vorteilen. Du kannst das Datum auswählen und direkt deinen Platz sichern.",
      ctaLabel: "Jetzt anmelden",
    },
    tabs,
    dates: [
      { id: "date-1", label: "Fr, 15. November · Hamburg" },
      { id: "date-2", label: "Sa, 23. November · Hamburg" },
      { id: "date-3", label: "Fr, 6. Dezember · Berlin" },
    ],
    categories: [{ id: 1, name: "Weinwissen", slug: "weinwissen" }],
    primaryCategoryName: "Weinwissen",
  };
}
