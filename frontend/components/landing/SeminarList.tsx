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

const formatParagraphs = (text: string): string[] => {
  return text
    .split(/\n+/)
    .map((paragraph) => paragraph.trim())
    .filter((paragraph) => paragraph.length > 0);
};

const formatImageSrc = (item: UpcomingSeminar): { src: string | null; alt: string } => {
  const alt =
    item.image.alt && item.image.alt.trim().length > 0 ? item.image.alt.trim() : item.title.trim();
  return {
    src: item.image.src && item.image.src.length > 0 ? item.image.src : null,
    alt: alt.length > 0 ? alt : "Seminarbild"
  };
};

type SeminarListItemProps = {
  seminar: UpcomingSeminar;
  ctaLabel: string;
};

function SeminarListItem({ seminar, ctaLabel }: SeminarListItemProps) {
  const image = formatImageSrc(seminar);

  return (
    <article className="flex flex-col gap-6 rounded-3xl bg-base-100 p-6 shadow-sm ring-1 ring-base-300 md:grid md:grid-cols-[minmax(0,15rem)_var(--width-seminar-date)_minmax(0,1fr)] md:gap-[var(--gap-seminar-columns)] md:items-start md:p-8">
      <div className="relative col-span-full aspect-[4/3] w-full overflow-hidden rounded-3xl bg-base-200 md:col-span-1 md:row-span-full md:h-auto">
        {image.src ? (
          <Image
            src={image.src}
            alt={image.alt}
            fill
            sizes="(min-width: 1024px) 240px, (min-width: 768px) 280px, 100vw"
            className="object-cover transition-transform duration-500 group-hover:scale-[1.02]"
            priority={false}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-sm text-base-content/60">
            Kein Bild verfügbar
          </div>
        )}
      </div>

      <div className="hidden md:flex md:col-start-2 md:row-start-1 md:items-center md:justify-center md:justify-self-center">
        <SeminarDateBadge date={seminar.nextDateIso} />
      </div>

      <div className="flex flex-col gap-3 md:col-start-3 md:row-start-1 md:gap-4">
        <div className="space-y-2">
          <h3 className="text-2xl font-semibold text-base-content md:hidden">
            {seminar.title}
          </h3>
          <h3 className="hidden md:block heading-card">
            {seminar.title}
          </h3>
          {seminar.shortDescription ? (
            <p className="text-base text-base-content/80 md:text-lg">{seminar.shortDescription}</p>
          ) : null}
        </div>
        <Link className="btn btn-primary min-w-[160px] self-start" href={`/seminare/${encodeURIComponent(seminar.slug)}`}>
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
  const [offset, setOffset] = useState(initialItems.length);
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
      const nextItems = await fetchUpcomingSeminars({
        categorySlug,
        limit: loadLimit,
        offset
      });
      setItems((current) => [...current, ...nextItems]);
      setOffset((current) => current + nextItems.length);
      if (nextItems.length < loadLimit) {
        setHasMore(false);
      }
    } catch (err) {
      setError("Es ist ein Fehler beim Laden weiterer Seminare aufgetreten.");
    } finally {
      setIsLoading(false);
    }
  };

  const paragraphs = intro ? formatParagraphs(intro) : [];
  const showHeadline = typeof headline === "string" && headline.trim().length > 0;
  const resolvedBackground = resolveSectionBackground(background ?? null);
  const isDarkBackground = isDarkSectionBackground(resolvedBackground);
  const style = useMemo(
    () => ({ backgroundColor: `var(${SECTION_BACKGROUND_CSS_VAR[resolvedBackground]})` }),
    [resolvedBackground]
  );

  const headingTags: Record<"h2" | "h3" | "h4", keyof JSX.IntrinsicElements> = {
    h2: "h2",
    h3: "h3",
    h4: "h4"
  };

  const headingClasses: Record<"h2" | "h3" | "h4", string> = {
    h2: "heading-section",
    h3: "",
    h4: ""
  };

  const HeadingTag = headingTags[headlineLevel];
  const headingClass = [headingClasses[headlineLevel], isDarkBackground ? "heading-on-dark" : ""]
    .filter(Boolean)
    .join(" ")
    .trim();
  const introTextClass = isDarkBackground ? "text-base-100/85" : "text-base-content/75";
  const emptyStateClass = isDarkBackground ? "text-base-100/80" : "text-base-content/70";

  return (
    <section style={style}>
      <div
        className={`mx-auto flex w-full max-w-6xl flex-col gap-10 px-6 py-16 md:px-8 md:py-20 ${
          isDarkBackground ? "text-base-100" : ""
        }`}
      >
        {showHeadline ? <HeadingTag className={headingClass}>{headline}</HeadingTag> : null}

        {paragraphs.length > 0 ? (
          <div className={`max-w-3xl space-y-4 text-lg leading-relaxed ${introTextClass}`}>
            {paragraphs.map((paragraph, index) => (
              <p key={index}>{paragraph}</p>
            ))}
          </div>
        ) : null}

        {items.length === 0 ? (
          <div
            className={`rounded-3xl bg-base-100 px-6 py-12 text-center shadow-sm ring-1 ring-base-300 md:px-10 ${emptyStateClass}`}
          >
            Aktuell sind keine Termine geplant.
          </div>
        ) : (
          <div className="flex flex-col gap-10 md:gap-12">
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
