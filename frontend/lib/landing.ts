import { fetchJson, mediaUrl } from "./api";
import { generateHTML } from "@tiptap/html";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";

export type SectionBackgroundKey =
  | "neutral"
  | "black"
  | "wine-blue"
  | "wine-blue-light"
  | "wine-blue-lighter"
  | "wine-blue-lightest"
  | "wine-blue-dark"
  | "wine-blue-darker"
  | "wine-blue-darkest";

type ColumnDisplayMode = "box" | "plain";

const SECTION_BACKGROUND_KEYS = new Set<SectionBackgroundKey>([
  "neutral",
  "black",
  "wine-blue",
  "wine-blue-light",
  "wine-blue-lighter",
  "wine-blue-lightest",
  "wine-blue-dark",
  "wine-blue-darker",
  "wine-blue-darkest"
]);

export const SECTION_BACKGROUND_CSS_VAR: Record<SectionBackgroundKey, string> = {
  neutral: "--section-bg-neutral",
  black: "--section-bg-black",
  "wine-blue": "--section-bg-wine-blue",
  "wine-blue-light": "--section-bg-wine-blue-light",
  "wine-blue-lighter": "--section-bg-wine-blue-lighter",
  "wine-blue-lightest": "--section-bg-wine-blue-lightest",
  "wine-blue-dark": "--section-bg-wine-blue-dark",
  "wine-blue-darker": "--section-bg-wine-blue-darker",
  "wine-blue-darkest": "--section-bg-wine-blue-darkest"
};

const DARK_SECTION_BACKGROUNDS = new Set<SectionBackgroundKey>([
  "black",
  "wine-blue-dark",
  "wine-blue-darker",
  "wine-blue-darkest"
]);

const CARD_TEXT_ALIGNMENTS = new Set<"left" | "center" | "right">(["left", "center", "right"]);
const CARD_VERTICAL_ALIGNMENTS = new Set<"top" | "center" | "bottom">(["top", "center", "bottom"]);
const GALLERY_WIDTH_MODES = new Set<"full" | "content">(["full", "content"]);
const COLUMN_DISPLAY_MODES = new Set<ColumnDisplayMode>(["box", "plain"]);

export function resolveSectionBackground(value?: SectionBackgroundKey | null): SectionBackgroundKey {
  if (value && SECTION_BACKGROUND_KEYS.has(value)) {
    return value;
  }
  return "neutral";
}

export function isDarkSectionBackground(value: SectionBackgroundKey): boolean {
  return DARK_SECTION_BACKGROUNDS.has(value);
}

type StrapiUploadFile = {
  url: string;
  alternativeText?: string | null;
  caption?: string | null;
  name?: string | null;
};

type TiptapJSON = {
  type: string;
  attrs?: Record<string, unknown>;
  content?: TiptapJSON[];
  text?: string;
};

type RichTextValue = string | TiptapJSON | null | undefined;

type StrapiCategorySummary = {
  id: number;
  name?: string | null;
  slug?: string | null;
  kurzbeschreibung?: string | null;
};

type StrapiHeroComponent = {
  __component: "landing.hero";
  überschrift: string;
  überschriftStufe?: "h1" | "h2" | "h3" | "h4" | null;
  einleitung?: string | null;
  bildergalerie?: {
    bilder?: (StrapiUploadFile | string | number | null)[] | null;
    rotationSekunden?: number | null;
  } | null;
  video?: {
    video?: StrapiUploadFile | null;
    hintergrundbild?: StrapiUploadFile | null;
  } | null;
  button?: {
    name?: string | null;
    link?: string | null;
    linkExtern?: boolean | null;
    stil?: string | null;
  } | null;
};

type StrapiBildergalerieComponent = {
  __component: "landing.bildergalerie";
  rotationSekunden?: number | null;
  breite?: "full" | "content" | null;
  bilder?: StrapiUploadFile[] | null;
};

type StrapiSeminarListComponent = {
  __component: "landing.seminar-liste";
  überschrift?: string | null;
  überschriftStufe?: "h2" | "h3" | "h4" | null;
  einleitung?: string | null;
  hintergrundfarbe?: string | null;
  anzahl?: number | null;
  buttonText?: string | null;
  mehrButtonText?: string | null;
  mehrButtonAnzeigen?: boolean | null;
  seminarkategorie?: StrapiCategorySummary | null;
};

