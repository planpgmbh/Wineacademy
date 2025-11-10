import { fetchJson, mediaUrl } from "./api";

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
  videoUrl?: string | null;
  posterUrl?: string | null;
  buttonText?: string | null;
  buttonLink?: string | null;
};

type StrapiHeroCarouselComponent = {
  __component: "landing.hero-carousel";
  überschrift: string;
  überschriftStufe?: "h1" | "h2" | "h3" | "h4" | null;
  einleitung?: string | null;
  rotationSekunden?: number | null;
  bilder?: StrapiUploadFile[] | null;
};

type StrapiHeroSmallComponent = {
  __component: "landing.hero-small";
  überschrift: string;
  überschriftStufe?: "h1" | "h2" | "h3" | "h4" | null;
  einleitung?: string | null;
  hintergrundbild?: StrapiUploadFile | null;
};

type StrapiHeroBlankComponent = {
  __component: "landing.hero-blank";
  überschrift: string;
  überschriftStufe?: "h1" | "h2" | "h3" | "h4" | null;
  einleitung?: string | null;
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
  inhalt?: string | null;
};

type StrapiColumnsComponent = {
  __component: "landing.columns";
  hintergrundfarbe?: string | null;
  darstellung?: ColumnDisplayMode | null;
  spalten?: StrapiColumnComponent[] | null;
};

type StrapiTrennlinieComponent = {
  __component: "landing.trennlinie";
  hintergrundfarbe?: string | null;
};

type StrapiTextBlockComponent = {
  __component: "landing.text-block";
  hintergrundfarbe?: string | null;
  einleitung?: string | null;
  buttonText?: string | null;
  buttonLink?: string | null;
  /** Legacy-Felder – werden zu HTML migriert */
  headline?: string | null;
  headlineLevel?: "h2" | "h3" | "h4" | null;
};

type StrapiTabItemComponent = {
  id?: number | string | null;
  überschrift?: string | null;
  inhalt?: string | null;
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

type StrapiLandingComponent =
  | StrapiHeroComponent
  | StrapiHeroCarouselComponent
  | StrapiHeroSmallComponent
  | StrapiHeroBlankComponent
  | StrapiBildergalerieComponent
  | StrapiSeminarListComponent
  | StrapiCardGridComponent
  | StrapiColumnsComponent
  | StrapiTrennlinieComponent
  | StrapiTextBlockComponent
  | StrapiTabsComponent
  | StrapiSeminarFinderComponent
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

const normaliseRichText = (value: string | null | undefined): string | null => {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return null;
  }
  return rewriteRichTextMediaSources(trimmed);
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
  return "box";
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
};

export type LandingHeroBlankSection = {
  type: "hero-blank";
  überschrift: string;
  überschriftStufe: "h1" | "h2" | "h3" | "h4";
  einleitung?: string | null;
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
  buttonText?: string | null;
  buttonLink?: string | null;
};

