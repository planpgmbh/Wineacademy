"use client";

import { useMemo } from "react";

import { ContentTabs } from "@/components/common/ContentTabs";

type SeminarContentTabsProps = {
  tabs: {
    id: string;
    title: string;
    contentHtml: string;
  }[];
};

export function SeminarContentTabs({ tabs }: SeminarContentTabsProps) {
  const normalizedTabs = useMemo(
    () =>
      tabs.map((tab) => ({
        id: tab.id,
        label: tab.title,
        contentHtml: tab.contentHtml
      })),
    [tabs]
  );

  return <ContentTabs tabs={normalizedTabs} />;
}
