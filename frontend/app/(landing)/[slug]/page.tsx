import type { Metadata } from "next";
import { draftMode } from "next/headers";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import { CardGrid } from "@/components/landing/CardGrid";
import { ColumnsSection } from "@/components/landing/ColumnsSection";
import { DividerSection } from "@/components/landing/DividerSection";
import { HeroBlank } from "@/components/landing/HeroBlank";
import { HeroCarousel } from "@/components/landing/HeroCarousel";
import { Bildergalerie } from "@/components/landing/Bildergalerie";
import { HeroSmall } from "@/components/landing/HeroSmall";
import { HeroVideo } from "@/components/landing/HeroVideo";
import { SeminarList } from "@/components/landing/SeminarList";
import { SeminarProductCards } from "@/components/landing/SeminarProductCards";
import { TabsSection } from "@/components/landing/TabsSection";
import { SeminarFinder as LandingSeminarFinder } from "@/components/seminar/SeminarFinder";
import {
  fetchLandingPage,
  type LandingHeroBlankSection,
  type LandingHeroCarouselSection,
  type LandingHeroSmallSection,
  type LandingHeroVideoSection,
  type LandingPage,
  type LandingSection,
  type LandingSeminarFinderSection,
  type LandingSeminarListSection,
  type LandingSeminarProductCardsSection,
  type LandingTabsSection
} from "@/lib/landing";
import { getSeminarFinderData } from "@/lib/seminar-finder";
import { fetchUpcomingSeminars } from "@/lib/upcoming-seminars";

export const revalidate = 120;

const SLUG_PATTERN = /^[a-z0-9-]+$/i;
const MAX_SLUG_LENGTH = 120;

const ANCHOR_BASE: Record<LandingSection["type"], string | null> = {
  "hero-video": null,
  "hero-carousel": null,
  "hero-small": null,
  "hero-blank": null,
  bildergalerie: "bildergalerie",
  "card-grid": "card-grid",
  columns: "spalten",
  divider: null,
  "seminar-list": "seminar-liste",
  "seminar-product-cards": "seminar-produkt-karten",
  tabs: "tabs",
  "seminar-finder": "seminar-finder",
  unknown: null
};

const anchorWrapperClass = "scroll-mt-28 md:scroll-mt-36";

const FALLBACK_METADATA = {
  title: "Wine Academy Landingpage",
  description: "Landingpage der Wine Academy Hamburg."
};

function isValidSlug(slug: string): boolean {
  return slug.length > 0 && slug.length <= MAX_SLUG_LENGTH && SLUG_PATTERN.test(slug);
}

async function resolveLanding(slug: string, status: "draft" | "published"): Promise<LandingPage | null> {
  if (!isValidSlug(slug)) {
    return null;
  }
  try {
    return await fetchLandingPage(slug, { status });
  } catch (error) {
    console.error(`[landing] Fehler beim Laden der Landingpage ${slug}:`, error);
    return null;
  }
}

function findHeroCarousel(sections: LandingSection[]): LandingHeroCarouselSection | null {
  for (const section of sections) {
    if (section.type === "hero-carousel") {
      return section;
    }
  }
  return null;
}

function findHeroSmall(sections: LandingSection[]): LandingHeroSmallSection | null {
  for (const section of sections) {
    if (section.type === "hero-small") {
      return section;
    }
  }
  return null;
}

function findHeroBlank(sections: LandingSection[]): LandingHeroBlankSection | null {
  for (const section of sections) {
    if (section.type === "hero-blank") {
      return section;
    }
  }
  return null;
}

function findHeroVideo(sections: LandingSection[]): LandingHeroVideoSection | null {
  for (const section of sections) {
    if (section.type === "hero-video") {
      return section;
    }
  }
  return null;
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const draft = await draftMode();
  const isDraftMode = draft.isEnabled;
  const status = isDraftMode ? "draft" : "published";
  const landing = await resolveLanding(slug, status);

  if (!landing) {
    return FALLBACK_METADATA;
  }

  const heroBlank = findHeroBlank(landing.sections);
  const heroVideo = findHeroVideo(landing.sections);
  const heroCarousel = findHeroCarousel(landing.sections);
  const heroSmall = findHeroSmall(landing.sections);

  return {
    title: landing.title ?? slug,
    description:
      heroBlank?.einleitung ??
      heroVideo?.einleitung ??
      heroCarousel?.einleitung ??
      heroSmall?.einleitung ??
      FALLBACK_METADATA.description
  };
}

