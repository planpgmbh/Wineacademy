import { notFound } from "next/navigation";
import { CardGrid } from "@/components/landing/CardGrid";
import { ColumnsSection } from "@/components/landing/ColumnsSection";
import { DividerSection } from "@/components/landing/DividerSection";
import { SeminarList } from "@/components/landing/SeminarList";
import { SeminarProductCards } from "@/components/landing/SeminarProductCards";
import { TabsSection } from "@/components/landing/TabsSection";
import { SeminarFinder as LandingSeminarFinder } from "@/components/seminar/SeminarFinder";
import { DesktopBookingOverlay } from "@/components/shared/DesktopBookingOverlay";
import { SeminarBookingCard } from "@/components/seminar/SeminarBookingCard";
import { SeminarBookingMobile } from "@/components/seminar/SeminarBookingMobile";
import { DetailPageHero } from "@/components/shared/DetailPageHero";
import { getSeminarFinderData } from "@/lib/seminar-finder";
import { getSeminarDetail } from "@/lib/seminar-detail";
import { fetchUpcomingSeminars } from "@/lib/upcoming-seminars";
import type { LandingSeminarFinderSection, LandingSeminarListSection, LandingSeminarProductCardsSection, LandingSection, LandingTabsSection } from "@/lib/landing";
import type { ReactNode } from "react";

type SeminarDetailPageProps = {
  params: Promise<{
    slug: string;
  }>;
};

export default async function SeminarDetailPage({ params }: SeminarDetailPageProps) {
  const { slug } = await params;
  const seminar = await getSeminarDetail(slug);

  if (!seminar) {
    notFound();
  }

  const breadcrumbs: { label: string; href?: string }[] = [
    { label: "Seminare", href: "/seminare" }
  ];

  const primaryCategory = seminar.categories[0];
  if (primaryCategory) {
    breadcrumbs.push({
      label: primaryCategory.name,
      href: primaryCategory.slug ? `/kategorien/${primaryCategory.slug}` : undefined
    });
  } else if (seminar.primaryCategoryName) {
    breadcrumbs.push({ label: seminar.primaryCategoryName });
  }

  breadcrumbs.push({ label: seminar.title });

  const bookingCardProps = {
    highlightLabel: seminar.bookingBox.highlightLabel ?? undefined,
    title: seminar.bookingBox.überschrift,
    price: seminar.price,
    description: seminar.bookingBox.beschreibung,
    dates: seminar.dates,
    buttonText: seminar.bookingBox.buttonText,
    seminarSlug: seminar.slug
  } as const;

  const needsSeminarFinderData = seminar.sections.some((section) => section.type === "seminar-finder");
  let seminarFinderData: Awaited<ReturnType<typeof getSeminarFinderData>> | null = null;

  if (needsSeminarFinderData) {
    try {
      seminarFinderData = await getSeminarFinderData();
    } catch (error) {
      console.error("[seminar-detail] SeminarFinder-Daten konnten nicht geladen werden:", error);
    }
  }

  return (
    <>
      <DesktopBookingOverlay footerId="site-footer">
        <SeminarBookingCard {...bookingCardProps} className="w-full" />
      </DesktopBookingOverlay>

      <div className="relative">
        <DetailPageHero
          title={seminar.hero.title}
          paragraphs={seminar.hero.paragraphs}
          breadcrumbs={breadcrumbs}
          backgroundImageUrl={seminar.hero.backgroundImageUrl}
          backgroundImageAlt={seminar.hero.backgroundImageAlt ?? undefined}
        />

        {seminar.sections.length > 0 ? (
          <div className="relative">
            <div className="mx-auto max-w-[var(--detail-content-max-width)] px-6 md:px-8">
              <div className="mt-12 space-y-10 md:mt-16 md:pr-[420px]">
                {await renderSections(seminar.sections, seminarFinderData)}
              </div>
            </div>
          </div>
        ) : null}
      </div>

      <SeminarBookingMobile {...bookingCardProps} />
    </>
  );
}

async function renderSections(
  sections: LandingSection[],
  seminarFinderData: Awaited<ReturnType<typeof getSeminarFinderData>> | null
) {
  const rendered = [];

  for (let index = 0; index < sections.length; index += 1) {
    const section = sections[index];

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
      `[seminar-detail] Seminarliste konnte nicht geladen werden (Kategorie ${categorySlug || "alle"}):`,
      error
    );
    initialError = "Seminare konnten nicht geladen werden.";
  }

  return (
    <SeminarList
      key={`seminar-list-${categorySlug || "alle"}-${index}`}
      id="seminar-liste"
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
      console.error(`[seminar-detail] Seminarliste konnte nicht geladen werden (Kategorie ${section.categorySlug}):`, error);
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
      id="seminar-finder"
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
