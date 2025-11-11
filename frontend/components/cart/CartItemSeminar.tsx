"use client";
import { useEffect, useMemo, useRef, useState } from "react";

import { QuantitySelector } from "../shared/QuantitySelector";
import type { BookingSelection, SeminarCartItem } from "./useCartData";

type CartItemSeminarProps = {
  seminar: SeminarCartItem | null;
  selection: BookingSelection;
  onQuantityChange?: (quantity: number) => void;
  onRemove?: () => void;
  variant?: "default" | "summary";
  showRemoveButton?: boolean;
  controlled?: boolean;
};

function useQuantity(
  initial: number,
  onChange?: (quantity: number) => void,
  options?: { controlled?: boolean }
) {
  const controlled = options?.controlled ?? false;
  const normalisedInitial = Math.max(1, Math.trunc(initial));
  const [quantity, setQuantity] = useState(normalisedInitial);
  const isFirstRender = useRef(true);
  const isSyncingFromProps = useRef(false);

  useEffect(() => {
    if (controlled) {
      return;
    }
    const next = Math.max(1, Math.trunc(initial));
    isSyncingFromProps.current = true;
    setQuantity(next);
  }, [controlled, initial]);

  useEffect(() => {
    if (controlled) {
      return;
    }
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    if (isSyncingFromProps.current) {
      isSyncingFromProps.current = false;
      return;
    }
    onChange?.(quantity);
  }, [controlled, onChange, quantity]);

  if (controlled) {
    const handleControlledChange = (value: number) => {
      const next = Math.max(1, Math.trunc(value));
      if (next === normalisedInitial) {
        return;
      }
      onChange?.(next);
    };
    return [normalisedInitial, handleControlledChange] as const;
  }

  return [quantity, setQuantity] as const;
}

const EURO_FORMATTER = new Intl.NumberFormat("de-DE", {
  style: "currency",
  currency: "EUR"
});

export function CartItemSeminar({
  seminar,
  selection,
  onQuantityChange,
  onRemove,
  variant = "default",
  showRemoveButton = true,
  controlled = false
}: CartItemSeminarProps) {
  const isSummaryVariant = variant === "summary";
  const [quantity, setQuantity] = useQuantity(selection.quantity ?? 1, onQuantityChange, {
    controlled: controlled || isSummaryVariant
  });

  const selectedDateId = selection.dateId ?? null;
  const selectedDate = useMemo(() => {
    if (!selectedDateId || !seminar?.dates?.length) {
      return null;
    }
    return seminar.dates.find((option) => option.id === String(selectedDateId)) ?? null;
  }, [selectedDateId, seminar?.dates]);

  const selectedDateLines = useMemo(() => {
    if (!selectedDate) {
      return [];
    }
    const source = selectedDate.days?.length ? selectedDate.days : selectedDate.label ? [selectedDate.label] : [];
    return source.map((entry) => entry.trim()).filter((entry) => entry.length > 0);
  }, [selectedDate]);
  const title = seminar?.title ?? selection.seminarTitle ?? "Seminar";

  const totalPriceFormatted = useMemo(() => {
    if (!seminar) {
      return "Preis auf Anfrage";
    }
    if (seminar.price.value == null) {
      return seminar.price.formatted;
    }
    const total = seminar.price.value * quantity;
    if (!Number.isFinite(total) || total <= 0) {
      return seminar.price.formatted;
    }
    return EURO_FORMATTER.format(total);
  }, [quantity, seminar]);

  const containerClasses =
    variant === "summary"
      ? "relative flex flex-col gap-4 py-2"
      : "relative flex flex-col gap-4 rounded-2xl bg-base-100 p-4 shadow-sm";
  const removeButtonPosition = variant === "summary" ? "right-0 top-0" : "right-3 top-3";

  return (
    <article className={containerClasses}>
      {showRemoveButton ? (
        <button
          type="button"
          aria-label="Seminar aus dem Warenkorb entfernen"
          className={`btn btn-ghost btn-circle btn-xs absolute ${removeButtonPosition}`}
          onClick={onRemove}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
            className="h-4 w-4"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0"
            />
          </svg>
        </button>
      ) : null}
      <div className="flex flex-1 flex-col gap-4">
        <header className="space-y-2 pr-8">
          <h3 className="heading-label">
            {title}
          </h3>
        </header>

        {selectedDateLines.length > 0 ? (
          <div className="space-y-1">
            <span className="text-xs font-semibold uppercase tracking-wide text-base-content">Termine:</span>
            <ul className="space-y-1 text-sm text-base-content">
              {selectedDateLines.map((line, index) => (
                <li key={`${selection.id}-selected-${index}`}>{line}</li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="text-xs text-base-content/60">
            {selectedDateId
              ? "Termin wird im Checkout bestätigt."
              : "Neue Termine werden in Kürze veröffentlicht."}
          </p>
        )}

        <footer className="flex items-center justify-between pt-2">
          <div className="flex items-center gap-3">
            <QuantitySelector value={quantity} onChange={setQuantity} />
          </div>
          <div className="text-right">
            <span className="block text-base font-semibold">{totalPriceFormatted}</span>
          </div>
        </footer>
      </div>
    </article>
  );
}
