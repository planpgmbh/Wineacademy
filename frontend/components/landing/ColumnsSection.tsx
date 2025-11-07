"use client";

import Image from "next/image";

import {
  resolveSectionBackground,
  SECTION_BACKGROUND_CSS_VAR,
  isDarkSectionBackground,
  type SectionBackgroundKey
} from "@/lib/landing";

type ColumnItem = {
  id: number;
  html?: string | null;
  image?: {
    src: string;
    alt: string;
  } | null;
};

type ColumnsSectionProps = {
  background?: SectionBackgroundKey | null;
  columns: ColumnItem[];
};

const normaliseLegacyListMarkup = (value: string): string => {
  const normaliseBlock = (tag: "ul" | "ol", raw: string): string => {
    if (/<li[\s>]/i.test(raw)) {
      return raw;
    }

    const lines = raw
      .split(/\n+/)
      .map((line) => line.replace(/&nbsp;/gi, " ").trim())
      .filter((line) => line.length > 0);

    if (lines.length === 0) {
      return raw;
    }

    return lines
      .map((line) => {
        const cleaned =
          tag === "ol"
            ? line.replace(/^[0-9]+[\.\)]\s*/, "").trim()
            : line.replace(/^[-–•*]\s*/, "").trim();
        return `<li>${cleaned}</li>`;
      })
      .join("");
  };

  return value
    .replace(/<ul>([\s\S]*?)<\/ul>/gi, (match, raw) => {
      const normalised = normaliseBlock("ul", raw);
      return normalised === raw ? match : `<ul>${normalised}</ul>`;
    })
    .replace(/<ol>([\s\S]*?)<\/ol>/gi, (match, raw) => {
      const normalised = normaliseBlock("ol", raw);
      return normalised === raw ? match : `<ol>${normalised}</ol>`;
    });
};

export function ColumnsSection({ background, columns }: ColumnsSectionProps) {
  const items = columns.filter((column) => column.html || column.image);
  if (items.length === 0) {
    return null;
  }

  const columnCount = items.length;
  const columnLayoutClass =
    columnCount <= 1
      ? "grid-cols-1 md:grid-cols-1 lg:grid-cols-1"
      : columnCount === 2
        ? "grid-cols-1 md:grid-cols-2 lg:grid-cols-2"
        : "grid-cols-1 md:grid-cols-2 lg:grid-cols-3";

  const resolvedBackground = resolveSectionBackground(background ?? null);
  const style = { backgroundColor: `var(${SECTION_BACKGROUND_CSS_VAR[resolvedBackground]})` };
  const isDarkBackground = isDarkSectionBackground(resolvedBackground);

  return (
    <section style={style}>
      <div
        className={`mx-auto w-full max-w-6xl px-6 py-[var(--section-padding-y-compact)] md:px-8 md:py-[var(--section-padding-y-lg)]`}
      >
        <div className={`grid gap-6 ${columnLayoutClass}`}>
          {items.map((column) => {
            const cardTone = isDarkBackground
              ? "border-neutral-700 bg-neutral-900 text-base-100"
              : "border-base-200 bg-base-100 text-base-content";
            const normalisedHtml =
              typeof column.html === "string" ? normaliseLegacyListMarkup(column.html) : column.html;

            return (
              <article
                key={column.id}
                className={`flex h-full flex-col gap-4 rounded-3xl border p-6 shadow-sm ${cardTone}`}
              >
                {column.image ? (
                  <figure className="overflow-hidden rounded-2xl">
                    <div className="relative aspect-[4/3]">
                      <Image
                        src={column.image.src}
                        alt={column.image.alt}
                        fill
                        sizes="(min-width: 1024px) 33vw, (min-width: 768px) 50vw, 100vw"
                        className="object-cover"
                      />
                    </div>
                  </figure>
                ) : null}
                {column.html ? (
                  <div
                    className={`prose prose-sm max-w-none ${
                      isDarkBackground
                        ? "text-base-100/85 prose-headings:text-base-100"
                        : "text-base-content/80 prose-headings:text-base-content"
                    }`}
                    dangerouslySetInnerHTML={{ __html: normalisedHtml ?? "" }}
                  />
                ) : null}
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
