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
  headline: string;
  headlineLevel?: "h1" | "h2" | "h3" | "h4" | null;
  einleitung?: string | null;
  videoUrl?: string | null;
  posterUrl?: string | null;
  buttonLabel?: string | null;
  buttonLink?: string | null;
};

type StrapiHeroCarouselComponent = {
  __component: "landing.hero-carousel";
  headline: string;
  headlineLevel?: "h1" | "h2" | "h3" | "h4" | null;
  einleitung?: string | null;
  rotationDelaySeconds?: number | null;
  bilder?: StrapiUploadFile[] | null;
};

type StrapiHeroSmallComponent = {
  __component: "landing.hero-small";
  headline: string;
  headlineLevel?: "h1" | "h2" | "h3" | "h4" | null;
  einleitung?: string | null;
  hintergrundbild?: StrapiUploadFile | null;
};

type StrapiSeminarListComponent = {
  __component: "landing.seminar-liste";
  headline?: string | null;
  headlineLevel?: "h2" | "h3" | "h4" | null;
  einleitung?: string | null;
  sectionBackground?: string | null;
  limit?: number | null;
  ctaLabel?: string | null;
  mehrButtonLabel?: string | null;
  mehrButtonAktiv?: boolean | null;
  seminarkategorie?: StrapiCategorySummary | null;
};

type StrapiCardComponent = {
  id?: number | null;
  headline?: string | null;
  einleitung?: string | null;
  link?: string | null;
  textAlignment?: "left" | "center" | "right" | null;
  verticalAlignment?: "top" | "center" | "bottom" | null;
  backgroundImage?: StrapiUploadFile | null;
  darkModeEnabled?: boolean | null;
};

type StrapiCardGridComponent = {
  __component: "landing.card-grid";
  sectionBackground?: string | null;
  karten?: StrapiCardComponent[] | null;
};

type StrapiTextBlockComponent = {
  __component: "landing.text-block";
  sectionBackground?: string | null;
  einleitung?: string | null;
  buttonLabel?: string | null;
  buttonLink?: string | null;
  /** Legacy-Felder – werden zu HTML migriert */
  headline?: string | null;
  headlineLevel?: "h2" | "h3" | "h4" | null;
};

type StrapiIconItemComponent = {
  id?: number | null;
  icon?: string | null;
  headline?: string | null;
  einleitung?: string | null;
};

type StrapiIconGridComponent = {
  __component: "landing.icon-grid";
  headline?: string | null;
  headlineLevel?: "h2" | "h3" | "h4" | null;
  sectionBackground?: string | null;
  einleitung?: string | null;
  items?: StrapiIconItemComponent[] | null;
};

type StrapiTabItemComponent = {
  id?: number | string | null;
  headline?: string | null;
  inhalt?: string | null;
};

type StrapiTabsComponent = {
  __component: "landing.tabs";
  headline?: string | null;
  headlineLevel?: "h2" | "h3" | "h4" | null;
  sectionBackground?: string | null;
  tabs?: StrapiTabItemComponent[] | null;
};

type StrapiSeminarFinderComponent = {
  __component: "landing.seminar-finder";
  headline?: string | null;
  headlineLevel?: "h2" | "h3" | "h4" | null;
  sectionBackground?: string | null;
  standardKategorie?: StrapiCategorySummary | null;
  sichtbareFilter?: StrapiCategorySummary[] | null;
};

type StrapiLandingComponent =
  | StrapiHeroComponent
  | StrapiHeroCarouselComponent
  | StrapiHeroSmallComponent
  | StrapiSeminarListComponent
  | StrapiCardGridComponent
  | StrapiTextBlockComponent
  | StrapiIconGridComponent
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

