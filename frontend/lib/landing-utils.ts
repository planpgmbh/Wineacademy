import { mediaUrl } from "./api";
import type { ColumnDisplayMode, SectionBackgroundKey } from "./landing-types";

const SECTION_BACKGROUND_KEYS = new Set<SectionBackgroundKey>([
  "neutral",
  "black",
  "wine-blue",
  "wine-blue-light",
  "wine-blue-lighter",
  "wine-blue-lightest",
  "wine-blue-dark",
  "wine-blue-darker",
  "wine-blue-darkest"
]);

const DARK_SECTION_BACKGROUNDS = new Set<SectionBackgroundKey>([
  "black",
  "wine-blue-dark",
  "wine-blue-darker",
  "wine-blue-darkest"
]);

const CARD_TEXT_ALIGNMENTS = new Set<"left" | "center" | "right">(["left", "center", "right"]);
const CARD_VERTICAL_ALIGNMENTS = new Set<"top" | "center" | "bottom">(["top", "center", "bottom"]);
const GALLERY_WIDTH_MODES = new Set<"full" | "content">(["full", "content"]);
const COLUMN_DISPLAY_MODES = new Set<ColumnDisplayMode>(["box", "plain"]);

export const SECTION_BACKGROUND_CSS_VAR: Record<SectionBackgroundKey, string> = {
  neutral: "--section-bg-neutral",
  black: "--section-bg-black",
  "wine-blue": "--section-bg-wine-blue",
  "wine-blue-light": "--section-bg-wine-blue-light",
  "wine-blue-lighter": "--section-bg-wine-blue-lighter",
  "wine-blue-lightest": "--section-bg-wine-blue-lightest",
  "wine-blue-dark": "--section-bg-wine-blue-dark",
  "wine-blue-darker": "--section-bg-wine-blue-darker",
  "wine-blue-darkest": "--section-bg-wine-blue-darkest"
};

export function resolveSectionBackground(value?: SectionBackgroundKey | null): SectionBackgroundKey {
  if (value && SECTION_BACKGROUND_KEYS.has(value)) {
    return value;
  }
  return "neutral";
}

export function isDarkSectionBackground(value: SectionBackgroundKey): boolean {
  return DARK_SECTION_BACKGROUNDS.has(value);
}

export const normaliseString = (value: string | null | undefined): string => {
  return typeof value === "string" ? value.trim() : "";
};

export const normaliseOptionalString = (value: string | null | undefined): string | null => {
  const trimmed = normaliseString(value);
  return trimmed.length > 0 ? trimmed : null;
};

export const slugify = (value: string): string => {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
};

export const normaliseSlug = (value: string | null | undefined, fallback: string, id: number): string => {
  if (typeof value === "string") {
    const prepared = slugify(value);
    if (prepared.length > 0) {
      return prepared;
    }
  }

  const fallbackSlug = slugify(fallback);
  if (fallbackSlug.length > 0) {
    return fallbackSlug;
  }

  return `item-${id}`;
};

export const pickBestImageUrl = (
  file?: { url?: string | null; formats?: Record<string, { url?: string | null }> | null } | null,
  preferredOrder: string[] = ["large", "medium", "small", "thumbnail"]
): string | null => {
  if (!file) return null;
  const formats = (file as any)?.formats ?? null;
  for (const key of preferredOrder) {
    const entry = formats?.[key];
    if (entry?.url) {
      const resolved = mediaUrl(entry.url);
      if (resolved) return resolved;
    }
  }
  return mediaUrl((file as any).url);
};

export const normaliseHeroHeadingLevel = (value: string | null | undefined): "h1" | "h2" | "h3" | "h4" => {
  if (value === "h1" || value === "h3" || value === "h4") {
    return value;
  }
  return "h2";
};

export const normaliseHeadingLevel = (value: string | null | undefined): "h2" | "h3" | "h4" => {
  if (value === "h3" || value === "h4") {
    return value;
  }
  return "h2";
};

export const normaliseBackgroundKey = (value: string | null | undefined): SectionBackgroundKey | null => {
  if (typeof value === "string" && SECTION_BACKGROUND_KEYS.has(value as SectionBackgroundKey)) {
    return value as SectionBackgroundKey;
  }
  return null;
};

export const normaliseColumnDisplayMode = (value: string | null | undefined): ColumnDisplayMode => {
  if (typeof value === "string" && COLUMN_DISPLAY_MODES.has(value as ColumnDisplayMode)) {
    return value as ColumnDisplayMode;
  }
  return "plain";
};

export const normaliseCardTextAlignment = (value: string | null | undefined): "left" | "center" | "right" => {
  if (typeof value === "string" && CARD_TEXT_ALIGNMENTS.has(value as "left" | "center" | "right")) {
    return value as "left" | "center" | "right";
  }
  return "center";
};

export const normaliseCardVerticalAlignment = (value: string | null | undefined): "top" | "center" | "bottom" => {
  if (typeof value === "string" && CARD_VERTICAL_ALIGNMENTS.has(value as "top" | "center" | "bottom")) {
    return value as "top" | "center" | "bottom";
  }
  return "center";
};

export const normaliseGalleryWidthMode = (value: string | null | undefined): "full" | "content" => {
  if (typeof value === "string" && GALLERY_WIDTH_MODES.has(value as "full" | "content")) {
    return value as "full" | "content";
  }
  return "full";
};
