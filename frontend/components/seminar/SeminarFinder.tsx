'use client';

import { useMemo, useState } from "react";
import Link from "next/link";
import type { SeminarFinderCategory, SeminarFinderLocation } from "@/lib/seminar-finder";

const ALL_CATEGORIES = "all";
const ALL_LOCATIONS = "all";

type SeminarFinderProps = {
  id?: string;
  title?: string;
  categories: SeminarFinderCategory[];
  locations: SeminarFinderLocation[];
  initialCategorySlug?: string | null;
  initialLocationId?: string | null;
};

const buttonBaseClasses = "btn btn-sm";

export function SeminarFinder({
  id,
  title = "Finde dein passendes Seminar",
  categories,
  locations,
  initialCategorySlug,
  initialLocationId
}: SeminarFinderProps) {
  const safeCategories = useMemo(
    () => (Array.isArray(categories) ? categories : []),
    [categories]
  );
  const safeLocations = useMemo(
    () => (Array.isArray(locations) ? locations : []),
    [locations]
  );

  const initialCategory = useMemo(() => {
    if (typeof initialCategorySlug === "string") {
      const match = safeCategories.find((category) => category.slug === initialCategorySlug);
      if (match) {
        return match.slug;
      }
    }
    return ALL_CATEGORIES;
  }, [initialCategorySlug, safeCategories]);

  const initialLocation = useMemo(() => {
    if (typeof initialLocationId === "string") {
      const match = safeLocations.find((location) => location.id === initialLocationId);
      if (match) {
        return match.id;
      }
    }
    return ALL_LOCATIONS;
  }, [initialLocationId, safeLocations]);

  const [selectedCategory, setSelectedCategory] = useState<string>(initialCategory);
  const [selectedLocation, setSelectedLocation] = useState<string>(initialLocation);

  const { categoriesWithSeminars, fallbackCategories } = useMemo(() => {
    const baseCategories =
      selectedCategory === ALL_CATEGORIES
        ? safeCategories
        : safeCategories.filter((category) => category.slug === selectedCategory);

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
  }, [safeCategories, selectedCategory, selectedLocation]);

  const hasSeminars = categoriesWithSeminars.length > 0;
  const categoriesToDisplay =
    hasSeminars || selectedCategory === ALL_CATEGORIES ? categoriesWithSeminars : fallbackCategories;

  return (
    <section id={id ?? undefined} className="mx-auto max-w-6xl px-6 py-16 md:px-8">
      <div className="space-y-10">
        <div className="space-y-3">
          <h2 className="text-3xl font-semibold text-base-content md:text-4xl">{title}</h2>
          <p className="max-w-2xl text-base text-base-content/70">
            Filtere nach Kategorien oder Standorten und entdecke die passenden Seminare für dich.
          </p>
        </div>

        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap gap-3 lg:max-w-4xl">
            <button
              type="button"
              className={`${buttonBaseClasses} ${
                selectedCategory === ALL_CATEGORIES ? "btn-primary" : "btn-outline"
              }`}
              onClick={() => setSelectedCategory(ALL_CATEGORIES)}
            >
              Alle Kategorien
            </button>

            {safeCategories.map((category) => (
              <button
                key={category.slug}
                type="button"
                className={`${buttonBaseClasses} ${
                  selectedCategory === category.slug
                    ? "btn-primary"
                    : "btn-outline"
                }`}
                onClick={() => setSelectedCategory(category.slug)}
              >
                {category.name}
              </button>
            ))}
          </div>

          <label className="flex items-center gap-3 text-base-content/80">
            <span className="text-xs font-semibold uppercase tracking-[0.18em] text-base-content/60">Standort</span>
            <select
              className="select select-bordered select-sm w-48 border-base-300 bg-base-100 text-base-content shadow-sm shadow-base-300/40"
              value={selectedLocation}
              onChange={(event) => setSelectedLocation(event.target.value)}
            >
              <option value={ALL_LOCATIONS}>Alle Standorte</option>
              {safeLocations.map((location) => (
                <option key={location.id} value={location.id}>
                  {location.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="space-y-8">
          {categoriesToDisplay.map(({ category, seminars }) => {
            return (
              <div
                key={category.slug}
                className="rounded-[24px] bg-primary px-6 py-8 text-primary-content shadow-[0_18px_40px_-24px_rgba(34,55,99,0.55)] md:px-10 md:py-10"
              >
                <div className="space-y-3">
                  <h3 className="text-xl font-semibold md:text-2xl">{category.name}</h3>
                  {category.shortDescription ? (
                    <p className="max-w-3xl text-sm leading-relaxed text-primary-content/80 md:text-base">
                      {category.shortDescription}
                    </p>
                  ) : null}
                </div>

                {seminars.length > 0 ? (
                  <div className="mt-8 space-y-5">
                    {seminars.map((seminar) => (
                      <article
                        key={seminar.id}
                        className="rounded-2xl bg-base-100 p-5 shadow-[0_12px_32px_-24px_rgba(15,23,42,0.45)] md:flex md:items-center md:justify-between md:px-7 md:py-6"
                      >
                        <div className="space-y-2 md:max-w-2xl">
                          <h4 className="text-base font-semibold text-base-content md:text-lg">{seminar.name}</h4>
                          {seminar.shortDescription ? (
                            <p className="text-sm leading-relaxed text-base-content/70 md:text-base">
                              {seminar.shortDescription}
                            </p>
                          ) : null}
                        </div>

                        <div className="mt-6 flex flex-col items-start gap-3 md:mt-0 md:flex-row md:items-center">
                          {seminar.priceLabel ? (
                            <span className="text-base font-semibold text-base-content md:text-lg">{seminar.priceLabel}</span>
                          ) : null}
                          <Link
                            href={`/seminare/${seminar.slug}`}
                            className="btn btn-primary"
                          >
                            Zum Seminar
                          </Link>
                        </div>
                      </article>
                    ))}
                  </div>
                ) : (
                  <div className="mt-8 rounded-2xl border border-primary/40 bg-primary-content/10 p-8 text-base-content">
                    <p className="text-base font-medium text-primary-content">
                      Aktuell gibt es keine Seminare, die zu diesem Standort-Filter passen. Ändere die Auswahl, um
                      weitere Seminare zu entdecken.
                    </p>
                  </div>
                )}
              </div>
            );
          })}

          {!hasSeminars && selectedCategory === ALL_CATEGORIES ? (
            <div className="rounded-3xl border border-dashed border-base-300 p-10 text-center text-base-content/70">
              Es sind keine Seminare für diese Filterkombination verfügbar. Ändere die Auswahl, um weitere Seminare zu
              entdecken.
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
