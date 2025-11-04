import Image from "next/image";
import type { JSX } from "react";

type HeroSmallProps = {
  headline: string;
  headlineLevel: "h1" | "h2" | "h3" | "h4";
  intro?: string | null;
  image?: {
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

export function HeroSmall({ headline, headlineLevel, intro, image }: HeroSmallProps) {
  const paragraphs = extractParagraphs(intro);
  const HeadingTag = headingTags[headlineLevel];
  const headingClass = headingStyles[headlineLevel];

  return (
    <section className="relative isolate overflow-hidden mb-[var(--section-padding-y)] md:mb-[var(--section-padding-y-lg)]">
      <div className="min-h-[280px] px-6 py-16 sm:py-20">
        <div className="relative z-10 mx-auto flex max-w-4xl flex-col gap-6 text-center text-base-100">
          <HeadingTag className={`heading-on-dark leading-tight tracking-tight ${headingClass}`}>
            {headline}
          </HeadingTag>
          {paragraphs.length > 0 ? (
            <p className="mx-auto max-w-2xl text-lg leading-relaxed text-base-100/90 md:text-xl">
              {paragraphs.map((paragraph, index) => (
                <span key={index} className="block">
                  {paragraph}
                </span>
              ))}
            </p>
          ) : null}
        </div>
      </div>

      <div className="absolute inset-0 -z-20 bg-gradient-to-br from-primary/40 via-primary/30 to-primary/50" aria-hidden="true" />

      {image ? (
        <div className="absolute inset-0 -z-30 overflow-hidden">
          <Image
            src={image.src}
            alt={image.alt}
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
