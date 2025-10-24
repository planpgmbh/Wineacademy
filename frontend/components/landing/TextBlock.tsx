"use client";

type TextBlockProps = {
  title: string;
  html?: string | null;
  buttonLabel?: string | null;
  buttonLink?: string | null;
};

const resolveLinkAttributes = (href: string) => {
  const isExternal = /^https?:\/\//i.test(href);
  if (isExternal) {
    return { href, rel: "noopener noreferrer", target: "_blank" };
  }
  return { href };
};

export function TextBlock({ title, html, buttonLabel, buttonLink }: TextBlockProps) {
  const showButton = buttonLabel && buttonLabel.trim().length > 0 && buttonLink && buttonLink.trim().length > 0;

  return (
    <section className="bg-base-200">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-6 py-20 text-base-content md:px-8 md:py-24">
        <h2
          className="text-3xl font-semibold tracking-tight md:text-4xl"
          style={{ fontFamily: "var(--font-serifbabe), ui-serif, Georgia, serif" }}
        >
          {title}
        </h2>
        {html ? (
          <div
            className="prose prose-lg max-w-none text-base-content/80 prose-headings:text-base-content"
            dangerouslySetInnerHTML={{ __html: html }}
          />
        ) : null}
        {showButton ? (
          <div>
            <a className="btn btn-outline btn-primary" {...resolveLinkAttributes(buttonLink.trim())}>
              {buttonLabel.trim()}
            </a>
          </div>
        ) : null}
      </div>
    </section>
  );
}
