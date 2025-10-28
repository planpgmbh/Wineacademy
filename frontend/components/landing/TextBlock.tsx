"use client";

import type { JSX } from "react";

import { resolveSectionBackground, SECTION_BACKGROUND_CSS_VAR, type SectionBackgroundKey } from "@/lib/landing";

type TextBlockProps = {
  headline: string;
  headlineLevel: "h2" | "h3" | "h4";
  background?: SectionBackgroundKey | null;
  html?: string | null;
  buttonLabel?: string | null;
  buttonLink?: string | null;
};

const headingTags: Record<"h2" | "h3" | "h4", keyof JSX.IntrinsicElements> = {
  h2: "h2",
  h3: "h3",
  h4: "h4"
};

const headingClasses: Record<"h2" | "h3" | "h4", string> = {
  h2: "text-4xl font-light tracking-tight md:text-5xl",
  h3: "text-3xl font-semibold tracking-tight md:text-4xl",
  h4: "text-2xl font-semibold tracking-tight md:text-3xl"
};

const resolveLinkAttributes = (href: string) => {
  const isExternal = /^https?:\/\//i.test(href);
  if (isExternal) {
    return { href, rel: "noopener noreferrer", target: "_blank" };
  }
  return { href };
};

export function TextBlock({ headline, headlineLevel, background, html, buttonLabel, buttonLink }: TextBlockProps) {
  const showHeadline = headline.trim().length > 0;
  const showButton = buttonLabel && buttonLabel.trim().length > 0 && buttonLink && buttonLink.trim().length > 0;
  const resolvedBackground = resolveSectionBackground(background ?? null);
  const style = { backgroundColor: `var(${SECTION_BACKGROUND_CSS_VAR[resolvedBackground]})` };

  const HeadingTag = headingTags[headlineLevel];
  const headingClass = headingClasses[headlineLevel];

  return (
    <section style={style}>
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-6 py-20 text-base-content md:px-8 md:py-24">
        {showHeadline ? <HeadingTag className={headingClass}>{headline}</HeadingTag> : null}
        {html ? (
          <div
            className="prose prose-lg max-w-none text-base-content/80 prose-headings:text-base-content"
            dangerouslySetInnerHTML={{ __html: html }}
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
