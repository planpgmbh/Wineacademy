import { notFound } from "next/navigation";

import { CardGrid } from "@/components/landing/CardGrid";
import { ColumnsSection } from "@/components/landing/ColumnsSection";
import { DividerSection } from "@/components/landing/DividerSection";
import { SeminarList } from "@/components/landing/SeminarList";
import { SeminarProductCards } from "@/components/landing/SeminarProductCards";
import { TabsSection } from "@/components/landing/TabsSection";
import { SeminarFinder as LandingSeminarFinder } from "@/components/seminar/SeminarFinder";
import { ProductBookingCard } from "@/components/product/ProductBookingCard";
import { ProductBookingMobile } from "@/components/product/ProductBookingMobile";
import { DesktopBookingOverlay } from "@/components/shared/DesktopBookingOverlay";
import { DetailPageHero } from "@/components/shared/DetailPageHero";
import { getProductDetail } from "@/lib/product-detail";
import { getSeminarFinderData } from "@/lib/seminar-finder";
import { fetchUpcomingSeminars } from "@/lib/upcoming-seminars";
import type { ReactNode } from "react";
import type {
  LandingSection,
  LandingTabsSection,
  LandingSeminarListSection,
  LandingSeminarProductCardsSection,
  LandingSeminarFinderSection
} from "@/lib/landing";

type ProductDetailPageProps = {
  params: Promise<{
    slug: string;
  }>;
};

export default async function ProductDetailPage({ params }: ProductDetailPageProps) {
  const { slug } = await params;
  const product = await getProductDetail(slug);

  if (!product) {
    notFound();
  }

  const breadcrumbs: { label: string; href?: string }[] = [
    { label: "Produkte", href: "/produkte" },
    { label: product.title }
  ];

  const bookingCardProps = {
    highlightLabel: product.bookingBox.highlightLabel ?? undefined,
    title: product.bookingBox.überschrift,
    price: product.price,
    description: product.bookingBox.beschreibung,
    buttonText: product.bookingBox.buttonText,
    productSlug: product.slug,
    productTitle: product.title,
    priceValue: product.priceValue,
    priceNetto: product.priceNetto,
    steuerSatz: product.steuerSatz,
    priceFormatted: product.price,
    isVoucher: product.isVoucher
  } as const;

  const needsSeminarFinderData = product.sections.some((section) => section.type === "seminar-finder");
  let seminarFinderData: Awaited<ReturnType<typeof getSeminarFinderData>> | null = null;

  if (needsSeminarFinderData) {
    try {
      seminarFinderData = await getSeminarFinderData();
    } catch (error) {
      console.error("[product-detail] SeminarFinder-Daten konnten nicht geladen werden:", error);
    }
  }

  return (
    <>
      <DesktopBookingOverlay footerId="site-footer">
        <ProductBookingCard {...bookingCardProps} className="w-full" />
      </DesktopBookingOverlay>

      <DetailPageHero
        title={product.hero.title}
        paragraphs={product.hero.paragraphs}
        breadcrumbs={breadcrumbs}
        backgroundImageUrl={product.hero.backgroundImageUrl}
        backgroundImageAlt={product.hero.backgroundImageAlt ?? undefined}
        mediaImageUrl={product.mainImage?.url ?? undefined}
        mediaImageAlt={product.mainImage?.alt ?? undefined}
      />

      {product.sections.length > 0 ? (
        <div className="relative">
          <div className="mx-auto max-w-[var(--detail-content-max-width)] px-6 md:px-8">
            <div className="mt-12 space-y-10 md:mt-16 md:pr-[420px]">
              {await renderSections(product.sections, seminarFinderData)}
            </div>
          </div>
        </div>
      ) : null}

      <ProductBookingMobile {...bookingCardProps} />
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
      `[product-detail] Seminarliste konnte nicht geladen werden (Kategorie ${categorySlug || "alle"}):`,
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
      console.error(`[product-detail] Seminarliste konnte nicht geladen werden (Kategorie ${section.categorySlug}):`, error);
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
