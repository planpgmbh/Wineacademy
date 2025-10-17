"use client";

import { useCallback, useEffect, useMemo, useState, type ChangeEvent } from "react";
import { QuantitySelector } from "@/components/shared/QuantitySelector";
import { BOOKING_SELECTION_STORAGE_KEY, triggerBookingFlow } from "./bookingUtils";

type SeminarBookingCardProps = {
  highlightLabel?: string;
  title: string;
  price: string;
  description: string;
  dates: { id: string; label: string }[];
  ctaLabel: string;
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
  ctaLabel,
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

  const handleSubmit = useCallback(() => {
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
  }, [hasDates, onSubmit, quantity, selectedDate, seminarSlug, title]);

  const handleDateChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const value = event.target.value === placeholderValue ? undefined : event.target.value;
    setSelectedDate(value);
    setDateError(null);
  };

  return (
    <article
      className={`flex w-full flex-col gap-6 rounded-box border border-base-300 bg-base-100/95 p-4 shadow-xl backdrop-blur-sm md:min-w-[360px] md:max-w-[360px] md:w-[360px] md:p-5 ${className}`.trim()}
    >
      <div className="space-y-2.5">
        {highlightLabel ? (
          <span className="badge badge-info badge-sm px-3 py-1 text-xs font-semibold uppercase tracking-wide">
            {highlightLabel}
          </span>
        ) : null}

        <div className="space-y-1.5">
          <h2 className="text-[1.75rem] font-light leading-tight text-base-content">{title}</h2>
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

        <button type="button" className="btn btn-primary w-full" onClick={handleSubmit}>
          {ctaLabel}
        </button>
      </div>
    </article>
  );
}