export type LandingCardGridSection = {
  type: "card-grid";
  hintergrund: SectionBackgroundKey | null;
  karten: {
    id: number;
    überschrift: string;
    einleitung?: string | null;
    link?: string | null;
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
};

export type LandingTextBlockSection = {
  type: "text-block";
  hintergrund: SectionBackgroundKey | null;
  html?: string | null;
  buttonText?: string | null;
  buttonLink?: string | null;
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
  category: {
    id: number;
    name: string;
    slug: string;
    shortDescription?: string | null;
  };
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
  | LandingTextBlockSection
  | LandingSeminarListSection
  | LandingTabsSection
  | LandingSeminarFinderSection
  | LandingUnknownSection;

export type LandingPage = {
  title: string;
  slug: string;
  sections: LandingSection[];
};

const transformHeroCarousel = (component: StrapiHeroCarouselComponent): LandingHeroCarouselSection => {
  const rotationSeconds = typeof component.rotationSekunden === "number" ? component.rotationSekunden : null;
  const rotationSekunden = rotationSeconds && rotationSeconds > 0 ? rotationSeconds : 8;

  const bilder =
    component.bilder
      ?.map((file) => {
        if (!file?.url) {
          return null;
        }
        const src = mediaUrl(file.url);
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
    type: "hero-carousel",
    überschrift: normaliseString(component.überschrift) || "Hero",
    überschriftStufe: normaliseHeroHeadingLevel(component.überschriftStufe ?? null),
    einleitung: normaliseRichText(component.einleitung ?? null),
    rotationSekunden,
    bilder
  };
};

const transformHeroSmall = (component: StrapiHeroSmallComponent): LandingHeroSmallSection => {
  const media = component.hintergrundbild ?? null;
  let bild: LandingHeroSmallSection["bild"] = null;

  if (media?.url) {
    const src = mediaUrl(media.url);
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

const transformHeroBlank = (component: StrapiHeroBlankComponent): LandingHeroBlankSection => {
  return {
    type: "hero-blank",
    überschrift: normaliseString(component.überschrift) || "Hero",
    überschriftStufe: normaliseHeroHeadingLevel(component.überschriftStufe ?? null),
    einleitung: normaliseRichText(component.einleitung ?? null)
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
        const src = mediaUrl(file.url);
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

const transformHeroVideo = (component: StrapiHeroComponent): LandingHeroVideoSection => {
  return {
    type: "hero-video",
    überschrift: normaliseString(component.überschrift) || "Hero",
    überschriftStufe: normaliseHeroHeadingLevel(component.überschriftStufe ?? null),
    einleitung: normaliseRichText(component.einleitung ?? null),
    videoUrl: component.videoUrl ?? null,
    posterUrl: component.posterUrl ?? null,
    buttonText: normaliseOptionalString(component.buttonText ?? null),
    buttonLink: normaliseOptionalString(component.buttonLink ?? null)
  };
};

const transformSeminarList = (
  component: StrapiSeminarListComponent
): LandingSeminarListSection | LandingUnknownSection => {
  const anzahl = typeof component.anzahl === "number" && component.anzahl > 0 ? component.anzahl : 6;
  const category = component.seminarkategorie;

  if (!category || typeof category.id !== "number" || category.id <= 0) {
    return {
      type: "unknown",
      component: component.__component,
      data: {
        reason: "missing-category"
      }
    };
  }

  const name = normaliseString(category.name);
  const slug = normaliseSlug(category.slug, name, category.id);

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
      id: category.id,
      name: name.length > 0 ? name : "Kategorie",
      slug,
      shortDescription: normaliseOptionalString(category.kurzbeschreibung ?? null)
    }
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
          const src = mediaUrl(media.url);
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
          const src = mediaUrl(media.url);
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
    hintergrund: normaliseBackgroundKey(component.hintergrundfarbe ?? null),
    darstellung: normaliseColumnDisplayMode(component.darstellung ?? null),
    spalten: columns
  };
};

const transformDividerSection = (component: StrapiTrennlinieComponent): LandingDividerSection => {
  return {
    type: "divider",
    hintergrund: normaliseBackgroundKey(component.hintergrundfarbe ?? null)
  };
};

const transformTextBlock = (component: StrapiTextBlockComponent): LandingTextBlockSection => {
  const hintergrund = normaliseBackgroundKey(component.hintergrundfarbe ?? null);
  const richText = normaliseRichText(component.einleitung ?? null);
  const rawHeading = normaliseString(component.headline ?? null);
  const isPlaceholderHeading = rawHeading.toLowerCase() === "textblock" || rawHeading.length === 0;
  const heading = isPlaceholderHeading ? "" : rawHeading;
  const headingLevel = normaliseHeadingLevel(component.headlineLevel ?? null);

  const headingHtml = heading.length > 0 ? `<${headingLevel}>${escapeHtml(heading)}</${headingLevel}>` : "";
  const htmlParts: string[] = [];
  if (headingHtml.length > 0) {
    htmlParts.push(headingHtml);
  }
  if (richText) {
    htmlParts.push(richText);
  }

  return {
    type: "text-block",
    hintergrund,
    html: htmlParts.length > 0 ? htmlParts.join("\n") : null,
    buttonText: normaliseOptionalString(component.buttonText ?? null),
    buttonLink: normaliseOptionalString(component.buttonLink ?? null)
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
    return transformHeroVideo(component as StrapiHeroComponent);
  }
  if (component.__component === "landing.hero-carousel") {
    return transformHeroCarousel(component as StrapiHeroCarouselComponent);
  }
  if (component.__component === "landing.hero-small") {
    return transformHeroSmall(component as StrapiHeroSmallComponent);
  }
  if (component.__component === "landing.hero-blank") {
    return transformHeroBlank(component as StrapiHeroBlankComponent);
  }
  if (component.__component === "landing.bildergalerie") {
    return transformBildergalerie(component as StrapiBildergalerieComponent);
  }
  if (component.__component === "landing.seminar-liste") {
    return transformSeminarList(component as StrapiSeminarListComponent);
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
  if (component.__component === "landing.text-block") {
    return transformTextBlock(component as StrapiTextBlockComponent);
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

export async function fetchLandingPage(slug: string): Promise<LandingPage> {
  const response = await fetchJson<StrapiLandingResponse>(`/public/landing-pages/${slug}`, {
    cache: "no-store"
  });

  const sections = Array.isArray(response.abschnitte)
    ? response.abschnitte.map(transformSection)
    : [];

 return {
   title: response.titel,
   slug: response.slug,
    sections
  };
}
