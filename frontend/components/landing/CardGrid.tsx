"use client";

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
  link?: string | null;
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
};

const resolveLinkAttributes = (href: string) => {
  const isExternal = /^https?:\/\//i.test(href);
  if (isExternal) {
    return { href, rel: "noopener noreferrer", target: "_blank" };
  }
  return { href };
};

export function CardGrid({ karten, hintergrund }: CardGridProps) {
  if (karten.length === 0) {
    return null;
  }

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

  return (
    <section style={style}>
      <div
        className={`mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 py-[var(--section-padding-y-compact)] md:px-8 md:py-[var(--section-padding-y-lg)] md:gap-8 ${
          isDarkBackground ? "text-base-100" : ""
        }`}
      >
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {karten.map((card) => {
            const hasLink = card.link && card.link.trim().length > 0;
            const CardTag = hasLink ? "a" : "div";
            const cardProps = hasLink ? resolveLinkAttributes(card.link!.trim()) : {};
            const hasBackgroundImage = Boolean(card.backgroundImage);
            const cardClasses = [
              "group relative h-full overflow-hidden rounded-3xl border border-base-200 bg-base-100 shadow-sm transition hover:-translate-y-1 hover:border-primary/60 hover:shadow-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary",
              card.darkMode && !hasBackgroundImage ? "border-neutral-700 bg-neutral-900" : "",
              hasBackgroundImage ? "bg-transparent" : ""
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
            const hasDetails = Boolean(card.einleitung) || hasLink;

            return (
              <CardTag
                key={card.id}
                className={cardClasses}
                {...cardProps}
              >
                {hasBackgroundImage ? (
                  <>
                    <span
                      aria-hidden="true"
                      className="absolute inset-0 bg-cover bg-center transition duration-300 ease-out group-hover:scale-105"
                      style={{ backgroundImage: `url(${card.backgroundImage?.src})` }}
                    />
                    <span aria-hidden="true" className={`absolute inset-0 ${overlayTintClass}`} />
                  </>
                ) : null}
                <div
                  className={`relative flex min-h-[16rem] flex-col p-6 ${horizontalAlignClasses[card.textAlign]} ${verticalAlignClasses[card.verticalAlign]} ${textColorClass}`}
                  style={card.darkMode ? { textShadow: "0 2px 6px rgba(0, 0, 0, 0.45)" } : undefined}
                >
                  <h3 className={headlineClasses}>{card.überschrift}</h3>
                  {hasDetails ? (
                    <div className={detailContainerClasses}>
                      {card.einleitung ? <p className={introClasses}>{card.einleitung}</p> : null}
                      {hasLink ? <span className={ctaClasses}>Mehr erfahren →</span> : null}
                    </div>
                  ) : null}
                </div>
              </CardTag>
            );
          })}
        </div>
      </div>
    </section>
  );
}