type StrapiCardComponent = {
  id?: number | null;
  überschrift?: string | null;
  einleitung?: string | null;
  link?: string | null;
  seminarfinderKategorie?: StrapiCategorySummary | null;
  button?: {
    name?: string | null;
    link?: string | null;
    stil?: string | null;
  } | null;
  textAlignment?: "left" | "center" | "right" | null;
  verticalAlignment?: "top" | "center" | "bottom" | null;
  backgroundImage?: StrapiUploadFile | null;
  darkModeEnabled?: boolean | null;
};

type StrapiCardGridComponent = {
  __component: "landing.card-grid";
  hintergrundfarbe?: string | null;
  karten?: StrapiCardComponent[] | null;
};

type StrapiColumnComponent = {
  id?: number | null;
  bild?: StrapiUploadFile | null;
  inhalt?: RichTextValue;
};

type StrapiColumnsComponent = {
  __component: "landing.columns";
  überschrift?: string | null;
  überschriftStufe?: "h2" | "h3" | "h4" | null;
  hintergrundfarbe?: string | null;
  darstellung?: ColumnDisplayMode | null;
  spalten?: StrapiColumnComponent[] | null;
};

type StrapiTrennlinieComponent = {
  __component: "landing.trennlinie";
  breite?: "normal" | "weit" | null;
};

type StrapiTabItemComponent = {
  id?: number | string | null;
  überschrift?: string | null;
  inhalt?: RichTextValue;
};

type StrapiTabsComponent = {
  __component: "landing.tabs";
  überschrift?: string | null;
  überschriftStufe?: "h2" | "h3" | "h4" | null;
  hintergrundfarbe?: string | null;
  reiter?: StrapiTabItemComponent[] | null;
};

type StrapiSeminarFinderComponent = {
  __component: "landing.seminar-finder";
  überschrift?: string | null;
  überschriftStufe?: "h2" | "h3" | "h4" | null;
  hintergrundfarbe?: string | null;
  standardKategorie?: StrapiCategorySummary | null;
  sichtbareFilter?: StrapiCategorySummary[] | null;
};

type StrapiProductSummary = {
  id?: number | null;
  name?: string | null;
  slug?: string | null;
  kurzbeschreibung?: string | null;
  bild?: StrapiUploadFile | null;
};

type StrapiSeminarProductCardsComponent = {
  __component: "landing.seminar-produkt-karten";
  überschrift?: string | null;
  überschriftStufe?: "h2" | "h3" | "h4" | null;
  hintergrundfarbe?: string | null;
  einleitung?: string | null;
  modus?: "seminare" | "produkte" | null;
  seminarkategorie?: StrapiCategorySummary | null;
  produkte?: StrapiProductSummary[] | null;
  anzahl?: number | null;
  buttonText?: string | null;
  mehrButtonText?: string | null;
  mehrButtonAnzeigen?: boolean | null;
};

export type StrapiLandingComponent =
  | StrapiHeroComponent
  | StrapiBildergalerieComponent
  | StrapiSeminarListComponent
  | StrapiCardGridComponent
  | StrapiColumnsComponent
  | StrapiTrennlinieComponent
  | StrapiTabsComponent
  | StrapiSeminarFinderComponent
  | StrapiSeminarProductCardsComponent
  | (Record<string, unknown> & { __component?: string });

type StrapiLandingResponse = {
  titel: string;
  slug: string;
  abschnitte: StrapiLandingComponent[];
};

const toSlideAlt = (file: StrapiUploadFile): string => {
  if (file.alternativeText && file.alternativeText.trim().length > 0) {
    return file.alternativeText.trim();
  }
  if (file.caption && file.caption.trim().length > 0) {
    return file.caption.trim();
  }
  if (file.name && file.name.trim().length > 0) {
    return file.name.trim();
  }
  return "Hero-Bild";
};

const normaliseString = (value: string | null | undefined): string => {
  return typeof value === "string" ? value.trim() : "";
};

const normaliseOptionalString = (value: string | null | undefined): string | null => {
  const trimmed = normaliseString(value);
  return trimmed.length > 0 ? trimmed : null;
};

