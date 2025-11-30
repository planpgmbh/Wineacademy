import { CardGrid } from "@/components/landing/CardGrid";
import { ColumnsSection } from "@/components/landing/ColumnsSection";
import { DividerSection } from "@/components/landing/DividerSection";
import { SeminarList } from "@/components/landing/SeminarList";
import { SeminarProductCards } from "@/components/landing/SeminarProductCards";
import { TabsSection } from "@/components/landing/TabsSection";
import { SeminarFinder as LandingSeminarFinder } from "@/components/seminar/SeminarFinder";
import { DetailPageHero } from "@/components/shared/DetailPageHero";
import { DesktopBookingOverlay } from "@/components/shared/DesktopBookingOverlay";
import { VoucherBookingCard } from "@/components/voucher/VoucherBookingCard";
import { VoucherBookingMobile } from "@/components/voucher/VoucherBookingMobile";
import { getSeminarFinderData } from "@/lib/seminar-finder";
import { fetchUpcomingSeminars } from "@/lib/upcoming-seminars";
import { getVoucherDetail } from "@/lib/voucher-detail";
import type { ReactNode } from "react";
import type {
  LandingSeminarFinderSection,
  LandingSeminarListSection,
  LandingSeminarProductCardsSection,
  LandingSection,
  LandingTabsSection
} from "@/lib/landing";

export async function generateMetadata(): Promise<Metadata> {
  const voucher = await getVoucherDetail();
  const seo = voucher.seo;
  const title = seo?.title || voucher.title || "Gutscheine";
  const description = seo?.description || voucher.hero.paragraphs[0] || "Gutscheine der Wine Academy.";
  const canonical = seo?.canonical || undefined;
  const robots = seo?.robots || undefined;
  const ogImage = seo?.ogImageUrl || undefined;

  const metadata: Metadata = {
    title,
    description
  };

  if (canonical) {
    metadata.alternates = { canonical };
  }
  if (robots) {
    metadata.robots = robots;
  }
  if (ogImage) {
    metadata.openGraph = {
      title,
      description,
      url: canonical,
      images: [ogImage]
    };
  }

  return metadata;
}

export const revalidate = 0;
export const dynamic = "force-dynamic";

export default async function VoucherDetailPage() {
  const voucher = await getVoucherDetail();

  const needsSeminarFinderData = voucher.sections.some((section) => section.type === "seminar-finder");
  let seminarFinderData: Awaited<ReturnType<typeof getSeminarFinderData>> | null = null;

  if (needsSeminarFinderData) {
    try {
      seminarFinderData = await getSeminarFinderData();
    } catch (error) {
      console.error("[gutscheine] SeminarFinder-Daten konnten nicht geladen werden:", error);
    }
  }

  const breadcrumbs: { label: string; href?: string }[] = [
    { label: "Gutscheine", href: "/gutscheine" },
    { label: voucher.title }
  ];

  const bookingProps = {
    highlightLabel: voucher.bookingBox.highlightLabel ?? undefined,
    title: voucher.bookingBox.überschrift,
    description: voucher.bookingBox.beschreibung,
    buttonText: voucher.bookingBox.buttonText,
    defaultAmount: voucher.bookingBox.defaultAmount,
    minAmount: voucher.bookingBox.minAmount ?? null,
    maxAmount: voucher.bookingBox.maxAmount ?? null,
    voucherTitle: voucher.title,
    voucherDescription: voucher.hero.paragraphs[0] ?? voucher.bookingBox.beschreibung,
    imageUrl: voucher.mainImage?.url ?? null,
    imageAlt: voucher.mainImage?.alt ?? null,
    shippingCost: voucher.shippingCost ?? null
  } as const;

  return (
    <>
      <DesktopBookingOverlay footerId="site-footer">
        <VoucherBookingCard {...bookingProps} className="w-full" />
      </DesktopBookingOverlay>

      <DetailPageHero
        title={voucher.hero.title}
        paragraphs={voucher.hero.paragraphs}
        breadcrumbs={breadcrumbs}
        backgroundImageUrl={voucher.hero.backgroundImageUrl}
        backgroundImageAlt={voucher.hero.backgroundImageAlt ?? undefined}
        mediaImageUrl={voucher.mainImage?.url ?? undefined}
        mediaImageAlt={voucher.mainImage?.alt ?? undefined}
        preferDarkMode={voucher.hero.preferDarkMode}
      />

      {voucher.sections.length > 0 ? (
        <div className="relative">
          <div className="mx-auto max-w-[var(--detail-content-max-width)]">
            <div className="mt-6 space-y-10 md:mt-10 md:pr-[400px]">
              {await renderSections(voucher.sections, seminarFinderData)}
            </div>
          </div>
        </div>
      ) : null}

      <VoucherBookingMobile {...bookingProps} />
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
      `[gutscheine] Seminarliste konnte nicht geladen werden (Kategorie ${categorySlug || "alle"}):`,
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
      console.error(`[gutscheine] Seminarliste konnte nicht geladen werden (Kategorie ${section.categorySlug}):`, error);
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
import type { Metadata } from "next";
