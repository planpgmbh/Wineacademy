"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";

import { fetchUpcomingSeminars, type UpcomingSeminar } from "@/lib/upcoming-seminars";

type SeminarListProps = {
  heading?: string | null;
  intro?: string | null;
  categorySlug: string;
  ctaLabel: string;
  loadMoreLabel: string;
  showLoadMore: boolean;
  initialItems: UpcomingSeminar[];
  initialError?: string | null;
  limit: number;
};

const DAY_FORMATTER = new Intl.DateTimeFormat("de-DE", { day: "2-digit" });
const MONTH_FORMATTER = new Intl.DateTimeFormat("de-DE", { month: "short" });

const formatParagraphs = (text: string): string[] => {
  return text
    .split(/\n+/)
    .map((paragraph) => paragraph.trim())
    .filter((paragraph) => paragraph.length > 0);
};

const formatMonth = (value: Date): string => MONTH_FORMATTER.format(value).toUpperCase();

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
  const seminarDate = new Date(seminar.nextDateIso);
  const day = DAY_FORMATTER.format(seminarDate);
  const month = formatMonth(seminarDate);
  const image = formatImageSrc(seminar);

  return (
    <article className="flex flex-col gap-6 rounded-3xl bg-base-100 p-6 shadow-sm ring-1 ring-base-300 md:flex-row md:items-stretch md:gap-8 md:p-8">
      <div className="relative aspect-[4/3] w-full overflow-hidden rounded-3xl bg-base-200 md:h-auto md:w-60 md:flex-none">
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

      <div className="flex items-center justify-start gap-2 text-base-content/80 md:w-24 md:flex-col md:items-center md:justify-center md:text-center">
        <span className="text-4xl font-semibold tracking-tight md:text-5xl">{day}</span>
        <span className="text-sm font-semibold uppercase tracking-[0.35em] text-base-content/60 md:tracking-[0.4em]">
          {month}
        </span>
      </div>

      <div className="flex flex-1 flex-col gap-4">
        <h3 className="text-2xl font-light leading-tight text-base-content md:text-[28px]">
          {seminar.title}
        </h3>
        {seminar.shortDescription ? (
          <p className="text-base text-base-content/80 md:text-lg">{seminar.shortDescription}</p>
        ) : null}
        <div>
          <Link className="btn btn-primary min-w-[160px]" href={`/seminare/${encodeURIComponent(seminar.slug)}`}>
            {ctaLabel}
          </Link>
        </div>
      </div>
    </article>
  );
}

export function SeminarList({
  heading,
  intro,
  categorySlug,
  ctaLabel,
  loadMoreLabel,
  showLoadMore,
  initialItems,
  initialError = null,
  limit
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

  return (
    <section className="bg-base-200">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-6 py-16 md:px-8 md:py-20">
        {heading ? (
          <h2 className="text-4xl font-light tracking-tight text-base-content md:text-5xl">{heading}</h2>
        ) : null}

        {paragraphs.length > 0 ? (
          <div className="max-w-3xl space-y-4 text-lg leading-relaxed text-base-content/75">
            {paragraphs.map((paragraph, index) => (
              <p key={index}>{paragraph}</p>
            ))}
          </div>
        ) : null}

        {items.length === 0 ? (
          <div className="rounded-3xl bg-base-100 px-6 py-12 text-center text-base-content/70 shadow-sm ring-1 ring-base-300 md:px-10">
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