const normaliseRichText = (value: string | null | undefined): string | null => {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
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

const normaliseCardTextAlignment = (value: string | null | undefined): "left" | "center" | "right" => {
  if (typeof value === "string" && CARD_TEXT_ALIGNMENTS.has(value as "left" | "center" | "right")) {
    return value as "left" | "center" | "right";
  }
  return "left";
};

const normaliseCardVerticalAlignment = (value: string | null | undefined): "top" | "center" | "bottom" => {
  if (typeof value === "string" && CARD_VERTICAL_ALIGNMENTS.has(value as "top" | "center" | "bottom")) {
    return value as "top" | "center" | "bottom";
  }
  return "top";
};

export type LandingHeroCarouselSection = {
  type: "hero-carousel";
  headline: string;
  headlineLevel: "h1" | "h2" | "h3" | "h4";
  intro?: string | null;
  rotationIntervalMs: number;
  slides: {
    src: string;
    alt: string;
  }[];
};

export type LandingHeroSmallSection = {
  type: "hero-small";
  headline: string;
  headlineLevel: "h1" | "h2" | "h3" | "h4";
  intro?: string | null;
  image?: {
    src: string;
    alt: string;
  } | null;
};

export type LandingHeroVideoSection = {
  type: "hero-video";
  headline: string;
  headlineLevel: "h1" | "h2" | "h3" | "h4";
  intro?: string | null;
  videoUrl?: string | null;
  posterUrl?: string | null;
  buttonLabel?: string | null;
  buttonLink?: string | null;
};

export type LandingCardGridSection = {
  type: "card-grid";
  background: SectionBackgroundKey | null;
  cards: {
    id: number;
    headline: string;
    intro?: string | null;
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

export type LandingTextBlockSection = {
  type: "text-block";
  background: SectionBackgroundKey | null;
  html?: string | null;
  buttonLabel?: string | null;
  buttonLink?: string | null;
};

export type LandingIconGridSection = {
  type: "icon-grid";
  headline?: string | null;
  headlineLevel: "h2" | "h3" | "h4";
  intro?: string | null;
  background: SectionBackgroundKey | null;
  items: {
    id: number;
    icon: string;
    headline: string;
    intro?: string | null;
  }[];
};

export type LandingSeminarListSection = {
  type: "seminar-list";
  headline?: string | null;
  headlineLevel: "h2" | "h3" | "h4";
  intro?: string | null;
  background: SectionBackgroundKey | null;
  limit: number;
  showLoadMore: boolean;
  ctaLabel: string;
  loadMoreLabel: string;
  category: {
    id: number;
    name: string;
    slug: string;
    shortDescription?: string | null;
  };
};

export type LandingTabsSection = {
  type: "tabs";
  headline?: string | null;
  headlineLevel: "h2" | "h3" | "h4";
  background: SectionBackgroundKey | null;
  tabs: {
    id: string;
    headline: string;
    contentHtml: string;
  }[];
};

export type LandingSeminarFinderSection = {
  type: "seminar-finder";
  headline?: string | null;
  headlineLevel: "h2" | "h3" | "h4";
  background: SectionBackgroundKey | null;
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
  | LandingCardGridSection
  | LandingTextBlockSection
  | LandingIconGridSection
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
  const rotationSeconds = typeof component.rotationDelaySeconds === "number" ? component.rotationDelaySeconds : null;
  const rotationIntervalMs = rotationSeconds && rotationSeconds > 0 ? rotationSeconds * 1000 : 8000;

  const slides =
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
    headline: normaliseString(component.headline) || "Hero",
    headlineLevel: normaliseHeroHeadingLevel(component.headlineLevel ?? null),
    intro: normaliseRichText(component.einleitung ?? null),
    rotationIntervalMs,
    slides
  };
};

const transformHeroSmall = (component: StrapiHeroSmallComponent): LandingHeroSmallSection => {
  const media = component.hintergrundbild ?? null;
  let image: LandingHeroSmallSection["image"] = null;

  if (media?.url) {
    const src = mediaUrl(media.url);
    if (src) {
      image = {
        src,
        alt: toSlideAlt(media)
      };
    }
  }

  return {
    type: "hero-small",
    headline: normaliseString(component.headline) || "Hero",
    headlineLevel: normaliseHeroHeadingLevel(component.headlineLevel ?? null),
    intro: normaliseRichText(component.einleitung ?? null),
    image
  };
};

const transformHeroVideo = (component: StrapiHeroComponent): LandingHeroVideoSection => {
  return {
    type: "hero-video",
    headline: normaliseString(component.headline) || "Hero",
    headlineLevel: normaliseHeroHeadingLevel(component.headlineLevel ?? null),
    intro: normaliseRichText(component.einleitung ?? null),
    videoUrl: component.videoUrl ?? null,
    posterUrl: component.posterUrl ?? null,
    buttonLabel: normaliseOptionalString(component.buttonLabel ?? null),
    buttonLink: normaliseOptionalString(component.buttonLink ?? null)
  };
};

const transformSeminarList = (
  component: StrapiSeminarListComponent
): LandingSeminarListSection | LandingUnknownSection => {
  const limit = typeof component.limit === "number" && component.limit > 0 ? component.limit : 6;
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
    headline: normaliseOptionalString(component.headline ?? null),
    headlineLevel: normaliseHeadingLevel(component.headlineLevel ?? null),
    intro: normaliseRichText(component.einleitung ?? null),
    background: normaliseBackgroundKey(component.sectionBackground ?? null),
    limit,
    showLoadMore: component.mehrButtonAktiv !== false,
    ctaLabel: normaliseString(component.ctaLabel ?? null) || "Zum Seminar",
    loadMoreLabel: normaliseString(component.mehrButtonLabel ?? null) || "Mehr laden",
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
        const headline = normaliseString(card?.headline ?? null);
        if (headline.length === 0) {
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
          headline,
          intro: normaliseOptionalString(card?.einleitung ?? null),
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
    background: normaliseBackgroundKey(component.sectionBackground ?? null),
    cards
  };
};

const transformTextBlock = (component: StrapiTextBlockComponent): LandingTextBlockSection => {
  const background = normaliseBackgroundKey(component.sectionBackground ?? null);
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
    background,
    html: htmlParts.length > 0 ? htmlParts.join("\n") : null,
    buttonLabel: normaliseOptionalString(component.buttonLabel ?? null),
    buttonLink: normaliseOptionalString(component.buttonLink ?? null)
  };
};

const transformIconGrid = (component: StrapiIconGridComponent): LandingIconGridSection => {
  const items =
    component.items
      ?.map((item, index) => {
        const headline = normaliseString(item?.headline ?? null);
        if (headline.length === 0) {
          return null;
        }
        return {
          id: typeof item?.id === "number" ? item.id : index,
          icon: normaliseString(item?.icon ?? null) || "sparkles",
          headline,
          intro: normaliseRichText(item?.einleitung ?? null)
        };
      })
      .filter((item): item is NonNullable<typeof item> => Boolean(item)) ?? [];

  return {
    type: "icon-grid",
    headline: normaliseOptionalString(component.headline ?? null),
    headlineLevel: normaliseHeadingLevel(component.headlineLevel ?? null),
    intro: normaliseRichText(component.einleitung ?? null),
    background: normaliseBackgroundKey(component.sectionBackground ?? null),
    items
  };
};

const transformTabsSection = (component: StrapiTabsComponent): LandingTabsSection => {
  const tabs =
    component.tabs
      ?.map((tab, index) => {
        const headline = normaliseString(tab?.headline ?? null);
        const contentHtml = normaliseRichText(tab?.inhalt ?? null);
        if (headline.length === 0 || !contentHtml) {
          return null;
        }
        const id = typeof tab?.id === "number" || typeof tab?.id === "string" ? String(tab.id) : `tab-${index + 1}`;
        return {
          id,
          headline,
          contentHtml
        };
      })
      .filter((tab): tab is NonNullable<typeof tab> => Boolean(tab)) ?? [];

  return {
    type: "tabs",
    headline: normaliseOptionalString(component.headline ?? null),
    headlineLevel: normaliseHeadingLevel(component.headlineLevel ?? null),
    background: normaliseBackgroundKey(component.sectionBackground ?? null),
    tabs
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
    headline: normaliseOptionalString(component.headline ?? null),
    headlineLevel: normaliseHeadingLevel(component.headlineLevel ?? null),
    background: normaliseBackgroundKey(component.sectionBackground ?? null),
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
  if (component.__component === "landing.seminar-liste") {
    return transformSeminarList(component as StrapiSeminarListComponent);
  }
  if (component.__component === "landing.card-grid") {
    return transformCardGrid(component as StrapiCardGridComponent);
  }
  if (component.__component === "landing.text-block") {
    return transformTextBlock(component as StrapiTextBlockComponent);
  }
  if (component.__component === "landing.icon-grid") {
    return transformIconGrid(component as StrapiIconGridComponent);
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
