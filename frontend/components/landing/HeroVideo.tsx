"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { JSX } from "react";

type HeroVideoProps = {
  überschrift: string;
  überschriftStufe: "h1" | "h2" | "h3" | "h4";
  einleitung?: string | null;
  videoUrl?: string | null;
  posterUrl?: string | null;
  button?: {
    name: string;
    link: string;
    stil?: "primary" | "secondary" | "ghost" | string | null;
    linkExtern?: boolean | null;
  } | null;
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

const DESKTOP_MIN_WIDTH = 1024;

export function HeroVideo({ überschrift, überschriftStufe, einleitung, videoUrl, posterUrl, button }: HeroVideoProps) {
  const [canPlayVideo, setCanPlayVideo] = useState(false);
  const paragraphs = useMemo(() => extractParagraphs(einleitung), [einleitung]);
  const showButton = Boolean(button && button.name && button.link);
  const HeadingTag = headingTags[überschriftStufe];
  const headingClass = headingStyles[überschriftStufe];

  useEffect(() => {
    if (!videoUrl) {
      setCanPlayVideo(false);
      return;
    }

    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updatePlaybackIntent = () => {
      const viewportWideEnough = window.innerWidth >= DESKTOP_MIN_WIDTH;
      setCanPlayVideo(viewportWideEnough && !mediaQuery.matches);
    };

    updatePlaybackIntent();

    window.addEventListener("resize", updatePlaybackIntent);
    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", updatePlaybackIntent);
    } else if (typeof mediaQuery.addListener === "function") {
      mediaQuery.addListener(updatePlaybackIntent);
    }

    return () => {
      window.removeEventListener("resize", updatePlaybackIntent);
      if (typeof mediaQuery.removeEventListener === "function") {
        mediaQuery.removeEventListener("change", updatePlaybackIntent);
      } else if (typeof mediaQuery.removeListener === "function") {
        mediaQuery.removeListener(updatePlaybackIntent);
      }
    };
  }, [videoUrl]);

  const shouldRenderVideo = canPlayVideo && Boolean(videoUrl);
  const hasPosterImage = typeof posterUrl === "string" && posterUrl.trim().length > 0;

  return (
    <section className="relative isolate flex min-h-[620px] items-center justify-center overflow-hidden bg-base-200 mb-[var(--space-section-lg)]">
      {shouldRenderVideo ? (
        <video
          className="absolute inset-0 -z-20 h-full w-full object-cover"
          src={videoUrl ?? undefined}
          poster={posterUrl ?? undefined}
          preload="metadata"
          autoPlay
          muted
          loop
          playsInline
        />
      ) : hasPosterImage ? (
        <Image
          src={posterUrl}
          alt=""
          fill
          priority
          sizes="100vw"
          className="absolute inset-0 -z-20 h-full w-full object-cover"
          aria-hidden="true"
        />
      ) : (
        <div className="absolute inset-0 -z-20 bg-gradient-to-br from-primary/40 via-primary/20 to-primary/50" />
      )}

      <div className="absolute inset-0 -z-10 bg-gradient-to-b from-black/60 via-black/40 to-black/70" aria-hidden="true" />

      <div className="relative z-10 mx-auto flex w-full max-w-[var(--landing-content-max-width)] flex-col items-center gap-[var(--space-block)] px-6 py-[var(--space-section)] text-center md:gap-[var(--space-section)] md:px-8 md:py-[var(--space-section-lg)]">
        <HeadingTag className={`heading-on-dark ${headingClass} mb-0`}>
          {überschrift}
        </HeadingTag>
        {paragraphs.length > 0 ? (
          <div className="flex max-w-2xl flex-col gap-[var(--space-compact)] text-lg leading-relaxed text-base-100/90 md:text-xl">
            {paragraphs.map((paragraph, index) => (
              <span key={index} className="block">
                {paragraph}
              </span>
            ))}
          </div>
        ) : null}

        {showButton ? (
          <Link
            className={resolveButtonClasses(button?.stil)}
            {...resolveLinkProps(button!.link!)}
          >
            {button?.name ?? "Mehr"}
          </Link>
        ) : null}
      </div>
    </section>
  );
}
