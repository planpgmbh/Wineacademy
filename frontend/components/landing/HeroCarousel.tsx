"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import type { JSX } from "react";

type Bild = {
  src: string;
  alt: string;
};

type HeroCarouselProps = {
  überschrift: string;
  überschriftStufe: "h1" | "h2" | "h3" | "h4";
  einleitung?: string | null;
  bilder: Bild[];
  rotationSekunden?: number;
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

const clampInterval = (value: number | undefined, fallback: number): number => {
  if (!value || Number.isNaN(value)) {
    return fallback;
  }
  return Math.min(Math.max(value, 2000), 60000);
};

export function HeroCarousel({ überschrift, überschriftStufe, einleitung, bilder, rotationSekunden }: HeroCarouselProps) {
  const validSlides = useMemo(
    () => bilder.filter((bild) => typeof bild.src === "string" && bild.src.trim().length > 0),
    [bilder]
  );
  const slideCount = validSlides.length;
  const [activeIndex, setActiveIndex] = useState(0);
  const paragraphs = useMemo(
    () =>
      einleitung
        ? einleitung
            .split(/\n+/)
            .map((paragraph) => paragraph.trim())
            .filter((paragraph) => paragraph.length > 0)
        : [],
    [einleitung]
  );
  const rotationInterval = clampInterval(rotationSekunden ? rotationSekunden * 1000 : undefined, 8000);

  const HeadingTag = headingTags[überschriftStufe];
  const headingClass = headingStyles[überschriftStufe];

  useEffect(() => {
    if (slideCount <= 1) {
      setActiveIndex(0);
      return;
    }

    const timer = window.setInterval(() => {
      setActiveIndex((current) => (current + 1) % slideCount);
    }, rotationInterval);

    return () => window.clearInterval(timer);
  }, [slideCount, rotationInterval]);

  if (slideCount === 0) {
    return (
      <section className="flex min-h-[420px] items-center justify-center bg-base-100 px-6 py-24 text-center mb-[calc(var(--section-padding-y)*1.5)] md:mb-[var(--section-padding-y-xl)]">
        <div className="mx-auto max-w-3xl space-y-6">
          <HeadingTag className={headingClass}>{überschrift}</HeadingTag>
          {einleitung ? <p className="text-lg text-base-content/80">{einleitung}</p> : null}
        </div>
      </section>
    );
  }

  return (
    <section className="relative isolate flex min-h-[600px] items-center justify-center overflow-hidden mb-[calc(var(--section-padding-y)*1.5)] md:mb-[var(--section-padding-y-xl)]">
      {validSlides.map((slide, index) => (
        <Image
          key={`${slide.src}-${index}`}
          src={slide.src}
          alt={slide.alt}
          fill
          priority={index === 0}
          loading="eager"
          sizes="100vw"
          className="absolute inset-0 -z-30 object-cover opacity-0 transition-opacity duration-[1600ms] ease-in-out"
          style={{ opacity: index === activeIndex ? 1 : 0 }}
        />
      ))}

      <div className="relative z-10 mx-auto flex w-full max-w-[var(--landing-content-max-width)] flex-col items-center gap-6 px-6 py-24 text-center md:py-32">
        <HeadingTag className={`heading-on-dark ${headingClass}`}>
          {überschrift}
        </HeadingTag>
        {paragraphs.length > 0 ? (
          <p className="text-lg leading-relaxed text-base-100/90 drop-shadow-[0_2px_12px_rgba(0,0,0,0.4)] md:text-xl">
            {paragraphs.map((paragraph, index) => (
              <span key={index} className="block">
                {paragraph}
              </span>
            ))}
          </p>
        ) : null}
      </div>
    </section>
  );
}
