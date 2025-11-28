import { fetchJson, mediaUrl } from "./api";
import { transformLandingSection, type LandingSection, type StrapiLandingComponent } from "./landing";

type StrapiMedia = {
  url?: string | null;
  alternativeText?: string | null;
};

type StrapiProductDetail = {
  id: number;
  name: string;
  slug: string;
  kurzbeschreibung?: string | null;
  beschreibung?: string | null;
  preisNetto?: string | number | null;
  preisBrutto?: string | number | null;
  steuerSatz?: string | number | null;
  mwst?: boolean | null;
  gutschein?: boolean | null;
  bookingbox_topline?: string | null;
  bookingbox_überschrift?: string | null;
  bookingbox_beschreibung?: string | null;
  hintergrundbild?: StrapiMedia | null;
  bild?: StrapiMedia | null;
  abschnitte?: StrapiLandingComponent[] | null;
};

export type ProductHero = {
  title: string;
  paragraphs: string[];
  backgroundImageUrl: string | null;
  backgroundImageAlt: string | null;
};

export type ProductBookingBox = {
  highlightLabel?: string | null;
  überschrift: string;
  beschreibung: string;
  buttonText: string;
};

export type ProductDetail = {
  id: number;
  slug: string;
  title: string;
  price: string;
  priceValue: number | null;
  priceNetto: number | null;
  steuerSatz: number | null;
  hero: ProductHero;
  mainImage: { url: string; alt: string | null } | null;
  bookingBox: ProductBookingBox;
  sections: LandingSection[];
  isVoucher: boolean;
};

const PRICE_FORMATTER = new Intl.NumberFormat("de-DE", {
  style: "currency",
  currency: "EUR"
});

const DEFAULT_VAT_RATE = 19;

