import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CardGrid } from "@/components/landing/CardGrid";
import { ColumnsSection } from "@/components/landing/ColumnsSection";
import { DividerSection } from "@/components/landing/DividerSection";
import { HeroBlank } from "@/components/landing/HeroBlank";
import { HeroCarousel } from "@/components/landing/HeroCarousel";
import { HeroSmall } from "@/components/landing/HeroSmall";
import { HeroVideo } from "@/components/landing/HeroVideo";
import { Bildergalerie } from "@/components/landing/Bildergalerie";
import { SeminarList } from "@/components/landing/SeminarList";
import { SeminarProductCards } from "@/components/landing/SeminarProductCards";
import { TabsSection } from "@/components/landing/TabsSection";
import { SeminarFinder as LandingSeminarFinder } from "@/components/seminar/SeminarFinder";
import { getCategoryDetail } from "@/lib/category-detail";
import { Fragment, type ReactNode } from "react";
import type {
  LandingSeminarFinderSection,
  LandingSeminarListSection,
  LandingSeminarProductCardsSection,
  LandingSection,
  LandingTabsSection
} from "@/lib/landing";
import { getSeminarFinderData } from "@/lib/seminar-finder";
import { fetchUpcomingSeminars } from "@/lib/upcoming-seminars";

type CategoryPageProps = {
  params: Promise<{
    slug: string;
  }>;
};

export async function generateMetadata({ params }: CategoryPageProps): Promise<Metadata> {
  const { slug } = await params;
  const category = await getCategoryDetail(slug);

  if (!category) {
    return {};
  }

  const title = category.seoTitle ?? category.title;
  const description = category.seoDescription ?? category.shortDescription ?? undefined;

  return {
    title,
    description,
  };
}

export default async function CategoryPage({ params }: CategoryPageProps) {
  const { slug } = await params;
  const category = await getCategoryDetail(slug);

  if (!category) {
    notFound();
  }

  const sections = Array.isArray(category.sections) ? category.sections : [];
  const needsFinderData = sections.some((section) => section.type === "seminar-finder");
  const seminarFinderData = needsFinderData ? await getSeminarFinderData() : null;

  return <main className="flex flex-col">{await renderSections(sections, seminarFinderData, category)}</main>;
}

async function renderSections(
  sections: LandingSection[],
  seminarFinderData: Awaited<ReturnType<typeof getSeminarFinderData>> | null,
  category: { title: string; slug: string; shortDescription: string | null }
) {
  const rendered = [];
  let hasHero = false;

  for (let index = 0; index < sections.length; index += 1) {
    const section = sections[index];

    if (section.type === "hero-blank") {
      rendered.push(
        <HeroBlank
          key={`hero-blank-${index}`}
          überschrift={section.überschrift}
          überschriftStufe={section.überschriftStufe}
          einleitung={section.einleitung}
        />
      );
      hasHero = true;
      continue;
    }

    if (section.type === "hero-video") {
      rendered.push(
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
      hasHero = true;
      continue;
    }

    if (section.type === "hero-carousel") {
      rendered.push(
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
      hasHero = true;
      continue;
    }

    if (section.type === "hero-small") {
      rendered.push(
        <HeroSmall
          key={`hero-small-${index}`}
          überschrift={section.überschrift}
          überschriftStufe={section.überschriftStufe}
          einleitung={section.einleitung}
          bild={section.bild}
        />
      );
      hasHero = true;
      continue;
    }

    if (section.type === "bildergalerie") {
      rendered.push(
        <Bildergalerie
          key={`bildergalerie-${index}`}
          bilder={section.bilder}
          rotationSekunden={section.rotationSekunden}
          breite={section.breite}
        />
      );
      continue;
    }

    if (section.type === "card-grid") {
      rendered.push(
        <CardGrid key={`card-grid-${index}`} karten={section.karten} hintergrund={section.hintergrund ?? undefined} />
      );
      continue;
    }

    if (section.type === "columns") {
      rendered.push(
        <ColumnsSection
          key={`columns-${index}`}
          überschrift={section.überschrift}
          überschriftStufe={section.überschriftStufe}
          hintergrund={section.hintergrund ?? undefined}
          darstellung={section.darstellung}
          spalten={section.spalten}
        />
      );
      continue;
    }

    if (section.type === "divider") {
      rendered.push(
        <DividerSection key={`divider-${index}`} hintergrund={section.hintergrund ?? undefined} breite={section.breite} />
      );
      continue;
    }

    if (section.type === "tabs") {
      rendered.push(renderTabsSection(section, index));
      continue;
    }

    if (section.type === "seminar-list") {
      rendered.push(await renderSeminarList(section, index));
      continue;
    }

    if (section.type === "seminar-product-cards") {
      rendered.push(await renderSeminarProductCards(section, index));
      continue;
    }

    if (section.type === "seminar-finder") {
      const finder = renderSeminarFinder(section, index, seminarFinderData);
      if (finder) {
        rendered.push(finder);
      }
      continue;
    }
  }

  if (!hasHero) {
    rendered.unshift(
      <HeroCarousel
        key="hero-fallback"
        überschrift={category.title}
        überschriftStufe="h2"
        einleitung={category.shortDescription}
        bilder={[]}
        rotationSekunden={8}
      />
    );
  }

  return rendered;
}

function renderTabsSection(section: LandingTabsSection, index: number) {
  return (
    <TabsSection
      key={`tabs-${index}`}
      überschrift={section.überschrift}
      überschriftStufe={section.überschriftStufe}
      hintergrund={section.hintergrund ?? undefined}
      reiter={section.reiter}
    />
  );
}

async function renderSeminarList(section: LandingSeminarListSection, index: number) {
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
      `[kategorie] Seminarliste konnte nicht geladen werden (Kategorie ${categorySlug || "alle"}):`,
      error
    );
    initialError = "Seminare konnten nicht geladen werden.";
  }

  return (
    <SeminarList
      key={`seminar-list-${categorySlug || "alle"}-${index}`}
      überschrift={section.überschrift}
      überschriftStufe={section.überschriftStufe}
      einleitung={section.einleitung}
      hintergrund={section.hintergrund ?? undefined}
      categorySlug={categorySlug || null}
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
      console.error(`[kategorie] Seminarliste konnte nicht geladen werden (Kategorie ${section.categorySlug}):`, error);
      initialError = "Seminare konnten nicht geladen werden.";
    }
  }

  return (
    <SeminarProductCards
      key={`seminar-product-cards-${index}`}
      überschrift={section.überschrift}
      überschriftStufe={section.überschriftStufe}
      einleitung={section.einleitung}
      hintergrund={section.hintergrund ?? undefined}
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
      hintergrund={section.hintergrund ?? undefined}
      categories={data.categories}
      locations={data.locations}
      initialCategorySlug={section.initialCategorySlug}
      allowedCategorySlugs={section.allowedCategorySlugs}
    />
  );
}