const pickBestImageUrl = (
  file?: StrapiUploadFile | null,
  preferredOrder: string[] = ["large", "medium", "small", "thumbnail"]
): string | null => {
  if (!file) return null;
  const formats = (file as any)?.formats ?? null;
  for (const key of preferredOrder) {
    const entry = formats?.[key];
    if (entry?.url) {
      const resolved = mediaUrl(entry.url);
      if (resolved) return resolved;
    }
  }
  return mediaUrl(file.url);
};

const slugify = (value: string): string => {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
};

const normaliseSlug = (value: string | null | undefined, fallback: string, id: number): string => {
  if (typeof value === "string") {
    const prepared = slugify(value);
    if (prepared.length > 0) {
      return prepared;
    }
  }

  const fallbackSlug = slugify(fallback);
  if (fallbackSlug.length > 0) {
    return fallbackSlug;
  }

  return `item-${id}`;
};

const RICH_TEXT_IMAGE_SRC_REGEX = /(<img\b[^>]*?\bsrc\s*=\s*)(["'])([^"']+)\2/gi;

const rewriteRichTextMediaSources = (value: string): string => {
  return value.replace(RICH_TEXT_IMAGE_SRC_REGEX, (match, prefix, quote, src) => {
    const resolved = mediaUrl(src);
    if (!resolved || resolved === src) {
      return match;
    }
    return `${prefix}${quote}${resolved}${quote}`;
  });
};

const TIPTAP_EXTENSIONS = [
  StarterKit,
  Link.configure({ openOnClick: true }),
  Image.configure({ HTMLAttributes: { loading: "lazy" } })
];

const extractPlainText = (node?: TiptapJSON | null): string => {
  if (!node) return "";
  if (node.text) return node.text;
  return (node.content ?? []).map(extractPlainText).join(" ").trim();
};

const normaliseRichText = (value: RichTextValue): string | null => {
  if (value == null) {
    return null;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed.length === 0) {
      return null;
    }
    return rewriteRichTextMediaSources(trimmed);
  }

  if (typeof value === "object") {
    try {
      const html = generateHTML(value as TiptapJSON, TIPTAP_EXTENSIONS);
      const trimmed = typeof html === "string" ? html.trim() : "";
      return trimmed ? rewriteRichTextMediaSources(trimmed) : null;
    } catch {
      const fallback = extractPlainText(value as TiptapJSON);
      return fallback ? `<p>${escapeHtml(fallback)}</p>` : null;
    }
  }

  return null;
};

const escapeHtml = (value: string): string =>
  value.replace(/[&<>"']/g, (char) => {
    switch (char) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      case "'":
        return "&#39;";
      default:
        return char;
    }
  });

const normaliseHeroHeadingLevel = (value: string | null | undefined): "h1" | "h2" | "h3" | "h4" => {
  if (value === "h1" || value === "h3" || value === "h4") {
    return value;
  }
  return "h2";
};

const normaliseHeadingLevel = (value: string | null | undefined): "h2" | "h3" | "h4" => {
  if (value === "h3" || value === "h4") {
    return value;
  }
  return "h2";
};

const normaliseBackgroundKey = (value: string | null | undefined): SectionBackgroundKey | null => {
  if (typeof value === "string" && SECTION_BACKGROUND_KEYS.has(value as SectionBackgroundKey)) {
    return value as SectionBackgroundKey;
  }
  return null;
};

const normaliseColumnDisplayMode = (value: string | null | undefined): ColumnDisplayMode => {
  if (typeof value === "string" && COLUMN_DISPLAY_MODES.has(value as ColumnDisplayMode)) {
    return value as ColumnDisplayMode;
  }
  return "plain";
};

const normaliseCardTextAlignment = (value: string | null | undefined): "left" | "center" | "right" => {
  if (typeof value === "string" && CARD_TEXT_ALIGNMENTS.has(value as "left" | "center" | "right")) {
    return value as "left" | "center" | "right";
  }
  return "center";
};

const normaliseCardVerticalAlignment = (value: string | null | undefined): "top" | "center" | "bottom" => {
  if (typeof value === "string" && CARD_VERTICAL_ALIGNMENTS.has(value as "top" | "center" | "bottom")) {
    return value as "top" | "center" | "bottom";
  }
  return "center";
};

const normaliseGalleryWidthMode = (value: string | null | undefined): "full" | "content" => {
  if (typeof value === "string" && GALLERY_WIDTH_MODES.has(value as "full" | "content")) {
    return value as "full" | "content";
  }
  return "full";
};

