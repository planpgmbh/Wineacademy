import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import { CardGrid } from "@/components/landing/CardGrid";
import { HeroCarousel } from "@/components/landing/HeroCarousel";
import { HeroSmall } from "@/components/landing/HeroSmall";
import { HeroVideo } from "@/components/landing/HeroVideo";
import { IconGrid } from "@/components/landing/IconGrid";
import { SeminarList } from "@/components/landing/SeminarList";
import { TabsSection } from "@/components/landing/TabsSection";
import { TextBlock } from "@/components/landing/TextBlock";
import { SeminarFinder as LandingSeminarFinder } from "@/components/seminar/SeminarFinder";
import {
  fetchLandingPage,
  type LandingHeroCarouselSection,
  type LandingHeroSmallSection,
  type LandingHeroVideoSection,
  type LandingPage,
  type LandingSection,
  type LandingSeminarFinderSection,
  type LandingSeminarListSection,
  type LandingTabsSection
} from "@/lib/landing";
import { getSeminarFinderData } from "@/lib/seminar-finder";
import { fetchUpcomingSeminars } from "@/lib/upcoming-seminars";

export const revalidate = 120;

const FALLBACK_METADATA = {
  title: "Wine Academy Landingpage",
  description: "Landingpage der Wine Academy Hamburg."
};

async function resolveLanding(slug: string): Promise<LandingPage | null> {
  try {
    return await fetchLandingPage(slug);
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
  const landing = await resolveLanding(slug);

  if (!landing) {
    return FALLBACK_METADATA;
  }

  const heroVideo = findHeroVideo(landing.sections);
  const heroCarousel = findHeroCarousel(landing.sections);
  const heroSmall = findHeroSmall(landing.sections);

  return {
    title: landing.title ?? slug,
    description: heroVideo?.intro ?? heroCarousel?.intro ?? heroSmall?.intro ?? FALLBACK_METADATA.description
  };
}

export default async function LandingPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const landing = await resolveLanding(slug);

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

  for (let index = 0; index < sections.length; index += 1) {
    const section = sections[index];

    if (section.type === "hero-video") {
      content.push(
        <HeroVideo
          key={`hero-video-${index}`}
          headline={section.headline}
          headlineLevel={section.headlineLevel}
          intro={section.intro}
          videoUrl={section.videoUrl}
          posterUrl={section.posterUrl}
          buttonLabel={section.buttonLabel}
          buttonLink={section.buttonLink}
        />
      );
      continue;
    }

    if (section.type === "hero-carousel") {
      content.push(
        <HeroCarousel
          key={`hero-carousel-${index}`}
          headline={section.headline}
          headlineLevel={section.headlineLevel}
          intro={section.intro}
          slides={section.slides}
          rotationIntervalMs={section.rotationIntervalMs}
        />
      );
      continue;
    }

    if (section.type === "hero-small") {
      content.push(
        <HeroSmall
          key={`hero-small-${index}`}
          headline={section.headline}
          headlineLevel={section.headlineLevel}
          intro={section.intro}
          image={section.image}
        />
      );
      continue;
    }

    if (section.type === "card-grid") {
      content.push(
        <CardGrid key={`card-grid-${index}`} cards={section.cards} background={section.background} />
      );
      continue;
    }

    if (section.type === "text-block") {
      content.push(
        <TextBlock
          key={`text-block-${index}`}
          background={section.background}
          html={section.html}
          buttonLabel={section.buttonLabel}
          buttonLink={section.buttonLink}
        />
      );
      continue;
    }

    if (section.type === "icon-grid") {
      content.push(
        <IconGrid
          key={`icon-grid-${index}`}
          headline={section.headline}
          headlineLevel={section.headlineLevel}
          intro={section.intro}
          background={section.background}
          items={section.items}
        />
      );
      continue;
    }

    if (section.type === "tabs") {
      content.push(renderTabsSection(section, index));
      continue;
    }

    if (section.type === "seminar-list") {
      content.push(await renderSeminarList(section, index));
      continue;
    }

    if (section.type === "seminar-finder") {
      const finder = renderSeminarFinder(section, index, seminarFinderData);
      if (finder) {
        content.push(finder);
      }
      continue;
    }

    // Unbekannte Bausteine ignorieren wir vorerst still.
  }

  const hasHero =
    sections.some((section) => section.type === "hero-carousel") ||
    sections.some((section) => section.type === "hero-video") ||
    sections.some((section) => section.type === "hero-small");

  if (!hasHero) {
    content.unshift(
      <HeroCarousel
        key="hero-fallback"
        headline={landing.title ?? slug}
        headlineLevel="h2"
        intro={null}
        slides={[]}
        rotationIntervalMs={8000}
      />
    );
  }

  return <main className="flex flex-col">{content}</main>;
}

function renderTabsSection(section: LandingTabsSection, index: number) {
  return (
    <TabsSection
      key={`tabs-${index}`}
      headline={section.headline}
      headlineLevel={section.headlineLevel}
      background={section.background}
      tabs={section.tabs}
    />
  );
}

async function renderSeminarList(section: LandingSeminarListSection, index: number) {
  let initialItems = [] as Awaited<ReturnType<typeof fetchUpcomingSeminars>>;
  let initialError: string | null = null;

  try {
    initialItems = await fetchUpcomingSeminars({
      categorySlug: section.category.slug,
      limit: section.limit,
      offset: 0
    });
  } catch (error) {
    console.error(
      `[landing] Seminarliste konnte nicht geladen werden (Kategorie ${section.category.slug}):`,
      error
    );
    initialError = "Seminare konnten nicht geladen werden.";
  }

  return (
    <SeminarList
      key={`seminar-list-${section.category.slug}-${index}`}
      headline={section.headline}
      headlineLevel={section.headlineLevel}
      intro={section.intro}
      background={section.background}
      categorySlug={section.category.slug}
      ctaLabel={section.ctaLabel}
      loadMoreLabel={section.loadMoreLabel}
      showLoadMore={section.showLoadMore}
      initialItems={initialItems}
      initialError={initialError}
      limit={section.limit}
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
      headline={section.headline}
      headlineLevel={section.headlineLevel}
      background={section.background}
      categories={data.categories}
      locations={data.locations}
      initialCategorySlug={section.initialCategorySlug}
      allowedCategorySlugs={section.allowedCategorySlugs}
    />
  );
}
