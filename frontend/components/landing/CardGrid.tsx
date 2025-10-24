"use client";

type Card = {
  id: number;
  title: string;
  subtitle?: string | null;
  link?: string | null;
};

type CardGridProps = {
  title?: string | null;
  description?: string | null;
  cards: Card[];
};

const resolveLinkAttributes = (href: string) => {
  const isExternal = /^https?:\/\//i.test(href);
  if (isExternal) {
    return { href, rel: "noopener noreferrer", target: "_blank" };
  }
  return { href };
};

export function CardGrid({ title, description, cards }: CardGridProps) {
  if (cards.length === 0) {
    return null;
  }

  return (
    <section className="bg-base-100">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-6 py-16 md:px-8 md:py-20">
        {title ? (
          <h2
            className="text-3xl font-semibold tracking-tight text-base-content md:text-4xl"
            style={{ fontFamily: "var(--font-serifbabe), ui-serif, Georgia, serif" }}
          >
            {title}
          </h2>
        ) : null}
        {description ? <p className="max-w-3xl text-lg text-base-content/75">{description}</p> : null}
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
                <h3 className="text-xl font-semibold text-base-content">{card.title}</h3>
                {card.subtitle ? <p className="text-base text-base-content/70">{card.subtitle}</p> : null}
                {hasLink ? <span className="text-sm font-semibold text-primary">Mehr erfahren →</span> : null}
              </CardTag>
            );
          })}
        </div>
      </div>
    </section>
  );
}