export type LandingHeroCarouselSection = {
  type: "hero-carousel";
  überschrift: string;
  überschriftStufe: "h1" | "h2" | "h3" | "h4";
  einleitung?: string | null;
  rotationSekunden: number;
  bilder: {
    src: string;
    alt: string;
  }[];
  button?: {
    name: string;
    link: string;
    linkExtern?: boolean | null;
    stil?: string | null;
  } | null;
};

export type LandingHeroSmallSection = {
  type: "hero-small";
  überschrift: string;
  überschriftStufe: "h1" | "h2" | "h3" | "h4";
  einleitung?: string | null;
  bild?: {
    src: string;
    alt: string;
  } | null;
  button?: {
    name: string;
    link: string;
    linkExtern?: boolean | null;
    stil?: string | null;
  } | null;
};

export type LandingHeroBlankSection = {
  type: "hero-blank";
  überschrift: string;
  überschriftStufe: "h1" | "h2" | "h3" | "h4";
  einleitung?: string | null;
  button?: {
    name: string;
    link: string;
    linkExtern?: boolean | null;
    stil?: string | null;
  } | null;
};

export type LandingBildergalerieSection = {
  type: "bildergalerie";
  rotationSekunden: number;
  breite: "full" | "content";
  bilder: {
    src: string;
    alt: string;
  }[];
};

export type LandingHeroVideoSection = {
  type: "hero-video";
  überschrift: string;
  überschriftStufe: "h1" | "h2" | "h3" | "h4";
  einleitung?: string | null;
  videoUrl?: string | null;
  posterUrl?: string | null;
  button?: {
    name: string;
    link: string;
    linkExtern?: boolean | null;
    stil?: string | null;
  } | null;
};

export type LandingCardGridSection = {
  type: "card-grid";
  hintergrund: SectionBackgroundKey | null;
  karten: {
    id: number;
    überschrift: string;
    einleitung?: string | null;
    link?: string | null;
    seminarFinderCategorySlug?: string | null;
    button?: {
      name: string;
      link: string;
      stil?: string | null;
    } | null;
    textAlign: "left" | "center" | "right";
    verticalAlign: "top" | "center" | "bottom";
    backgroundImage?: {
      src: string;
      alt: string;
    } | null;
    darkMode: boolean;
  }[];
};

export type LandingColumnsSection = {
  type: "columns";
  überschrift?: string | null;
  überschriftStufe: "h2" | "h3" | "h4";
  hintergrund: SectionBackgroundKey | null;
  darstellung: ColumnDisplayMode;
  spalten: {
    id: number;
    html?: string | null;
    bild?: {
      src: string;
      alt: string;
    } | null;
  }[];
};

export type LandingDividerSection = {
  type: "divider";
  hintergrund: SectionBackgroundKey | null;
  breite: "normal" | "weit";
};

export type LandingSeminarListSection = {
  type: "seminar-list";
  überschrift?: string | null;
  überschriftStufe: "h2" | "h3" | "h4";
  einleitung?: string | null;
  hintergrund: SectionBackgroundKey | null;
  anzahl: number;
  mehrButtonAnzeigen: boolean;
  buttonText: string;
  mehrButtonText: string;
  category?: {
    id: number;
    name: string;
    slug: string;
    shortDescription?: string | null;
  } | null;
};

export type LandingSeminarProductCardsSection = {
  type: "seminar-product-cards";
  überschrift?: string | null;
  überschriftStufe: "h2" | "h3" | "h4";
  einleitung?: string | null;
  hintergrund: SectionBackgroundKey | null;
  modus: "seminare" | "produkte";
  categorySlug?: string | null;
  produkte: {
    id: number;
    name: string;
    slug: string;
    shortDescription?: string | null;
    image: {
      src: string;
      alt: string;
    } | null;
  }[];
  anzahl: number;
  buttonText: string;
  mehrButtonText: string;
  mehrButtonAnzeigen: boolean;
};

export type LandingTabsSection = {
  type: "tabs";
  überschrift?: string | null;
  überschriftStufe: "h2" | "h3" | "h4";
  hintergrund: SectionBackgroundKey | null;
  reiter: {
    id: string;
    überschrift: string;
    contentHtml: string;
  }[];
};

