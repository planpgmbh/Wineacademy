import Link from "next/link";
import type {
  LandingCardGridSection,
  LandingHeroSection,
  LandingIconGridSection,
  LandingSection,
  LandingTextBlockSection,
} from "../../_lib/cms";

type HeroProps = {
  data: LandingHeroSection;
};

function HeroSection({ data }: HeroProps) {
  const paragraphs =
    typeof data.text === "string"
      ? data.text
          .split(/\n+/)
          .map((part) => part.trim())
          .filter(Boolean)
      : [];

  return (
    <section className="relative hero min-h-[60vh] overflow-hidden bg-base-200">
      {data.videoUrl ? (
        <video
          className="absolute inset-0 h-full w-full object-cover"
          src={data.videoUrl}
          poster={data.posterUrl ?? undefined}
          autoPlay
          muted
          loop
          playsInline
        />
      ) : null}
      <div className="absolute inset-0 bg-neutral/70" aria-hidden="true" />
      <div className="hero-content relative z-10 mx-auto max-w-4xl flex-col gap-6 text-center text-neutral-content lg:text-left">
        <div className="space-y-6">
          <h1 className="text-4xl font-bold sm:text-5xl lg:text-6xl">{data.titel}</h1>
          {paragraphs.length > 0 ? (
            <div className="space-y-3 text-lg font-light leading-relaxed">
              {paragraphs.map((line, index) => (
                <p key={index}>{line}</p>
              ))}
            </div>
          ) : null}
          {data.buttonLabel && data.buttonLink ? (
            <Link href={data.buttonLink} className="btn btn-primary btn-wide">
              {data.buttonLabel}
            </Link>
          ) : null}
        </div>
      </div>
    </section>
  );
}

type CardGridProps = {
  data: LandingCardGridSection;
};

function CardGridSection({ data }: CardGridProps) {
  const cards = Array.isArray(data.karten) ? data.karten.filter((card) => Boolean(card?.titel)) : [];
  if (cards.length === 0) {
    return null;
  }

  return (
    <section className="bg-base-100 py-16">
      <div className="mx-auto max-w-6xl space-y-8 px-4">
        {data.titel ? <h2 className="text-3xl font-semibold text-center md:text-left">{data.titel}</h2> : null}
        {data.beschreibung ? (
          <p className="mx-auto max-w-3xl text-center text-base-content/80 md:text-left">{data.beschreibung}</p>
        ) : null}
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {cards.map((card, index) => {
            const content = (
              <div className="card h-full border border-base-200 bg-base-200 transition duration-200 hover:border-primary hover:bg-base-100">
                <div className="card-body items-center text-center">
                  <h3 className="card-title text-xl font-semibold">{card.titel}</h3>
                  {card.untertitel ? <p className="text-base-content/70">{card.untertitel}</p> : null}
                </div>
              </div>
            );

            if (card.link) {
              return (
                <Link key={index} href={card.link} className="group block h-full no-underline">
                  {content}
                </Link>
              );
            }

            return (
              <div key={index} className="h-full">
                {content}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

type TextBlockProps = {
  data: LandingTextBlockSection;
};

function TextBlockSection({ data }: TextBlockProps) {
  return (
    <section className="bg-base-100 py-16">
      <div className="mx-auto max-w-4xl space-y-8 px-4 text-center md:text-left">
        <h2 className="text-3xl font-semibold md:text-4xl">{data.titel}</h2>
        {data.text ? (
          <div
            className="space-y-4 text-lg leading-relaxed text-base-content/90"
            dangerouslySetInnerHTML={{ __html: data.text }}
          />
        ) : null}
        {data.buttonLabel && data.buttonLink ? (
          <div>
            <Link href={data.buttonLink} className="btn btn-outline">
              {data.buttonLabel}
            </Link>
          </div>
        ) : null}
      </div>
    </section>
  );
}

type IconGridProps = {
  data: LandingIconGridSection;
};

const ICON_EMOJI: Record<string, string> = {
  "wine-glass": "🍷",
  globe: "🌍",
  certificate: "📜",
  fingerprint: "🖐️",
  award: "🏆",
  book: "📚",
  calendar: "📅",
  sparkles: "✨",
  users: "👥",
};

function IconGridSection({ data }: IconGridProps) {
  const items = Array.isArray(data.items) ? data.items.filter((item) => Boolean(item?.titel)) : [];
  if (items.length === 0) {
    return null;
  }

  return (
    <section className="bg-primary text-primary-content py-16">
      <div className="mx-auto max-w-6xl space-y-10 px-4 text-center">
        {data.titel ? <h2 className="text-3xl font-semibold md:text-4xl">{data.titel}</h2> : null}
        {data.beschreibung ? <p className="mx-auto max-w-3xl text-lg opacity-90">{data.beschreibung}</p> : null}
        <div className="grid gap-6 md:grid-cols-3">
          {items.map((item, index) => {
            const emoji = ICON_EMOJI[item.icon] ?? "⭐";
            return (
              <div key={index} className="card bg-primary-content/10">
                <div className="card-body items-center space-y-4 text-center">
                  <span className="text-4xl" aria-hidden="true">
                    {emoji}
                  </span>
                  <h3 className="card-title text-2xl font-semibold">{item.titel}</h3>
                  {item.text ? <p className="text-primary-content/80">{item.text}</p> : null}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

type RendererProps = {
  sections: LandingSection[];
};

export function LandingPageRenderer({ sections }: RendererProps) {
  if (!Array.isArray(sections) || sections.length === 0) {
    return (
      <div className="mx-auto w-full max-w-4xl px-4 py-24 text-center">
        <div className="alert alert-info">
          <span>Für diese Seite sind derzeit keine Inhalte hinterlegt.</span>
        </div>
      </div>
    );
  }

  return (
    <>
      {sections.map((section, index) => {
        switch (section.__component) {
          case "landing.hero":
            return <HeroSection key={`hero-${index}`} data={section} />;
          case "landing.card-grid":
            return <CardGridSection key={`card-grid-${index}`} data={section} />;
          case "landing.text-block":
            return <TextBlockSection key={`text-block-${index}`} data={section} />;
          case "landing.icon-grid":
            return <IconGridSection key={`icon-grid-${index}`} data={section} />;
          default:
            return null;
        }
      })}
    </>
  );
}
