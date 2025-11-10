'use client';

import { useMemo, useState } from 'react';

function cx(...classes: Array<string | undefined | null | false>) {
  return classes.filter(Boolean).join(' ');
}

type ContentTabsProps = {
  tabs: {
    id: string;
    label: string;
    contentHtml: string;
  }[];
  classNames?: {
    root?: string;
    tabListWrapper?: string;
    tabList?: string;
    tabButton?: string;
    activeTabButton?: string;
    inactiveTabButton?: string;
    content?: string;
    contentWrapper?: string;
    contentWrapperStyle?: React.CSSProperties;
  };
};

export function ContentTabs({ tabs, classNames }: ContentTabsProps) {
  const validTabs = useMemo(
    () =>
      tabs.filter((tab) => {
        return tab.label.trim().length > 0 && tab.contentHtml.trim().length > 0;
      }),
    [tabs]
  );

  const [activeId, setActiveId] = useState(() => validTabs[0]?.id ?? '');

  if (validTabs.length === 0) {
    return null;
  }

  const activeTab = validTabs.find((tab) => tab.id === activeId) ?? validTabs[0];

  return (
    <div className={cx('w-full', classNames?.root)}>
      <div className={cx('ui-border-bottom', classNames?.tabListWrapper)}>
        <div role="tablist" className={cx('tabs -mb-[1px] gap-6', classNames?.tabList)}>
          {validTabs.map((tab) => {
            const isActive = tab.id === activeTab.id;
            return (
              <button
                key={tab.id}
                role="tab"
                type="button"
                className={cx(
                  'tab relative whitespace-nowrap px-0 pb-3 text-base font-medium transition-colors',
                  classNames?.tabButton,
                  isActive
                    ? cx(
                        "font-semibold text-base-content after:absolute after:bottom-[1px] after:left-0 after:h-1 after:w-full after:bg-primary after:content-['']",
                        classNames?.activeTabButton
                      )
                    : cx('text-base-content/60 hover:text-base-content', classNames?.inactiveTabButton)
                )}
                tabIndex={isActive ? 0 : -1}
                aria-selected={isActive}
                onClick={() => setActiveId(tab.id)}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className={cx('mt-8 flex justify-start', classNames?.contentWrapper)}>
        <div
          className={cx(
            "w-full text-base leading-relaxed text-base-content/80 [&_a]:text-primary [&_a]:underline [&_ol]:list-decimal [&_ol]:space-y-2 [&_ol]:pl-5 [&_p:not(:first-child)]:mt-4 [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-5",
            classNames?.content
          )}
          dangerouslySetInnerHTML={{ __html: activeTab.contentHtml }}
        />
      </div>
    </div>
  );
}
