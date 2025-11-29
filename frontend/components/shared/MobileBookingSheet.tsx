"use client";

import { useEffect, useState, type ReactNode } from "react";

type MobileBookingSheetProps = {
  ctaLabel: string;
  onConfirm?: () => boolean | void | Promise<boolean | void>;
  ctaDisabled?: boolean;
  children: ReactNode;
};

export function MobileBookingSheet({ ctaLabel, onConfirm, ctaDisabled = false, children }: MobileBookingSheetProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [showCTA, setShowCTA] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setShowCTA(window.scrollY > 0);
    };

    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const shouldShowSheet = isOpen || showCTA;
  const safeAreaBottom = "env(safe-area-inset-bottom, 0)";
  const isButtonDisabled = ctaDisabled;

  const handleConfirm = async () => {
    if (!isOpen) {
      setIsOpen(true);
      return;
    }

    if (isButtonDisabled) {
      return;
    }

    const result = await onConfirm?.();
    if (result !== false) {
      setIsOpen(false);
    }
  };

  const handleClose = () => {
    setIsOpen(false);
  };

  return (
    <div className="md:hidden">
      <div
        data-open={isOpen}
        className={`booking-sheet fixed inset-x-0 bottom-0 z-50 transform transition-transform duration-300 ${
          shouldShowSheet ? "translate-y-0" : "translate-y-full"
        }`}
      >
        <div className="booking-sheet-panel mx-auto max-w-[var(--detail-content-max-width)] space-y-4 p-5">
          <div className="relative">
            {isOpen ? (
              <button
                type="button"
                className="btn btn-ghost btn-sm booking-sheet-close absolute"
                aria-label="Sheet schließen"
                onClick={handleClose}
              >
                ✕
              </button>
            ) : null}

            <div
              className={`overflow-hidden transition-[max-height,opacity] duration-300 ${
                isOpen ? "max-h-[80vh] opacity-100" : "max-h-0 opacity-0"
              }`}
            >
              <div className="space-y-6 pb-5">{children}</div>
            </div>
          </div>

          <div
            className="flex items-center justify-center pb-[calc(env(safe-area-inset-bottom,0)+12px)]"
            style={{ paddingBottom: `calc(${safeAreaBottom} + 12px)` }}
          >
            <button
              type="button"
              className="booking-sheet-cta btn btn-primary mb-2 h-[52px] w-full max-w-sm text-base"
              disabled={isButtonDisabled}
              onClick={handleConfirm}
            >
              {ctaLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
