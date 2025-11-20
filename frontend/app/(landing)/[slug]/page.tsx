import type { Metadata } from "next";
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
import { TextBlock } from "@/components/landing/TextBlock";
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
  const landing = await resolveLanding(slug);

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

    if (section.type === "hero-blank") {
      content.push(
        <HeroBlank
          key={`hero-blank-${index}`}
          überschrift={section.überschrift}
          überschriftStufe={section.überschriftStufe}
          einleitung={section.einleitung}
        />
      );
      continue;
    }

    if (section.type === "hero-video") {
      content.push(
        <HeroVideo
          key={`hero-video-${index}`}
          überschrift={section.überschrift}
          überschriftStufe={section.überschriftStufe}
          einleitung={section.einleitung}
          videoUrl={section.videoUrl}
          posterUrl={section.posterUrl}
          buttonText={section.buttonText}
          buttonLink={section.buttonLink}
        />
      );
      continue;
    }

    if (section.type === "hero-carousel") {
      content.push(
        <HeroCarousel
          key={`hero-carousel-${index}`}
          überschrift={section.überschrift}
          überschriftStufe={section.überschriftStufe}
          einleitung={section.einleitung}
          bilder={section.bilder}
          rotationSekunden={section.rotationSekunden}
        />
      );
      continue;
    }

    if (section.type === "bildergalerie") {
      content.push(
        <Bildergalerie
          key={`bildergalerie-${index}`}
          bilder={section.bilder}
          rotationSekunden={section.rotationSekunden}
          breite={section.breite}
        />
      );
      continue;
    }

    if (section.type === "hero-small") {
      content.push(
        <HeroSmall
          key={`hero-small-${index}`}
          überschrift={section.überschrift}
          überschriftStufe={section.überschriftStufe}
          einleitung={section.einleitung}
          bild={section.bild}
        />
      );
      continue;
    }

    if (section.type === "card-grid") {
      content.push(
        <CardGrid key={`card-grid-${index}`} karten={section.karten} hintergrund={section.hintergrund} />
      );
      continue;
    }

    if (section.type === "columns") {
      content.push(
        <ColumnsSection
          key={`columns-${index}`}
          hintergrund={section.hintergrund}
          darstellung={section.darstellung}
          spalten={section.spalten}
        />
      );
      continue;
    }

    if (section.type === "divider") {
      content.push(
        <DividerSection key={`divider-${index}`} hintergrund={section.hintergrund} breite={section.breite} />
      );
      continue;
    }

    if (section.type === "text-block") {
      content.push(
        <TextBlock
          key={`text-block-${index}`}
          hintergrund={section.hintergrund}
          html={section.html}
          buttonText={section.buttonText}
          buttonLink={section.buttonLink}
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

    if (section.type === "seminar-product-cards") {
      content.push(await renderSeminarProductCards(section, index));
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

async function renderSeminarList(section: LandingSeminarListSection, index: number) {
  let initialItems = [] as Awaited<ReturnType<typeof fetchUpcomingSeminars>>;
  let initialError: string | null = null;

  try {
    initialItems = await fetchUpcomingSeminars({
      categorySlug: section.category.slug,
      limit: section.anzahl,
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
      überschrift={section.überschrift}
      überschriftStufe={section.überschriftStufe}
      einleitung={section.einleitung}
      hintergrund={section.hintergrund}
      categorySlug={section.category.slug}
      buttonText={section.buttonText}
      mehrButtonText={section.mehrButtonText}
      mehrButtonAnzeigen={section.mehrButtonAnzeigen}
      initialItems={initialItems}
      initialError={initialError}
      anzahl={section.anzahl}
    />
  );
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
