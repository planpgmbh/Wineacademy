"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, type JSX } from "react";

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
const DESCRIPTION_MAX_LENGTH = 160;

type SeminarFinderProps = {
  id?: string;
  überschrift?: string | null;
  überschriftStufe: "h2" | "h3" | "h4";
  categories: SeminarFinderCategory[];
  locations: SeminarFinderLocation[];
  initialCategorySlug?: string | null;
  initialLocationId?: string | null;
  hintergrund?: SectionBackgroundKey | null;
  allowedCategorySlugs?: string[] | null;
  compactCards?: boolean;
};

const LOCATION_SELECT_PILL_BASE =
  "relative inline-flex shrink-0 min-h-[22px] items-center rounded-full border px-2 text-[0.68rem] font-medium tracking-wide leading-tight transition-colors duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2";

const truncateText = (value: string | null | undefined, maxLength = DESCRIPTION_MAX_LENGTH): string | null => {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  if (trimmed.length <= maxLength) {
    return trimmed;
  }
  return `${trimmed.slice(0, maxLength).trimEnd()}...`;
};

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
  überschrift,
  überschriftStufe,
  categories,
  locations,
  initialCategorySlug,
  initialLocationId,
  hintergrund,
  allowedCategorySlugs,
  compactCards = false
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
        seminar.locationIds.forEach((locationId) => ids.add(locationId));
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

  const [selectedCategory, setSelectedCategory] = useState<string>(initialCategory);
  const [selectedLocation, setSelectedLocation] = useState<string>(initialLocationId ?? ALL_LOCATIONS);
  const [isLocationMenuOpen, setIsLocationMenuOpen] = useState(false);
  const locationDropdownRef = useRef<HTMLDivElement | null>(null);
  const [isDesktop, setIsDesktop] = useState<boolean>(() => {
    if (typeof window === "undefined") {
      return false;
    }
    return window.matchMedia("(min-width: 768px)").matches;
  });

  useEffect(() => {
    const handler = (evt: Event) => {
      const detail = (evt as CustomEvent)?.detail as { slug?: string | null } | undefined;
      const slug = detail?.slug;
      if (!slug) {
        return;
      }
      const exists = availableCategories.some((category) => category.slug === slug);
      if (!exists) {
        return;
      }
      setSelectedCategory(slug);
    };
    window.addEventListener("seminar-finder:set-category", handler as EventListener);
    return () => window.removeEventListener("seminar-finder:set-category", handler as EventListener);
  }, [availableCategories]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!locationDropdownRef.current) {
        return;
      }
      if (locationDropdownRef.current.contains(event.target as Node)) {
        return;
      }
      setIsLocationMenuOpen(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsLocationMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const media = window.matchMedia("(min-width: 768px)");
    const update = () => setIsDesktop(media.matches);
    update();
    if (typeof media.addEventListener === "function") {
      media.addEventListener("change", update);
      return () => media.removeEventListener("change", update);
    }
    media.addListener(update);
    return () => media.removeListener(update);
  }, []);

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

  const handleLocationBadgeClick = useCallback((locationId: string) => {
    setSelectedLocation((current) => (current === locationId ? ALL_LOCATIONS : locationId));
    setIsLocationMenuOpen(false);
  }, []);

  const handleLocationSelect = useCallback((locationId: string) => {
    setSelectedLocation(locationId || ALL_LOCATIONS);
    setIsLocationMenuOpen(false);
  }, []);

  const toggleLocationMenu = useCallback(() => {
    setIsLocationMenuOpen((current) => !current);
  }, []);

  const resolvedBackground = resolveSectionBackground(hintergrund ?? null);
  const isDarkBackground = isDarkSectionBackground(resolvedBackground);
  const style = useMemo(
    () => ({ backgroundColor: `var(${SECTION_BACKGROUND_CSS_VAR[resolvedBackground]})` }),
    [resolvedBackground]
  );

  const showHeadline = typeof überschrift === "string" && überschrift.trim().length > 0;
  const HeadingTag = headingTags[überschriftStufe];
  const headingClass = [
    headingClasses[überschriftStufe],
    isDarkBackground ? "heading-on-dark" : "",
    "!mb-4",
    "md:!mb-6"
  ]
    .filter(Boolean)
    .join(" ")
    .trim();

  const categoryPillInactive = isDarkBackground
    ? "badge-location badge-location-dark"
    : "badge-location badge-location-light";
  const categoryPillActive = isDarkBackground
    ? "badge-location badge-location-active-dark"
    : "badge-location badge-location-active-light";
  const getCategoryPillClass = (active: boolean) => (active ? categoryPillActive : categoryPillInactive);
  const hasLocationFilter = availableLocations.length > 0;
  const resolvedSelectedLocation = selectedLocation && selectedLocation.length > 0 ? selectedLocation : ALL_LOCATIONS;
  const locationMenuId = useMemo(() => `${id ?? "seminar-finder"}-location-menu`, [id]);
  const locationOptions = useMemo(() => {
    if (!hasLocationFilter) {
      return [];
    }
    return [{ id: ALL_LOCATIONS, label: "Alle Standorte" }, ...availableLocations];
  }, [availableLocations, hasLocationFilter]);
  const selectedLocationLabel = useMemo(() => {
    if (resolvedSelectedLocation === ALL_LOCATIONS) {
      return "Alle Standorte";
    }
    const match = availableLocations.find((location) => location.id === resolvedSelectedLocation);
    return match?.label ?? "Alle Standorte";
  }, [availableLocations, resolvedSelectedLocation]);
  const locationSelectWrapperClasses = `${LOCATION_SELECT_PILL_BASE} border-secondary text-secondary focus-visible:outline-secondary`;
  const locationArrowClass = "text-secondary";
  const locationMenuPanelClass = "bg-base-100 text-base-content";
  const locationOptionBaseClass =
    "flex w-full items-center justify-between rounded-xl px-3 py-2 text-sm text-base-content/80 transition";
  const locationOptionHoverClass = "hover:bg-base-200 hover:text-base-content";
  const locationOptionActiveClass = "bg-base-200 text-base-content font-semibold";
  const renderCategoryButtons = () => (
    <>
      <button
        type="button"
        className={getCategoryPillClass(selectedCategory === ALL_CATEGORIES)}
        aria-pressed={selectedCategory === ALL_CATEGORIES}
        onClick={() => setSelectedCategory(ALL_CATEGORIES)}
      >
        Alle Kategorien
      </button>
      {availableCategories.map((category) => {
        const active = selectedCategory === category.slug;
        return (
          <button
            key={category.slug}
            type="button"
            className={getCategoryPillClass(active)}
            aria-pressed={active}
            onClick={() => setSelectedCategory(category.slug)}
          >
            {category.name}
          </button>
        );
      })}
    </>
  );

  return (
    <section id={id ?? undefined} style={style} className="scroll-mt-28 md:scroll-mt-36">
      <div className="mx-auto max-w-6xl px-6 py-[var(--section-padding-y)] md:px-8 md:py-[var(--section-padding-y-lg)]">
        <div className="space-y-0 md:space-y-10">
          {showHeadline ? (
            <div className="space-y-3">
              <HeadingTag className={headingClass}>{überschrift}</HeadingTag>
            </div>
          ) : null}

          <div className="space-y-5 md:space-y-0">
            <div className="flex w-full flex-wrap gap-2 md:hidden">{renderCategoryButtons()}</div>

            <div className="hidden md:grid md:grid-cols-[minmax(0,1fr)_auto] md:items-start md:gap-3 lg:gap-5">
              <div className="flex flex-wrap gap-2 lg:max-w-4xl lg:gap-2">{renderCategoryButtons()}</div>

              {hasLocationFilter ? (
                <div className="relative hidden md:flex md:justify-end" ref={locationDropdownRef}>
                  <button
                    type="button"
                    className={`${locationSelectWrapperClasses} pr-6 w-full justify-between`}
                    onClick={toggleLocationMenu}
                    aria-haspopup="listbox"
                    aria-expanded={isLocationMenuOpen}
                    aria-controls={locationMenuId}
                  >
                    <span className="mr-1">{selectedLocationLabel}</span>
                    <span className={`pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 ${locationArrowClass}`}>
                      <svg
                        width="10"
                        height="6"
                        viewBox="0 0 10 6"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                        className={`transition-transform duration-200 ${isLocationMenuOpen ? "rotate-180" : ""}`}
                      >
                        <path
                          d="M1 1L5 5L9 1"
                          stroke="currentColor"
                          strokeWidth="1.2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </span>
                  </button>

                  {isLocationMenuOpen ? (
                    <div
                      id={locationMenuId}
                      className={`absolute right-0 top-[calc(100%+0.35rem)] z-20 w-60 rounded-2xl border border-base-200 px-1.5 py-2 shadow-xl ring-1 ring-base-200 ${locationMenuPanelClass}`}
                      role="listbox"
                      aria-activedescendant={resolvedSelectedLocation}
                    >
                      {locationOptions.map((option) => {
                        const active = resolvedSelectedLocation === option.id;
                        return (
                          <button
                            type="button"
                            key={option.id}
                            className={`${locationOptionBaseClass} ${locationOptionHoverClass} ${
                              active ? locationOptionActiveClass : ""
                            }`}
                            role="option"
                            aria-selected={active}
                            onClick={() => handleLocationSelect(option.id)}
                          >
                            <span>{option.label}</span>
                            {active ? (
                              <svg
                                width="14"
                                height="10"
                                viewBox="0 0 14 10"
                                fill="none"
                                xmlns="http://www.w3.org/2000/svg"
                                className="text-primary"
                              >
                                <path
                                  d="M2 5L5 8L12 1"
                                  stroke="currentColor"
                                  strokeWidth="1.5"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                />
                              </svg>
                            ) : null}
                          </button>
                        );
                      })}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>

          <div className="space-y-6 md:space-y-8">
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
                  <CategorySeminarList
                    seminars={seminars}
                    onLocationClick={handleLocationBadgeClick}
                    compactCards={compactCards}
                    isDesktop={isDesktop}
                    isFiltered={resolvedSelectedLocation !== ALL_LOCATIONS || selectedCategory !== ALL_CATEGORIES}
                  />
                ) : (
                  <div className="mt-6 rounded-2xl border border-secondary/40 bg-secondary-content/10 p-8 text-secondary-content md:mt-8">
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
  onLocationClick?: (locationId: string) => void;
  forceMobileLayout?: boolean;
};

type CategorySeminarListProps = {
  seminars: SeminarFinderSeminar[];
  onLocationClick?: (locationId: string) => void;
  compactCards: boolean;
  isDesktop: boolean;
  isFiltered: boolean;
};

function CategorySeminarList({
  seminars,
  onLocationClick,
  compactCards,
  isDesktop,
  isFiltered
}: CategorySeminarListProps) {
  const listRef = useRef<HTMLDivElement | null>(null);
  const [activeSlide, setActiveSlide] = useState(0);
  const [userInteracted, setUserInteracted] = useState(false);
  const [hasEnteredView, setHasEnteredView] = useState(false);
  const isFilteredMobile = !isDesktop && isFiltered;

  const scrollToIndex = useCallback((index: number) => {
    const container = listRef.current;
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
    if (isDesktop || seminars.length <= 1 || isFilteredMobile) {
      return;
    }
    const container = listRef.current;
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
  }, [isDesktop, seminars.length, isFilteredMobile]);

  useEffect(() => {
    if (
      isDesktop ||
      seminars.length <= 1 ||
      userInteracted ||
      typeof window === "undefined" ||
      !hasEnteredView ||
      isFilteredMobile
    ) {
      return;
    }
    const timer = window.setTimeout(() => {
      const nextIndex = (activeSlide + 1) % seminars.length;
      scrollToIndex(nextIndex);
    }, 4000);
    return () => window.clearTimeout(timer);
  }, [activeSlide, isDesktop, seminars.length, userInteracted, scrollToIndex, hasEnteredView, isFilteredMobile]);

  useEffect(() => {
    setActiveSlide(0);
    setUserInteracted(false);
    if (!isDesktop && listRef.current) {
      listRef.current.scrollTo({ left: 0, behavior: "auto" });
    }
  }, [isDesktop, seminars.length]);

  useEffect(() => {
    if (isDesktop || typeof window === "undefined") {
      return;
    }
    const target = listRef.current;
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

  return (
    <>
      <div className="hidden md:block md:mt-8 md:space-y-[var(--gap-seminar-columns)]">
        {seminars.map((seminar) => (
          <SeminarFinderCard
            key={seminar.id}
            seminar={seminar}
            onLocationClick={onLocationClick}
            forceMobileLayout={compactCards}
          />
        ))}
      </div>

      <div className="mt-6 md:hidden">
        {isFilteredMobile ? (
          <div className="flex flex-col gap-4">
            {seminars.map((seminar) => (
              <SeminarFinderCard
                key={seminar.id}
                seminar={seminar}
                onLocationClick={onLocationClick}
                forceMobileLayout
              />
            ))}
          </div>
        ) : (
          <>
            <div
              ref={listRef}
              className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-4 [-webkit-overflow-scrolling:touch] no-scrollbar"
            >
              {seminars.map((seminar) => (
                <div key={seminar.id} className="w-full shrink-0 snap-center">
                  <SeminarFinderCard
                    seminar={seminar}
                    onLocationClick={onLocationClick}
                    forceMobileLayout
                  />
                </div>
              ))}
            </div>
            {seminars.length > 1 ? (
              <div className="mt-2 flex justify-center gap-2">
                {seminars.map((seminar, index) => (
                  <span
                    key={`${seminar.id}-dot`}
                    className={`h-2 w-2 rounded-full transition ${
                      index === activeSlide ? "bg-primary" : "bg-secondary-content/40"
                    }`}
                  />
                ))}
              </div>
            ) : null}
          </>
        )}
      </div>
    </>
  );
}

function SeminarFinderCard({ seminar, onLocationClick, forceMobileLayout = false }: SeminarFinderCardProps) {
  const cardLayoutClasses = forceMobileLayout
    ? "flex h-full flex-col gap-3 rounded-2xl bg-base-100 p-5 shadow-sm ring-1 ring-base-200 md:gap-4"
    : "flex flex-col gap-3 rounded-2xl bg-base-100 p-5 md:grid md:grid-cols-[var(--width-seminar-date)_minmax(0,1fr)_auto_auto] md:items-start md:gap-[var(--gap-seminar-columns)] md:px-7 md:py-6";
  return (
    <article className={cardLayoutClasses}>
      <SeminarFinderCardMobile
        seminar={seminar}
        onLocationClick={onLocationClick}
        forceVisible={forceMobileLayout}
      />
      {forceMobileLayout ? null : <SeminarFinderCardDesktop seminar={seminar} onLocationClick={onLocationClick} />}
    </article>
  );
}

type SeminarFinderCardMobileProps = SeminarFinderCardProps & { forceVisible?: boolean };

function SeminarFinderCardMobile({ seminar, onLocationClick, forceVisible = false }: SeminarFinderCardMobileProps) {
  const locationBadgeClass = "badge-location badge-location-light";
  const shortDescription = truncateText(seminar.shortDescription);

  const handleBadgeClick = () => {
    if (!seminar.primaryLocationId) {
      return;
    }
    onLocationClick?.(seminar.primaryLocationId);
  };

  return (
    <div className={`flex h-full flex-col justify-between gap-4 ${forceVisible ? "" : "md:hidden"}`}>
      <div className="flex flex-col gap-[0.35rem]">
        <h4 className="font-sans text-base font-semibold text-base-content [&]:m-0">{seminar.name}</h4>
        {seminar.locationLabel ? (
          <button
            type="button"
            onClick={handleBadgeClick}
            className={locationBadgeClass}
            aria-label={`Seminare am Standort ${seminar.locationLabel} filtern`}
          >
            {seminar.locationLabel}
          </button>
        ) : null}
        {shortDescription ? <p className="text-sm leading-relaxed text-base-content/70">{shortDescription}</p> : null}
      </div>
      <div className="flex w-full items-center justify-between gap-3">
        <span className="font-sans text-xl font-semibold text-base-content">{seminar.priceLabel ?? ""}</span>
        <Link href={`/seminare/${seminar.slug}`} className="btn btn-primary min-w-[140px] px-4">
          Zum Seminar
        </Link>
      </div>
    </div>
  );
}

function SeminarFinderCardDesktop({ seminar, onLocationClick }: SeminarFinderCardProps) {
  const locationBadgeClass = "badge-location badge-location-light";
  const shortDescription = truncateText(seminar.shortDescription);

  const handleBadgeClick = () => {
    if (!seminar.primaryLocationId) {
      return;
    }
    onLocationClick?.(seminar.primaryLocationId);
  };

  return (
    <>
      <div className="hidden md:flex md:col-start-1 md:items-center md:justify-center">
        {seminar.nextDateIso ? <SeminarDateBadge date={seminar.nextDateIso} /> : null}
      </div>
      <div className="hidden md:flex md:col-start-2 md:flex-col md:gap-2">
        <div className="flex flex-col gap-[0.35rem]">
          <h4 className="font-sans text-base font-semibold text-base-content md:text-lg [&]:m-0">{seminar.name}</h4>
          {seminar.locationLabel ? (
            <button
              type="button"
              onClick={handleBadgeClick}
              className={locationBadgeClass}
              aria-label={`Seminare am Standort ${seminar.locationLabel} filtern`}
            >
              {seminar.locationLabel}
            </button>
          ) : null}
          {shortDescription ? (
            <p className="text-sm leading-relaxed text-base-content/70 md:text-base">{shortDescription}</p>
          ) : null}
        </div>
      </div>
      <div className="hidden md:flex md:col-start-3 md:col-span-2 md:flex-col md:items-end md:justify-between md:self-stretch">
        <span className="font-sans text-xl font-semibold text-base-content">{seminar.priceLabel ?? ""}</span>
        <Link href={`/seminare/${seminar.slug}`} className="btn btn-primary min-w-[160px]">
          Zum Seminar
        </Link>
      </div>
    </>
  );
}
