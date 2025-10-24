import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import { CardGrid } from "@/components/landing/CardGrid";
import { HeroCarousel } from "@/components/landing/HeroCarousel";
import { HeroVideo } from "@/components/landing/HeroVideo";
import { IconGrid } from "@/components/landing/IconGrid";
import { SeminarList } from "@/components/landing/SeminarList";
import { TextBlock } from "@/components/landing/TextBlock";
import {
  fetchLandingPage,
  type LandingHeroCarouselSection,
  type LandingHeroVideoSection,
  type LandingPage,
  type LandingSection,
  type LandingSeminarListSection
} from "@/lib/landing";
import { fetchUpcomingSeminars } from "@/lib/upcoming-seminars";

export const revalidate = 120;

async function resolveLanding(slug: string): Promise<LandingPage | null> {
  try {
    return await fetchLandingPage(slug);
  } catch (error) {
    console.error(`[landing] Fehler beim Laden der Landingpage ${slug}:`, error);
    return null;
  }
}

function findHeroSection(sections: LandingSection[]): LandingHeroCarouselSection | null {
  for (const section of sections) {
    if (section.type === "hero-carousel") {
      return section;
    }
  }
  return null;
}

function findHeroVideoSection(sections: LandingSection[]): LandingHeroVideoSection | null {
  for (const section of sections) {
    if (section.type === "hero-video") {
      return section;
    }
  }
  return null;
}

function findSeminarSections(sections: LandingSection[]): LandingSeminarListSection[] {
  return sections.filter((section): section is LandingSeminarListSection => section.type === "seminar-list");
}

const FALLBACK_METADATA = {
  title: "Wine Academy Landingpage",
  description: "Landingpage der Wine Academy Hamburg."
};

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const landing = await resolveLanding(slug);

  if (!landing) {
    return FALLBACK_METADATA;
  }

  const heroVideo = findHeroVideoSection(landing.sections);
  const hero = findHeroSection(landing.sections);

  return {
    title: landing.title ?? slug,
    description: heroVideo?.text ?? hero?.intro ?? FALLBACK_METADATA.description
  };
}

export default async function LandingPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const landing = await resolveLanding(slug);

  if (!landing) {
    return notFound();
  }

  const content: ReactNode[] = [];
  const sections = Array.isArray(landing.sections) ? landing.sections : [];

  for (let index = 0; index < sections.length; index += 1) {
    const section = sections[index];

    if (section.type === "hero-video") {
      content.push(
        <HeroVideo
          key={`hero-video-${index}`}
          title={section.title}
          text={section.text}
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
          key={`hero-${index}`}
          title={section.title ?? landing.title ?? slug}
          intro={section.intro}
          slides={section.slides}
          rotationIntervalMs={section.rotationIntervalMs}
        />
      );
      continue;
    }

    if (section.type === "card-grid") {
      content.push(
        <CardGrid
          key={`card-grid-${index}`}
          title={section.title}
          description={section.description}
          cards={section.cards}
        />
      );
      continue;
    }

    if (section.type === "text-block") {
      content.push(
        <TextBlock
          key={`text-block-${index}`}
          title={section.title}
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
          title={section.title}
          description={section.description}
          items={section.items}
        />
      );
      continue;
    }

    if (section.type === "seminar-list") {
      content.push(await renderSeminarList(section, index));
      continue;
    }

    // Unbekannte Bausteine ignorieren wir vorerst still.
  }

  const hasHero =
    sections.some((section) => section.type === "hero-carousel") ||
    sections.some((section) => section.type === "hero-video");

  if (!hasHero) {
    content.unshift(
      <HeroCarousel
        key="hero-fallback"
        title={landing.title ?? slug}
        intro={null}
        slides={[]}
        rotationIntervalMs={8000}
      />
    );
  }

  return <main className="flex flex-col">{content}</main>;
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

  const heading = section.heading ?? null;
  const intro = section.intro ?? null;

  return (
    <SeminarList
      key={`seminar-list-${section.category.slug}-${index}`}
      heading={heading}
      intro={intro}
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
