import { fetchJson } from "./api";

type PublicCategory = {
  id: number;
  name?: string | null;
  slug?: string | null;
  kurzbeschreibung?: string | null;
};

type PublicSeminarCategory = {
  id: number;
  name?: string | null;
  slug?: string | null;
  kurzbeschreibung?: string | null;
};

type PublicSeminarTerm = {
  id: number;
  starttag?: string | null;
  kapazitaet?: number | null;
  planungsstatus?: string | null;
  preis?: number | string | null;
  standort?: {
    id?: number | null;
    name?: string | null;
    typ?: string | null;
    veranstaltungsort?: string | null;
    stadt?: string | null;
  } | null;
};

type PublicSeminar = {
  id: number;
  name?: string | null;
  slug?: string | null;
  kurzbeschreibung?: string | null;
  preis?: number | string | null;
  mwst?: boolean | null;
  kategorien?: PublicSeminarCategory[] | null;
  termine?: PublicSeminarTerm[] | null;
};

export type SeminarFinderLocation = {
  id: string;
  label: string;
};

export type SeminarFinderSeminar = {
  id: number;
  slug: string;
  name: string;
  shortDescription: string | null;
  priceLabel: string | null;
  locationIds: string[];
};

export type SeminarFinderCategory = {
  id: number;
  slug: string;
  name: string;
  shortDescription: string | null;
  seminars: SeminarFinderSeminar[];
};

export type SeminarFinderData = {
  categories: SeminarFinderCategory[];
  locations: SeminarFinderLocation[];
};

const PRICE_FORMATTER = new Intl.NumberFormat("de-DE", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0
});

function sanitiseSlug(rawSlug: string | null | undefined, fallback: string, id: number): string {
  if (typeof rawSlug === "string" && rawSlug.trim().length > 0) {
    return rawSlug.trim();
  }
  const fallbackSlug = fallback.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return fallbackSlug.length > 0 ? fallbackSlug : `category-${id}`;
}

function sanitiseName(value: string | null | undefined): string {
  return typeof value === "string" ? value.trim() : "";
}

function normaliseShortText(value: string | null | undefined): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function formatPrice(value: number | string | null | undefined): string | null {
  const numeric =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number.parseFloat(value.replace(",", "."))
        : null;

  if (numeric == null || !Number.isFinite(numeric) || numeric <= 0) {
    return null;
  }

  return PRICE_FORMATTER.format(numeric);
}

function createLocationId(raw: PublicSeminarTerm["standort"]): string | null {
  if (!raw) {
    return null;
  }
  if (typeof raw.id === "number") {
    return String(raw.id);
  }

  const name = sanitiseName(raw.name ?? raw.stadt ?? "");
  if (name.length > 0) {
    return name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  }

  return null;
}

function formatLocationLabel(raw: PublicSeminarTerm["standort"]): string {
  if (!raw) {
    return "Unbekannter Standort";
  }

  const type = sanitiseName(raw.typ ?? "");
  if (type === "online") {
    return "Online";
  }

  const name = sanitiseName(raw.name ?? "");
  const city = sanitiseName(raw.stadt ?? "");

  if (name && city && !name.toLowerCase().includes(city.toLowerCase())) {
    return `${name} · ${city}`;
  }

  if (name.length > 0) {
    return name;
  }

  if (city.length > 0) {
    return city;
  }

  return "Standort";
}

export async function getSeminarFinderData(): Promise<SeminarFinderData> {
  const [categoriesPayload, seminarsPayload] = await Promise.all([
    fetchJson<PublicCategory[]>("/public/kategorien", { cache: "no-store" }),
    fetchJson<PublicSeminar[]>("/public/seminare", { cache: "no-store" })
  ]);

  const orderedSlugs: string[] = [];
  const orderedSlugSet = new Set<string>();
  const rememberSlug = (slug: string) => {
    if (orderedSlugSet.has(slug)) {
      return;
    }
    orderedSlugSet.add(slug);
    orderedSlugs.push(slug);
  };
  const categoryMap = new Map<string, SeminarFinderCategory>();
  categoriesPayload.forEach((category) => {
    const name = sanitiseName(category.name);
    if (name.length === 0) {
      return;
    }

    const slug = sanitiseSlug(category.slug, name, category.id);
    rememberSlug(slug);
    categoryMap.set(slug, {
      id: category.id,
      slug,
      name,
      shortDescription: normaliseShortText(category.kurzbeschreibung),
      seminars: []
    });
  });

  const locationMap = new Map<string, SeminarFinderLocation>();

  seminarsPayload.forEach((seminar) => {
    const name = sanitiseName(seminar.name);
    if (name.length === 0) {
      return;
    }

    const slug = sanitiseSlug(seminar.slug, name, seminar.id);
    const shortDescription = normaliseShortText(seminar.kurzbeschreibung);
    const priceLabel = formatPrice(seminar.preis ?? null);

    const locationIds: string[] = [];
    const uniqueLocationIds = new Set<string>();

    (seminar.termine ?? []).forEach((termin) => {
      const locationId = createLocationId(termin.standort ?? null);
      if (!locationId) {
        return;
      }
      if (uniqueLocationIds.has(locationId)) {
        return;
      }
      uniqueLocationIds.add(locationId);
      locationIds.push(locationId);

      if (!locationMap.has(locationId)) {
        const label = formatLocationLabel(termin.standort ?? null);
        locationMap.set(locationId, {
          id: locationId,
          label
        });
      }
    });

    const seminarEntry: SeminarFinderSeminar = {
      id: seminar.id,
      slug,
      name,
      shortDescription,
      priceLabel,
      locationIds
    };

    const categories = Array.isArray(seminar.kategorien) ? seminar.kategorien : [];
    categories.forEach((category) => {
      const categoryName = sanitiseName(category.name);
      if (categoryName.length === 0) {
        return;
      }

      const categorySlug = sanitiseSlug(category.slug, categoryName, category.id);
      const existing = categoryMap.get(categorySlug);
      if (existing) {
        existing.seminars.push(seminarEntry);
      } else {
        rememberSlug(categorySlug);
        categoryMap.set(categorySlug, {
          id: category.id,
          slug: categorySlug,
          name: categoryName,
          shortDescription: normaliseShortText(category.kurzbeschreibung),
          seminars: [seminarEntry]
        });
      }
    });
  });

  const categories = orderedSlugs
    .map((slug) => categoryMap.get(slug))
    .filter((category): category is SeminarFinderCategory => Boolean(category));
  const locations = Array.from(locationMap.values()).sort((a, b) => a.label.localeCompare(b.label, "de"));

  return { categories, locations };
}
