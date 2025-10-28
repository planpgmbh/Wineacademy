"use client";

import { resolveSectionBackground, SECTION_BACKGROUND_CSS_VAR, type SectionBackgroundKey } from "@/lib/landing";

type Card = {
  id: number;
  headline: string;
  intro?: string | null;
  link?: string | null;
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

  const resolvedBackground = resolveSectionBackground(background);
  const style = { backgroundColor: `var(${SECTION_BACKGROUND_CSS_VAR[resolvedBackground]})` };

  return (
    <section style={style}>
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-6 py-16 md:px-8 md:py-20">
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {cards.map((card) => {
            const hasLink = card.link && card.link.trim().length > 0;
            const CardTag = hasLink ? "a" : "div";
            const cardProps = hasLink ? resolveLinkAttributes(card.link!.trim()) : {};

            return (
              <CardTag
                key={card.id}
                className="group flex flex-col gap-3 rounded-3xl border border-base-200 bg-base-100 p-6 shadow-sm transition hover:-translate-y-1 hover:border-primary/60 hover:shadow-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary"
                {...cardProps}
              >
                <h3 className="text-xl font-semibold text-base-content">{card.headline}</h3>
                {card.intro ? <p className="text-base text-base-content/70">{card.intro}</p> : null}
                {hasLink ? <span className="text-sm font-semibold text-primary">Mehr erfahren →</span> : null}
              </CardTag>
            );
          })}
        </div>
      </div>
    </section>
  );
}
