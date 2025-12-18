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
  button?: {
    name: string;
    link: string;
    stil?: "primary" | "secondary" | "ghost" | string | null;
    linkExtern?: boolean | null;
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

const clampInterval = (value: number | undefined, fallback: number): number => {
  if (!value || Number.isNaN(value)) {
    return fallback;
  }
  return Math.min(Math.max(value, 2000), 60000);
};

const resolveLinkProps = (href: string) => {
  const isExternal = /^https?:\/\//i.test(href);
  if (isExternal) {
    return { href, rel: "noopener noreferrer", target: "_blank" };
  }
  return { href };
};

const resolveButtonClasses = (stil?: string | null) => {
  switch (stil) {
    case "secondary":
      return "inline-flex min-w-[180px] items-center justify-center gap-2 rounded-full border border-white/70 bg-white/10 px-6 py-3 text-base font-semibold text-white transition hover:border-white hover:bg-white/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white md:px-8 md:py-3.5";
    case "ghost":
      return "inline-flex min-w-[180px] items-center justify-center gap-2 rounded-full px-6 py-3 text-base font-semibold text-white transition hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white md:px-8 md:py-3.5";
    default:
      return "inline-flex min-w-[180px] items-center justify-center gap-2 rounded-full border border-white/75 px-6 py-3 text-base font-semibold text-white transition hover:border-white hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white md:px-8 md:py-3.5";
  }
};

export function HeroCarousel({ überschrift, überschriftStufe, einleitung, bilder, rotationSekunden, button }: HeroCarouselProps) {
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
      <section className="flex min-h-[420px] items-center justify-center bg-base-100 px-6 py-[var(--space-section)] text-center mb-[var(--space-section-lg)] md:px-8 md:py-[var(--space-section-lg)]">
        <div className="mx-auto max-w-3xl space-y-[var(--space-block)]">
          <HeadingTag className={headingClass}>{überschrift}</HeadingTag>
          {einleitung ? <p className="text-lg text-base-content/80">{einleitung}</p> : null}
        </div>
      </section>
    );
  }

  return (
    <section className="relative isolate flex min-h-[600px] items-center justify-center overflow-hidden mb-[var(--space-section-lg)]">
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

      <div className="relative z-10 mx-auto flex w-full max-w-[var(--landing-content-max-width)] flex-col items-center gap-[var(--space-block)] px-6 py-[var(--space-section)] text-center md:px-8 md:py-[var(--space-section-lg)]">
        <HeadingTag className={`heading-on-dark ${headingClass}`}>{überschrift}</HeadingTag>
        {paragraphs.length > 0 ? (
          <div className="flex flex-col gap-[var(--space-compact)] text-lg leading-relaxed text-base-100/90 drop-shadow-[0_2px_12px_rgba(0,0,0,0.4)] md:text-xl">
            {paragraphs.map((paragraph, index) => (
              <span key={index} className="block">
                {paragraph}
              </span>
            ))}
          </div>
        ) : null}
        {button && button.name && button.link ? (
          <a className={resolveButtonClasses(button.stil)} {...resolveLinkProps(button.link)}>
            {button.name}
          </a>
        ) : null}
      </div>
    </section>
  );
}
