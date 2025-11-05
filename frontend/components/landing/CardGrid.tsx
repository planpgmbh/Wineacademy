"use client";

import {
  resolveSectionBackground,
  SECTION_BACKGROUND_CSS_VAR,
  isDarkSectionBackground,
  type SectionBackgroundKey
} from "@/lib/landing";

type Card = {
  id: number;
  headline: string;
  intro?: string | null;
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
  cards: Card[];
  background?: SectionBackgroundKey | null;
};

const resolveLinkAttributes = (href: string) => {
  const isExternal = /^https?:\/\//i.test(href);
  if (isExternal) {
    return { href, rel: "noopener noreferrer", target: "_blank" };
  }
  return { href };
};

export function CardGrid({ cards, background }: CardGridProps) {
  if (cards.length === 0) {
    return null;
  }

  const horizontalAlignClasses: Record<Card["textAlign"], string> = {
    left: "items-start text-left",
    center: "items-center text-center",
    right: "items-end text-right"
  };

  const verticalAlignClasses: Record<Card["verticalAlign"], string> = {
    top: "justify-start",
    center: "justify-center",
    bottom: "justify-end"
  };

  const resolvedBackground = resolveSectionBackground(background);
  const style = { backgroundColor: `var(${SECTION_BACKGROUND_CSS_VAR[resolvedBackground]})` };
  const isDarkBackground = isDarkSectionBackground(resolvedBackground);

  return (
    <section style={style}>
      <div
        className={`mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 py-[var(--section-padding-y-compact)] md:px-8 md:py-[var(--section-padding-y-lg)] md:gap-8 ${
          isDarkBackground ? "text-base-100" : ""
        }`}
      >
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {cards.map((card) => {
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
            const overlayTintClass = card.darkMode ? "bg-neutral-900/70" : "bg-base-100/80";

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
                  className={`relative flex min-h-[14rem] flex-col gap-3 p-6 ${horizontalAlignClasses[card.textAlign]} ${verticalAlignClasses[card.verticalAlign]} ${textColorClass}`}
                >
                  <h3 className="heading-ui">{card.headline}</h3>
                  {card.intro ? <p className={`text-base ${introColorClass}`}>{card.intro}</p> : null}
                  {hasLink ? <span className={`text-sm font-semibold ${ctaColorClass}`}>Mehr erfahren →</span> : null}
                </div>
              </CardTag>
            );
          })}
        </div>
      </div>
    </section>
  );
}
