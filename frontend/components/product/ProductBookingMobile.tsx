"use client";

import { useEffect, useState } from "react";

import { QuantitySelector } from "@/components/shared/QuantitySelector";
import {
  PRODUCT_SELECTION_STORAGE_KEY,
  triggerProductBooking
} from "@/components/product/productBookingUtils";

type ProductBookingMobileProps = {
  highlightLabel?: string;
  title: string;
  price: string;
  description: string;
  buttonText: string;
  productSlug?: string;
  productTitle?: string;
  priceValue?: number | null;
  priceNetto?: number | null;
  steuerSatz?: number | null;
  priceFormatted?: string | null;
  isVoucher?: boolean;
  onSubmit?: (payload: { quantity: number }) => void;
};

export function ProductBookingMobile({
  highlightLabel,
  title,
  price,
  description,
  buttonText,
  productSlug,
  productTitle,
  priceValue,
  priceNetto,
  steuerSatz,
  priceFormatted,
  isVoucher,
  onSubmit
}: ProductBookingMobileProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [showCTA, setShowCTA] = useState(false);
  const [quantity, setQuantity] = useState(1);

  useEffect(() => {
    const handleScroll = () => {
      setShowCTA(window.scrollY > 160);
    };

    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || !productSlug) {
      return;
    }

    try {
      const raw = window.localStorage.getItem(PRODUCT_SELECTION_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object") return;

      const storedSlug =
        typeof parsed.slug === "string"
          ? parsed.slug
          : typeof parsed.productSlug === "string"
            ? parsed.productSlug
            : null;

      if (!storedSlug || storedSlug !== productSlug) return;

      if (typeof parsed.quantity === "number" && Number.isFinite(parsed.quantity)) {
        setQuantity(Math.max(1, Math.trunc(parsed.quantity)));
      }
    } catch {
      // Ignoriert – Vorbelegung optional.
    }
  }, [productSlug]);

  const safeAreaBottom = "env(safe-area-inset-bottom, 0)";

  const handleButtonClick = () => {
    if (!isOpen) {
      setIsOpen(true);
      return;
    }

    if (onSubmit) {
      onSubmit({ quantity });
      setIsOpen(false);
      return;
    }

    triggerProductBooking({
      quantity,
      productSlug,
      productTitle: productTitle ?? title,
      priceValue,
      priceNetto,
      steuerSatz,
      priceFormatted: priceFormatted ?? price,
      isVoucher
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
        <div className="booking-sheet-panel mx-auto max-w-[var(--detail-content-max-width)] space-y-4 p-5">
          <div className="relative">
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
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-center pb-[calc(env(safe-area-inset-bottom,0)+12px)]">
            <button
              type="button"
              className="booking-sheet-cta btn btn-primary w-full max-w-sm h-[52px] text-base mb-2"
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
