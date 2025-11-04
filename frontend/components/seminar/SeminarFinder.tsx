"use client";

import Link from "next/link";
import { useMemo, useState, type JSX } from "react";

import type { SeminarFinderCategory, SeminarFinderLocation, SeminarFinderSeminar } from "@/lib/seminar-finder";
import {
  resolveSectionBackground,
  SECTION_BACKGROUND_CSS_VAR,
  isDarkSectionBackground,
  type SectionBackgroundKey
} from "@/lib/landing";
import { SeminarDateBadge } from "@/components/shared/SeminarDateBadge";

const ALL_CATEGORIES = "all";
const ALL_LOCATIONS = "all";

type SeminarFinderProps = {
  id?: string;
  headline?: string | null;
  headlineLevel: "h2" | "h3" | "h4";
  categories: SeminarFinderCategory[];
  locations: SeminarFinderLocation[];
  initialCategorySlug?: string | null;
  initialLocationId?: string | null;
  background?: SectionBackgroundKey | null;
  allowedCategorySlugs?: string[] | null;
};

const buttonBaseClasses =
  "inline-flex h-[32px] items-center justify-center rounded-full px-3 text-xs shadow-none transition-colors duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2";
const buttonActiveClasses =
  "border border-transparent bg-secondary text-secondary-content hover:bg-secondary/90 focus-visible:outline-secondary";
const buttonInactiveClasses =
  "ui-border bg-base-100 text-base-content hover:bg-base-200 hover:text-base-content/80 focus-visible:outline-base-content";

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

