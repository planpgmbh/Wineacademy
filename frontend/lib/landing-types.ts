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

export type ColumnDisplayMode = "box" | "plain";

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
