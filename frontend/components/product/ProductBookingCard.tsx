"use client";

import { useEffect, useState } from "react";
import { QuantitySelector } from "@/components/shared/QuantitySelector";
import {
  PRODUCT_SELECTION_STORAGE_KEY,
  triggerProductBooking
} from "@/components/product/productBookingUtils";

type ProductBookingCardProps = {
  highlightLabel?: string;
  title: string;
  price: string;
  description: string;
  ctaLabel: string;
  className?: string;
  productSlug?: string;
  productTitle?: string;
  priceValue?: number | null;
  priceNetto?: number | null;
  steuerSatz?: number | null;
  priceFormatted?: string | null;
  isVoucher?: boolean;
  onSubmit?: (payload: { quantity: number }) => void;
};

export function ProductBookingCard({
  highlightLabel,
  title,
  price,
  description,
  ctaLabel,
  className = "",
  productSlug,
  productTitle,
  priceValue,
  priceNetto,
  steuerSatz,
  priceFormatted,
  isVoucher,
  onSubmit
}: ProductBookingCardProps) {
  const [quantity, setQuantity] = useState(1);

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
      // Persistenz optional; Fehler ignorieren.
    }
  }, [productSlug]);

  const handleSubmit = () => {
    if (onSubmit) {
      onSubmit({ quantity });
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
  };

  return (
    <article
      className={`flex w-full flex-col gap-6 rounded-box border ui-border bg-base-100/95 p-4 shadow-xl backdrop-blur-sm md:min-w-[360px] md:max-w-[360px] md:w-[360px] md:p-5 ${className}`.trim()}
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
        </div>

        <button type="button" className="btn btn-primary w-full" onClick={handleSubmit}>
          {ctaLabel}
        </button>
      </div>
    </article>
  );
}
