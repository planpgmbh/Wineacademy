"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState, type JSX } from "react";

import { fetchUpcomingSeminars, type UpcomingSeminar } from "@/lib/upcoming-seminars";
import {
  resolveSectionBackground,
  SECTION_BACKGROUND_CSS_VAR,
  isDarkSectionBackground,
  type SectionBackgroundKey
} from "@/lib/landing";

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

const DATE_FORMATTER = new Intl.DateTimeFormat("de-DE", {
  day: "2-digit",
  month: "long",
  year: "numeric"
});

const formatDate = (isoString: string): string | null => {
  if (!isoString) {
    return null;
  }
  const parsed = new Date(isoString);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return DATE_FORMATTER.format(parsed);
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
  const dateLabel = formatDate(seminar.nextDateIso);
  const location = seminar.locationLabel ?? null;
  const truncatedDescription = truncateText(seminar.shortDescription);
  const titleClass =
    "heading-card rt-heading-xs font-semibold leading-tight text-balance text-base-content !mt-0 !mb-[0.2rem] !text-[1.35rem] w-fit";
  const href = `/seminare/${encodeURIComponent(seminar.slug)}`;

  return (
    <Link
      href={href}
      className="group block h-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary focus-visible:ring-offset-2 focus-visible:ring-offset-base-100"
    >
      <article className="card card-compact h-full bg-base-100 shadow-lg transition hover:-translate-y-1 hover:shadow-xl">
        <figure className="relative h-48 w-full overflow-hidden bg-base-200">
          {hasImage ? (
            <Image
              src={seminar.image.src as string}
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
        <div className="card-body gap-3">
          <div className="flex flex-col gap-1">
            {dateLabel ? <p className="text-xs font-semibold uppercase text-base-content/60">{dateLabel}</p> : null}
            <h3 className={titleClass}>{seminar.title}</h3>
            {location ? <p className="text-sm text-base-content/70">{location}</p> : null}
          </div>
          {truncatedDescription ? (
            <p className="text-base text-base-content/75">{truncatedDescription}</p>
          ) : null}
          <div className="card-actions mt-auto pt-1">
            <span className="btn btn-primary pointer-events-none">{buttonText}</span>
          </div>
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
        <div className="card-body gap-3">
          <h3 className={titleClass}>{product.name}</h3>
          {truncatedDescription ? <p className="text-base text-base-content/75">{truncatedDescription}</p> : null}
          <div className="card-actions mt-auto pt-1">
            <span className="btn btn-primary pointer-events-none">{buttonText}</span>
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
  const introClass = isDarkBackground ? "prose prose-invert max-w-3xl mx-auto" : "prose max-w-3xl mx-auto";
  const textClass = isDarkBackground ? "text-base-100" : "text-base-content";
  const errorClass = isDarkBackground ? "text-error-content" : "text-error";

  const visibleProducts = useMemo(
    () => (modus === "produkte" ? (Array.isArray(produkte) ? produkte.slice(0, productVisible) : []) : []),
    [modus, produkte, productVisible]
  );

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

  const contentItems = modus === "produkte" ? visibleProducts : seminars;
  const showMoreButton = hasMore && mehrButtonAnzeigen;

  return (
    <section style={style}>
      <div
        className={`mx-auto flex w-full max-w-6xl flex-col gap-8 px-6 py-[var(--section-padding-y-compact)] md:gap-10 md:px-8 md:py-[var(--section-padding-y-lg)] ${textClass}`}
      >
        <div className="flex flex-col gap-1 text-center mb-4 md:mb-5">
          {überschrift ? <HeadingTag className={`${headingClass} mb-0 md:mb-0`}>{überschrift}</HeadingTag> : null}
          {introHtml ? <div className={introClass} dangerouslySetInnerHTML={{ __html: introHtml }} /> : null}
        </div>

        {error ? <p className={`text-center text-sm ${errorClass}`}>{error}</p> : null}

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
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

        {showMoreButton ? (
          <div className="flex justify-center">
            <button
              type="button"
              className={`btn btn-outline ${isLoading ? "loading" : ""}`}
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
