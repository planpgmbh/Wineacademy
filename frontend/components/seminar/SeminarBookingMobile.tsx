"use client";

import { useEffect, useState } from "react";

import { QuantitySelector } from "@/components/shared/QuantitySelector";
import { triggerBookingFlow } from "./bookingUtils";

type SeminarBookingMobileProps = {
  highlightLabel?: string;
  title: string;
  price: string;
  description: string;
  dates: { id: string; label: string }[];
  ctaLabel: string;
  onSubmit?: (payload: { quantity: number; dateId?: string }) => void;
  seminarSlug?: string;
};

export function SeminarBookingMobile({
  highlightLabel,
  title,
  price,
  description,
  dates,
  ctaLabel,
  onSubmit,
  seminarSlug
}: SeminarBookingMobileProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [showCTA, setShowCTA] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [selectedDate, setSelectedDate] = useState<string | undefined>(undefined);

  const hasDates = dates.length > 0;
  const placeholderValue = "";

  useEffect(() => {
    const handleScroll = () => {
      setShowCTA(window.scrollY > 160);
    };

    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const safeAreaBottom = "env(safe-area-inset-bottom, 0)";

  const handleButtonClick = () => {
    if (!isOpen) {
      setIsOpen(true);
      return;
    }

    const payload = { quantity, dateId: selectedDate };
    if (onSubmit) {
      onSubmit(payload);
      return;
    }
    triggerBookingFlow({
      quantity,
      dateId: selectedDate,
      seminarSlug,
      seminarTitle: title,
    });
  };

  const shouldShowSheet = isOpen || showCTA;

  return (
    <div className="md:hidden">
      <div
        className={`fixed inset-x-0 bottom-0 z-40 transform transition-transform duration-300 ${
          shouldShowSheet ? "translate-y-0" : "translate-y-full"
        }`}
      >
        <div className="bg-base-100 shadow-[0_-12px_30px_rgb(15_23_42/0.18)]">
          <div
            className="relative mx-auto max-w-6xl p-5"
            style={{
              paddingBottom: `calc(${safeAreaBottom} + 20px + 45px)`
            }}
          >
            {isOpen ? (
              <button
                type="button"
                className="btn btn-ghost btn-sm absolute right-5 top-5"
                aria-label="Sheet schließen"
                onClick={() => setIsOpen(false)}
              >
                ✕
              </button>
            ) : null}

            <div
              className={`overflow-hidden transition-[max-height,opacity] duration-300 ${
                isOpen ? "max-h-[80vh] opacity-100" : "max-h-0 opacity-0"
              }`}
            >
              <div className="space-y-6 pb-5">
                <div className="space-y-2">
                  {highlightLabel ? (
                    <span className="badge badge-info badge-sm px-3 py-1 text-xs font-semibold uppercase tracking-wide">
                      {highlightLabel}
                    </span>
                  ) : null}
                  <h2 className="text-2xl font-light leading-tight text-base-content">{title}</h2>
                  <p className="text-lg font-light text-base-content/80">{price}</p>
                </div>

                <p className="text-sm leading-relaxed text-base-content/80">{description}</p>

                <div className="space-y-3">
                  <div className="flex flex-wrap items-center gap-3">
                    <QuantitySelector value={quantity} onChange={setQuantity} />

                    <label className="form-control min-w-[200px] flex-1">
                      <span className="sr-only">Termin auswählen</span>
                      <select
                        className="select select-bordered w-full"
                        value={selectedDate ?? placeholderValue}
                        disabled={!hasDates}
                        onChange={(event) =>
                          setSelectedDate(event.target.value === placeholderValue ? undefined : event.target.value)
                        }
                      >
                        <option value={placeholderValue} disabled={hasDates}>
                          {hasDates ? "Termin auswählen" : "Termine folgen in Kürze"}
                        </option>
                        {dates.map((option) => (
                          <option key={option.id} value={option.id}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                </div>
              </div>
            </div>

            <button
              type="button"
              className="btn btn-primary absolute left-5 right-5 h-[40px]"
              style={{
                bottom: `calc(${safeAreaBottom} + 20px)`
              }}
              onClick={handleButtonClick}
            >
              {ctaLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
