import { fetchJson, mediaUrl } from "./api";

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
  titel: string;
  text?: string | null;
  videoUrl?: string | null;
  posterUrl?: string | null;
  buttonLabel?: string | null;
  buttonLink?: string | null;
};

type StrapiHeroCarouselComponent = {
  __component: "landing.hero-carousel";
  titel: string;
  text?: string | null;
  rotationDelaySeconds?: number | null;
  bilder?: StrapiUploadFile[] | null;
};

type StrapiSeminarListComponent = {
  __component: "landing.seminar-liste";
  ueberschrift?: string | null;
  einleitung?: string | null;
  limit?: number | null;
  ctaLabel?: string | null;
  mehrButtonLabel?: string | null;
  mehrButtonAktiv?: boolean | null;
  seminarkategorie?: StrapiCategorySummary | null;
};

type StrapiCardComponent = {
  id?: number | null;
  titel?: string | null;
  untertitel?: string | null;
  link?: string | null;
};

type StrapiCardGridComponent = {
  __component: "landing.card-grid";
  titel?: string | null;
  beschreibung?: string | null;
  karten?: StrapiCardComponent[] | null;
};

type StrapiTextBlockComponent = {
  __component: "landing.text-block";
  titel: string;
  text?: string | null;
  buttonLabel?: string | null;
  buttonLink?: string | null;
};

type StrapiIconItemComponent = {
  id?: number | null;
  icon?: string | null;
  titel?: string | null;
  text?: string | null;
};

type StrapiIconGridComponent = {
  __component: "landing.icon-grid";
  titel?: string | null;
  beschreibung?: string | null;
  items?: StrapiIconItemComponent[] | null;
};

type StrapiLandingComponent =
  | StrapiHeroComponent
  | StrapiHeroCarouselComponent
  | StrapiSeminarListComponent
  | StrapiCardGridComponent
  | StrapiTextBlockComponent
  | StrapiIconGridComponent
  | (Record<string, unknown> & { __component?: string });

type StrapiLandingResponse = {
  titel: string;
  slug: string;
  abschnitte: StrapiLandingComponent[];
};

export type LandingHeroCarouselSection = {
  type: "hero-carousel";
  title: string;
  intro?: string | null;
  rotationIntervalMs: number;
  slides: {
    src: string;
    alt: string;
  }[];
};

export type LandingHeroVideoSection = {
  type: "hero-video";
  title: string;
  text?: string | null;
  videoUrl?: string | null;
  posterUrl?: string | null;
  buttonLabel?: string | null;
  buttonLink?: string | null;
};

export type LandingSeminarListSection = {
  type: "seminar-list";
  heading?: string | null;
  intro?: string | null;
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

export type LandingCardGridSection = {
  type: "card-grid";
  title?: string | null;
  description?: string | null;
  cards: {
    id: number;
    title: string;
    subtitle?: string | null;
    link?: string | null;
  }[];
};

export type LandingTextBlockSection = {
  type: "text-block";
  title: string;
  html?: string | null;
  buttonLabel?: string | null;
  buttonLink?: string | null;
};

export type LandingIconGridSection = {
  type: "icon-grid";
  title?: string | null;
  description?: string | null;
  items: {
    id: number;
    icon: string;
    title: string;
    text?: string | null;
  }[];
};

type LandingUnknownSection = {
  type: "unknown";
  component: string;
  data: Record<string, unknown>;
};

export type LandingSection =
  | LandingHeroVideoSection
  | LandingHeroCarouselSection
  | LandingCardGridSection
  | LandingTextBlockSection
  | LandingIconGridSection
  | LandingSeminarListSection
  | LandingUnknownSection;

export type LandingPage = {
  title: string;
  slug: string;
  sections: LandingSection[];
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

const normaliseSlug = (value: string | null | undefined, fallback: string, id: number): string => {
  if (typeof value === "string" && value.trim().length > 0) {
    return value.trim();
  }
  const slugFromName = fallback
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slugFromName.length > 0 ? slugFromName : `category-${id}`;
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
          alt: toSlideAlt(file),
        };
      })
      .filter((slide): slide is { src: string; alt: string } => Boolean(slide)) ?? [];

  return {
    type: "hero-carousel",
    title: component.titel,
    intro: component.text ?? null,
    rotationIntervalMs,
    slides,
  };
};

