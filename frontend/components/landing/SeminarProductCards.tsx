"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, type JSX } from "react";

import { fetchUpcomingSeminars, type UpcomingSeminar } from "@/lib/upcoming-seminars";
import {
  resolveSectionBackground,
  SECTION_BACKGROUND_CSS_VAR,
  isDarkSectionBackground,
  type SectionBackgroundKey
} from "@/lib/landing";
import { SliderDots } from "@/components/shared/SliderDots";

type ProductCardItem = {
  id: number;
  name: string;
  slug: string;
  shortDescription?: string | null;
  image?: {
    src: string;
    alt: string;
  } | null;
};

type SeminarProductCardsProps = {
  überschrift?: string | null;
  überschriftStufe: "h2" | "h3" | "h4";
  einleitung?: string | null;
  hintergrund?: SectionBackgroundKey | null;
  modus: "seminare" | "produkte";
  categorySlug?: string | null;
  produkte?: ProductCardItem[] | null;
  anzahl: number;
  buttonText: string;
  mehrButtonText: string;
  mehrButtonAnzeigen: boolean;
  initialSeminars?: UpcomingSeminar[];
  initialError?: string | null;
};

const TOPLINE_DAY_FORMATTER = new Intl.DateTimeFormat("de-DE", { day: "2-digit" });
const TOPLINE_MONTH_FORMATTER = new Intl.DateTimeFormat("de-DE", { month: "long" });

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

const formatRichText = (html?: string | null) => {
  if (!html || html.trim().length === 0) {
    return null;
  }
  return html;
};

const truncateText = (value?: string | null, limit = 140): string | null => {
  if (!value) {
    return null;
  }
  const trimmed = value.trim();
  if (trimmed.length <= limit) {
    return trimmed;
  }
  return `${trimmed.slice(0, Math.max(0, limit - 1)).trimEnd()}…`;
};

type SeminarCardProps = {
  seminar: UpcomingSeminar;
  buttonText: string;
};

