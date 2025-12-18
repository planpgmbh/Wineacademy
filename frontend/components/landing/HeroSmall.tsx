import Image from "next/image";
import type { JSX } from "react";

type HeroSmallProps = {
  überschrift: string;
  überschriftStufe: "h1" | "h2" | "h3" | "h4";
  einleitung?: string | null;
  bild?: {
    src: string;
    alt: string;
  } | null;
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

export function HeroSmall({ überschrift, überschriftStufe, einleitung, bild }: HeroSmallProps) {
  const paragraphs = extractParagraphs(einleitung);
  const HeadingTag = headingTags[überschriftStufe];
  const headingClass = headingStyles[überschriftStufe];

  return (
    <section className="relative isolate overflow-hidden mb-[var(--space-section-lg)]">
      <div className="min-h-[280px] px-6 py-[var(--space-section)] md:px-8 md:py-[var(--space-section-lg)]">
        <div className="relative z-10 mx-auto flex max-w-[var(--landing-content-max-width)] flex-col gap-[var(--space-block)] text-center text-base-100">
          <HeadingTag className={`heading-on-dark leading-tight tracking-tight ${headingClass}`}>
          {überschrift}
        </HeadingTag>
          {paragraphs.length > 0 ? (
            <div className="mx-auto flex max-w-2xl flex-col gap-[var(--space-compact)] text-lg leading-relaxed text-base-100/90 md:text-xl">
              {paragraphs.map((paragraph, index) => (
                <span key={index} className="block">
                  {paragraph}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      <div className="absolute inset-0 -z-20 bg-gradient-to-br from-primary/40 via-primary/30 to-primary/50" aria-hidden="true" />

      {bild ? (
        <div className="absolute inset-0 -z-30 overflow-hidden">
          <Image
            src={bild.src}
            alt={bild.alt}
            fill
            sizes="100vw"
            className="h-full w-full scale-110 object-cover blur-3xl opacity-70"
            priority
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-black/50 to-black/70" aria-hidden="true" />
        </div>
      ) : null}
    </section>
  );
}