export type LandingSeminarFinderSection = {
  type: "seminar-finder";
  überschrift?: string | null;
  überschriftStufe: "h2" | "h3" | "h4";
  hintergrund: SectionBackgroundKey | null;
  initialCategorySlug?: string | null;
  allowedCategorySlugs: string[] | null;
};

type LandingUnknownSection = {
  type: "unknown";
  component: string;
  data: Record<string, unknown>;
};

export type LandingSection =
  | LandingHeroVideoSection
  | LandingHeroCarouselSection
  | LandingHeroSmallSection
  | LandingHeroBlankSection
  | LandingBildergalerieSection
  | LandingCardGridSection
  | LandingColumnsSection
  | LandingDividerSection
  | LandingSeminarListSection
  | LandingSeminarProductCardsSection
  | LandingTabsSection
  | LandingSeminarFinderSection
  | LandingUnknownSection;

export type LandingPage = {
  title: string;
  slug: string;
  sections: LandingSection[];
};

const transformHeroCarousel = (component: StrapiHeroComponent): LandingHeroCarouselSection => {
  const rotationSeconds =
    typeof component.bildergalerie?.rotationSekunden === "number" ? component.bildergalerie.rotationSekunden : null;
  const rotationSekunden = rotationSeconds && rotationSeconds > 0 ? rotationSeconds : 4;

  const bilder =
    component.bildergalerie?.bilder
      ?.map((file) => {
        if (!file) return null;
        if (typeof (file as any).url === "string") {
          const src = pickBestImageUrl(file as any);
          if (!src) return null;
          return { src, alt: toSlideAlt(file as any) };
        }
        return null;
      })
      .filter((slide): slide is { src: string; alt: string } => Boolean(slide)) ?? [];

  return {
    type: "hero-carousel",
    überschrift: normaliseString(component.überschrift) || "Hero",
    überschriftStufe: normaliseHeroHeadingLevel(component.überschriftStufe ?? null),
    einleitung: normaliseRichText(component.einleitung ?? null),
    rotationSekunden,
    bilder,
    button: component.button
      ? {
          name: normaliseString(component.button.name ?? "") || "Mehr",
          link: normaliseString(component.button.link ?? "#") || "#",
          linkExtern: component.button.linkExtern ?? false,
          stil: component.button.stil ?? null
        }
      : null
  };
};

const transformHeroSmall = (component: StrapiHeroComponent): LandingHeroSmallSection => {
  const media = component.video?.hintergrundbild ?? null;
  let bild: LandingHeroSmallSection["bild"] = null;

  if (media?.url) {
    const src = pickBestImageUrl(media);
    if (src) {
      bild = {
        src,
        alt: toSlideAlt(media)
      };
    }
  }

  return {
    type: "hero-small",
    überschrift: normaliseString(component.überschrift) || "Hero",
    überschriftStufe: normaliseHeroHeadingLevel(component.überschriftStufe ?? null),
    einleitung: normaliseRichText(component.einleitung ?? null),
    bild
  };
};

const transformHeroBlank = (component: StrapiHeroComponent): LandingHeroBlankSection => {
  return {
    type: "hero-blank",
    überschrift: normaliseString(component.überschrift) || "Hero",
    überschriftStufe: normaliseHeroHeadingLevel(component.überschriftStufe ?? null),
    einleitung: normaliseRichText(component.einleitung ?? null),
    button: component.button
      ? {
          name: normaliseString(component.button.name ?? "") || "Mehr",
          link: normaliseString(component.button.link ?? "#") || "#",
          linkExtern: component.button.linkExtern ?? false,
          stil: component.button.stil ?? null
        }
      : null
  };
};

const transformBildergalerie = (component: StrapiBildergalerieComponent): LandingBildergalerieSection => {
  const rotationSeconds = typeof component.rotationSekunden === "number" ? component.rotationSekunden : null;
  const rotationSekunden = rotationSeconds && rotationSeconds > 0 ? rotationSeconds : 7;
  const breite = normaliseGalleryWidthMode(component.breite ?? null);

  const bilder =
    component.bilder
      ?.map((file) => {
        if (!file?.url) {
          return null;
        }
        const src = pickBestImageUrl(file);
        if (!src) {
          return null;
        }
        return {
          src,
          alt: toSlideAlt(file)
        };
      })
      .filter((slide): slide is { src: string; alt: string } => Boolean(slide)) ?? [];

  return {
    type: "bildergalerie",
    rotationSekunden,
    breite,
    bilder
  };
};

