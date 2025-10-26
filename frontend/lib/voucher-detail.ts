import { fetchJson, mediaUrl } from "./api";
import { normaliseShippingInput } from "./shipping";

type StrapiMedia = {
  url?: string | null;
  alternativeText?: string | null;
};

type StrapiTab = {
  id?: number | string;
  titel?: string | null;
  inhalt?: string | null;
};

type StrapiVoucherTemplate = {
  name: string;
  beschreibung?: string | null;
  bookingbox_topline?: string | null;
  bookingbox_headline?: string | null;
  bookingbox_body?: string | null;
  minBetrag?: number | null;
  maxBetrag?: number | null;
  versandkosten?: number | null;
  bild?: StrapiMedia | null;
  hintergrundbild?: StrapiMedia | null;
  gutscheininhalte?: StrapiTab[] | null;
  heroDarkMode?: boolean | null;
};

export type VoucherContentTab = {
  id: string;
  title: string;
  contentHtml: string;
};

export type VoucherDetail = {
  title: string;
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
    headline: string;
    description: string;
    ctaLabel: string;
    minAmount?: number | null;
    maxAmount?: number | null;
    defaultAmount: number;
  };
  tabs: VoucherContentTab[];
  shippingCost?: number | null;
};

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

function toTabs(tabs: StrapiTab[] | null | undefined): VoucherContentTab[] {
  if (!Array.isArray(tabs)) {
    return [];
  }

  return tabs
    .map((tab, index) => {
      const title = typeof tab?.titel === "string" && tab.titel.trim().length > 0 ? tab.titel.trim() : `Abschnitt ${index + 1}`;
      const contentHtml = ensureHtmlContent(tab?.inhalt);
      if (contentHtml.length === 0) {
        return null;
      }
      const id =
        typeof tab?.id === "number"
          ? `tab-${tab.id}`
          : typeof tab?.id === "string" && tab.id.length > 0
            ? tab.id
            : `tab-${index + 1}`;
      return { id, title, contentHtml };
    })
    .filter((tab): tab is VoucherContentTab => Boolean(tab));
}

function createFallbackVoucherDetail(): VoucherDetail {
  return {
    title: "Geschenkgutschein",
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
      headline: "Gutschein anfordern",
      description: "Wähle einen Wunschbetrag und sichere dir einen Gutschein für unsere Angebote.",
      ctaLabel: "In den Warenkorb",
      minAmount: null,
      maxAmount: null,
      defaultAmount: 25
    },
      tabs: [],
      shippingCost: null
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

    return {
      title: payload.name,
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
        headline:
          payload.bookingbox_headline && payload.bookingbox_headline.trim().length > 0
            ? payload.bookingbox_headline.trim()
            : "Geschenkgutschein sichern",
        description:
          payload.bookingbox_body && payload.bookingbox_body.trim().length > 0
            ? payload.bookingbox_body.trim()
            : "Wähle deinen Wunschbetrag und sichere dir oder deinen Liebsten einen Gutschein für Seminare und Produkte.",
        ctaLabel: "In den Warenkorb",
        minAmount,
        maxAmount,
        defaultAmount
      },
      tabs: toTabs(payload.gutscheininhalte),
      shippingCost: normaliseShippingInput(payload.versandkosten)
    };
  } catch (error) {
    console.warn("[voucher-detail] Konnte Gutschein-Template nicht laden, nutze Fallback:", error);
    return createFallbackVoucherDetail();
  }
}
