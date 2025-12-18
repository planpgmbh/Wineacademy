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
import { forwardRef, useCallback, useEffect, useMemo, useRef, useState, type JSX } from "react";

import { SeminarDateBadge } from "@/components/shared/SeminarDateBadge";
import { SliderDots } from "@/components/shared/SliderDots";

type SeminarListProps = {
  id?: string;
  überschrift?: string | null;
  überschriftStufe: "h2" | "h3" | "h4";
  einleitung?: string | null;
  categorySlug?: string | null;
  buttonText: string;
  mehrButtonText: string;
  mehrButtonAnzeigen: boolean;
  initialItems: UpcomingSeminar[];
  initialError?: string | null;
  anzahl: number;
  hintergrund?: SectionBackgroundKey | null;
  compactLayout?: boolean;
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

const slugify = (value: string): string =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const deriveLocationKeyFromSeminar = (seminar: Pick<UpcomingSeminar, "locationId" | "locationLabel">): string | null => {
  if (seminar.locationId) {
    return seminar.locationId;
  }
  if (seminar.locationLabel) {
    const slug = slugify(seminar.locationLabel);
    return slug.length > 0 ? slug : null;
  }
  return null;
};

const TOPLINE_DATE_FORMATTER = new Intl.DateTimeFormat("de-DE", { day: "2-digit", month: "short" });

const TOPLINE_DAY_FORMATTER = new Intl.DateTimeFormat("de-DE", { day: "2-digit" });
const TOPLINE_MONTH_FORMATTER = new Intl.DateTimeFormat("de-DE", { month: "long" });

const truncateText = (value?: string | null, limit = 160): string | null => {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  if (trimmed.length <= limit) {
    return trimmed;
  }
  return `${trimmed.slice(0, limit).trimEnd()}...`;
};

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
  isDarkBackground: boolean;
  onLocationClick?: (locationKey: string) => void;
  compactLayout?: boolean;
  mobileHeight?: number | null;
};

const SeminarListItem = forwardRef<HTMLElement, SeminarListItemProps>(function SeminarListItem(
  { seminar, buttonText, isDarkBackground, onLocationClick, compactLayout = false, mobileHeight = null },
  ref
) {
  const image = formatImageSrc(seminar);
  const seminarHref = `/seminare/${encodeURIComponent(seminar.slug)}`;
  const mobileToplineDate = useMemo(() => formatToplineDate(seminar.nextDateIso), [seminar.nextDateIso]);
  const locationLabel = seminar.locationLabel ?? null;
  const locationKey = deriveLocationKeyFromSeminar(seminar);
  const locationBadgeClass = isDarkBackground ? "badge-location badge-location-dark" : "badge-location badge-location-light";
  const truncatedDescription = truncateText(seminar.shortDescription);

  const handleLocationBadgeClick = () => {
    if (!locationKey) {
      return;
    }
    onLocationClick?.(locationKey);
  };

  const gridTemplateDesktop = compactLayout
    ? "md:grid-cols-[215px_var(--width-seminar-date)_minmax(0,1fr)]"
    : "md:grid-cols-[280px_var(--width-seminar-date)_minmax(0,1fr)]";
  const imageWidthClass = compactLayout ? "md:w-[215px]" : "md:w-[280px]";

  return (
    <article
      ref={ref}
      style={mobileHeight ? { minHeight: mobileHeight } : undefined}
      className={`group flex h-full flex-col overflow-hidden rounded-2xl bg-base-100 p-0 shadow-sm ring-1 ring-base-300/70 transition hover:shadow-md md:grid md:h-auto md:items-start md:gap-[var(--space-block)] md:rounded-none md:bg-transparent md:p-0 md:shadow-none md:ring-0 md:hover:shadow-none ${gridTemplateDesktop}`}
    >
      <div
        className={`relative col-span-full h-[190px] w-full shrink-0 overflow-hidden bg-base-200 md:col-span-1 md:row-span-full md:h-[170px] ${imageWidthClass} md:rounded-2xl md:shadow-md`}
      >
        {image.src ? (
          <Image
            src={image.src}
            alt={image.alt}
            fill
            sizes="(min-width: 1024px) 240px, (min-width: 768px) 280px, 100vw"
            className="object-cover transition-transform duration-500 group-hover:scale-[1.02]"
          />
        ) : (
          <div
            className="flex h-full w-full items-center justify-center"
            style={{
              backgroundImage: "var(--hero-fallback-gradient)",
              backgroundSize: "cover",
              backgroundPosition: "center"
            }}
          >
            <div className="flex h-[60px] w-[60px] items-center justify-center rounded-full bg-white/70 shadow-md backdrop-blur-sm">
              <Image
                src="/icons/WineAcademy.png"
                alt="Wine Academy Logo"
                width={50}
                height={50}
                className="h-[50px] w-[50px] object-contain"
              />
            </div>
          </div>
        )}
      </div>

      <div className="hidden items-start text-base-content/80 md:col-start-2 md:row-span-full md:flex md:justify-center md:self-start">
        <SeminarDateBadge date={seminar.nextDateIso} />
      </div>

      <div className="flex flex-1 flex-col justify-between gap-[var(--space-block)] px-6 pb-6 pt-4 md:col-start-3 md:row-start-1 md:flex-none md:gap-[var(--space-block)] md:self-start md:px-0 md:pb-0 md:pt-0">
        <div className="flex flex-col gap-[var(--space-compact)] md:gap-[var(--space-compact)]">
          {(mobileToplineDate || locationLabel) ? (
            <div className="flex items-center justify-between md:hidden">
              {mobileToplineDate ? (
                <p className="flex items-baseline gap-1.25 text-sm font-semibold uppercase leading-tight tracking-wide text-base-content">
                  <span className="text-base-content text-2xl leading-none">{mobileToplineDate.day}</span>
                  <span className="text-base-content/30">|</span>
                  <span className="font-normal text-base-content/60">{mobileToplineDate.month}</span>
                </p>
              ) : <span />}
              {locationLabel ? (
                <button
                  type="button"
                  onClick={handleLocationBadgeClick}
                  className={`${locationBadgeClass} md:hidden`}
                  aria-label={`Seminare am Standort ${locationLabel} filtern`}
                >
                  {locationLabel}
                </button>
              ) : null}
            </div>
          ) : null}
          <div className="flex flex-col gap-[var(--space-compact)]">
            <h3 className="heading-card rt-heading-xs font-semibold leading-tight text-balance text-base-content !mt-0 !mb-[0.15rem] !text-[1.35rem] w-fit">
              {seminar.title}
            </h3>
          </div>
          {truncatedDescription ? <p className="text-base text-base-content/80">{truncatedDescription}</p> : null}
        </div>
        <Link className="btn btn-primary min-w-[160px] self-start md:self-start" href={seminarHref}>
          {buttonText}
        </Link>
      </div>
    </article>
  );
});