const formatMediaUrl = (file?: StrapiUploadFile | null): string | null => pickBestImageUrl(file);

const transformHeroVideo = (component: StrapiHeroComponent): LandingHeroVideoSection => {
  const videoUrl = formatMediaUrl(component.video?.video ?? null);
  const posterUrl = formatMediaUrl(component.video?.hintergrundbild ?? null);

  return {
    type: "hero-video",
    überschrift: normaliseString(component.überschrift) || "Hero",
    überschriftStufe: normaliseHeroHeadingLevel(component.überschriftStufe ?? null),
    einleitung: normaliseRichText(component.einleitung ?? null),
    videoUrl,
    posterUrl,
    button: component.button
      ? {
          name: normaliseString(component.button.name ?? "") || "Mehr",
          link: normaliseString(component.button.link ?? "#") || "#",
          linkExtern: component.button.linkExtern ?? false,
          stil: component.button.stil ?? null
        }
      : null
  };
};

const transformUnifiedHero = (component: StrapiHeroComponent): LandingSection => {
  const hasVideo = Boolean(component.video?.video);
  const hasGallery = Array.isArray(component.bildergalerie?.bilder) && component.bildergalerie!.bilder!.length > 0;

  if (hasVideo) {
    return transformHeroVideo(component);
  }
  if (hasGallery) {
    return transformHeroCarousel({
      __component: "landing.hero",
      überschrift: component.überschrift,
      überschriftStufe: component.überschriftStufe,
      einleitung: component.einleitung,
      bildergalerie: component.bildergalerie,
      button: component.button
    } as any);
  }
  // Fallback: Blank Hero
  return transformHeroBlank({
    __component: "landing.hero-blank",
    überschrift: component.überschrift,
    überschriftStufe: component.überschriftStufe,
    einleitung: component.einleitung,
    button: component.button ?? null
  } as any);
};

const transformSeminarList = (
  component: StrapiSeminarListComponent
): LandingSeminarListSection | LandingUnknownSection => {
  const anzahl = typeof component.anzahl === "number" && component.anzahl > 0 ? component.anzahl : 6;
  const category = component.seminarkategorie;

  const name = category ? normaliseString(category.name) : "";
  const slug =
    category && typeof category.id === "number" && category.id > 0
      ? normaliseSlug(category.slug, name, category.id)
      : null;

  return {
    type: "seminar-list",
    überschrift: normaliseOptionalString(component.überschrift ?? null),
    überschriftStufe: normaliseHeadingLevel(component.überschriftStufe ?? null),
    einleitung: normaliseRichText(component.einleitung ?? null),
    hintergrund: normaliseBackgroundKey(component.hintergrundfarbe ?? null),
    anzahl,
    mehrButtonAnzeigen: component.mehrButtonAnzeigen !== false,
    buttonText: normaliseString(component.buttonText ?? null) || "Zum Seminar",
    mehrButtonText: normaliseString(component.mehrButtonText ?? null) || "Mehr laden",
    category: {
      id: category?.id ?? -1,
      name: name.length > 0 ? name : "Alle Seminare",
      slug: slug ?? "",
      shortDescription: normaliseOptionalString(category?.kurzbeschreibung ?? null)
    }
  };
};

const formatProductImage = (media?: StrapiUploadFile | null): { src: string; alt: string } | null => {
  if (!media?.url) {
    return null;
  }
  const src = pickBestImageUrl(media);
  if (!src) {
    return null;
  }
  return {
    src,
    alt: toSlideAlt(media)
  };
};

