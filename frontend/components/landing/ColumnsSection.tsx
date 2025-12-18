"use client";

import Image from "next/image";
import type { JSX } from "react";

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
  überschrift?: string | null;
  überschriftStufe?: "h2" | "h3" | "h4" | null;
  hintergrund?: SectionBackgroundKey | null;
  darstellung?: "box" | "plain" | null;
  flush?: boolean;
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

export function ColumnsSection({
  überschrift,
  überschriftStufe,
  hintergrund,
  darstellung,
  flush = false,
  spalten
}: ColumnsSectionProps) {
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
  const showHeadline = typeof überschrift === "string" && überschrift.trim().length > 0;

  const contentStyle = { maxWidth: "var(--landing-content-max-width)" };
  const dividerTone = isDarkBackground ? "divide-white/25" : "divide-neutral-200";
  const verticalLineClass = isDarkBackground ? "bg-base-100/30" : "bg-base-content/20";
  const gridClass =
    variant === "plain"
      ? `grid ${columnLayoutClass} gap-y-[var(--space-compact)] md:gap-y-0 md:divide-y-0 ${dividerTone}`
      : `grid gap-[var(--space-block)] ${columnLayoutClass}`;

  const paddingY =
    variant === "plain" && showHeadline
      ? "py-[var(--section-padding-y-compact)] md:py-[var(--section-padding-y-lg)]"
      : "";

  const horizontalPaddingClass = flush ? "" : "px-6 md:px-8";
  const wrapperPaddingClass =
    variant === "plain"
      ? ["mx-auto w-full", horizontalPaddingClass, paddingY].filter(Boolean).join(" ")
      : [
          "mx-auto w-full",
          horizontalPaddingClass || undefined,
          "py-[var(--section-padding-y-compact)]",
          "md:py-[var(--section-padding-y-lg)]"
        ]
          .filter(Boolean)
          .join(" ");

  const HeadingTag = (überschriftStufe ?? "h2") as keyof JSX.IntrinsicElements;
  const headingClass = [
    (überschriftStufe ?? "h2") === "h2" ? "heading-section" : "",
    isDarkBackground ? "heading-on-dark" : ""
  ]
    .filter(Boolean)
    .join(" ");

  const stackGapClass =
    variant === "plain" && showHeadline
      ? "gap-[calc(var(--space-compact)*0.8)] md:gap-[calc(var(--space-compact)*0.8)]"
      : "gap-[var(--space-block)] md:gap-[var(--space-block)]";

  return (
    <section style={style}>
      <div className={`${wrapperPaddingClass} flex flex-col ${stackGapClass}`} style={contentStyle}>
        {showHeadline ? <HeadingTag className={`${headingClass} text-left`}>{überschrift?.trim()}</HeadingTag> : null}
        <div className={gridClass}>
          {items.map((column, index) => {
            const cardTone = isDarkBackground
              ? "border-neutral-700 bg-neutral-900 text-base-100"
              : "border-base-200 bg-base-100 text-base-content";
            const plainTone = isDarkBackground ? "text-base-100" : "text-base-content";
            const normalisedHtml =
              typeof column.html === "string" ? normaliseLegacyListMarkup(column.html) : column.html;
            const baseArticleClass = "flex h-full flex-col gap-[var(--space-block)]";
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
                ? `${baseArticleClass} ${plainTone} pt-0 pb-0 md:pt-0 md:pb-0 md:px-8 ${edgePaddingAdjustment}`.trim()
                : `${baseArticleClass} rounded-3xl border p-6 shadow-sm ${cardTone}`;

            const richTextClass = [
              "richtext-stack w-full text-base leading-relaxed",
              "[&_ul]:list-disc",
              "[&_ol]:list-decimal",
              "[&_a]:underline",
              isDarkBackground ? "[&_a]:text-primary-200" : "[&_a]:text-primary",
              isDarkBackground ? "text-base-100/85" : "text-base-content/80",
              "[&_strong]:text-current",
              "[&_em]:text-current",
              "[&_h3]:text-current",
              "[&_h4]:text-current",
              "[&_h5]:text-current"
            ]
              .filter(Boolean)
              .join(" ");

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
                  <div className={richTextClass} dangerouslySetInnerHTML={{ __html: normalisedHtml ?? "" }} />
                ) : null}
              </article>
            );

            if (variant === "plain") {
              return (
                <div
                  key={column.id}
                  className="relative flex h-full flex-col my-2 first:mt-0 last:mb-0 md:my-0"
                >
                  {index > 0 ? (
                    <span
                      aria-hidden="true"
                      className={`pointer-events-none absolute left-0 hidden w-px md:block ${verticalLineClass}`}
                      style={{ top: 0, bottom: 0 }}
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
