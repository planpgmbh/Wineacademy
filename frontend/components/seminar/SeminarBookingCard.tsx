"use client";

import { useCallback, useEffect, useMemo, useState, type ChangeEvent } from "react";
import { QuantitySelector } from "@/components/shared/QuantitySelector";
import { BOOKING_SELECTION_STORAGE_KEY, readBookingSelections, triggerBookingFlow, type BookingSelection } from "./bookingUtils";

type SeminarBookingCardProps = {
  highlightLabel?: string;
  title: string;
  price: string;
  description: string;
  dates: { id: string; label: string; kapazitaet?: number | null; planungsstatus?: string | null }[];
  buttonText: string;
  className?: string;
  seminarSlug?: string;
  onSubmit?: (payload: { quantity: number; dateId?: string }) => void;
};

export function SeminarBookingCard({
  highlightLabel,
  title,
  price,
  description,
  dates,
  buttonText,
  className = "",
  seminarSlug,
  onSubmit
}: SeminarBookingCardProps) {
  const [quantity, setQuantity] = useState(1);
  const [selectedDate, setSelectedDate] = useState<string | undefined>(undefined);
  const [dateError, setDateError] = useState<string | null>(null);
  const hasDates = dates.length > 0;
  const placeholderValue = "";
  const datesKey = useMemo(() => dates.map((date) => date.id).join("|"), [dates]);
  const selectedDateInfo = useMemo(
    () => (selectedDate ? dates.find((date) => date.id === selectedDate) ?? null : null),
    [dates, selectedDate]
  );

  const normalisedStatus = (selectedDateInfo?.planungsstatus ?? "").toLowerCase();
  const capacity =
    selectedDateInfo?.kapazitaet != null && Number.isFinite(selectedDateInfo.kapazitaet)
      ? Number(selectedDateInfo.kapazitaet)
      : null;
  const isCancelled = normalisedStatus === "abgesagt";
  const isSoldOut = normalisedStatus === "ausgebucht" || (capacity != null && capacity <= 0);
  const isLowStock = capacity != null && capacity > 0 && capacity < 10;
  const remainingLabel =
    capacity === 1 ? "Nur noch 1 Platz" : isLowStock && capacity != null ? `Nur noch ${capacity} Plätze` : null;
  const dynamicHighlight =
    isCancelled || isSoldOut
      ? isCancelled
        ? "Termin abgesagt"
        : "Leider Ausgebucht"
      : remainingLabel
        ? remainingLabel
        : highlightLabel;
  const ctaLabel = isCancelled ? "Termin abgesagt" : isSoldOut ? "Termin ausgebucht" : buttonText;
  const disableCta = isCancelled || isSoldOut;
  const badgeClassName = `badge-highlight ${isLowStock ? "badge-highlight-pulse" : ""}`.trim();

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

  const handleSubmit = useCallback(() => {
    if (disableCta) {
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
  }, [disableCta, hasDates, onSubmit, quantity, selectedDate, seminarSlug, title]);

  const handleDateChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const value = event.target.value === placeholderValue ? undefined : event.target.value;
    setSelectedDate(value);
    setDateError(null);
    if (value) {
      syncSelection(value);
    }
  };

  return (
    <article
      className={`flex w-full flex-col gap-6 rounded-box border ui-border bg-base-100/65 p-4 shadow-xl backdrop-blur-xl md:min-w-[360px] md:max-w-[360px] md:w-[360px] md:p-5 ${className}`.trim()}
    >
      <div className="space-y-2.5">
        {dynamicHighlight ? <span className={badgeClassName}>{dynamicHighlight}</span> : null}

        <div className="space-y-1.5">
          <h2 className="heading-card">{title}</h2>
          <p className="text-lg font-light text-base-content/80">{price}</p>
        </div>

        <p className="text-sm leading-relaxed text-base-content/80">{description}</p>
      </div>

      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex flex-shrink-0 items-center">
            <QuantitySelector value={quantity} onChange={setQuantity} />
          </div>

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

        <button type="button" className="btn btn-primary w-full" onClick={handleSubmit} disabled={disableCta}>
          {ctaLabel}
        </button>
      </div>
    </article>
  );
}
