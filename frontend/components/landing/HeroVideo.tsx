"use client";

import Link from "next/link";
import { useMemo } from "react";
import type { JSX } from "react";

type HeroVideoProps = {
  headline: string;
  headlineLevel: "h1" | "h2" | "h3" | "h4";
  intro?: string | null;
  videoUrl?: string | null;
  posterUrl?: string | null;
  buttonLabel?: string | null;
  buttonLink?: string | null;
};

const extractParagraphs = (text?: string | null): string[] => {
  if (!text) return [];
  return text
    .split(/\n+/)
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
};

const resolveLinkProps = (href: string) => {
  const isExternal = /^https?:\/\//i.test(href);
  if (isExternal) {
    return { href, rel: "noopener noreferrer", target: "_blank" };
  }
  return { href };
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

export function HeroVideo({ headline, headlineLevel, intro, videoUrl, posterUrl, buttonLabel, buttonLink }: HeroVideoProps) {
  const paragraphs = useMemo(() => extractParagraphs(intro), [intro]);
  const showButton = buttonLabel && buttonLabel.trim().length > 0 && buttonLink && buttonLink.trim().length > 0;
  const HeadingTag = headingTags[headlineLevel];
  const headingClass = headingStyles[headlineLevel];

  return (
    <section className="relative isolate flex min-h-[620px] items-center justify-center overflow-hidden bg-base-200">
      {videoUrl ? (
        <video
          className="absolute inset-0 -z-20 h-full w-full object-cover"
          src={videoUrl}
          poster={posterUrl ?? undefined}
          autoPlay
          muted
          loop
          playsInline
        />
      ) : (
        <div className="absolute inset-0 -z-20 bg-gradient-to-br from-primary/40 via-primary/20 to-primary/50" />
      )}

      <div className="absolute inset-0 -z-10 bg-gradient-to-b from-black/60 via-black/40 to-black/70" aria-hidden="true" />

      <div className="relative z-10 mx-auto flex w-full max-w-5xl flex-col items-center gap-6 px-6 py-24 text-center md:gap-8 md:py-32">
        <HeadingTag className={`heading-on-dark ${headingClass}`}>
          {headline}
        </HeadingTag>
        {paragraphs.length > 0 ? (
          <p className="max-w-2xl text-lg leading-relaxed text-base-100/90 md:text-xl">
            {paragraphs.map((paragraph, index) => (
              <span key={index} className="block">
                {paragraph}
              </span>
            ))}
          </p>
        ) : null}

        {showButton ? (
          <Link
            className="btn btn-primary btn-wide md:btn-lg"
            {...resolveLinkProps(buttonLink.trim())}
          >
            {buttonLabel.trim()}
          </Link>
        ) : null}
      </div>
    </section>
  );
}
