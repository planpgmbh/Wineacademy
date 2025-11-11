"use client";

import Image from "next/image";

import {
  resolveSectionBackground,
  SECTION_BACKGROUND_CSS_VAR,
  isDarkSectionBackground,
  type SectionBackgroundKey
} from "@/lib/landing";

type SpaltenEintrag = {
  id: number;
  html?: string | null;
  bild?: {
    src: string;
    alt: string;
  } | null;
};

type ColumnsSectionProps = {
  hintergrund?: SectionBackgroundKey | null;
  darstellung?: "box" | "plain" | null;
  spalten: SpaltenEintrag[];
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

export function ColumnsSection({ hintergrund, darstellung, spalten }: ColumnsSectionProps) {
  const items = spalten.filter((column) => column.html || column.bild);
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

  const variant = darstellung === "plain" ? "plain" : "box";
  const resolvedBackground = resolveSectionBackground(hintergrund ?? null);
  const style = { backgroundColor: `var(${SECTION_BACKGROUND_CSS_VAR[resolvedBackground]})` };
  const isDarkBackground = isDarkSectionBackground(resolvedBackground);

  const contentStyle = { maxWidth: "var(--landing-content-max-width)" };
  const dividerTone = isDarkBackground ? "divide-white/25" : "divide-neutral-200";
  const verticalLineClass = isDarkBackground ? "bg-base-100/30" : "bg-base-content/20";
  const gridClass =
    variant === "plain"
      ? `grid ${columnLayoutClass} divide-y md:divide-y-0 ${dividerTone}`
      : `grid gap-6 ${columnLayoutClass}`;

  const wrapperPaddingClass =
    variant === "plain"
      ? "mx-auto w-full px-6 md:px-8"
      : "mx-auto w-full px-6 py-[var(--section-padding-y-compact)] md:px-8 md:py-[var(--section-padding-y-lg)]";

  return (
    <section style={style}>
      <div className={wrapperPaddingClass} style={contentStyle}>
        <div className={gridClass}>
          {items.map((column, index) => {
            const cardTone = isDarkBackground
              ? "border-neutral-700 bg-neutral-900 text-base-100"
              : "border-base-200 bg-base-100 text-base-content";
            const plainTone = isDarkBackground ? "text-base-100" : "text-base-content";
            const normalisedHtml =
              typeof column.html === "string" ? normaliseLegacyListMarkup(column.html) : column.html;
            const baseArticleClass = "flex h-full flex-col gap-4";
            const edgePaddingAdjustment =
              variant === "plain"
                ? [
                    index === 0 ? "pl-0 md:pl-0" : "",
                    index === items.length - 1 ? "pr-0 md:pr-0" : ""
                  ]
                    .filter(Boolean)
                    .join(" ")
                : "";
            const articleClass =
              variant === "plain"
                ? `${baseArticleClass} ${plainTone} py-6 md:py-8 md:px-8 ${edgePaddingAdjustment}`.trim()
                : `${baseArticleClass} rounded-3xl border p-6 shadow-sm ${cardTone}`;

            const columnContent = (
              <article className={articleClass}>
                {column.bild ? (
                  <figure className="overflow-hidden rounded-2xl">
                    <div className="relative aspect-[4/3]">
                      <Image
                        src={column.bild.src}
                        alt={column.bild.alt}
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

            if (variant === "plain") {
              return (
                <div
                  key={column.id}
                  className="relative flex h-full flex-col mt-[5px] first:mt-0 md:mt-0"
                >
                  {index > 0 ? (
                    <span
                      aria-hidden="true"
                      className={`pointer-events-none absolute left-0 hidden w-px md:block ${verticalLineClass}`}
                      style={{ top: "2rem", bottom: "2rem" }}
                    />
                  ) : null}
                  {columnContent}
                </div>
              );
            }

            return (
              <div
                key={column.id}
                className="flex h-full flex-col mt-[5px] first:mt-0 md:mt-0"
              >
                {columnContent}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
