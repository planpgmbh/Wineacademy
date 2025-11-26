"use client";

import { useCallback, useEffect, useMemo, useState, type ChangeEvent } from "react";

import { QuantitySelector } from "@/components/shared/QuantitySelector";
import {
  BOOKING_SELECTION_STORAGE_KEY,
  readBookingSelections,
  triggerBookingFlow,
  type BookingSelection
} from "./bookingUtils";

type SeminarBookingMobileProps = {
  highlightLabel?: string;
  title: string;
  price: string;
  description: string;
  dates: { id: string; label: string }[];
  buttonText: string;
  onSubmit?: (payload: { quantity: number; dateId?: string }) => void;
  seminarSlug?: string;
};

export function SeminarBookingMobile({
  highlightLabel,
  title,
  price,
  description,
  dates,
  buttonText,
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

  const syncSelection = useCallback(
    (preferredDate?: string) => {
      if (typeof window === "undefined" || !seminarSlug) {
        return;
      }

      const selections = readBookingSelections().filter((entry) => entry.seminarSlug === seminarSlug);
      if (selections.length === 0) {
        return;
      }

      const desiredDate = preferredDate ?? selectedDate ?? null;
      const matchByDate = desiredDate ? selections.find((entry) => entry.dateId === desiredDate) ?? null : null;

      if (preferredDate && !matchByDate) {
        setQuantity(1);
        return;
      }

      const latestFallback = selections.reduce<BookingSelection | null>((latest, entry) => {
        if (!latest) {
          return entry;
        }
        if (!entry.updatedAt) {
          return latest;
        }
        if (!latest.updatedAt || entry.updatedAt > latest.updatedAt) {
          return entry;
        }
        return latest;
      }, null);

      const candidate = matchByDate ?? latestFallback;
      if (!candidate) {
        return;
      }

      setQuantity(Math.max(1, Math.trunc(candidate.quantity ?? 1)));
      if (!selectedDate && candidate.dateId && dates.some((date) => date.id === candidate.dateId)) {
        setSelectedDate(candidate.dateId);
      }
      setDateError(null);
    },
    [dates, selectedDate, seminarSlug]
  );

  useEffect(() => {
    if (typeof window === "undefined" || !seminarSlug) {
      return;
    }

    const handleSync = () => syncSelection();
    const handleStorage = (event: StorageEvent) => {
      if (event.key === BOOKING_SELECTION_STORAGE_KEY) {
        syncSelection();
      }
    };

    syncSelection();

    document.addEventListener("booking:pending", handleSync);
    window.addEventListener("storage", handleStorage);

    return () => {
      document.removeEventListener("booking:pending", handleSync);
      window.removeEventListener("storage", handleStorage);
    };
  }, [datesKey, syncSelection, seminarSlug]);

  const safeAreaBottom = "env(safe-area-inset-bottom, 0)";

  const handleDateChange = useCallback(
    (event: ChangeEvent<HTMLSelectElement>) => {
      const value = event.target.value === placeholderValue ? undefined : event.target.value;
      setSelectedDate(value);
      setDateError(null);
      if (value) {
        syncSelection(value);
      }
    },
    [placeholderValue, syncSelection]
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
        data-open={isOpen}
        className={`booking-sheet fixed inset-x-0 bottom-0 z-50 transform transition-transform duration-300 ${
          shouldShowSheet ? "translate-y-0" : "translate-y-full"
        }`}
      >
        <div className="booking-sheet-panel mx-auto max-w-[var(--detail-content-max-width)] p-5">
          <div
            className="relative"
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
                    <span className="badge-highlight">{highlightLabel}</span>
                  ) : null}
                  <h2 className="heading-card">{title}</h2>
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
              className="booking-sheet-cta btn btn-primary absolute left-5 right-5 h-[40px]"
              style={{
                bottom: `calc(${safeAreaBottom} + 20px)`
              }}
              onClick={handleButtonClick}
            >
              {buttonText}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
