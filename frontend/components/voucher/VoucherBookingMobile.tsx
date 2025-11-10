"use client";

import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";

import { triggerVoucherFlow } from "./voucherBookingUtils";

const EURO_FORMATTER = new Intl.NumberFormat("de-DE", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
});
const AMOUNT_PLACEHOLDER_LENGTH = 6;

type VoucherBookingMobileProps = {
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

export function VoucherBookingMobile({
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
  shippingCost
}: VoucherBookingMobileProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [showCTA, setShowCTA] = useState(false);
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

  useEffect(() => {
    const handleScroll = () => {
      setShowCTA(window.scrollY > 160);
    };

    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const handleSubmit = () => {
    if (validation || amount == null) {
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
    setIsOpen(false);
  };

  const safeAreaBottom = "env(safe-area-inset-bottom, 0)";
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
            className="relative mx-auto max-w-[var(--detail-content-max-width)] p-5"
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
                  <h2 className="heading-card">{title}</h2>
                  <p className="text-lg font-light text-base-content/80">
                    {amount != null ? EURO_FORMATTER.format(amount) : "–"}
                  </p>
                </div>

                <p className="text-sm leading-relaxed text-base-content/80">{description}</p>

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
                  </div>
                  {validation ? <p className="text-xs text-error">{validation}</p> : null}
                </div>
              </div>
            </div>

            <button
              type="button"
              className="btn btn-primary absolute left-5 right-5 h-[40px]"
              style={{
                bottom: `calc(${safeAreaBottom} + 20px)`
              }}
              onClick={() => {
                if (!isOpen) {
                  setIsOpen(true);
                } else {
                  handleSubmit();
                }
              }}
              disabled={Boolean(validation)}
            >
              {buttonText}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
