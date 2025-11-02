"use client";
import { useEffect, useMemo, useState } from "react";

import { QuantitySelector } from "../shared/QuantitySelector";

type CartItemProductProps = {
  product: {
    id: number;
    title: string;
    description?: string | null;
    price?: { value: number | null; formatted: string | null } | null;
    imageUrl: string | null;
    imageAlt: string | null;
  } | null;
  quantity?: number;
  onQuantityChange?: (quantity: number) => void;
  onRemove?: () => void;
};

export function CartItemProduct({ product, quantity = 1, onQuantityChange, onRemove }: CartItemProductProps) {
  const [internalQuantity, setInternalQuantity] = useState(() => Math.max(1, Math.trunc(quantity)));

  useEffect(() => {
    setInternalQuantity(Math.max(1, Math.trunc(quantity)));
  }, [quantity]);

  useEffect(() => {
    if (!product) {
      setInternalQuantity(1);
    }
  }, [product]);

  const totalPriceFormatted = useMemo(() => {
    if (!product) {
      return "Preis auf Anfrage";
    }
    const unitPrice = product.price?.value ?? null;
    if (unitPrice == null || !Number.isFinite(unitPrice) || unitPrice <= 0) {
      return product.price?.formatted ?? "Preis auf Anfrage";
    }
    const total = unitPrice * internalQuantity;
    if (!Number.isFinite(total) || total <= 0) {
      return product.price?.formatted ?? "Preis auf Anfrage";
    }
    return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(total);
  }, [internalQuantity, product]);

  if (!product) {
    return null;
  }

  const handleQuantityChange = (value: number) => {
    const next = Math.max(1, value);
    setInternalQuantity(next);
    if (product) {
      onQuantityChange?.(next);
    }
  };

  return (
    <article className="relative flex flex-col gap-3 rounded-2xl bg-base-100 p-4 shadow-sm">
      <button
        type="button"
        aria-label="Entfernen"
        className="btn btn-ghost btn-circle btn-xs absolute right-3 top-3"
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
      <header className="flex flex-col gap-2 pr-8">
        <h3 className="heading-label">
          {product.title}
        </h3>
        <p className="text-sm text-base-content/80">
          {product.description ?? "Aktuell keine Beschreibung verfügbar."}
        </p>
      </header>
      <footer className="flex items-center justify-between pt-1">
        <div className="flex items-center gap-3">
          <QuantitySelector value={internalQuantity} onChange={handleQuantityChange} />
        </div>
        <span className="text-base font-semibold">
          {totalPriceFormatted}
        </span>
      </footer>
    </article>
  );
}
