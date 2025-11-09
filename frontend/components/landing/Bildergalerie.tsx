"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";

type Bild = {
  src: string;
  alt: string;
};

type BildergalerieProps = {
  bilder: Bild[];
  rotationSekunden?: number;
  breite?: "full" | "content";
};

const clampInterval = (value: number | undefined, fallback: number): number => {
  if (!value || Number.isNaN(value)) {
    return fallback;
  }
  return Math.min(Math.max(value, 2000), 60000);
};

export function Bildergalerie({ bilder, rotationSekunden, breite = "full" }: BildergalerieProps) {
  const validSlides = useMemo(
    () => bilder.filter((slide) => typeof slide.src === "string" && slide.src.trim().length > 0),
    [bilder]
  );
  const slideCount = validSlides.length;
  const [activeIndex, setActiveIndex] = useState(0);
  const rotationInterval = clampInterval(rotationSekunden ? rotationSekunden * 1000 : undefined, 7000);
  const isContentWidth = breite === "content";

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
      <section className="mb-[calc(var(--section-padding-y)*1.5)] flex min-h-[400px] items-center justify-center bg-base-200 text-base-content/50 md:mb-[var(--section-padding-y-xl)]">
        <span className="text-sm uppercase tracking-[0.3em]">Bildergalerie</span>
      </section>
    );
  }

  const sectionClasses = [
    "relative isolate mb-[calc(var(--section-padding-y)*1.5)] overflow-hidden md:mb-[var(--section-padding-y-xl)]",
    isContentWidth ? "px-6" : "flex min-h-[550px] items-center justify-center"
  ].join(" ");

  const wrapperClasses = isContentWidth
    ? "mx-auto min-h-[420px] w-full max-w-5xl overflow-hidden rounded-3xl"
    : "h-full w-full min-h-[550px]";

  return (
    <section className={sectionClasses}>
      <div className={wrapperClasses}>
        <div className="relative isolate flex h-full w-full items-center justify-center">
          {validSlides.map((slide, index) => (
            <Image
              key={`${slide.src}-${index}`}
              src={slide.src}
              alt={slide.alt}
              fill
              sizes="100vw"
              priority={index === 0}
              className="absolute inset-0 -z-30 h-full w-full object-cover opacity-0 transition-opacity duration-[1400ms] ease-in-out"
              style={{ opacity: index === activeIndex ? 1 : 0 }}
            />
          ))}

          <div className="absolute inset-0 -z-20 bg-gradient-to-b from-black/40 via-black/35 to-black/60" aria-hidden="true" />

          <div className="absolute bottom-8 left-1/2 z-10 flex -translate-x-1/2 items-center gap-2">
            {validSlides.map((_, index) => (
              <span
                key={`dot-${index}`}
                className="h-2 w-2 rounded-full bg-base-100/40 transition-opacity"
                style={{ opacity: index === activeIndex ? 1 : 0.35 }}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