const transformHeroVideo = (component: StrapiHeroComponent): LandingHeroVideoSection => {
  return {
    type: "hero-video",
    title: component.titel,
    text: component.text ?? null,
    videoUrl: component.videoUrl ?? null,
    posterUrl: component.posterUrl ?? null,
    buttonLabel: component.buttonLabel ?? null,
    buttonLink: component.buttonLink ?? null
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
        reason: "missing-category",
      },
    };
  }

  const name = normaliseString(category.name);
  const slug = normaliseSlug(category.slug, name, category.id);

  return {
    type: "seminar-list",
    heading: normaliseString(component.ueberschrift) || null,
    intro: normaliseString(component.einleitung) || null,
    limit,
    showLoadMore: component.mehrButtonAktiv !== false,
    ctaLabel: normaliseString(component.ctaLabel) || "Zum Seminar",
    loadMoreLabel: normaliseString(component.mehrButtonLabel) || "Mehr laden",
    category: {
      id: category.id,
      name: name.length > 0 ? name : "Kategorie",
      slug,
      shortDescription: normaliseString(category.kurzbeschreibung) || null
    }
  };
};

const transformCardGrid = (component: StrapiCardGridComponent): LandingCardGridSection => {
  const cards =
    component.karten
      ?.map((card, index) => {
        const title = normaliseString(card?.titel ?? null);
        if (title.length === 0) {
          return null;
        }
        return {
          id: typeof card?.id === "number" ? card.id : index,
          title,
          subtitle: normaliseString(card?.untertitel ?? null) || null,
          link: normaliseString(card?.link ?? null) || null
        };
      })
      .filter((card): card is NonNullable<typeof card> => Boolean(card)) ?? [];

  return {
    type: "card-grid",
    title: normaliseString(component.titel ?? null) || null,
    description: normaliseString(component.beschreibung ?? null) || null,
    cards
  };
};

const transformTextBlock = (component: StrapiTextBlockComponent): LandingTextBlockSection => {
  return {
    type: "text-block",
    title: component.titel,
    html: component.text ?? null,
    buttonLabel: component.buttonLabel ?? null,
    buttonLink: component.buttonLink ?? null
  };
};

const transformIconGrid = (component: StrapiIconGridComponent): LandingIconGridSection => {
  const items =
    component.items
      ?.map((item, index) => {
        const title = normaliseString(item?.titel ?? null);
        if (title.length === 0) {
          return null;
        }
        return {
          id: typeof item?.id === "number" ? item.id : index,
          icon: normaliseString(item?.icon ?? null) || "sparkles",
          title,
          text: normaliseString(item?.text ?? null) || null
        };
      })
      .filter((item): item is NonNullable<typeof item> => Boolean(item)) ?? [];

  return {
    type: "icon-grid",
    title: normaliseString(component.titel ?? null) || null,
    description: normaliseString(component.beschreibung ?? null) || null,
    items
  };
};

const transformSection = (component: StrapiLandingComponent): LandingSection => {
  if (component.__component === "landing.hero") {
    return transformHeroVideo(component as StrapiHeroComponent);
  }
  if (component.__component === "landing.hero-carousel") {
    return transformHeroCarousel(component as StrapiHeroCarouselComponent);
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
  return {
    type: "unknown",
    component: component.__component ?? "unbekannt",
    data: component as Record<string, unknown>,
  };
};

export async function fetchLandingPage(slug: string): Promise<LandingPage> {
  const response = await fetchJson<StrapiLandingResponse>(`/public/landing-pages/${slug}`, {
    next: { revalidate: 120, tags: [`landing-${slug}`] },
  });

  const sections = Array.isArray(response.abschnitte)
    ? response.abschnitte.map(transformSection)
    : [];

  return {
    title: response.titel,
    slug: response.slug,
    sections,
  };
}