function parsePrice(value: string | number | null | undefined): number | null {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === "string") {
    const normalised = value.replace(",", ".").trim();
    if (normalised.length === 0) return null;
    const parsed = Number.parseFloat(normalised);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function formatPrice(value: string | number | null | undefined): { formatted: string; numeric: number | null } {
  const numeric = parsePrice(value);
  if (numeric === null) {
    return { numeric: null, formatted: "Preis auf Anfrage" };
  }
  return { numeric, formatted: PRICE_FORMATTER.format(numeric) };
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

function ensureHtmlContent(value: string | null | undefined): string {
  if (!value) {
    return "";
  }

  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return "";
  }

  if (/<[a-z][\s\S]*>/i.test(trimmed)) {
    return trimmed;
  }

  return `<p>${trimmed}</p>`;
}

function richTextToParagraphs(value: string | null | undefined): string[] {
  if (!value) {
    return [];
  }

  const normalised = value
    .replace(/<\/p>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<li>/gi, "• ")
    .replace(/<\/li>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/\u00a0/g, " ")
    .replace(/\r?\n+/g, "\n")
    .trim();

  if (!normalised) {
    return [];
  }

  return normalised
    .split(/\n+/)
    .map((paragraph) => paragraph.trim())
    .filter((paragraph) => paragraph.length > 0);
}

function createFallbackProduct(slug: string): ProductDetail {
  const title = "Wine Academy Produkt";
  const paragraphs = [
    "Dieses Produkt kann aktuell nicht geladen werden. Wir zeigen Beispielinhalte, damit das Layout getestet werden kann.",
    "Bitte versuche es später erneut oder kontaktiere uns bei Fragen."
  ];

  return {
    id: 0,
    slug,
    title,
    price: "Preis auf Anfrage",
    priceValue: null,
    priceNetto: null,
    steuerSatz: null,
    hero: {
      title,
      paragraphs,
      backgroundImageUrl: "/img/product_detail.jpg",
      backgroundImageAlt: null
    },
    mainImage: null,
    bookingBox: {
      highlightLabel: "Demoprodukt",
      überschrift: "Derzeit nicht verfügbar",
      beschreibung:
        "Dieses Produkt konnte nicht geladen werden. Der Platzhalter demonstriert das Layout der Produktdetailseite.",
      buttonText: "Bald verfügbar"
    },
    sections: [
      {
        type: "tabs",
        überschrift: null,
        überschriftStufe: "h2",
        hintergrund: "neutral",
        reiter: [
          {
            id: "description",
            überschrift: "Beschreibung",
            contentHtml:
              "<p>Hier erscheinen bald ausführliche Informationen zum Produkt. Sobald die Daten im CMS gepflegt sind, werden sie automatisch angezeigt.</p>"
          }
        ]
      }
    ],
    isVoucher: false
  };
}

function normaliseProductPayload(payload: StrapiProductDetail): ProductDetail {
  const price = formatPrice(payload.preisBrutto ?? payload.preisNetto ?? null);
  const priceNetto = parsePrice(payload.preisNetto ?? null);
  const rawSteuer = parsePrice(payload.steuerSatz ?? null);
  const steuerSatz = payload.gutschein || payload.mwst === false
    ? 0
    : rawSteuer != null
      ? rawSteuer
      : price.numeric != null && priceNetto != null && priceNetto > 0
        ? Math.max(0, Math.round(((price.numeric / priceNetto - 1) * 100 + Number.EPSILON) * 100) / 100)
        : DEFAULT_VAT_RATE;

  const descriptionParagraphs = richTextToParagraphs(payload.beschreibung ?? null);
  const heroFallbackParagraphs = splitParagraphs(payload.kurzbeschreibung ?? null);
  const heroParagraphs =
    descriptionParagraphs.length > 0
      ? descriptionParagraphs
      : heroFallbackParagraphs.length > 0
        ? heroFallbackParagraphs
        : ["Für dieses Produkt liegen derzeit keine Kurztexte vor."];

  const bookingHeadline =
    payload.bookingbox_überschrift && payload.bookingbox_überschrift.trim().length > 0
      ? payload.bookingbox_überschrift.trim()
      : "Jetzt bestellen";

  const bookingDescription =
    payload.bookingbox_beschreibung && payload.bookingbox_beschreibung.trim().length > 0
      ? payload.bookingbox_beschreibung.trim()
      : payload.kurzbeschreibung?.trim() ?? "Dieses Produkt kann direkt über den Shop bestellt werden.";

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
  const mainImageUrl = mediaUrl(payload.bild?.url);
  const mainImageAlt = payload.bild?.alternativeText ?? null;
  const backgroundImageUrl = mediaUrl(payload.hintergrundbild?.url) ?? mainImageUrl;
  const backgroundImageAlt = payload.hintergrundbild?.alternativeText ?? mainImageAlt ?? null;

  return {
    id: payload.id,
    slug: payload.slug,
    title: payload.name,
    price: price.formatted,
    priceValue: price.numeric,
    priceNetto,
    steuerSatz,
    hero: {
      title: payload.name,
      paragraphs: heroParagraphs,
      backgroundImageUrl,
      backgroundImageAlt
    },
    mainImage: mainImageUrl ? { url: mainImageUrl, alt: mainImageAlt } : null,
    bookingBox: {
      highlightLabel: payload.bookingbox_topline?.trim() ?? null,
      überschrift: bookingHeadline,
      beschreibung: bookingDescription,
      buttonText: "In den Warenkorb"
    },
    sections,
    isVoucher: Boolean(payload.gutschein)
  };
}

export async function getProductDetail(slug: string): Promise<ProductDetail | null> {
  try {
    const payload = await fetchJson<StrapiProductDetail>(`/public/produkte/${encodeURIComponent(slug)}`, {
      next: { revalidate: 30 },
      cache: "force-cache"
    });
    return normaliseProductPayload(payload);
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "status" in error &&
      (error as { status?: number }).status === 404
    ) {
      return null;
    }
    console.warn("[product-detail] API nicht erreichbar, nutze Fallback:", error);
    return createFallbackProduct(slug);
  }
}