export default async function LandingPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const draft = await draftMode();
  const isDraftMode = draft.isEnabled;
  const status = isDraftMode ? "draft" : "published";
  const landing = await resolveLanding(slug, status);

  if (!landing) {
    return notFound();
  }

  const sections = Array.isArray(landing.sections) ? landing.sections : [];

  const needsSeminarFinderData = sections.some((section) => section.type === "seminar-finder");
  let seminarFinderData: Awaited<ReturnType<typeof getSeminarFinderData>> | null = null;

  if (needsSeminarFinderData) {
    try {
      seminarFinderData = await getSeminarFinderData();
    } catch (error) {
      console.error("[landing] SeminarFinder-Daten konnten nicht geladen werden:", error);
    }
  }

  const content: ReactNode[] = [];
  const anchorCounts = new Map<string, number>();

  const resolveAnchorId = (type: LandingSection["type"]): string | null => {
    const base = ANCHOR_BASE[type];
    if (!base) return null;
    const nextCount = (anchorCounts.get(base) ?? 0) + 1;
    anchorCounts.set(base, nextCount);
    return nextCount === 1 ? base : `${base}-${nextCount}`;
  };

  const wrapWithAnchor = (node: ReactNode, key: string, anchorId: string | null): ReactNode => {
    if (!anchorId) return node;
    return (
      <div key={key} id={anchorId} className={anchorWrapperClass}>
        {node}
      </div>
    );
  };

  for (let index = 0; index < sections.length; index += 1) {
    const section = sections[index];
    const anchorId = resolveAnchorId(section.type);

    if (section.type === "hero-blank") {
      const node = (
        <HeroBlank
          key={`hero-blank-${index}`}
          überschrift={section.überschrift}
          überschriftStufe={section.überschriftStufe}
          einleitung={section.einleitung}
        />
      );
      content.push(wrapWithAnchor(node, `hero-blank-${index}`, anchorId));
      continue;
    }

    if (section.type === "hero-video") {
      const node = (
        <HeroVideo
          key={`hero-video-${index}`}
          überschrift={section.überschrift}
          überschriftStufe={section.überschriftStufe}
          einleitung={section.einleitung}
          videoUrl={section.videoUrl}
          posterUrl={section.posterUrl}
          button={section.button ?? null}
        />
      );
      content.push(wrapWithAnchor(node, `hero-video-${index}`, anchorId));
      continue;
    }

    if (section.type === "hero-carousel") {
      const node = (
        <HeroCarousel
          key={`hero-carousel-${index}`}
          überschrift={section.überschrift}
          überschriftStufe={section.überschriftStufe}
          einleitung={section.einleitung}
          bilder={section.bilder}
          rotationSekunden={section.rotationSekunden}
          button={section.button ?? null}
        />
      );
      content.push(wrapWithAnchor(node, `hero-carousel-${index}`, anchorId));
      continue;
    }

    if (section.type === "bildergalerie") {
      const node = (
        <Bildergalerie
          key={`bildergalerie-${index}`}
          bilder={section.bilder}
          rotationSekunden={section.rotationSekunden}
          breite={section.breite}
        />
      );
      content.push(wrapWithAnchor(node, `bildergalerie-${index}`, anchorId));
      continue;
    }

    if (section.type === "hero-small") {
      const node = (
        <HeroSmall
          key={`hero-small-${index}`}
          überschrift={section.überschrift}
          überschriftStufe={section.überschriftStufe}
          einleitung={section.einleitung}
          bild={section.bild}
        />
      );
      content.push(wrapWithAnchor(node, `hero-small-${index}`, anchorId));
      continue;
    }

    if (section.type === "card-grid") {
      const node = <CardGrid key={`card-grid-${index}`} karten={section.karten} hintergrund={section.hintergrund} />;
      content.push(wrapWithAnchor(node, `card-grid-${index}`, anchorId));
      continue;
    }

    if (section.type === "columns") {
      const node = (
        <ColumnsSection
          key={`columns-${index}`}
          überschrift={section.überschrift}
          überschriftStufe={section.überschriftStufe}
          hintergrund={section.hintergrund}
          darstellung={section.darstellung}
          spalten={section.spalten}
        />
      );
      content.push(wrapWithAnchor(node, `columns-${index}`, anchorId));
      continue;
    }

    if (section.type === "divider") {
      content.push(
        <DividerSection key={`divider-${index}`} hintergrund={section.hintergrund} breite={section.breite} />
      );
      continue;
    }

    if (section.type === "tabs") {
      content.push(wrapWithAnchor(renderTabsSection(section, index), `tabs-${index}`, anchorId));
      continue;
    }

    if (section.type === "seminar-list") {
      const node = await renderSeminarList(section, index, anchorId);
      content.push(node);
      continue;
    }

    if (section.type === "seminar-product-cards") {
      const node = await renderSeminarProductCards(section, index);
      content.push(wrapWithAnchor(node, `seminar-product-cards-${index}`, anchorId));
      continue;
    }

    if (section.type === "seminar-finder") {
      const finder = renderSeminarFinder(section, index, seminarFinderData);
      if (finder) {
        content.push(wrapWithAnchor(finder, `seminar-finder-${index}`, anchorId));
      }
      continue;
    }

    // Unbekannte Bausteine ignorieren wir vorerst still.
  }

  const hasHero =
    sections.some((section) => section.type === "hero-blank") ||
    sections.some((section) => section.type === "hero-carousel") ||
    sections.some((section) => section.type === "bildergalerie") ||
    sections.some((section) => section.type === "hero-video") ||
    sections.some((section) => section.type === "hero-small");

  if (!hasHero) {
    content.unshift(
      <HeroCarousel
        key="hero-fallback"
        überschrift={landing.title ?? slug}
        überschriftStufe="h2"
        einleitung={null}
        bilder={[]}
        rotationSekunden={8}
      />
    );
  }

  return <main className="flex flex-col">{content}</main>;
}

