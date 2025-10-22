"use client";

import { useState } from "react";

type SeminarContentTabsProps = {
  tabs: {
    id: string;
    title: string;
    contentHtml: string;
  }[];
};

export function SeminarContentTabs({ tabs }: SeminarContentTabsProps) {
  const [activeId, setActiveId] = useState(() => tabs[0]?.id ?? "");

  if (tabs.length === 0) {
    return null;
  }

  const activeTab = tabs.find((tab) => tab.id === activeId) ?? tabs[0];

  return (
    <div className="w-full">
      <div className="ui-border-bottom">
        <div role="tablist" className="tabs -mb-[1px] gap-6">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              role="tab"
              type="button"
              className={`tab relative whitespace-nowrap px-0 pb-3 text-base font-medium transition-colors ${
                tab.id === activeTab.id
                  ? "font-semibold text-base-content after:absolute after:bottom-[1px] after:left-0 after:h-1 after:w-full after:rounded-full after:bg-primary after:content-['']"
                  : "text-base-content/60 hover:text-base-content"
              }`}
              tabIndex={tab.id === activeTab.id ? 0 : -1}
              aria-selected={tab.id === activeTab.id}
              onClick={() => setActiveId(tab.id)}
            >
              {tab.title}
            </button>
          ))}
        </div>
      </div>

      <div
        className="mt-8 text-base leading-relaxed text-base-content/80 [&_a]:text-primary [&_a]:underline [&_ol]:list-decimal [&_ol]:space-y-2 [&_ol]:pl-5 [&_p:not(:first-child)]:mt-4 [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-5"
        dangerouslySetInnerHTML={{ __html: activeTab.contentHtml }}
      />
    </div>
  );
}
