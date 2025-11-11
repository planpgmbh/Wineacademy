import { fetchJson, mediaUrl } from "./api";

type PublicSeminarLocation = {
  name?: string | null;
  typ?: string | null;
  veranstaltungsort?: string | null;
  stadt?: string | null;
};

type PublicSeminarResponse = {
  id: number;
  name?: string | null;
  slug?: string | null;
  kurzbeschreibung?: string | null;
  bild?: {
    url?: string | null;
    alternativeText?: string | null;
  } | null;
  naechsterTermin?: {
    id?: number | null;
    starttag?: string | null;
    timestamp?: number | null;
    standort?: PublicSeminarLocation | null;
  } | null;
};

const normaliseString = (value: unknown): string => {
  return typeof value === "string" ? value.trim() : "";
};

const ensureSlug = (value: string | null | undefined, fallback: string, id: number): string => {
  if (typeof value === "string" && value.trim().length > 0) {
    return value.trim();
  }
  const base = fallback
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (base.length > 0) {
    return base;
  }
  return `seminar-${id}`;
};

const formatImage = (
  image: PublicSeminarResponse["bild"],
  fallbackTitle: string
): { src: string | null; alt: string } => {
  if (!image || !image.url) {
    return {
      src: null,
      alt: fallbackTitle.length > 0 ? fallbackTitle : "Seminarbild"
    };
  }
  const src = mediaUrl(image.url);
  const alt = normaliseString(image.alternativeText) || fallbackTitle || "Seminarbild";
  return { src, alt };
};

const isValidTimestamp = (value: unknown): value is number => {
  return typeof value === "number" && Number.isFinite(value);
};

const formatLocationLabel = (location: PublicSeminarLocation | null | undefined): string | null => {
  if (!location) {
    return null;
  }
  const name = normaliseString((location as any)?.name ?? null);
  const venue = normaliseString((location as any)?.veranstaltungsort ?? null);
  const city = normaliseString((location as any)?.stadt ?? null);
  const type = normaliseString((location as any)?.typ ?? null);

  if (type.toLowerCase() === "online") {
    return "Online";
  }
  if (venue && city && !venue.toLowerCase().includes(city.toLowerCase())) {
    return `${venue} · ${city}`;
  }
  if (name && city && !name.toLowerCase().includes(city.toLowerCase())) {
    return `${name} · ${city}`;
  }
  if (venue.length > 0) {
    return venue;
  }
  if (name.length > 0) {
    return name;
  }
  if (city.length > 0) {
    return city;
  }
  return null;
};

export type UpcomingSeminar = {
  id: number;
  slug: string;
  title: string;
  shortDescription: string | null;
  image: {
    src: string | null;
    alt: string;
  };
  nextDateIso: string;
  nextDateTimestamp: number;
  locationLabel: string | null;
};

export type FetchUpcomingSeminarsOptions = {
  categorySlug: string;
  limit: number;
  offset?: number;
};

export async function fetchUpcomingSeminars({
  categorySlug,
  limit,
  offset = 0
}: FetchUpcomingSeminarsOptions): Promise<UpcomingSeminar[]> {
  const params = new URLSearchParams();
  params.set("category", categorySlug);
  params.set("limit", String(Math.max(1, limit)));
  if (offset > 0) {
    params.set("offset", String(offset));
  }

  const payload = await fetchJson<PublicSeminarResponse[]>(`/public/seminare?${params.toString()}`, {
    cache: "no-store"
  });

  const seminars: UpcomingSeminar[] = [];

  payload.forEach((item) => {
    if (typeof item.id !== "number" || item.id <= 0) {
      return;
    }

    const title = normaliseString(item.name);
    if (title.length === 0) {
      return;
    }

    const nextDateIso = normaliseString(item.naechsterTermin?.starttag ?? null);
    if (nextDateIso.length === 0) {
      return;
    }

    const nextTimestamp = item.naechsterTermin?.timestamp ?? null;
    if (!isValidTimestamp(nextTimestamp)) {
      return;
    }

    const slug = ensureSlug(item.slug, title, item.id);
    const image = formatImage(item.bild ?? null, title);
    const shortDescription = normaliseString(item.kurzbeschreibung ?? null) || null;
    const locationLabel = formatLocationLabel(item.naechsterTermin?.standort ?? null);

    seminars.push({
      id: item.id,
      slug,
      title,
      shortDescription,
      image,
      nextDateIso,
      nextDateTimestamp: nextTimestamp,
      locationLabel
    });
  });

  return seminars;
}
