import { fetchJson, mediaUrl } from "./api";

type StrapiMedia = {
  url?: string | null;
  alternativeText?: string | null;
};

type CategoryResponse = {
  id: number;
  name: string;
  slug: string;
  beschreibung?: string | null;
  heroDarkMode?: boolean | null;
  seoTitle?: string | null;
  seoDescription?: string | null;
  hintergrundbild?: StrapiMedia | null;
};

export type CategoryDetail = {
  id: number;
  slug: string;
  title: string;
  description: string;
  paragraphs: string[];
  backgroundImageUrl: string | null;
  backgroundImageAlt: string | null;
  heroDarkMode: boolean;
  seoTitle: string | null;
  seoDescription: string | null;
};

function splitParagraphs(text: string | null | undefined): string[] {
  if (!text) {
    return [];
  }

  return text
    .split(/\r?\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter((paragraph) => paragraph.length > 0);
}

export async function getCategoryDetail(slug: string): Promise<CategoryDetail | null> {
  const trimmedSlug = typeof slug === "string" ? slug.trim() : "";
  if (trimmedSlug.length === 0) {
    return null;
  }

  try {
    const payload = await fetchJson<CategoryResponse>(`/public/kategorien/${encodeURIComponent(trimmedSlug)}`);

    const description = typeof payload.beschreibung === "string" ? payload.beschreibung.trim() : "";
    const paragraphs = splitParagraphs(description);
    const backgroundImageUrl = mediaUrl(payload.hintergrundbild?.url);
    const backgroundImageAlt =
      typeof payload.hintergrundbild?.alternativeText === "string"
        ? payload.hintergrundbild.alternativeText.trim()
        : null;

    return {
      id: payload.id,
      slug: payload.slug,
      title: payload.name,
      description,
      paragraphs,
      backgroundImageUrl,
      backgroundImageAlt,
      heroDarkMode: Boolean(payload.heroDarkMode),
      seoTitle: typeof payload.seoTitle === "string" ? payload.seoTitle.trim() || null : null,
      seoDescription:
        typeof payload.seoDescription === "string" ? payload.seoDescription.trim() || null : null
    };
  } catch (error) {
    const status = (error as Error & { status?: number }).status;
    if (status === 404) {
      return null;
    }
    throw error;
  }
}
