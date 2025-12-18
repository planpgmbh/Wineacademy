export {
  SECTION_BACKGROUND_CSS_VAR,
  resolveSectionBackground,
  isDarkSectionBackground,
  normaliseBackgroundKey,
  normaliseHeadingLevel,
  normaliseHeroHeadingLevel
} from "./landing-utils";

export { normaliseRichText } from "./landing-richtext";

export {
  transformLandingSection,
  fetchLandingPage,
  type StrapiLandingComponent
} from "./landing-transformers";

export type {
  ColumnDisplayMode,
  LandingBildergalerieSection,
  LandingCardGridSection,
  LandingColumnsSection,
  LandingDividerSection,
  LandingHeroBlankSection,
  LandingHeroCarouselSection,
  LandingHeroSmallSection,
  LandingHeroVideoSection,
  LandingPage,
  LandingSection,
  LandingSeminarFinderSection,
  LandingSeminarListSection,
  LandingSeminarProductCardsSection,
  LandingTabsSection,
  SectionBackgroundKey
} from "./landing-types";
