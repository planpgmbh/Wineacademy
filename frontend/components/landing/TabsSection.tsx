"use client";

import { useMemo, type JSX } from "react";

import {
  resolveSectionBackground,
  SECTION_BACKGROUND_CSS_VAR,
  isDarkSectionBackground,
  type SectionBackgroundKey
} from "@/lib/landing";
import { ContentTabs } from "@/components/common/ContentTabs";

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

  const normalizedTabs = useMemo(
    () =>
      validTabs.map((tab) => ({
        id: tab.id,
        label: tab.headline,
        contentHtml: tab.contentHtml
      })),
    [validTabs]
  );
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
  const inactiveTabClass = isDarkBackground ? "text-base-100/70 hover:text-base-100" : undefined;
  const activeTabClass = isDarkBackground ? "text-base-100" : undefined;
  const contentClass = isDarkBackground ? "text-base-100/80 [&_a]:text-primary-200" : undefined;

  return (
    <section style={style}>
      <div
        className={`mx-auto flex w-full max-w-5xl flex-col gap-6 px-6 py-[var(--section-padding-y-compact)] md:px-8 md:py-[var(--section-padding-y-lg)] md:gap-10 ${
          isDarkBackground ? "text-base-100" : ""
        }`}
      >
        {showHeadline ? <HeadingTag className={headingClass}>{headline}</HeadingTag> : null}

        <ContentTabs
          tabs={normalizedTabs}
          classNames={{
            tabList: "gap-6",
            tabButton: "px-0",
            activeTabButton: activeTabClass,
            inactiveTabButton: inactiveTabClass,
            content: contentClass
          }}
        />
      </div>
    </section>
  );
}
