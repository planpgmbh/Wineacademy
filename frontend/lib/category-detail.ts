import { fetchJson } from "./api";
import { transformLandingSection, type LandingSection, type StrapiLandingComponent } from "./landing";

type StrapiMedia = {
  url?: string | null;
  alternativeText?: string | null;
};

type CategoryResponse = {
  id: number;
  name: string;
  slug: string;
  kurzbeschreibung?: string | null;
  seoTitle?: string | null;
  seoDescription?: string | null;
  abschnitte?: StrapiLandingComponent[] | null;
  seo?: {
    title?: string | null;
    description?: string | null;
    canonical?: string | null;
    robots?: string | null;
    og_image?: StrapiMedia | null;
  } | null;
};

export type CategoryDetail = {
  id: number;
  slug: string;
  title: string;
  shortDescription: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  sections: LandingSection[];
  seo?: CategoryResponse["seo"];
};

export async function getCategoryDetail(slug: string): Promise<CategoryDetail | null> {
  const trimmedSlug = typeof slug === "string" ? slug.trim() : "";
  if (trimmedSlug.length === 0) {
    return null;
  }

  try {
    const payload = await fetchJson<CategoryResponse>(`/public/kategorien/${encodeURIComponent(trimmedSlug)}`);

    const sections = Array.isArray(payload.abschnitte)
      ? payload.abschnitte.map(transformLandingSection).filter((section) => Boolean(section))
      : [];
    const shortDescription =
      typeof payload.kurzbeschreibung === "string" && payload.kurzbeschreibung.trim().length > 0
        ? payload.kurzbeschreibung.trim()
        : null;

    return {
      id: payload.id,
      slug: payload.slug,
      title: payload.name,
      shortDescription,
      seoTitle: typeof payload.seoTitle === "string" ? payload.seoTitle.trim() || null : null,
      seoDescription: typeof payload.seoDescription === "string" ? payload.seoDescription.trim() || null : null,
      sections,
      seo: payload.seo ?? null
    };
  } catch (error) {
    const status = (error as Error & { status?: number }).status;
    if (status === 404) {
      return null;
    }
    throw error;
  }
}
