import { fetchJson, mediaUrl } from "./api";
import { transformLandingSection, type LandingSection, type StrapiLandingComponent } from "./landing";
import { normaliseShippingInput } from "./shipping";

type StrapiMedia = {
  url?: string | null;
  alternativeText?: string | null;
};

type StrapiVoucherTemplate = {
  name: string;
  slug?: string | null;
  beschreibung?: string | null;
  bookingbox_topline?: string | null;
  bookingbox_überschrift?: string | null;
  bookingbox_beschreibung?: string | null;
  minBetrag?: number | null;
  maxBetrag?: number | null;
  versandkosten?: number | null;
  bild?: StrapiMedia | null;
  hintergrundbild?: StrapiMedia | null;
  heroDarkMode?: boolean | null;
  abschnitte?: StrapiLandingComponent[] | null;
  seo?: {
    title?: string | null;
    description?: string | null;
    canonical?: string | null;
    robots?: string | null;
    og_image?: StrapiMedia | null;
  } | null;
};

export type VoucherDetail = {
  title: string;
  slug?: string | null;
  hero: {
    title: string;
    paragraphs: string[];
    backgroundImageUrl: string | null;
    backgroundImageAlt: string | null;
    preferDarkMode: boolean;
  };
  mainImage: { url: string; alt: string | null } | null;
  bookingBox: {
    highlightLabel?: string | null;
    überschrift: string;
    beschreibung: string;
    buttonText: string;
    minAmount?: number | null;
    maxAmount?: number | null;
    defaultAmount: number;
  };
  shippingCost?: number | null;
  sections: LandingSection[];
  seo?: {
    title?: string | null;
    description?: string | null;
    canonical?: string | null;
    robots?: string | null;
    ogImageUrl?: string | null;
  } | null;
};

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

function createFallbackVoucherDetail(): VoucherDetail {
  return {
    title: "Geschenkgutschein",
    slug: "gutscheine",
    hero: {
      title: "Geschenkgutschein",
      paragraphs: [
        "Verschenke die Wine Academy Hamburg als Erlebnis: Seminare, Produkte und Masterclasses können flexibel eingelöst werden."
      ],
      backgroundImageUrl: null,
      backgroundImageAlt: null,
      preferDarkMode: false
    },
    mainImage: null,
    bookingBox: {
      highlightLabel: null,
      überschrift: "Gutschein anfordern",
      beschreibung: "Wähle einen Wunschbetrag und sichere dir einen Gutschein für unsere Angebote.",
      buttonText: "In den Warenkorb",
      minAmount: null,
      maxAmount: null,
      defaultAmount: 25
    },
    shippingCost: null,
    sections: [],
    seo: null
  };
}

export async function getVoucherDetail(): Promise<VoucherDetail> {
  try {
    const payload = await fetchJson<StrapiVoucherTemplate>("/public/gutscheine/template", {
      next: { revalidate: 60 },
      cache: "force-cache"
    });

    const heroParagraphs = richTextToParagraphs(payload.beschreibung ?? null);
    const backgroundImageUrl = mediaUrl(payload.hintergrundbild?.url);
    const backgroundImageAlt = payload.hintergrundbild?.alternativeText ?? payload.bild?.alternativeText ?? null;
    const mainImageUrl = mediaUrl(payload.bild?.url);
    const mainImageAlt = payload.bild?.alternativeText ?? null;

    const defaultAmountCandidate = 25;
    const minAmount = typeof payload.minBetrag === "number" ? payload.minBetrag : undefined;
    const maxAmount = typeof payload.maxBetrag === "number" ? payload.maxBetrag : undefined;
    let defaultAmount = defaultAmountCandidate;
    if (minAmount != null && defaultAmount < minAmount) {
      defaultAmount = minAmount;
    }
    if (maxAmount != null && defaultAmount > maxAmount) {
      defaultAmount = maxAmount;
    }

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

    return {
      title: payload.name,
      slug: payload.slug ?? null,
      hero: {
        title: payload.name,
        paragraphs:
          heroParagraphs.length > 0
            ? heroParagraphs
            : ["Dieser Gutschein kann für alle Angebote der Wine Academy eingesetzt werden."],
        backgroundImageUrl: backgroundImageUrl ?? mainImageUrl,
        backgroundImageAlt,
        preferDarkMode: Boolean(payload.heroDarkMode)
      },
      mainImage: mainImageUrl ? { url: mainImageUrl, alt: mainImageAlt } : null,
      bookingBox: {
        highlightLabel: payload.bookingbox_topline?.trim() ?? null,
        überschrift:
          payload.bookingbox_überschrift && payload.bookingbox_überschrift.trim().length > 0
            ? payload.bookingbox_überschrift.trim()
            : "Geschenkgutschein sichern",
        beschreibung:
          payload.bookingbox_beschreibung && payload.bookingbox_beschreibung.trim().length > 0
            ? payload.bookingbox_beschreibung.trim()
            : "Wähle deinen Wunschbetrag und sichere dir oder deinen Liebsten einen Gutschein für Seminare und Produkte.",
        buttonText: "In den Warenkorb",
        minAmount,
        maxAmount,
        defaultAmount
      },
      shippingCost: normaliseShippingInput(payload.versandkosten),
      sections,
      seo: payload.seo
        ? {
            title: payload.seo.title ?? null,
            description: payload.seo.description ?? null,
            canonical: payload.seo.canonical ?? null,
            robots: payload.seo.robots ?? null,
            ogImageUrl: payload.seo.og_image?.url ? mediaUrl(payload.seo.og_image.url) ?? null : null
          }
        : null
    };
  } catch (error) {
    console.warn("[voucher-detail] Konnte Gutschein-Template nicht laden, nutze Fallback:", error);
    return createFallbackVoucherDetail();
  }
}
