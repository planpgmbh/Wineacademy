import { notFound } from "next/navigation";
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

  const breadcrumbs = ["Seminare"];
  if (seminar.primaryCategoryName) {
    breadcrumbs.push(seminar.primaryCategoryName);
  }
  breadcrumbs.push(seminar.title);

  const bookingCardProps = {
    highlightLabel: seminar.bookingBox.highlightLabel ?? undefined,
    title: seminar.bookingBox.überschrift,
    price: seminar.price,
    description: seminar.bookingBox.beschreibung,
    dates: seminar.dates,
    buttonText: seminar.bookingBox.buttonText,
    seminarSlug: seminar.slug
  } as const;

  const DesktopStickyBookingCard = (
    <div className="pointer-events-none hidden md:block fixed inset-0 z-40">
      <div className="mx-auto flex h-full max-w-[var(--detail-content-max-width)] items-center justify-end px-6 md:px-8">
        <div className="pointer-events-auto">
          <SeminarBookingCard {...bookingCardProps} className="w-full" />
        </div>
      </div>
    </div>
  );

  return (
    <>
      {DesktopStickyBookingCard}

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

      <SeminarBookingMobile {...bookingCardProps} />
    </>
  );
}