const transformSeminarProductCards = (
  component: StrapiSeminarProductCardsComponent
): LandingSeminarProductCardsSection | LandingUnknownSection => {
  const modus = component.modus === "produkte" ? "produkte" : "seminare";
  const anzahl = typeof component.anzahl === "number" && component.anzahl > 0 ? component.anzahl : 6;
  const headingLevel = normaliseHeadingLevel(component.überschriftStufe ?? null);
  const buttonText = normaliseString(component.buttonText ?? null) || "Mehr erfahren";
  const mehrButtonText = normaliseString(component.mehrButtonText ?? null) || "Mehr laden";
  const mehrButtonAnzeigen = component.mehrButtonAnzeigen !== false;

  const categorySlug =
    component.seminarkategorie?.slug && component.seminarkategorie.slug.length > 0
      ? component.seminarkategorie.slug
      : null;

  if (modus === "seminare" && !categorySlug) {
    return {
      type: "unknown",
      component: component.__component,
      data: {
        reason: "missing-category"
      }
    };
  }

  const produkte =
    component.produkte
      ?.map((product) => {
        const id = typeof product?.id === "number" ? product.id : null;
        const name = normaliseString(product?.name ?? null);
        if (!id || name.length === 0) {
          return null;
        }

        const slug = normaliseSlug(product?.slug, name, id);
        if (slug.length === 0) {
          return null;
        }

        return {
          id,
          name,
          slug,
          shortDescription: normaliseOptionalString(product?.kurzbeschreibung ?? null),
          image: formatProductImage(product?.bild ?? null)
        };
      })
      .filter((item): item is NonNullable<typeof item> => Boolean(item)) ?? [];

  return {
    type: "seminar-product-cards",
    überschrift: normaliseOptionalString(component.überschrift ?? null),
    überschriftStufe: headingLevel,
    einleitung: normaliseRichText(component.einleitung ?? null),
    hintergrund: normaliseBackgroundKey(component.hintergrundfarbe ?? null),
    modus,
    categorySlug,
    produkte,
    anzahl,
    buttonText,
    mehrButtonText,
    mehrButtonAnzeigen
  };
};

const transformCardGrid = (component: StrapiCardGridComponent): LandingCardGridSection => {
  const cards =
    component.karten
      ?.map((card, index) => {
        const überschrift = normaliseString(card?.überschrift ?? null);
        if (überschrift.length === 0) {
          return null;
        }

        let backgroundImage: { src: string; alt: string } | null = null;
        const media = card?.backgroundImage ?? null;
        if (media?.url) {
          // Für Kacheln reicht das kleine Format (500px), danach steigern
          const src = pickBestImageUrl(media, ["small", "medium", "large", "thumbnail"]);
          if (src) {
            backgroundImage = {
              src,
              alt: toSlideAlt(media)
            };
          }
        }

        return {
          id: typeof card?.id === "number" ? card.id : index,
          überschrift,
          einleitung: normaliseOptionalString(card?.einleitung ?? null),
          link: normaliseOptionalString(card?.link ?? null),
          seminarFinderCategorySlug: normaliseOptionalString(card?.seminarfinderKategorie?.slug ?? null),
          button:
            card?.button && normaliseOptionalString(card.button.link ?? null)
              ? {
                  name: normaliseString(card.button.name ?? "") || "Mehr erfahren",
                  link: normaliseString(card.button.link ?? ""),
                  stil: card.button.stil ?? null
                }
              : null,
          textAlign: normaliseCardTextAlignment(card?.textAlignment ?? null),
          verticalAlign: normaliseCardVerticalAlignment(card?.verticalAlignment ?? null),
          backgroundImage,
          darkMode: Boolean(card?.darkModeEnabled)
        };
      })
      .filter((card): card is NonNullable<typeof card> => Boolean(card)) ?? [];

  return {
    type: "card-grid",
    hintergrund: normaliseBackgroundKey(component.hintergrundfarbe ?? null),
    karten: cards
  };
};

const transformColumnsSection = (component: StrapiColumnsComponent): LandingColumnsSection => {
  const columns =
    component.spalten
      ?.map((column, index) => {
        const html = normaliseRichText(column?.inhalt ?? null);

        let bild: { src: string; alt: string } | null = null;
        const media = column?.bild ?? null;
        if (media?.url) {
          const src = pickBestImageUrl(media);
          if (src) {
            bild = {
              src,
              alt: toSlideAlt(media)
            };
          }
        }

        if (!html && !bild) {
          return null;
        }

        return {
          id: typeof column?.id === "number" ? column.id : index,
          html,
          bild
        };
      })
      .filter((column): column is NonNullable<typeof column> => Boolean(column)) ?? [];

  return {
    type: "columns",
    überschrift: normaliseOptionalString(component.überschrift ?? null),
    überschriftStufe: normaliseHeadingLevel(component.überschriftStufe ?? null),
    hintergrund: normaliseBackgroundKey(component.hintergrundfarbe ?? null),
    darstellung: normaliseColumnDisplayMode(component.darstellung ?? null),
    spalten: columns
  };
};