export function SeminarList({
  id,
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
  hintergrund,
  compactLayout = false
}: SeminarListProps) {
  const loadLimit = Math.max(1, anzahl);
  const [items, setItems] = useState<UpcomingSeminar[]>(() => initialItems);
  const [isLoading, setIsLoading] = useState(false);
  const [hasMore, setHasMore] = useState(mehrButtonAnzeigen && initialItems.length >= loadLimit);
  const [error, setError] = useState<string | null>(initialError);
  const [selectedLocationKey, setSelectedLocationKey] = useState<string | null>(null);
  const [activeSlide, setActiveSlide] = useState(0);
  const [userInteracted, setUserInteracted] = useState(false);
  const [hasEnteredView, setHasEnteredView] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);
  const sliderRef = useRef<HTMLDivElement | null>(null);
  const itemRefs = useRef<(HTMLElement | null)[]>([]);
  const [maxMobileHeight, setMaxMobileHeight] = useState<number | null>(null);

  const handleLoadMore = useCallback(async () => {
    if (isLoading || !hasMore) {
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const offset = items.length;
      const nextItems = await fetchUpcomingSeminars({
        categorySlug: categorySlug ?? undefined,
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
  }, [categorySlug, hasMore, isLoading, items.length, loadLimit]);

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
    isDarkBackground ? "heading-on-dark" : "",
    "text-center"
  ]
    .filter(Boolean)
    .join(" ")
    .trim();
  const introTextClass = `${isDarkBackground ? "text-base-100/85" : "text-base-content/75"} text-center mx-auto`;
  const emptyStateClass = isDarkBackground ? "text-base-100/80" : "text-base-content/70";

  const locationOptions = useMemo(() => {
    const byKey = new Map<string, string>();
    items.forEach((seminar) => {
      if (!seminar.locationLabel) {
        return;
      }
      const key = deriveLocationKeyFromSeminar(seminar);
      if (!key || byKey.has(key)) {
        return;
      }
      byKey.set(key, seminar.locationLabel);
    });
    return Array.from(byKey.entries())
      .map(([id, label]) => ({ id, label }))
      .sort((a, b) => a.label.localeCompare(b.label, "de"));
  }, [items]);

  const hasLocationFilter = locationOptions.length > 0;
  const filteredItems = useMemo(() => {
    if (!selectedLocationKey) {
      return items;
    }
    return items.filter((seminar) => deriveLocationKeyFromSeminar(seminar) === selectedLocationKey);
  }, [items, selectedLocationKey]);

  const handleLocationFilterChange = useCallback((key: string | null) => {
    if (!key) {
      setSelectedLocationKey(null);
      return;
    }
    setSelectedLocationKey((current) => (current === key ? null : key));
  }, []);

  const noItemsMessage = selectedLocationKey
    ? "Für diesen Standort sind aktuell keine Termine geplant."
    : "Aktuell sind keine Termine geplant.";

  const hasIntro = paragraphs.length > 0;
  const listSpacingClass =
    hasIntro || hasLocationFilter
      ? "mt-[var(--space-block)] md:mt-[var(--space-section)]"
      : "mt-[var(--space-compact)] md:mt-[var(--space-block)]";
  const locationPillInactive = isDarkBackground ? "badge-location badge-location-dark" : "badge-location badge-location-light";
  const locationPillActive = isDarkBackground
    ? "badge-location badge-location-active-dark"
    : "badge-location badge-location-active-light";
  const getLocationPillClass = (active: boolean) => (active ? locationPillActive : locationPillInactive);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const media = window.matchMedia("(min-width: 768px)");
    const update = () => setIsDesktop(media.matches);
    update();
    const listener = () => update();
    media.addEventListener("change", listener);
    return () => media.removeEventListener("change", listener);
  }, []);

  const scrollToIndex = useCallback((index: number) => {
    const container = sliderRef.current;
    if (!container) {
      return;
    }
    const child = container.children[index] as HTMLElement | undefined;
    if (!child) {
      return;
    }
    container.scrollTo({ left: child.offsetLeft, behavior: "smooth" });
  }, []);

  useEffect(() => {
    if (isDesktop || filteredItems.length <= 1) {
      return;
    }
    const container = sliderRef.current;
    if (!container) {
      return;
    }
    const handleScroll = () => {
      const children = Array.from(container.children) as HTMLElement[];
      if (children.length === 0) {
        return;
      }
      const { scrollLeft } = container;
      let closestIndex = 0;
      let smallestDistance = Number.POSITIVE_INFINITY;
      children.forEach((child, index) => {
        const distance = Math.abs(child.offsetLeft - scrollLeft);
        if (distance < smallestDistance) {
          smallestDistance = distance;
          closestIndex = index;
        }
      });
      setActiveSlide(closestIndex);
      if (closestIndex === filteredItems.length - 1 && hasMore && !isLoading && userInteracted) {
        handleLoadMore();
      }
    };
    const handlePointerDown = () => setUserInteracted(true);
    const handleWheel = () => setUserInteracted(true);
    container.addEventListener("scroll", handleScroll, { passive: true });
    container.addEventListener("pointerdown", handlePointerDown, { passive: true });
    container.addEventListener("wheel", handleWheel, { passive: true });
    return () => {
      container.removeEventListener("scroll", handleScroll);
      container.removeEventListener("pointerdown", handlePointerDown);
      container.removeEventListener("wheel", handleWheel);
    };
  }, [filteredItems.length, handleLoadMore, hasMore, isDesktop, isLoading, userInteracted]);

  useEffect(() => {
    if (
      isDesktop ||
      filteredItems.length <= 1 ||
      userInteracted ||
      typeof window === "undefined" ||
      !hasEnteredView
    ) {
      return;
    }
    const timer = window.setTimeout(() => {
      const nextIndex = (activeSlide + 1) % filteredItems.length;
      scrollToIndex(nextIndex);
    }, 4000);
    return () => window.clearTimeout(timer);
  }, [activeSlide, filteredItems.length, isDesktop, scrollToIndex, userInteracted, hasEnteredView]);

  useEffect(() => {
    setActiveSlide(0);
    if (!isDesktop && sliderRef.current) {
      sliderRef.current.scrollTo({ left: 0, behavior: "auto" });
    }
  }, [filteredItems.length, isDesktop, selectedLocationKey]);

  useEffect(() => {
    if (isDesktop || typeof window === "undefined") {
      return;
    }
    const target = sliderRef.current;
    if (!target) {
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry.isIntersecting) {
          setHasEnteredView(true);
          observer.disconnect();
        }
      },
      { threshold: 0.2 }
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [isDesktop]);

  useEffect(() => {
    if (isDesktop) {
      setMaxMobileHeight(null);
      return;
    }
    const measure = () => {
      const heights = itemRefs.current
        .map((el) => {
          if (!el) {
            return 0;
          }
          const rect = el.getBoundingClientRect();
          return rect.height || el.offsetHeight;
        })
        .filter((height) => height > 0);
      if (heights.length === 0) {
        setMaxMobileHeight(null);
        return;
      }
      setMaxMobileHeight(Math.max(...heights));
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [filteredItems.length, isDesktop]);

  return (
    <section style={style} id={id} className="scroll-mt-28 md:scroll-mt-36">
      <div
        className={`mx-auto flex w-full max-w-[var(--landing-content-max-width)] flex-col px-6 py-[var(--section-padding-y-compact)] md:px-8 md:py-[var(--section-padding-y-lg)] ${
          isDarkBackground ? "text-base-100" : ""
        }`}
      >
        {showHeadline ? (
          <HeadingTag className={`${headingClass} mb-[var(--space-compact)] md:mb-[var(--space-compact)]`}>
            {trimmedHeadline}
          </HeadingTag>
        ) : null}

        {paragraphs.length > 0 ? (
          <div
            className={`max-w-3xl space-y-[var(--space-compact)] text-lg leading-relaxed ${introTextClass} mb-[var(--space-block)] md:mb-[var(--space-section)]`}
          >
            {paragraphs.map((paragraph, index) => (
              <p key={index}>{paragraph}</p>
            ))}
          </div>
        ) : null}

        {hasLocationFilter ? (
          <div className={`mb-0 flex flex-wrap justify-center gap-[var(--space-compact)] md:mb-0 md:gap-[var(--space-block)] ${hasIntro ? "mt-0" : "mt-[var(--space-compact)]"}`}>
            <button
              type="button"
              className={getLocationPillClass(selectedLocationKey === null)}
              aria-pressed={selectedLocationKey === null}
              onClick={() => handleLocationFilterChange(null)}
            >
              Alle Standorte
            </button>
            {locationOptions.map((option) => {
              const active = selectedLocationKey === option.id;
              return (
                <button
                  key={option.id}
                  type="button"
                  className={getLocationPillClass(active)}
                  aria-pressed={active}
                  onClick={() => handleLocationFilterChange(option.id)}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        ) : null}

        <div className={listSpacingClass}>
          {filteredItems.length === 0 ? (
            <div
              className={`rounded-3xl bg-base-100 px-6 py-10 text-center shadow-sm ring-1 ring-base-300 md:px-10 md:py-12 ${emptyStateClass}`}
            >
              {noItemsMessage}
            </div>
          ) : (
            <>
              <div className="hidden md:flex md:flex-col md:gap-[var(--space-block)]">
                {filteredItems.map((seminar) => (
                  <SeminarListItem
                    key={`${seminar.id}-${seminar.nextDateTimestamp}`}
                    seminar={seminar}
                    buttonText={buttonText}
                    isDarkBackground={isDarkBackground}
                    onLocationClick={handleLocationFilterChange}
                    compactLayout={compactLayout}
                  />
                ))}
              </div>

              <div className="md:hidden">
                <div
                  ref={sliderRef}
              className="flex snap-x snap-mandatory gap-[var(--space-compact)] overflow-x-auto pb-[var(--space-compact)] [-webkit-overflow-scrolling:touch] no-scrollbar"
                >
                  {filteredItems.map((seminar, index) => (
                    <div
                      key={`${seminar.id}-${seminar.nextDateTimestamp}`}
                      className="w-full shrink-0 snap-center"
                      style={maxMobileHeight ? { minHeight: maxMobileHeight } : undefined}
                    >
                      <SeminarListItem
                        ref={(el) => {
                          itemRefs.current[index] = el;
                        }}
                        seminar={seminar}
                        buttonText={buttonText}
                        isDarkBackground={isDarkBackground}
                        onLocationClick={handleLocationFilterChange}
                        compactLayout={compactLayout}
                        mobileHeight={maxMobileHeight}
                      />
                    </div>
                  ))}
                </div>
                <SliderDots count={filteredItems.length} activeIndex={activeSlide} />
              </div>
            </>
          )}
        </div>

        {error ? <p className="text-sm text-error">{error}</p> : null}

        {hasMore ? (
          <div className="mt-[var(--space-compact)] hidden justify-center md:mt-[var(--space-block)] md:flex">
            <button
              type="button"
              className="btn-more-outline min-w-[200px]"
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
