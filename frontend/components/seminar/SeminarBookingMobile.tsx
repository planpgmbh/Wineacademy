"use client";

import { useCallback, useEffect, useMemo, useState, type ChangeEvent } from "react";

import { QuantitySelector } from "@/components/shared/QuantitySelector";
import { MobileBookingSheet } from "@/components/shared/MobileBookingSheet";
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
  const [quantity, setQuantity] = useState(1);
  const [selectedDate, setSelectedDate] = useState<string | undefined>(undefined);
  const [dateError, setDateError] = useState<string | null>(null);

  const hasDates = dates.length > 0;
  const placeholderValue = "";
  const datesKey = useMemo(() => dates.map((date) => date.id).join("|"), [dates]);

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

  const handleConfirm = () => {
    if (hasDates && !selectedDate) {
      setDateError("Bitte wähle einen Termin aus.");
      return false;
    }

    const payload = { quantity, dateId: selectedDate };
    if (onSubmit) {
      onSubmit(payload);
      return true;
    }
    triggerBookingFlow({
      quantity,
      dateId: selectedDate,
      seminarSlug,
      seminarTitle: title,
    });

    return true;
  };

  return (
    <MobileBookingSheet ctaLabel={buttonText} onConfirm={handleConfirm}>
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
    </MobileBookingSheet>
  );
}