export function SeminarFinder({
  id,
  headline,
  headlineLevel,
  categories,
  locations,
  initialCategorySlug,
  initialLocationId,
  background,
  allowedCategorySlugs
}: SeminarFinderProps) {
  const allowedCategorySet = useMemo(() => {
    if (!Array.isArray(allowedCategorySlugs)) {
      return null;
    }
    const cleaned = allowedCategorySlugs
      .map((slug) => (typeof slug === "string" ? slug.trim() : ""))
      .filter((slug) => slug.length > 0);
    if (cleaned.length === 0) {
      return null;
    }
    return new Set(cleaned);
  }, [allowedCategorySlugs]);

  const availableCategories = useMemo(() => {
    const base = Array.isArray(categories) ? categories : [];
    if (!allowedCategorySet) {
      return base;
    }
    const filtered = base.filter((category) => allowedCategorySet.has(category.slug));
    return filtered.length > 0 ? filtered : base;
  }, [categories, allowedCategorySet]);

  const relevantLocationIds = useMemo(() => {
    const ids = new Set<string>();
    availableCategories.forEach((category) => {
      category.seminars.forEach((seminar) => {
        seminar.locationIds.forEach((locationId) => {
          ids.add(locationId);
        });
      });
    });
    return Array.from(ids);
  }, [availableCategories]);

  const availableLocations = useMemo(() => {
    const base = Array.isArray(locations) ? locations : [];
    if (relevantLocationIds.length === 0) {
      return base;
    }
    const relevantSet = new Set(relevantLocationIds);
    const filtered = base.filter((location) => relevantSet.has(location.id));
    return filtered.length > 0 ? filtered : base;
  }, [locations, relevantLocationIds]);

  const initialCategory = useMemo(() => {
    if (typeof initialCategorySlug === "string") {
      const match = availableCategories.find((category) => category.slug === initialCategorySlug);
      if (match) {
        return match.slug;
      }
    }
    return ALL_CATEGORIES;
  }, [initialCategorySlug, availableCategories]);

  const initialLocation = useMemo(() => {
    if (typeof initialLocationId === "string") {
      const match = availableLocations.find((location) => location.id === initialLocationId);
      if (match) {
        return match.id;
      }
    }
    return ALL_LOCATIONS;
  }, [initialLocationId, availableLocations]);

  const [selectedCategory, setSelectedCategory] = useState<string>(initialCategory);
  const [selectedLocation, setSelectedLocation] = useState<string>(initialLocation);

  const { categoriesWithSeminars, fallbackCategories } = useMemo(() => {
    const baseCategories =
      selectedCategory === ALL_CATEGORIES
        ? availableCategories
        : availableCategories.filter((category) => category.slug === selectedCategory);

    const filtered = baseCategories.map((category) => {
      const seminars = category.seminars.filter((seminar) => {
        if (selectedLocation === ALL_LOCATIONS) {
          return true;
        }
        if (!seminar.locationIds || seminar.locationIds.length === 0) {
          return false;
        }
        return seminar.locationIds.includes(selectedLocation);
      });

      return { category, seminars };
    });

    const nonEmpty = filtered.filter((entry) => entry.seminars.length > 0);
    return {
      categoriesWithSeminars: nonEmpty,
      fallbackCategories: filtered
    };
  }, [availableCategories, selectedCategory, selectedLocation]);

  const hasSeminars = categoriesWithSeminars.length > 0;
  const categoriesToDisplay =
    hasSeminars || selectedCategory === ALL_CATEGORIES ? categoriesWithSeminars : fallbackCategories;

  const resolvedBackground = resolveSectionBackground(background ?? null);
  const isDarkBackground = isDarkSectionBackground(resolvedBackground);
  const style = useMemo(
    () => ({ backgroundColor: `var(${SECTION_BACKGROUND_CSS_VAR[resolvedBackground]})` }),
    [resolvedBackground]
  );

  const showHeadline = typeof headline === "string" && headline.trim().length > 0;
  const HeadingTag = headingTags[headlineLevel];
  const headingClass = [headingClasses[headlineLevel], isDarkBackground ? "heading-on-dark" : ""]
    .filter(Boolean)
    .join(" ")
    .trim();

  return (
    <section id={id ?? undefined} style={style}>
      <div className="mx-auto max-w-6xl px-6 py-[var(--section-padding-y)] md:px-8 md:py-[var(--section-padding-y-lg)]">
        <div className="space-y-10">
          {showHeadline ? (
            <div className="space-y-3">
              <HeadingTag className={headingClass}>{headline}</HeadingTag>
            </div>
          ) : null}

          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap gap-3 lg:max-w-4xl">
              <button
                type="button"
                className={`${buttonBaseClasses} ${
                  selectedCategory === ALL_CATEGORIES ? buttonActiveClasses : buttonInactiveClasses
                }`}
                onClick={() => setSelectedCategory(ALL_CATEGORIES)}
              >
                Alle Kategorien
              </button>

              {availableCategories.map((category) => (
                <button
                  key={category.slug}
                  type="button"
                  className={`${buttonBaseClasses} ${
                    selectedCategory === category.slug ? buttonActiveClasses : buttonInactiveClasses
                  }`}
                  onClick={() => setSelectedCategory(category.slug)}
                >
                  {category.name}
                </button>
              ))}
            </div>

            <label className="flex items-center gap-3 text-base-content/80 lg:self-start">
              <span className="text-sm font-semibold text-base-content/60">Standort</span>
              <select
                className="select select-bordered select-sm w-48 border-base-300 bg-base-100 text-base-content shadow-sm shadow-base-300/40"
                value={selectedLocation}
                onChange={(event) => setSelectedLocation(event.target.value)}
              >
                <option value={ALL_LOCATIONS}>Alle Standorte</option>
                {availableLocations.map((location) => (
                  <option key={location.id} value={location.id}>
                    {location.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="space-y-8">
            {categoriesToDisplay.map(({ category, seminars }) => (
              <div
                key={category.slug}
                className="rounded-[24px] bg-secondary px-6 py-8 text-secondary-content shadow-[0_18px_40px_-24px_rgba(34,55,99,0.55)] md:px-10 md:py-10"
              >
                <div className="space-y-3">
                  <h3 className="font-serif text-3xl font-light text-secondary-content md:text-[2.1rem]">
                    {category.name}
                  </h3>
                  {category.shortDescription ? (
                    <p className="max-w-3xl text-sm leading-relaxed text-secondary-content/80 md:text-base">
                      {category.shortDescription}
                    </p>
                  ) : null}
                </div>

                {seminars.length > 0 ? (
                  <div className="mt-8 space-y-[var(--gap-seminar-columns)]">
                    {seminars.map((seminar) => (
                      <SeminarFinderCard key={seminar.id} seminar={seminar} />
                    ))}
                  </div>
                ) : (
                  <div className="mt-8 rounded-2xl border border-secondary/40 bg-secondary-content/10 p-8 text-secondary-content">
                    <p className="text-base font-medium text-secondary-content">
                      Aktuell gibt es keine Seminare, die zu diesem Standort-Filter passen. Ändere die Auswahl, um
                      weitere Seminare zu entdecken.
                    </p>
                  </div>
                )}
              </div>
            ))}

            {!hasSeminars && selectedCategory === ALL_CATEGORIES ? (
              <div className="rounded-3xl border border-dashed border-base-300 p-10 text-center text-base-content/70">
                Es sind keine Seminare für diese Filterkombination verfügbar. Ändere die Auswahl, um weitere Seminare zu
                entdecken.
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}

type SeminarFinderCardProps = {
  seminar: SeminarFinderSeminar;
};

function SeminarFinderCard({ seminar }: SeminarFinderCardProps) {
  return (
    <article className="flex flex-col gap-3 rounded-2xl bg-base-100 p-5 md:grid md:grid-cols-[var(--width-seminar-date)_minmax(0,1fr)_auto_auto] md:items-start md:gap-[var(--gap-seminar-columns)] md:px-7 md:py-6">
      <SeminarFinderCardMobile seminar={seminar} />
      <SeminarFinderCardDesktop seminar={seminar} />
    </article>
  );
}

function SeminarFinderCardMobile({ seminar }: SeminarFinderCardProps) {
  return (
    <div className="flex flex-col gap-3 md:hidden">
      <h4 className="font-sans text-base font-semibold text-base-content [&]:m-0">{seminar.name}</h4>
      {seminar.shortDescription ? (
        <p className="text-sm leading-relaxed text-base-content/70">{seminar.shortDescription}</p>
      ) : null}
      <div className="flex w-full items-center justify-between gap-3">
        <span className="font-sans text-xl font-semibold text-base-content">{seminar.priceLabel ?? ""}</span>
        <Link
          href={`/seminare/${seminar.slug}`}
          className="btn btn-primary min-w-[140px] px-4"
        >
          Zum Seminar
        </Link>
      </div>
    </div>
  );
}

function SeminarFinderCardDesktop({ seminar }: SeminarFinderCardProps) {
  return (
    <>
      <div className="hidden md:flex md:col-start-1 md:items-center md:justify-center">
        {seminar.nextDateIso ? <SeminarDateBadge date={seminar.nextDateIso} /> : null}
      </div>
      <div className="hidden md:flex md:col-start-2 md:flex-col md:gap-3">
        <h4 className="font-sans text-base font-semibold text-base-content md:text-lg [&]:m-0">{seminar.name}</h4>
        {seminar.shortDescription ? (
          <p className="text-sm leading-relaxed text-base-content/70 md:text-base">{seminar.shortDescription}</p>
        ) : null}
      </div>
      <div className="hidden md:flex md:col-start-3 md:items-center md:justify-end md:self-center">
        <span className="font-sans text-base font-semibold text-base-content md:text-lg">{seminar.priceLabel ?? ""}</span>
      </div>
      <div className="hidden md:flex md:col-start-4 md:items-center md:justify-end md:self-center">
        <Link href={`/seminare/${seminar.slug}`} className="btn btn-primary min-w-[160px]">
          Zum Seminar
        </Link>
      </div>
    </>
  );
}
