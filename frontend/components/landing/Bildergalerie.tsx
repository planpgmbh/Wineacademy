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

  const minHeight = isContentWidth ? 420 : 550;
  const sectionClasses = [
    "relative isolate mb-[calc(var(--section-padding-y)*1.5)] overflow-hidden md:mb-[var(--section-padding-y-xl)]",
    isContentWidth ? "" : "flex items-center justify-center"
  ]
    .filter(Boolean)
    .join(" ");

  const wrapperClasses = [
    isContentWidth ? "mx-auto w-full max-w-[var(--landing-content-max-width)] px-6 md:px-8" : "w-full",
    "relative isolate flex items-center justify-center"
  ].join(" ");

  const innerClasses = [
    "relative isolate flex h-full w-full items-center justify-center",
    isContentWidth ? "overflow-hidden rounded-3xl" : ""
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <section className={sectionClasses}>
      <div className={wrapperClasses}>
        <div className={innerClasses} style={{ height: `${minHeight}px`, minHeight: `${minHeight}px` }}>
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
