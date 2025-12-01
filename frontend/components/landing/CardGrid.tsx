"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import {
  resolveSectionBackground,
  SECTION_BACKGROUND_CSS_VAR,
  isDarkSectionBackground,
  type SectionBackgroundKey
} from "@/lib/landing";

type Karte = {
  id: number;
  überschrift: string;
  einleitung?: string | null;
  button?: {
    name: string;
    link: string;
    linkExtern?: boolean | null;
  } | null;
  seminarFinderCategorySlug?: string | null;
  textAlign: "left" | "center" | "right";
  verticalAlign: "top" | "center" | "bottom";
  backgroundImage?: {
    src: string;
    alt: string;
  } | null;
  darkMode: boolean;
};

type CardGridProps = {
  karten: Karte[];
  hintergrund?: SectionBackgroundKey | null;
  id?: string;
};

const resolveLinkAttributes = (href: string) => {
  const isExternal = /^https?:\/\//i.test(href);
  if (isExternal) {
    return { href, rel: "noopener noreferrer", target: "_blank" };
  }
  return { href };
};

export function CardGrid({ karten, hintergrund, id }: CardGridProps) {
  const horizontalAlignClasses: Record<Karte["textAlign"], string> = {
    left: "items-start text-left",
    center: "items-center text-center",
    right: "items-end text-right"
  };

  const verticalAlignClasses: Record<Karte["verticalAlign"], string> = {
    top: "justify-start",
    center: "justify-center",
    bottom: "justify-end"
  };

  const resolvedBackground = resolveSectionBackground(hintergrund);
  const style = { backgroundColor: `var(${SECTION_BACKGROUND_CSS_VAR[resolvedBackground]})` };
  const isDarkBackground = isDarkSectionBackground(resolvedBackground);
  const headingHoverShift: Record<Karte["verticalAlign"], string> = {
    top: "md:group-hover:-translate-y-1",
    center: "md:group-hover:-translate-y-3",
    bottom: "md:group-hover:-translate-y-5"
  };
  const cardCount = karten.length;
  const desktopGridColumns =
    cardCount <= 1
      ? "md:grid-cols-1"
      : cardCount === 2
        ? "md:grid-cols-2"
        : "md:grid-cols-2 lg:grid-cols-3";
  const cardListClass = [
    "flex snap-x snap-mandatory gap-4 overflow-x-auto pb-3 [-webkit-overflow-scrolling:touch] no-scrollbar",
    "md:grid md:snap-none md:overflow-visible md:gap-6",
    desktopGridColumns
  ]
    .filter(Boolean)
    .join(" ");
  const listRef = useRef<HTMLDivElement | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    const container = listRef.current;
    if (!container) {
      return;
    }
    const handleScroll = () => {
      const children = Array.from(container.children) as HTMLElement[];
      if (children.length === 0) {
        return;
      }
      const { scrollLeft, offsetWidth } = container;
      const index = Math.round((scrollLeft / offsetWidth) * 1);
      const clampIndex = Math.min(children.length - 1, Math.max(0, index));
      setActiveIndex(clampIndex);
    };
    container.addEventListener("scroll", handleScroll, { passive: true });
    return () => container.removeEventListener("scroll", handleScroll);
  }, []);

  if (karten.length === 0) {
    return null;
  }

  return (
    <section style={style} id={id}>
      <div
        className={`mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 py-[var(--section-padding-y-compact)] md:px-8 md:py-[var(--section-padding-y-lg)] md:gap-8 ${
          isDarkBackground ? "text-base-100" : ""
        }`}
      >
        <div ref={listRef} className={cardListClass}>
          {karten.map((card) => {
            const hasButtonLink = Boolean(card.button?.link && card.button.link.trim().length > 0);
            const hasSeminarFinderTarget = Boolean(card.seminarFinderCategorySlug);
            const href =
              (hasButtonLink ? card.button!.link!.trim() : null) ??
              (hasSeminarFinderTarget ? "#seminar-finder" : null);
            const isAnchorLink = href?.startsWith("#");
            const hasAction = Boolean(href) || hasSeminarFinderTarget;
            const hasCta = hasButtonLink || hasSeminarFinderTarget;
            const CardTag = hasAction ? "a" : "div";
            const cardProps = href ? resolveLinkAttributes(href) : {};
            const hasBackgroundImage = Boolean(card.backgroundImage);
            const cardClasses = [
              "group relative flex h-full w-full flex-none snap-center overflow-hidden rounded-3xl border border-base-200 bg-base-100 shadow-sm transition hover:-translate-y-1 hover:border-primary/60 hover:shadow-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary md:flex-auto",
              card.darkMode && !hasBackgroundImage ? "border-neutral-700 bg-neutral-900" : "",
              hasBackgroundImage ? "bg-transparent" : "",
              hasAction ? "cursor-pointer" : ""
            ]
              .filter(Boolean)
              .join(" ");
            const textColorClass = card.darkMode ? "text-base-100" : "text-base-content";
            const introColorClass = card.darkMode ? "text-base-100/80" : "text-base-content/70";
            const ctaColorClass = card.darkMode ? "text-base-100" : "text-primary";
            const overlayTintClass = card.darkMode ? "bg-neutral-900/30" : "bg-base-100/80";
            const headlineClasses = [
              "heading-card-grid transform-gpu transition-all duration-300 ease-out",
              "md:translate-y-0",
              headingHoverShift[card.verticalAlign],
              card.darkMode ? "text-base-100" : ""
            ]
              .filter(Boolean)
              .join(" ");
            const detailContainerClasses = [
              "mt-3 flex w-full flex-col gap-2 text-inherit",
              "md:mt-0 md:max-h-0 md:translate-y-4 md:opacity-0 md:overflow-hidden md:pointer-events-none md:transition-all md:duration-300 md:ease-out",
              "md:group-hover:mt-3 md:group-hover:max-h-96 md:group-hover:translate-y-0 md:group-hover:opacity-100 md:group-hover:pointer-events-auto"
            ]
              .filter(Boolean)
              .join(" ");
            const introClasses = [
              `text-base ${introColorClass}`,
              "md:opacity-0 md:translate-y-2 md:transition md:duration-300 md:ease-out",
              "md:group-hover:opacity-100 md:group-hover:translate-y-0"
            ]
              .filter(Boolean)
              .join(" ");
            const ctaClasses = [
              `text-sm font-semibold ${ctaColorClass}`,
              "md:opacity-0 md:translate-y-2 md:transition md:duration-300 md:ease-out",
              "md:group-hover:opacity-100 md:group-hover:translate-y-0"
            ]
              .filter(Boolean)
              .join(" ");
            const hasDetails = Boolean(card.einleitung) || hasCta;

            const handleCardClick = (event: React.MouseEvent) => {
              if (!hasAction) {
                return;
              }
              // Für externe oder normale Links nichts abfangen
              if (href && !isAnchorLink) {
                return;
              }
              event.preventDefault();
              if (isAnchorLink && href) {
                const targetId = href.replace(/^#/, "");
                const el = document.getElementById(targetId);
                if (el) {
                  el.scrollIntoView({ behavior: "smooth", block: "start" });
                }
              }
              if (card.seminarFinderCategorySlug) {
                window.dispatchEvent(
                  new CustomEvent("seminar-finder:set-category", {
                    detail: { slug: card.seminarFinderCategorySlug }
                  })
                );
              }
            };

            return (
              <CardTag
                key={card.id}
                className={cardClasses}
                onClick={handleCardClick}
                {...cardProps}
              >
                {hasBackgroundImage ? (
                  <>
                    <Image
                      src={card.backgroundImage!.src}
                      alt=""
                      fill
                      sizes="(min-width: 1024px) 33vw, (min-width: 768px) 50vw, 100vw"
                      className="absolute inset-0 z-0 object-cover transition duration-300 ease-out group-hover:scale-105"
                      loading="lazy"
                      aria-hidden="true"
                    />
                    <span aria-hidden="true" className={`absolute inset-0 z-10 ${overlayTintClass}`} />
                  </>
                ) : null}
                <div
                  className={`relative z-20 flex min-h-[16rem] flex-col p-6 ${horizontalAlignClasses[card.textAlign]} ${verticalAlignClasses[card.verticalAlign]} ${textColorClass}`}
                  style={card.darkMode ? { textShadow: "0 2px 6px rgba(0, 0, 0, 0.45)" } : undefined}
                >
                  <h3 className={headlineClasses}>{card.überschrift}</h3>
                  {hasDetails ? (
                    <div className={detailContainerClasses}>
                      {card.einleitung ? <p className={introClasses}>{card.einleitung}</p> : null}
                      {hasCta ? (
                        <span className={ctaClasses}>{card.button?.name?.trim() || "Mehr erfahren"} →</span>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </CardTag>
            );
          })}
        </div>
        {cardCount > 1 ? (
          <div className="flex justify-center gap-2 md:hidden">
            {karten.map((card, index) => (
              <span
                key={card.id}
                className={`h-2 w-2 rounded-full transition ${index === activeIndex ? "bg-primary" : "bg-base-content/30"}`}
              />
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}
