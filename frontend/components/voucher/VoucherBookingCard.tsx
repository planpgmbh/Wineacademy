"use client";

import { useMemo, useState } from "react";
import type { CSSProperties } from "react";

import { triggerVoucherFlow } from "./voucherBookingUtils";

const EURO_FORMATTER = new Intl.NumberFormat("de-DE", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
});
const AMOUNT_PLACEHOLDER_LENGTH = 6;

type VoucherBookingCardProps = {
  highlightLabel?: string | null;
  title: string;
  description: string;
  buttonText: string;
  defaultAmount: number;
  minAmount?: number | null;
  maxAmount?: number | null;
  voucherTitle: string;
  voucherDescription?: string | null;
  imageUrl?: string | null;
  imageAlt?: string | null;
  shippingCost?: number | null;
  className?: string;
};

function sanitiseAmountInput(value: string): string {
  return value.replace(/[^0-9.,]/g, "");
}

function parseAmount(value: string): number | null {
  if (!value) {
    return null;
  }
  const normalised = value.replace(/\./g, "").replace(",", ".");
  const parsed = Number.parseFloat(normalised);
  if (!Number.isFinite(parsed)) {
    return null;
  }
  return Math.round(parsed * 100) / 100;
}

export function VoucherBookingCard({
  highlightLabel,
  title,
  description,
  buttonText,
  defaultAmount,
  minAmount,
  maxAmount,
  voucherTitle,
  voucherDescription,
  imageUrl,
  imageAlt,
  className = "",
  shippingCost
}: VoucherBookingCardProps) {
  const [inputValue, setInputValue] = useState(() => String(defaultAmount));
  const amount = useMemo(() => parseAmount(inputValue), [inputValue]);
  const amountInputStyle = useMemo<CSSProperties>(() => {
    const visibleLength = Math.max(inputValue.length, AMOUNT_PLACEHOLDER_LENGTH);
    return { width: `max(80px, ${visibleLength + 1}ch)` };
  }, [inputValue]);

  const validation = useMemo(() => {
    if (amount == null || amount <= 0) {
      return "Bitte gib einen gültigen Betrag ein.";
    }
    if (minAmount != null && amount < minAmount) {
      return `Der Mindestbetrag beträgt ${EURO_FORMATTER.format(minAmount)}.`;
    }
    if (maxAmount != null && amount > maxAmount) {
      return `Der maximale Betrag beträgt ${EURO_FORMATTER.format(maxAmount)}.`;
    }
    return null;
  }, [amount, minAmount, maxAmount]);

  const formattedAmount = amount != null ? EURO_FORMATTER.format(amount) : "–";

  const handleSubmit = () => {
    if (validation) {
      return;
    }
    if (amount == null) {
      return;
    }
    triggerVoucherFlow({
      amount,
      title: voucherTitle,
      description: voucherDescription,
      imageUrl,
      imageAlt,
      minAmount: minAmount ?? undefined,
      maxAmount: maxAmount ?? undefined,
      shippingCost: shippingCost ?? undefined
    });
  };

  return (
    <article
      className={`flex w-full flex-col gap-6 rounded-box border ui-border bg-base-100/95 p-4 shadow-xl backdrop-blur-sm md:min-w-[360px] md:max-w-[360px] md:w-[360px] md:p-5 ${className}`.trim()}
    >
      <div className="space-y-2.5">
        {highlightLabel ? <span className="badge-highlight">{highlightLabel}</span> : null}

        <div className="space-y-1.5">
          <h2 className="heading-card">{title}</h2>
          <p className="text-lg font-light text-base-content/80">{formattedAmount}</p>
        </div>

        <p className="text-sm leading-relaxed text-base-content/80">{description}</p>

        <p className="text-xs text-base-content/60">
          {minAmount != null ? `Ab ${EURO_FORMATTER.format(minAmount)}` : null}
          {minAmount != null && maxAmount != null ? " · " : null}
          {maxAmount != null ? `Bis ${EURO_FORMATTER.format(maxAmount)}` : null}
          {minAmount == null && maxAmount == null ? "Betrag frei wählbar" : null}
        </p>
      </div>

      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-[80px] flex-shrink-0">
            <input
              type="text"
              inputMode="decimal"
              className="input input-bordered pl-8 pr-3"
              style={amountInputStyle}
              value={inputValue}
              onChange={(event) => setInputValue(sanitiseAmountInput(event.target.value))}
              onBlur={() => {
                if (amount != null) {
                  setInputValue(String(amount));
                }
              }}
              aria-label="Gutscheinbetrag"
              placeholder="Betrag"
            />
            <span
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-base-content/60 z-10"
              aria-hidden="true"
            >
              €
            </span>
          </div>
          <button
            type="button"
            className="btn btn-primary flex-1 min-w-[140px]"
            onClick={handleSubmit}
            disabled={Boolean(validation)}
          >
            {buttonText}
          </button>
        </div>
        {validation ? <p className="text-xs text-error">{validation}</p> : null}
      </div>
    </article>
  );
}
