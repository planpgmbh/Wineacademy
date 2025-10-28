"use client";

import type { JSX, ReactElement } from "react";

import { resolveSectionBackground, SECTION_BACKGROUND_CSS_VAR, type SectionBackgroundKey } from "@/lib/landing";

type IconName =
  | "award"
  | "book"
  | "calendar"
  | "certificate"
  | "fingerprint"
  | "globe"
  | "sparkles"
  | "users"
  | "wine-glass";

type IconGridItem = {
  id: number;
  icon: string;
  headline: string;
  intro?: string | null;
};

type IconGridProps = {
  headline?: string | null;
  headlineLevel: "h2" | "h3" | "h4";
  intro?: string | null;
  background?: SectionBackgroundKey | null;
  items: IconGridItem[];
};

const ICON_COMPONENTS: Record<IconName, ReactElement> = {
  award: (
    <>
      <circle cx="18" cy="12" r="5" stroke="currentColor" strokeWidth="1.5" fill="none" />
      <path d="M18 7v-3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M15 3.5h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M16.5 16.5l-1.5 4.5l3-1.5l3 1.5l-1.5-4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M6 4l2.5 7l1.5-4L14 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </>
  ),
  book: (
    <>
      <path
        d="M5 5.5v12.5a1 1 0 0 0 1 1h5V4H6a1 1 0 0 0-1 1.5Z"
        stroke="currentColor"
        strokeWidth="1.5"
        fill="none"
        strokeLinejoin="round"
      />
      <path
        d="M19 5.5v12.5a1 1 0 0 1-1 1h-5V4h5a1 1 0 0 1 1 1.5Z"
        stroke="currentColor"
        strokeWidth="1.5"
        fill="none"
        strokeLinejoin="round"
      />
      <path d="M6 4h5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M18 4h-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </>
  ),
  calendar: (
    <>
      <rect x="4" y="6" width="16" height="14" rx="2" stroke="currentColor" strokeWidth="1.5" fill="none" />
      <path d="M8 4v4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M16 4v4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M4 11h16" stroke="currentColor" strokeWidth="1.5" />
      <path d="M9 15h2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M13 15h2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </>
  ),
  certificate: (
    <>
      <circle cx="12" cy="9" r="5" stroke="currentColor" strokeWidth="1.5" fill="none" />
      <path
        d="M9.5 13.5l-1 7l3.5-2l3.5 2l-1-7"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </>
  ),
  fingerprint: (
    <>
      <path
        d="M18 9a6 6 0 0 0-12 0c0 4-1 6-2 7"
        stroke="currentColor"
        strokeWidth="1.5"
        fill="none"
        strokeLinecap="round"
      />
      <path
        d="M19 12c-.5 2.5-1.5 4-2.5 5.5"
        stroke="currentColor"
        strokeWidth="1.5"
        fill="none"
        strokeLinecap="round"
      />
      <path
        d="M12 7a2 2 0 0 0-2 2c0 3-1 5-2 6"
        stroke="currentColor"
        strokeWidth="1.5"
        fill="none"
        strokeLinecap="round"
      />
      <path
        d="M14 7a2 2 0 0 1 2 2c0 3-1 6-2.5 8.5"
        stroke="currentColor"
        strokeWidth="1.5"
        fill="none"
        strokeLinecap="round"
      />
      <path
        d="M12 11c0 2-1 4-2 5"
        stroke="currentColor"
        strokeWidth="1.5"
        fill="none"
        strokeLinecap="round"
      />
    </>
  ),
  globe: (
    <>
      <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.5" fill="none" />
      <path d="M4 12h16" stroke="currentColor" strokeWidth="1.5" />
      <path d="M12 4a14 14 0 0 1 0 16" stroke="currentColor" strokeWidth="1.5" fill="none" />
      <path d="M12 4a14 14 0 0 0 0 16" stroke="currentColor" strokeWidth="1.5" fill="none" />
    </>
  ),
  sparkles: (
    <>
      <path
        d="M12 5l1.2 3.6L17 9l-3 2.1L15.4 14 12 12l-3.4 2L9.9 11 7 9l3.8-.4L12 5Z"
        stroke="currentColor"
        strokeWidth="1.5"
        fill="none"
        strokeLinejoin="round"
      />
      <path d="M6 4l.5 1.5L8 6l-1.5.5L6 8l-.5-1.5L4 6l1.5-.5L6 4Z" fill="currentColor" />
      <path d="M18 16l.4 1.2 1.2.4-1.2.4-.4 1.2-.4-1.2-1.2-.4 1.2-.4.4-1.2Z" fill="currentColor" />
    </>
  ),
  users: (
    <>
      <circle cx="10" cy="10" r="3" stroke="currentColor" strokeWidth="1.5" fill="none" />
      <path
        d="M4 18c1-2.5 3-4 6-4s5 1.5 6 4"
        stroke="currentColor"
        strokeWidth="1.5"
        fill="none"
        strokeLinecap="round"
      />
      <path
        d="M17 10.5a2.5 2.5 0 1 1-5 0a2.5 2.5 0 0 1 5 0Z"
        stroke="currentColor"
        strokeWidth="1.5"
        fill="none"
      />
      <path
        d="M19.5 18c-.7-1.9-2-3.1-4-3.5"
        stroke="currentColor"
        strokeWidth="1.5"
        fill="none"
        strokeLinecap="round"
      />
    </>
  ),
  "wine-glass": (
    <>
      <path
        d="M8 3h8l-1 7a3 3 0 0 1-3 2.6A3 3 0 0 1 9 10L8 3Z"
        stroke="currentColor"
        strokeWidth="1.5"
        fill="none"
        strokeLinejoin="round"
      />
      <path d="M12 12v6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M9 21h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M8 6h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </>
  )
};

