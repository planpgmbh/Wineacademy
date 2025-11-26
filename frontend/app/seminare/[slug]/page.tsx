import { notFound } from "next/navigation";
import { DesktopBookingOverlay } from "@/components/shared/DesktopBookingOverlay";
import { SeminarBookingCard } from "@/components/seminar/SeminarBookingCard";
import { SeminarBookingMobile } from "@/components/seminar/SeminarBookingMobile";
import { SeminarContentTabs } from "@/components/seminar/SeminarContentTabs";
import { DetailPageHero } from "@/components/shared/DetailPageHero";
import { getSeminarDetail } from "@/lib/seminar-detail";

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

        {seminar.tabs.length > 0 ? (
          <div className="relative">
            <div className="mx-auto max-w-[var(--detail-content-max-width)] px-6 md:px-8">
              <div className="mt-12 space-y-10 md:mt-16 md:pr-[420px]">
                <SeminarContentTabs tabs={seminar.tabs} />
              </div>
            </div>
          </div>
        ) : null}
      </div>

      <SeminarBookingMobile {...bookingCardProps} />
    </>
  );
}
