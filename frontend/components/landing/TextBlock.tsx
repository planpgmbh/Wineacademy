"use client";

import {
  resolveSectionBackground,
  SECTION_BACKGROUND_CSS_VAR,
  isDarkSectionBackground,
  type SectionBackgroundKey
} from "@/lib/landing";

type TextBlockProps = {
  background?: SectionBackgroundKey | null;
  html?: string | null;
  buttonLabel?: string | null;
  buttonLink?: string | null;
};

const resolveLinkAttributes = (href: string) => {
  const isExternal = /^https?:\/\//i.test(href);
  if (isExternal) {
    return { href, rel: "noopener noreferrer", target: "_blank" };
  }
  return { href };
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

export function TextBlock({ background, html, buttonLabel, buttonLink }: TextBlockProps) {
  const showButton = buttonLabel && buttonLabel.trim().length > 0 && buttonLink && buttonLink.trim().length > 0;
  const resolvedBackground = resolveSectionBackground(background ?? null);
  const style = { backgroundColor: `var(${SECTION_BACKGROUND_CSS_VAR[resolvedBackground]})` };
  const isDarkBackground = isDarkSectionBackground(resolvedBackground);
  const normalisedHtml = typeof html === "string" ? normaliseLegacyListMarkup(html) : html;

  return (
    <section style={style}>
      <div
        className={`mx-auto flex w-full max-w-4xl flex-col gap-8 px-6 py-20 md:px-8 md:py-24 ${
          isDarkBackground ? "text-base-100" : "text-base-content"
        }`}
      >
        {html ? (
          <div
            className={`prose prose-lg prose-legal max-w-none ${
              isDarkBackground
                ? "text-base-100/85 prose-headings:text-base-100"
                : "text-base-content/80 prose-headings:text-base-content"
            }`}
            dangerouslySetInnerHTML={{ __html: normalisedHtml ?? "" }}
          />
        ) : null}
        {showButton ? (
          <div>
            <a className="btn btn-outline btn-primary" {...resolveLinkAttributes(buttonLink.trim())}>
              {buttonLabel.trim()}
            </a>
          </div>
        ) : null}
      </div>
    </section>
  );
}
