"use client";

import { fetchUpcomingSeminars, type UpcomingSeminar } from "@/lib/upcoming-seminars";
import {
  resolveSectionBackground,
  SECTION_BACKGROUND_CSS_VAR,
  isDarkSectionBackground,
  type SectionBackgroundKey
} from "@/lib/landing";
import Image from "next/image";
import Link from "next/link";
import { useMemo, useState, type JSX } from "react";

import { SeminarDateBadge } from "@/components/shared/SeminarDateBadge";

type SeminarListProps = {
  headline?: string | null;
  headlineLevel: "h2" | "h3" | "h4";
  intro?: string | null;
  categorySlug: string;
  ctaLabel: string;
  loadMoreLabel: string;
  showLoadMore: boolean;
  initialItems: UpcomingSeminar[];
  initialError?: string | null;
  limit: number;
  background?: SectionBackgroundKey | null;
};

const formatParagraphs = (text?: string | null): string[] => {
  if (!text) {
    return [];
  }
  return text
    .split(/\n+/)
    .map((paragraph) => paragraph.trim())
    .filter((paragraph) => paragraph.length > 0);
};

const formatImageSrc = (item: UpcomingSeminar): { src: string | null; alt: string } => {
  const alt = item.image.alt?.trim() || item.title.trim() || "Seminarbild";
  const src = item.image.src && item.image.src.length > 0 ? item.image.src : null;
  return { src, alt };
};

type SeminarListItemProps = {
  seminar: UpcomingSeminar;
  ctaLabel: string;
};

function SeminarListItem({ seminar, ctaLabel }: SeminarListItemProps) {
  const image = formatImageSrc(seminar);
  const seminarHref = `/seminare/${encodeURIComponent(seminar.slug)}`;

  return (
    <article className="group grid gap-6 md:grid-cols-[280px_var(--width-seminar-date)_minmax(0,1fr)] md:items-start md:gap-[var(--gap-seminar-columns)]">
      <div className="relative col-span-full aspect-[4/3] w-full overflow-hidden bg-base-200 md:col-span-1 md:row-span-full md:h-[190px] md:w-[280px]">
        {image.src ? (
          <Image
            src={image.src}
            alt={image.alt}
            fill
            sizes="(min-width: 1024px) 240px, (min-width: 768px) 280px, 100vw"
            className="object-cover transition-transform duration-500 group-hover:scale-[1.02]"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-sm text-base-content/60">
            Kein Bild verfügbar
          </div>
        )}
      </div>

      <div className="flex items-start text-base-content/80 md:col-start-2 md:row-span-full md:justify-center md:self-start">
        <SeminarDateBadge date={seminar.nextDateIso} />
      </div>

      <div className="flex flex-col gap-3 md:col-start-3 md:row-start-1 md:gap-4 md:self-start">
        <div className="space-y-2">
          <h3 className="heading-card rt-heading-xs font-semibold leading-tight text-base-content !mt-0 !mb-0">
            {seminar.title}
          </h3>
          {seminar.shortDescription ? (
            <p className="text-base text-base-content/80">{seminar.shortDescription}</p>
          ) : null}
        </div>
        <Link className="btn btn-primary min-w-[160px] self-start" href={seminarHref}>
          {ctaLabel}
        </Link>
      </div>
    </article>
  );
}

export function SeminarList({
  headline,
  headlineLevel,
  intro,
  categorySlug,
  ctaLabel,
  loadMoreLabel,
  showLoadMore,
  initialItems,
  initialError = null,
  limit,
  background
}: SeminarListProps) {
  const loadLimit = Math.max(1, limit);
  const [items, setItems] = useState<UpcomingSeminar[]>(() => initialItems);
  const [isLoading, setIsLoading] = useState(false);
  const [hasMore, setHasMore] = useState(showLoadMore && initialItems.length >= loadLimit);
  const [error, setError] = useState<string | null>(initialError);

  const handleLoadMore = async () => {
    if (isLoading || !hasMore) {
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const offset = items.length;
      const nextItems = await fetchUpcomingSeminars({
        categorySlug,
        limit: loadLimit,
        offset
      });
      setItems((current) => [...current, ...nextItems]);
      if (nextItems.length < loadLimit) {
        setHasMore(false);
      }
    } catch (err) {
      setError("Es ist ein Fehler beim Laden weiterer Seminare aufgetreten.");
    } finally {
      setIsLoading(false);
    }
  };

  const paragraphs = formatParagraphs(intro);
  const trimmedHeadline = headline?.trim() ?? "";
  const showHeadline = trimmedHeadline.length > 0;
  const resolvedBackground = resolveSectionBackground(background ?? null);
  const isDarkBackground = isDarkSectionBackground(resolvedBackground);
  const style = useMemo(
    () => ({ backgroundColor: `var(${SECTION_BACKGROUND_CSS_VAR[resolvedBackground]})` }),
    [resolvedBackground]
  );

  const HeadingTag = headlineLevel as keyof JSX.IntrinsicElements;
  const headingClass = [
    headlineLevel === "h2" ? "heading-section" : "",
    isDarkBackground ? "heading-on-dark" : ""
  ]
    .filter(Boolean)
    .join(" ")
    .trim();
  const introTextClass = isDarkBackground ? "text-base-100/85" : "text-base-content/75";
  const emptyStateClass = isDarkBackground ? "text-base-100/80" : "text-base-content/70";

  return (
    <section style={style}>
      <div
        className={`mx-auto flex w-full max-w-4xl flex-col gap-2 px-6 py-[var(--section-padding-y-compact)] md:px-8 md:py-[var(--section-padding-y-lg)] md:gap-4 ${
          isDarkBackground ? "text-base-100" : ""
        }`}
      >
        {showHeadline ? <HeadingTag className={headingClass}>{trimmedHeadline}</HeadingTag> : null}

        {paragraphs.length > 0 ? (
          <div className={`max-w-3xl space-y-4 text-lg leading-relaxed ${introTextClass}`}>
            {paragraphs.map((paragraph, index) => (
              <p key={index}>{paragraph}</p>
            ))}
          </div>
        ) : null}

        {items.length === 0 ? (
          <div
            className={`rounded-3xl bg-base-100 px-6 py-10 text-center shadow-sm ring-1 ring-base-300 md:px-10 md:py-12 ${emptyStateClass}`}
          >
            Aktuell sind keine Termine geplant.
          </div>
        ) : (
          <div className="flex flex-col gap-8 md:gap-12">
            {items.map((seminar) => (
              <SeminarListItem key={`${seminar.id}-${seminar.nextDateTimestamp}`} seminar={seminar} ctaLabel={ctaLabel} />
            ))}
          </div>
        )}

        {error ? <p className="text-sm text-error">{error}</p> : null}

        {hasMore ? (
          <div className="flex justify-center">
            <button
              type="button"
              className="btn btn-outline min-w-[200px]"
              onClick={handleLoadMore}
              disabled={isLoading}
            >
              {isLoading ? "Lädt …" : loadMoreLabel}
            </button>
          </div>
        ) : null}
      </div>
    </section>
  );
}
