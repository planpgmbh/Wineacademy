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
  ctaLabel: string;
  productSlug?: string;
  productTitle?: string;
  priceValue?: number | null;
  priceFormatted?: string | null;
  isVoucher?: boolean;
  onSubmit?: (payload: { quantity: number }) => void;
};

export function ProductBookingMobile({
  highlightLabel,
  title,
  price,
  description,
  ctaLabel,
  productSlug,
  productTitle,
  priceValue,
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
      priceFormatted: priceFormatted ?? price,
      isVoucher
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
