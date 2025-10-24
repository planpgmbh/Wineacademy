"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";

type Slide = {
  src: string;
  alt: string;
};

type HeroCarouselProps = {
  title: string;
  intro?: string | null;
  slides: Slide[];
  rotationIntervalMs?: number;
};

const clampInterval = (value: number | undefined, fallback: number): number => {
  if (!value || Number.isNaN(value)) {
    return fallback;
  }
  return Math.min(Math.max(value, 2000), 60000);
};

export function HeroCarousel({ title, intro, slides, rotationIntervalMs }: HeroCarouselProps) {
  const validSlides = useMemo(
    () => slides.filter((slide) => typeof slide.src === "string" && slide.src.trim().length > 0),
    [slides]
  );
  const slideCount = validSlides.length;
  const [activeIndex, setActiveIndex] = useState(0);
  const paragraphs = useMemo(
    () =>
      intro
        ? intro
            .split(/\n+/)
            .map((paragraph) => paragraph.trim())
            .filter((paragraph) => paragraph.length > 0)
        : [],
    [intro]
  );
  const rotationInterval = clampInterval(rotationIntervalMs, 8000);

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
      <section className="flex min-h-[420px] items-center justify-center bg-base-100 px-6 py-24 text-center">
        <div className="mx-auto max-w-3xl space-y-6">
          <h1>{title}</h1>
          {intro ? <p className="text-lg text-base-content/80">{intro}</p> : null}
        </div>
      </section>
    );
  }

  return (
    <section className="relative isolate flex min-h-[600px] items-center justify-center overflow-hidden">
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

      <div className="relative z-10 mx-auto flex w-full max-w-4xl flex-col items-center gap-6 px-6 py-24 text-center md:py-32">
        <h1 className="text-4xl font-semibold tracking-tight text-base-100 drop-shadow-[0_4px_16px_rgba(0,0,0,0.45)] sm:text-5xl md:text-6xl">
          {title}
        </h1>
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
