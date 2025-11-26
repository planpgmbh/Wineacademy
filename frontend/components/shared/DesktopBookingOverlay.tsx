"use client";

import { useEffect, useState, type ReactNode } from "react";

type DesktopBookingOverlayProps = {
  footerId: string;
  children: ReactNode;
  cardWrapperClassName?: string;
};

export function DesktopBookingOverlay({
  footerId,
  children,
  cardWrapperClassName = ""
}: DesktopBookingOverlayProps) {
  const [shouldHide, setShouldHide] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !("IntersectionObserver" in window)) {
      return;
    }

    const footer = document.getElementById(footerId);
    if (!footer) {
      setShouldHide(false);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const isVisible = entries.some((entry) => entry.isIntersecting);
        setShouldHide(isVisible);
      },
      {
        root: null,
        rootMargin: "0px 0px -160px 0px",
        threshold: 0
      }
    );

    observer.observe(footer);

    return () => observer.disconnect();
  }, [footerId]);

  return (
    <div
      className={`pointer-events-none fixed inset-0 z-30 hidden md:block transition-opacity duration-300 ${
        shouldHide ? "opacity-0" : "opacity-100"
      }`}
      aria-hidden="true"
    >
      <div className="mx-auto flex h-full max-w-[var(--detail-content-max-width)] justify-end px-6 md:px-8">
        <div className={`pointer-events-auto w-[360px] self-start pt-[172px] ${cardWrapperClassName}`.trim()}>
          {children}
        </div>
      </div>
    </div>
  );
}
