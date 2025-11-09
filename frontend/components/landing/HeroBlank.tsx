import type { JSX } from "react";

type HeroBlankProps = {
  überschrift: string;
  überschriftStufe: "h1" | "h2" | "h3" | "h4";
  einleitung?: string | null;
};

const headingStyles: Record<"h1" | "h2" | "h3" | "h4", string> = {
  h1: "heading-hero",
  h2: "heading-hero",
  h3: "heading-section",
  h4: "heading-section"
};

const headingTags: Record<"h1" | "h2" | "h3" | "h4", keyof JSX.IntrinsicElements> = {
  h1: "h1",
  h2: "h2",
  h3: "h3",
  h4: "h4"
};

const extractParagraphs = (text?: string | null): string[] => {
  if (!text) {
    return [];
  }

  return text
    .split(/\n+/)
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
};

export function HeroBlank({ überschrift, überschriftStufe, einleitung }: HeroBlankProps) {
  const paragraphs = extractParagraphs(einleitung);
  const HeadingTag = headingTags[überschriftStufe];
  const headingClass = headingStyles[überschriftStufe];

  return (
    <section className="relative isolate bg-base-100 mb-[calc(var(--section-padding-y)*1.5)] md:mb-[var(--section-padding-y-xl)]">
      <div className="mx-auto flex max-w-5xl flex-col items-center justify-center gap-0 px-6 pt-10 pb-6 text-center md:gap-0.5 md:pt-16 md:pb-10">
        <HeadingTag className={`leading-tight tracking-tight text-base-content ${headingClass} mb-5`}>
          {überschrift}
        </HeadingTag>
        {paragraphs.length > 0 ? (
          <p className="mx-auto max-w-3xl text-lg leading-tight text-base-content/80 md:text-xl [word-spacing:-0.1em]">
            {paragraphs.map((paragraph, index) => (
              <span key={index} className="block">
                {paragraph}
              </span>
            ))}
          </p>
        ) : null}
      </div>
      <div className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-b from-base-100 via-base-100 to-base-200" aria-hidden="true" />
    </section>
  );
}