const renderIcon = (name: string) => {
  const key = (name as IconName) in ICON_COMPONENTS ? (name as IconName) : "sparkles";
  return (
    <svg
      viewBox="0 0 24 24"
      role="img"
      aria-hidden="true"
      className="h-12 w-12 text-primary"
    >
      {ICON_COMPONENTS[key]}
    </svg>
  );
};

const headingTags: Record<"h2" | "h3" | "h4", keyof JSX.IntrinsicElements> = {
  h2: "h2",
  h3: "h3",
  h4: "h4"
};

const headingClasses: Record<"h2" | "h3" | "h4", string> = {
  h2: "text-4xl font-light tracking-tight text-base-content md:text-5xl",
  h3: "text-3xl font-semibold tracking-tight text-base-content md:text-4xl",
  h4: "text-2xl font-semibold tracking-tight text-base-content md:text-3xl"
};

export function IconGrid({ headline, headlineLevel, intro, background, items }: IconGridProps) {
  if (items.length === 0) {
    return null;
  }

  const resolvedBackground = resolveSectionBackground(background ?? null);
  const style = { backgroundColor: `var(${SECTION_BACKGROUND_CSS_VAR[resolvedBackground]})` };
  const showHeadline = typeof headline === "string" && headline.trim().length > 0;
  const paragraphs =
    intro
      ?.split(/\n+/)
      .map((paragraph) => paragraph.trim())
      .filter((paragraph) => paragraph.length > 0) ?? [];

  const HeadingTag = headingTags[headlineLevel];
  const headingClass = headingClasses[headlineLevel];

  return (
    <section style={style}>
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-6 py-20 md:px-8 md:py-24">
        {showHeadline ? <HeadingTag className={headingClass}>{headline}</HeadingTag> : null}
        {paragraphs.length > 0 ? (
          <div className="max-w-3xl space-y-4 text-lg text-base-content/75">
            {paragraphs.map((paragraph, index) => (
              <p key={index}>{paragraph}</p>
            ))}
          </div>
        ) : null}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => (
            <article
              key={item.id}
              className="flex flex-col gap-4 rounded-3xl border border-base-200 bg-base-100 p-6 shadow-sm transition hover:border-primary/60 hover:shadow-md"
            >
              <span className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary">
                {renderIcon(item.icon)}
              </span>
              <h3 className="text-xl font-semibold text-base-content">{item.headline}</h3>
              {item.intro ? <p className="text-base text-base-content/70">{item.intro}</p> : null}
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
