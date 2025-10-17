"use client";

import { useCallback, useEffect, useMemo, useState, type ChangeEvent } from "react";

import { QuantitySelector } from "@/components/shared/QuantitySelector";
import { BOOKING_SELECTION_STORAGE_KEY, triggerBookingFlow } from "./bookingUtils";

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
  const [dateError, setDateError] = useState<string | null>(null);

  const hasDates = dates.length > 0;
  const placeholderValue = "";
  const datesKey = useMemo(() => dates.map((date) => date.id).join("|"), [dates]);

  useEffect(() => {
    const handleScroll = () => {
      setShowCTA(window.scrollY > 160);
    };

    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || !seminarSlug) {
      return;
    }

    try {
      const raw = window.localStorage.getItem(BOOKING_SELECTION_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object") return;

      const storedSlug =
        typeof parsed.slug === "string"
          ? parsed.slug
          : typeof parsed.seminarSlug === "string"
            ? parsed.seminarSlug
            : null;

      if (!storedSlug || storedSlug !== seminarSlug) return;

      if (typeof parsed.quantity === "number" && Number.isFinite(parsed.quantity)) {
        setQuantity(Math.max(1, Math.trunc(parsed.quantity)));
      }

      const storedDate = typeof parsed.dateId === "string" ? parsed.dateId : null;
      if (storedDate && dates.some((date) => date.id === storedDate)) {
        setSelectedDate(storedDate);
      } else {
        setSelectedDate(undefined);
      }
      setDateError(null);
    } catch {
      // Ignoriert – Vorbelegung optional.
    }
  }, [datesKey, dates, seminarSlug]);

  const safeAreaBottom = "env(safe-area-inset-bottom, 0)";

  const handleDateChange = useCallback(
    (event: ChangeEvent<HTMLSelectElement>) => {
      const value = event.target.value === placeholderValue ? undefined : event.target.value;
      setSelectedDate(value);
      setDateError(null);
    },
    [placeholderValue]
  );

  const handleButtonClick = () => {
    if (!isOpen) {
      setIsOpen(true);
      return;
    }

    if (hasDates && !selectedDate) {
      setDateError("Bitte wähle einen Termin aus.");
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

    setIsOpen(false);
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
                        aria-invalid={Boolean(dateError)}
                        onChange={handleDateChange}
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
                      {dateError ? <span className="label-text-alt mt-1 text-xs text-error">{dateError}</span> : null}
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
