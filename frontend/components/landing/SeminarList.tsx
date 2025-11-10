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
  überschrift?: string | null;
  überschriftStufe: "h2" | "h3" | "h4";
  einleitung?: string | null;
  categorySlug: string;
  buttonText: string;
  mehrButtonText: string;
  mehrButtonAnzeigen: boolean;
  initialItems: UpcomingSeminar[];
  initialError?: string | null;
  anzahl: number;
  hintergrund?: SectionBackgroundKey | null;
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

const TOPLINE_DATE_FORMATTER = new Intl.DateTimeFormat("de-DE", { day: "2-digit", month: "short" });

const TOPLINE_DAY_FORMATTER = new Intl.DateTimeFormat("de-DE", { day: "2-digit" });
const TOPLINE_MONTH_FORMATTER = new Intl.DateTimeFormat("de-DE", { month: "long" });

const formatImageSrc = (item: UpcomingSeminar): { src: string | null; alt: string } => {
  const alt = item.image.alt?.trim() || item.title.trim() || "Seminarbild";
  const src = item.image.src && item.image.src.length > 0 ? item.image.src : null;
  return { src, alt };
};

const formatToplineDate = (value?: string | Date | null): { day: string; month: string } | null => {
  if (!value) {
    return null;
  }
  const parsed = typeof value === "string" ? new Date(value) : value;
  if (!(parsed instanceof Date) || Number.isNaN(parsed.getTime())) {
    return null;
  }
  return {
    day: TOPLINE_DAY_FORMATTER.format(parsed),
    month: TOPLINE_MONTH_FORMATTER.format(parsed).toUpperCase()
  };
};

type SeminarListItemProps = {
  seminar: UpcomingSeminar;
  buttonText: string;
};

function SeminarListItem({ seminar, buttonText }: SeminarListItemProps) {
  const image = formatImageSrc(seminar);
  const seminarHref = `/seminare/${encodeURIComponent(seminar.slug)}`;
  const mobileToplineDate = useMemo(() => formatToplineDate(seminar.nextDateIso), [seminar.nextDateIso]);

  return (
    <article className="group grid gap-4 md:grid-cols-[280px_var(--width-seminar-date)_minmax(0,1fr)] md:items-start md:gap-6">
      <div className="relative col-span-full aspect-[4/3] w-full overflow-hidden bg-base-200 md:col-span-1 md:row-span-full md:h-[170px] md:w-[280px]">
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

      <div className="hidden items-start text-base-content/80 md:col-start-2 md:row-span-full md:flex md:justify-center md:self-start">
        <SeminarDateBadge date={seminar.nextDateIso} />
      </div>

      <div className="flex flex-col gap-3 md:col-start-3 md:row-start-1 md:gap-4 md:self-start">
        <div className="space-y-1">
          {mobileToplineDate ? (
            <p className="flex items-baseline gap-1.5 text-base font-semibold uppercase leading-tight md:hidden">
              <span className="text-base-content">{mobileToplineDate.day}</span>
              <span className="text-base-content/30">|</span>
              <span className="font-normal text-base-content/60">{mobileToplineDate.month}</span>
            </p>
          ) : null}
          <h3 className="heading-card rt-heading-xs font-semibold leading-tight text-balance text-base-content !mt-0 mb-1.5 !text-[1.35rem]">
            {seminar.title}
          </h3>
          {seminar.shortDescription ? (
            <p className="text-base text-base-content/80">{seminar.shortDescription}</p>
          ) : null}
        </div>
        <Link className="btn btn-primary min-w-[160px] self-start" href={seminarHref}>
          {buttonText}
        </Link>
      </div>
    </article>
  );
}

export function SeminarList({
  überschrift,
  überschriftStufe,
  einleitung,
  categorySlug,
  buttonText,
  mehrButtonText,
  mehrButtonAnzeigen,
  initialItems,
  initialError = null,
  anzahl,
  hintergrund
}: SeminarListProps) {
  const loadLimit = Math.max(1, anzahl);
  const [items, setItems] = useState<UpcomingSeminar[]>(() => initialItems);
  const [isLoading, setIsLoading] = useState(false);
  const [hasMore, setHasMore] = useState(mehrButtonAnzeigen && initialItems.length >= loadLimit);
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

  const paragraphs = formatParagraphs(einleitung);
  const trimmedHeadline = überschrift?.trim() ?? "";
  const showHeadline = trimmedHeadline.length > 0;
  const resolvedBackground = resolveSectionBackground(hintergrund ?? null);
  const isDarkBackground = isDarkSectionBackground(resolvedBackground);
  const style = useMemo(
    () => ({ backgroundColor: `var(${SECTION_BACKGROUND_CSS_VAR[resolvedBackground]})` }),
    [resolvedBackground]
  );

  const HeadingTag = überschriftStufe as keyof JSX.IntrinsicElements;
  const headingClass = [
    überschriftStufe === "h2" ? "heading-section" : "",
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
        className={`mx-auto flex w-full max-w-[var(--landing-content-max-width)] flex-col gap-2 px-6 py-[var(--section-padding-y-compact)] md:px-8 md:py-[var(--section-padding-y-lg)] md:gap-4 ${
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
          <div className="flex flex-col gap-10 md:gap-14">
            {items.map((seminar) => (
              <SeminarListItem key={`${seminar.id}-${seminar.nextDateTimestamp}`} seminar={seminar} buttonText={buttonText} />
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
              {isLoading ? "Lädt …" : mehrButtonText}
            </button>
          </div>
        ) : null}
      </div>
    </section>
  );
}