const transformDividerSection = (component: StrapiTrennlinieComponent): LandingDividerSection => {
  return {
    type: "divider",
    hintergrund: "neutral",
    breite: component.breite === "weit" ? "weit" : "normal"
  };
};

const transformTabsSection = (component: StrapiTabsComponent): LandingTabsSection => {
  const reiter =
    component.reiter
      ?.map((tab, index) => {
        const überschrift = normaliseString(tab?.überschrift ?? null);
        const contentHtml = normaliseRichText(tab?.inhalt ?? null);
        if (überschrift.length === 0 || !contentHtml) {
          return null;
        }
        const id = typeof tab?.id === "number" || typeof tab?.id === "string" ? String(tab.id) : `tab-${index + 1}`;
        return {
          id,
          überschrift,
          contentHtml
        };
      })
      .filter((tab): tab is NonNullable<typeof tab> => Boolean(tab)) ?? [];

  return {
    type: "tabs",
    überschrift: normaliseOptionalString(component.überschrift ?? null),
    überschriftStufe: normaliseHeadingLevel(component.überschriftStufe ?? null),
    hintergrund: normaliseBackgroundKey(component.hintergrundfarbe ?? null),
    reiter
  };
};

const transformSeminarFinderSection = (
  component: StrapiSeminarFinderComponent
): LandingSeminarFinderSection => {
  const categorySlug = normaliseOptionalString(component.standardKategorie?.slug ?? null);
  const allowedCategorySlugs =
    component.sichtbareFilter
      ?.map((item) => normaliseOptionalString(item?.slug ?? null))
      .filter((slug): slug is string => Boolean(slug)) ?? [];

  return {
    type: "seminar-finder",
    überschrift: normaliseOptionalString(component.überschrift ?? null),
    überschriftStufe: normaliseHeadingLevel(component.überschriftStufe ?? null),
    hintergrund: normaliseBackgroundKey(component.hintergrundfarbe ?? null),
    initialCategorySlug: categorySlug,
    allowedCategorySlugs: allowedCategorySlugs.length > 0 ? allowedCategorySlugs : null
  };
};

const transformSection = (component: StrapiLandingComponent): LandingSection => {
  if (component.__component === "landing.hero") {
    return transformUnifiedHero(component as StrapiHeroComponent);
  }
  if (component.__component === "landing.bildergalerie") {
    return transformBildergalerie(component as StrapiBildergalerieComponent);
  }
  if (component.__component === "landing.seminar-liste") {
    return transformSeminarList(component as StrapiSeminarListComponent);
  }
  if (component.__component === "landing.seminar-produkt-karten") {
    return transformSeminarProductCards(component as StrapiSeminarProductCardsComponent);
  }
  if (component.__component === "landing.card-grid") {
    return transformCardGrid(component as StrapiCardGridComponent);
  }
  if (component.__component === "landing.columns") {
    return transformColumnsSection(component as StrapiColumnsComponent);
  }
  if (component.__component === "landing.trennlinie") {
    return transformDividerSection(component as StrapiTrennlinieComponent);
  }
  if (component.__component === "landing.tabs") {
    return transformTabsSection(component as StrapiTabsComponent);
  }
  if (component.__component === "landing.seminar-finder") {
    return transformSeminarFinderSection(component as StrapiSeminarFinderComponent);
  }
  return {
    type: "unknown",
    component: component.__component ?? "unbekannt",
    data: component as Record<string, unknown>
  };
};

export const transformLandingSection = (component: StrapiLandingComponent): LandingSection => {
  return transformSection(component);
};

export async function fetchLandingPage(
  slug: string,
  options?: { status?: "draft" | "published" }
): Promise<LandingPage> {
  const status = options?.status === "draft" ? "draft" : "published";
  const searchParams = new URLSearchParams();

  if (status === "draft") {
    searchParams.set("status", "draft");
    const token = process.env.PREVIEW_SECRET ?? process.env.ADMIN_JWT_SECRET;
    if (token) {
      searchParams.set("token", token);
    }
  }

  const query = searchParams.toString();
  const response = await fetchJson<StrapiLandingResponse>(
    `/public/landing-pages/${slug}${query ? `?${query}` : ""}`,
    {
      cache: "no-store"
    }
  );

  const sections = Array.isArray(response.abschnitte)
    ? response.abschnitte.map(transformSection)
    : [];

 return {
   title: response.titel,
   slug: response.slug,
    sections
  };
}
