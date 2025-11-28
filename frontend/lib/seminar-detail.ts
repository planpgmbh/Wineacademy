import { fetchJson, mediaUrl } from "./api";
import { transformLandingSection, type LandingSection, type StrapiLandingComponent } from "./landing";

type StrapiMedia = {
  url?: string | null;
  alternativeText?: string | null;
};

type StrapiCategory = {
  id?: number | string;
  name?: string | null;
  slug?: string | null;
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
  bookingbox_überschrift?: string | null;
  bookingbox_beschreibung?: string | null;
  hintergrundbild?: StrapiMedia | null;
  bild?: StrapiMedia | null;
  abschnitte?: StrapiLandingComponent[] | null;
  termine?: (StrapiTermin & { preis?: string | number | null })[];
  kategorien?: StrapiCategory[] | null;
};

export type SeminarDateOption = {
  id: string;
  label: string;
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
    überschrift: string;
    beschreibung: string;
    buttonText: string;
  };
  sections: LandingSection[];
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

function extractParagraphsFromRichText(text: string | null | undefined): string[] {
  const html = ensureHtmlContent(text);
  if (html.length === 0) {
    return [];
  }

  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]*>/g, " ")
    .split(/\n+/)
    .map((paragraph) => paragraph.replace(/\s+/g, " ").trim())
    .filter((paragraph) => paragraph.length > 0);
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
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  }).format(date);

  const locationRaw = termin.standort?.stadt ?? termin.standort?.name ?? "";
  const location = locationRaw.trim();

  return location.length > 0 ? `${dateLabel} | ${location}` : dateLabel;
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

function extractHeroParagraphs(seminar: StrapiSeminarDetail): string[] {
  const fromDescription = extractParagraphsFromRichText(seminar.beschreibung);
  if (fromDescription.length > 0) {
    return fromDescription;
  }

  const fromShortDescription = splitParagraphs(seminar.kurzbeschreibung);
  if (fromShortDescription.length > 0) {
    return fromShortDescription;
  }

  return [];
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

  const sections = Array.isArray(payload.abschnitte)
    ? payload.abschnitte
        .map(transformLandingSection)
        .filter(
          (section) =>
            section.type !== "hero-carousel" &&
            section.type !== "hero-small" &&
            section.type !== "hero-blank" &&
            section.type !== "hero-video"
        )
    : [];
  const dates = mapDateOptions(payload.termine);

  const heroParagraphs = extractHeroParagraphs(payload);

  const highlightLabel = payload.bookingbox_topline?.trim() ?? undefined;
  const bookingHeadline =
    payload.bookingbox_überschrift?.trim() && payload.bookingbox_überschrift.trim().length > 0
      ? payload.bookingbox_überschrift.trim()
      : "Sichere dir deinen Platz";
  const bookingDescription =
    payload.bookingbox_beschreibung?.trim() && payload.bookingbox_beschreibung.trim().length > 0
      ? payload.bookingbox_beschreibung.trim()
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
      überschrift: bookingHeadline,
      beschreibung: bookingDescription,
      buttonText: "Jetzt anmelden",
    },
    sections,
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

  const sections: LandingSection[] = [
    {
      type: "tabs",
      überschrift: null,
      überschriftStufe: "h2",
      hintergrund: "neutral",
      reiter: [
        {
          id: "overview",
          überschrift: "Überblick",
          contentHtml: `<p>${paragraphs[0]}</p><p>${paragraphs[1]}</p>`,
        },
        {
          id: "agenda",
          überschrift: "Ablauf & Termine",
          contentHtml:
            "<p>Der Kurs erstreckt sich über drei Tage inklusive Prüfung. Jeder Tag fokussiert sich auf einen Themenblock: Sensorik, Herkunft & Stilistik sowie Service & Prüfungstraining.</p><p>Für jedes Datum stellen wir rechtzeitig eine detaillierte Agenda, Pausenplanung und optionale Zusatztermine zur Verfügung.</p>",
        },
        {
          id: "infos",
          überschrift: "Weitere Infos",
          contentHtml:
            "<p>Im Preis sind alle Tasting-Weine, Unterlagen sowie die Prüfungsgebühren enthalten. Nach erfolgreichem Abschluss erhältst du ein Zertifikat der Wine Academy Hamburg.</p><p>Für Unternehmen bieten wir auf Anfrage Sammelbuchungen und Inhouse-Schulungen an. Sprich uns gern an, wenn du individuelle Wünsche hast.</p>",
        },
      ],
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
      überschrift: "Sichere dir deinen Platz.",
      beschreibung:
        "Hier steht die Kurzbeschreibung des Seminars mit allen wichtigen Eckdaten und Vorteilen. Du kannst das Datum auswählen und direkt deinen Platz sichern.",
      buttonText: "Jetzt anmelden",
    },
    sections,
    dates: [
      { id: "date-1", label: "Fr, 15. November · Hamburg" },
      { id: "date-2", label: "Sa, 23. November · Hamburg" },
      { id: "date-3", label: "Fr, 6. Dezember · Berlin" },
    ],
    categories: [{ id: 1, name: "Weinwissen", slug: "weinwissen" }],
    primaryCategoryName: "Weinwissen",
  };
}
