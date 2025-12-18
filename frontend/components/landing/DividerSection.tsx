import Image from "next/image";

import {
  isDarkSectionBackground,
  type SectionBackgroundKey
} from "@/lib/landing";

type DividerSectionProps = {
  hintergrund?: SectionBackgroundKey | null;
  breite?: "normal" | "weit" | null;
};

export function DividerSection({ hintergrund, breite }: DividerSectionProps) {
  const resolvedBackground = hintergrund ?? "neutral";
  const isDarkBackground = isDarkSectionBackground(resolvedBackground);

  const lineClass = isDarkBackground ? "bg-base-100/30" : "bg-base-content/20";
  const maxWidth =
    breite === "weit" ? "var(--detail-content-max-width)" : "var(--landing-content-max-width)";
  const contentStyle = { maxWidth };

  return (
    <section>
      <div
        className="mx-auto flex w-full items-center px-6 pt-[15px] md:px-8"
        style={contentStyle}
        aria-hidden="true"
      >
        <div className="flex w-full items-center gap-[var(--space-compact)] md:gap-[var(--space-block)]">
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
