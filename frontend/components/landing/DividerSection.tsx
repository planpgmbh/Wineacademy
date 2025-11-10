import Image from "next/image";

import {
  resolveSectionBackground,
  SECTION_BACKGROUND_CSS_VAR,
  isDarkSectionBackground,
  type SectionBackgroundKey
} from "@/lib/landing";

type DividerSectionProps = {
  hintergrund?: SectionBackgroundKey | null;
};

export function DividerSection({ hintergrund }: DividerSectionProps) {
  const resolvedBackground = resolveSectionBackground(hintergrund ?? null);
  const isDarkBackground = isDarkSectionBackground(resolvedBackground);
  const style = { backgroundColor: `var(${SECTION_BACKGROUND_CSS_VAR[resolvedBackground]})` };

  const lineClass = isDarkBackground ? "bg-base-100/30" : "bg-base-content/20";
  const contentStyle = { maxWidth: "var(--landing-content-max-width)" };

  return (
    <section style={style}>
      <div
        className="mx-auto flex w-full items-center px-6 py-10 md:px-8 md:py-14"
        style={contentStyle}
        aria-hidden="true"
      >
        <div className="flex w-full items-center gap-4 md:gap-6">
          <span className={`h-px flex-1 ${lineClass}`} />
          <div className="flex items-center justify-center px-2">
            <Image
              src="/icons/WineAcademy.svg"
              alt="Wine Academy Logo"
              width={30}
              height={30}
              className="h-[30px] w-[30px]"
            />
          </div>
          <span className={`h-px flex-1 ${lineClass}`} />
        </div>
      </div>
    </section>
  );
}
