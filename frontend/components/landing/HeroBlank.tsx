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
    <section className="relative isolate bg-base-100 mb-[var(--space-section-lg)]">
      <div className="mx-auto flex max-w-[var(--landing-content-max-width)] flex-col items-center justify-center gap-[var(--space-compact)] px-6 py-[var(--space-section)] text-center md:gap-[var(--space-block)] md:px-8 md:py-[var(--space-section-lg)]">
        <HeadingTag className={`leading-tight tracking-tight text-base-content ${headingClass}`}>
          {überschrift}
        </HeadingTag>
        {paragraphs.length > 0 ? (
          <div className="mx-auto flex max-w-3xl flex-col gap-[var(--space-compact)] text-lg leading-tight text-base-content/80 md:text-xl [word-spacing:-0.1em]">
            {paragraphs.map((paragraph, index) => (
              <span key={index} className="block">
                {paragraph}
              </span>
            ))}
          </div>
        ) : null}
      </div>
      <div className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-b from-base-100 via-base-100 to-base-200" aria-hidden="true" />
    </section>
  );
}