function SeminarCard({ seminar, buttonText }: SeminarCardProps) {
  const imageAlt = seminar.image.alt?.trim() || seminar.title || "Seminarbild";
  const hasImage = Boolean(seminar.image.src);
  const mobileToplineDate = formatToplineDate(seminar.nextDateIso);
  const location = seminar.locationLabel ?? null;
  const truncatedDescription = truncateText(seminar.shortDescription);
  const titleClass =
    "heading-card rt-heading-xs font-semibold leading-tight text-balance text-base-content !mt-0 !mb-[0.15rem] !text-[1.35rem] w-fit";
  const href = `/seminare/${encodeURIComponent(seminar.slug)}`;

  return (
    <Link
      href={href}
      className="group block h-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary focus-visible:ring-offset-2 focus-visible:ring-offset-base-100"
    >
      <article className="group flex h-full flex-col overflow-hidden rounded-2xl bg-base-100 p-0 shadow-sm ring-1 ring-base-300/70 transition hover:shadow-md">
        <div className="relative h-[190px] w-full shrink-0 overflow-hidden bg-base-200">
          {hasImage ? (
            <Image
              src={seminar.image.src as string}
              alt={imageAlt}
              fill
              className="object-cover transition-transform duration-500 group-hover:scale-[1.02]"
              sizes="(min-width: 1024px) 360px, (min-width: 768px) 320px, 100vw"
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
        <div className="flex flex-1 flex-col justify-between gap-[var(--space-block)] px-6 pb-6 pt-4">
          <div className="flex flex-col gap-[0.35rem]">
            {mobileToplineDate || location ? (
              <div className="flex items-center justify-between">
                {mobileToplineDate ? (
                  <p className="flex items-baseline gap-1.25 text-sm font-semibold uppercase leading-tight tracking-wide text-base-content">
                    <span className="text-base-content text-2xl leading-none">{mobileToplineDate.day}</span>
                    <span className="text-base-content/30">|</span>
                    <span className="font-normal text-base-content/60">{mobileToplineDate.month}</span>
                  </p>
                ) : (
                  <span />
                )}
                {location ? <span className="badge-location badge-location-light">{location}</span> : null}
              </div>
            ) : null}

            <h3 className={titleClass}>{seminar.title}</h3>
            {truncatedDescription ? <p className="text-base text-base-content/80">{truncatedDescription}</p> : null}
          </div>
          <span className="btn btn-primary pointer-events-none min-w-[150px] self-start transition-colors duration-200 hover:brightness-105">
            {buttonText}
          </span>
        </div>
      </article>
    </Link>
  );
}

type ProductCardProps = {
  product: ProductCardItem;
  buttonText: string;
};

function ProductCard({ product, buttonText }: ProductCardProps) {
  const hasImage = Boolean(product.image?.src);
  const imageAlt = product.image?.alt?.trim() || product.name || "Produktbild";
  const truncatedDescription = truncateText(product.shortDescription);
  const titleClass =
    "heading-card rt-heading-xs font-semibold leading-tight text-balance text-base-content !mt-0 !mb-[0.2rem] !text-[1.35rem] w-fit";
  const href = `/produkte/${encodeURIComponent(product.slug)}`;

  return (
    <Link
      href={href}
      className="group block h-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary focus-visible:ring-offset-2 focus-visible:ring-offset-base-100"
    >
      <article className="card card-compact h-full bg-base-100 shadow-lg transition hover:-translate-y-1 hover:shadow-xl">
        <figure className="relative h-48 w-full overflow-hidden bg-base-200">
          {hasImage ? (
            <Image
              src={product.image?.src as string}
              alt={imageAlt}
              fill
              className="object-cover transition duration-500 group-hover:scale-[1.02]"
              sizes="(min-width: 1024px) 360px, (min-width: 768px) 320px, 100vw"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-sm text-base-content/60">
              Kein Bild verfügbar
            </div>
          )}
        </figure>
        <div className="card-body gap-[var(--space-compact)]">
          <h3 className={titleClass}>{product.name}</h3>
          {truncatedDescription ? <p className="text-base text-base-content/75">{truncatedDescription}</p> : null}
          <div className="card-actions mt-auto pt-1">
            <span className="btn btn-primary pointer-events-none transition-colors duration-200 hover:brightness-105">{buttonText}</span>
          </div>
        </div>
      </article>
    </Link>
  );
}

export function SeminarProductCards({
  überschrift,
  überschriftStufe,
  einleitung,
  hintergrund,
  modus,
  categorySlug,
  produkte = [],
  anzahl,
  buttonText,
  mehrButtonText,
  mehrButtonAnzeigen,
  initialSeminars = [],
  initialError = null
}: SeminarProductCardsProps) {
  const loadLimit = Math.max(1, anzahl);
  const [seminars, setSeminars] = useState<UpcomingSeminar[]>(initialSeminars);
  const [productVisible, setProductVisible] = useState(() =>
    Math.min(loadLimit, Array.isArray(produkte) ? produkte.length : 0)
  );
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(initialError ?? null);
  const [hasMore, setHasMore] = useState(() => {
    if (!mehrButtonAnzeigen) {
      return false;
    }
    if (modus === "seminare") {
      return initialSeminars.length >= loadLimit;
    }
    return (produkte?.length ?? 0) > loadLimit;
  });

  const resolvedBackground = resolveSectionBackground(hintergrund ?? null);
  const style = useMemo(
    () => ({ backgroundColor: `var(${SECTION_BACKGROUND_CSS_VAR[resolvedBackground]})` }),
    [resolvedBackground]
  );
  const isDarkBackground = isDarkSectionBackground(resolvedBackground);
  const [isDesktop, setIsDesktop] = useState(false);
  const sliderRef = useRef<HTMLDivElement | null>(null);
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [activeSlide, setActiveSlide] = useState(0);
  const [userInteracted, setUserInteracted] = useState(false);
  const [hasEnteredView, setHasEnteredView] = useState(false);
  const [maxMobileHeight, setMaxMobileHeight] = useState<number | null>(null);

  const HeadingTag = überschriftStufe as keyof JSX.IntrinsicElements;
  const headingClass = [
    überschriftStufe === "h2" ? "heading-section" : "",
    isDarkBackground ? "heading-on-dark" : "",
    "text-center"
  ]
    .filter(Boolean)
    .join(" ")
    .trim();
  const introHtml = formatRichText(einleitung);
  const introClass = [
    "richtext-stack max-w-3xl mx-auto text-lg leading-relaxed",
    isDarkBackground ? "text-base-100/85" : "text-base-content/80",
    isDarkBackground ? "[&_a]:text-primary-200" : "[&_a]:text-primary",
    "[&_a]:underline",
    "[&_ul]:list-disc",
    "[&_ol]:list-decimal"
  ]
    .filter(Boolean)
    .join(" ");
  const textClass = isDarkBackground ? "text-base-100" : "text-base-content";
  const errorClass = isDarkBackground ? "text-error-content" : "text-error";

  const visibleProducts = useMemo(
    () => (modus === "produkte" ? (Array.isArray(produkte) ? produkte.slice(0, productVisible) : []) : []),
    [modus, produkte, productVisible]
  );
  const contentItems = modus === "produkte" ? visibleProducts : seminars;
  const showMoreButton = hasMore && mehrButtonAnzeigen;
  const hasIntro = Boolean(introHtml);
  const listSpacingClass = hasIntro
    ? "mt-[var(--space-block)] md:mt-[var(--space-section)]"
    : "mt-[var(--space-compact)] md:mt-[var(--space-block)]";

  const handleLoadMore = async () => {
    if (isLoading || !hasMore) {
      return;
    }

    if (modus === "produkte") {
      const total = produkte?.length ?? 0;
      const nextVisible = Math.min(total, productVisible + loadLimit);
      setProductVisible(nextVisible);
      if (nextVisible >= total) {
        setHasMore(false);
      }
      return;
    }

    if (!categorySlug) {
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const nextItems = await fetchUpcomingSeminars({
        categorySlug,
        limit: loadLimit,
        offset: seminars.length
      });
      setSeminars((current) => [...current, ...nextItems]);
      if (nextItems.length < loadLimit) {
        setHasMore(false);
      }
    } catch (err) {
      setError("Es ist ein Fehler beim Laden weiterer Inhalte aufgetreten.");
    } finally {
      setIsLoading(false);
    }
  };

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
  }, [contentItems.length, isDesktop]);

  useEffect(() => {
    if (isDesktop) {
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
    };
    const handlePointerDown = () => setUserInteracted(true);
    container.addEventListener("scroll", handleScroll, { passive: true });
    container.addEventListener("pointerdown", handlePointerDown, { passive: true });
    return () => {
      container.removeEventListener("scroll", handleScroll);
      container.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [isDesktop, contentItems.length]);

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
    if (isDesktop || contentItems.length <= 1 || userInteracted || typeof window === "undefined" || !hasEnteredView) {
      return;
    }
    const timer = window.setTimeout(() => {
      const nextIndex = (activeSlide + 1) % contentItems.length;
      const container = sliderRef.current;
      const child = container?.children[nextIndex] as HTMLElement | undefined;
      if (!container || !child) {
        return;
      }
      container.scrollTo({ left: child.offsetLeft, behavior: "smooth" });
    }, 4500);
    return () => window.clearTimeout(timer);
  }, [activeSlide, contentItems.length, isDesktop, userInteracted, hasEnteredView]);

  useEffect(() => {
    setActiveSlide(0);
    setUserInteracted(false);
    if (!isDesktop && sliderRef.current) {
      sliderRef.current.scrollTo({ left: 0, behavior: "auto" });
    }
  }, [contentItems.length, isDesktop]);

  return (
    <section style={style}>
      <div
        className={`mx-auto flex w-full max-w-[var(--landing-content-max-width)] flex-col px-6 py-[var(--section-padding-y-compact)] md:px-8 md:py-[var(--section-padding-y-lg)] ${textClass}`}
      >
        <div className="flex flex-col gap-[var(--space-compact)] text-center">
          {überschrift ? (
            <HeadingTag className={`${headingClass} !mb-[var(--space-compact)] md:!mb-[var(--space-compact)]`}>
              {überschrift}
            </HeadingTag>
          ) : null}
          {introHtml ? (
            <div
              className={`${introClass} mb-[var(--space-compact)] md:mb-[var(--space-block)]`}
              dangerouslySetInnerHTML={{ __html: introHtml }}
            />
          ) : null}
        </div>

        {error ? <p className={`text-center text-sm ${errorClass}`}>{error}</p> : null}

        <div className={listSpacingClass}>
          <div className="hidden grid-cols-1 gap-[var(--space-block)] md:grid md:grid-cols-[repeat(auto-fit,minmax(280px,1fr))]">
            {contentItems.map((item) =>
              modus === "produkte" ? (
                <ProductCard key={`product-${item.id}`} product={item as ProductCardItem} buttonText={buttonText} />
              ) : (
                <SeminarCard key={`seminar-${(item as UpcomingSeminar).id}`} seminar={item as UpcomingSeminar} buttonText={buttonText} />
              )
            )}
            {contentItems.length === 0 ? (
              <div className="col-span-full flex items-center justify-center rounded-2xl border border-dashed border-base-200 p-10 text-base-content/70">
                Keine Inhalte vorhanden.
              </div>
            ) : null}
          </div>

          <div className="md:hidden">
            <div
              ref={sliderRef}
              className="flex snap-x snap-mandatory gap-[var(--space-compact)] overflow-x-auto pb-[var(--space-compact)] [-webkit-overflow-scrolling:touch] no-scrollbar"
            >
              {contentItems.map((item, index) => (
                <div
                  key={`${modus}-${"id" in item ? item.id : index}`}
                  className="w-full shrink-0 snap-center"
                  ref={(el) => {
                    itemRefs.current[index] = el;
                  }}
                  style={maxMobileHeight ? { minHeight: maxMobileHeight } : undefined}
                >
                  {modus === "produkte" ? (
                    <ProductCard product={item as ProductCardItem} buttonText={buttonText} />
                  ) : (
                    <SeminarCard seminar={item as UpcomingSeminar} buttonText={buttonText} />
                  )}
                </div>
              ))}
            </div>
            <SliderDots count={contentItems.length} activeIndex={activeSlide} />
            {contentItems.length === 0 ? (
              <div className="mt-[var(--space-block)] rounded-2xl border border-dashed border-base-200 p-8 text-center text-base-content/70">
                Keine Inhalte vorhanden.
              </div>
            ) : null}
          </div>
        </div>

        {showMoreButton ? (
          <div className="mt-[var(--space-compact)] flex justify-center md:mt-[var(--space-block)]">
            <button
              type="button"
              className={`btn-more-outline ${isLoading ? "loading" : ""}`}
              disabled={isLoading}
              onClick={handleLoadMore}
            >
              {mehrButtonText}
            </button>
          </div>
        ) : null}
      </div>
    </section>
  );
}