function renderTabsSection(section: LandingTabsSection, index: number) {
  return (
    <TabsSection
      key={`tabs-${index}`}
      überschrift={section.überschrift}
      überschriftStufe={section.überschriftStufe}
      hintergrund={section.hintergrund}
      reiter={section.reiter}
    />
  );
}

async function renderSeminarList(section: LandingSeminarListSection, index: number, anchorId: string | null) {
  let initialItems = [] as Awaited<ReturnType<typeof fetchUpcomingSeminars>>;
  let initialError: string | null = null;
  const categorySlug = section.category?.slug ?? "";

  try {
    initialItems = await fetchUpcomingSeminars({
      categorySlug,
      limit: section.anzahl,
      offset: 0
    });
  } catch (error) {
    console.error(
      `[landing] Seminarliste konnte nicht geladen werden (Kategorie ${categorySlug || "alle"}):`,
      error
    );
    initialError = "Seminare konnten nicht geladen werden.";
  }

  const node = (
    <SeminarList
      key={`seminar-list-${categorySlug || "alle"}-${index}`}
      id={anchorId ?? "seminar-liste"}
      überschrift={section.überschrift}
      überschriftStufe={section.überschriftStufe}
      einleitung={section.einleitung}
      hintergrund={section.hintergrund}
      categorySlug={categorySlug || null}
      buttonText={section.buttonText}
      mehrButtonText={section.mehrButtonText}
      mehrButtonAnzeigen={section.mehrButtonAnzeigen}
      initialItems={initialItems}
      initialError={initialError}
      anzahl={section.anzahl}
    />
  );

  if (anchorId) {
    return (
      <div key={`seminar-list-wrapper-${index}`} id={anchorId} className={anchorWrapperClass}>
        {node}
      </div>
    );
  }

  return node;
}

async function renderSeminarProductCards(section: LandingSeminarProductCardsSection, index: number) {
  let initialItems = [] as Awaited<ReturnType<typeof fetchUpcomingSeminars>>;
  let initialError: string | null = null;

  if (section.modus === "seminare" && section.categorySlug) {
    try {
      initialItems = await fetchUpcomingSeminars({
        categorySlug: section.categorySlug,
        limit: section.anzahl,
        offset: 0
      });
    } catch (error) {
      console.error(`[landing] Seminarliste konnte nicht geladen werden (Kategorie ${section.categorySlug}):`, error);
      initialError = "Seminare konnten nicht geladen werden.";
    }
  }

  return (
    <SeminarProductCards
      key={`seminar-product-cards-${index}`}
      überschrift={section.überschrift}
      überschriftStufe={section.überschriftStufe}
      einleitung={section.einleitung}
      hintergrund={section.hintergrund}
      modus={section.modus}
      categorySlug={section.categorySlug ?? undefined}
      produkte={section.produkte}
      anzahl={section.anzahl}
      buttonText={section.buttonText}
      mehrButtonText={section.mehrButtonText}
      mehrButtonAnzeigen={section.mehrButtonAnzeigen}
      initialSeminars={initialItems}
      initialError={initialError}
    />
  );
}

function renderSeminarFinder(
  section: LandingSeminarFinderSection,
  index: number,
  data: Awaited<ReturnType<typeof getSeminarFinderData>> | null
) {
  if (!data) {
    return null;
  }

  return (
    <LandingSeminarFinder
      key={`seminar-finder-${index}`}
      id="seminar-finder"
      überschrift={section.überschrift}
      überschriftStufe={section.überschriftStufe}
      hintergrund={section.hintergrund}
      categories={data.categories}
      locations={data.locations}
      initialCategorySlug={section.initialCategorySlug}
      allowedCategorySlugs={section.allowedCategorySlugs}
    />
  );
}
