"use client";

import { useMemo, useState, type JSX } from "react";

import {
  resolveSectionBackground,
  SECTION_BACKGROUND_CSS_VAR,
  isDarkSectionBackground,
  type SectionBackgroundKey
} from "@/lib/landing";

type TabsSectionProps = {
  headline?: string | null;
  headlineLevel: "h2" | "h3" | "h4";
  background?: SectionBackgroundKey | null;
  tabs: {
    id: string;
    headline: string;
    contentHtml: string;
  }[];
};

const headingTags: Record<"h2" | "h3" | "h4", keyof JSX.IntrinsicElements> = {
  h2: "h2",
  h3: "h3",
  h4: "h4"
};

const headingClasses: Record<"h2" | "h3" | "h4", string> = {
  h2: "heading-section",
  h3: "",
  h4: ""
};

export function TabsSection({ headline, headlineLevel, background, tabs }: TabsSectionProps) {
  const validTabs = useMemo(
    () =>
      tabs.filter((tab) => {
        return tab.headline.trim().length > 0 && tab.contentHtml.trim().length > 0;
      }),
    [tabs]
  );

  const [activeId, setActiveId] = useState(() => validTabs[0]?.id ?? "");
  const resolvedBackground = resolveSectionBackground(background ?? null);
  const style = useMemo(
    () => ({ backgroundColor: `var(${SECTION_BACKGROUND_CSS_VAR[resolvedBackground]})` }),
    [resolvedBackground]
  );
  const isDarkBackground = isDarkSectionBackground(resolvedBackground);

  if (validTabs.length === 0) {
    return null;
  }

  const showHeadline = typeof headline === "string" && headline.trim().length > 0;
  const HeadingTag = headingTags[headlineLevel];
  const headingClass = [headingClasses[headlineLevel], isDarkBackground ? "heading-on-dark" : ""]
    .filter(Boolean)
    .join(" ")
    .trim();
  const activeTab = validTabs.find((tab) => tab.id === activeId) ?? validTabs[0];
  const inactiveTabClass = isDarkBackground
    ? "text-base-100/70 hover:text-base-100"
    : "text-base-content/60 hover:text-base-content";

  return (
    <section style={style}>
      <div
        className={`mx-auto flex w-full max-w-5xl flex-col gap-6 px-6 py-[var(--section-padding-y-compact)] md:px-8 md:py-[var(--section-padding-y-lg)] md:gap-10 ${
          isDarkBackground ? "text-base-100" : ""
        }`}
      >
        {showHeadline ? <HeadingTag className={headingClass}>{headline}</HeadingTag> : null}

        <div className="space-y-5 md:space-y-8">
          <div className="ui-border-bottom overflow-x-auto">
            <div role="tablist" className="tabs -mb-[1px] gap-4 md:gap-6">
              {validTabs.map((tab) => {
                const isActive = tab.id === activeTab.id;
                return (
                  <button
                    key={tab.id}
                    role="tab"
                    type="button"
                    className={`tab relative whitespace-nowrap px-1 pb-3 text-base font-medium transition-colors ${
                      isActive
                        ? `font-semibold ${isDarkBackground ? "text-base-100" : "text-base-content"} after:absolute after:bottom-[1px] after:left-0 after:h-1 after:w-full after:rounded-full after:bg-primary after:content-['']`
                        : inactiveTabClass
                    }`}
                    tabIndex={isActive ? 0 : -1}
                    aria-selected={isActive}
                    onClick={() => setActiveId(tab.id)}
                  >
                    {tab.headline}
                  </button>
                );
              })}
            </div>
          </div>

          <div
            className="rounded-3xl bg-base-100 p-6 text-base leading-relaxed text-base-content/80 shadow-sm ring-1 ring-base-300 md:p-8 [&_a]:text-primary [&_a]:underline [&_ol]:list-decimal [&_ol]:space-y-2 [&_ol]:pl-5 [&_p:not(:first-child)]:mt-4 [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-5"
            dangerouslySetInnerHTML={{ __html: activeTab.contentHtml }}
          />
        </div>
      </div>
    </section>
  );
}
