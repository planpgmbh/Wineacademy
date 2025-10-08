"use client";

import { useMemo } from "react";
import { useCart } from "./CartProvider";

export function CartButton() {
  const { items, openCart } = useCart();

  const cartCount = useMemo(
    () => items.reduce((sum, item) => sum + item.quantity, 0),
    [items],
  );

  const badgeLabel = cartCount > 99 ? "99+" : `${cartCount}`;
  const ariaLabel =
    cartCount > 0
      ? `Warenkorb öffnen, ${badgeLabel} Artikel im Warenkorb`
      : "Warenkorb öffnen";

  return (
    <button
      type="button"
      className="btn btn-ghost btn-circle"
      aria-label={ariaLabel}
      onClick={openCart}
    >
      <div className="indicator">
        {cartCount > 0 && (
          <span className="indicator-item badge badge-secondary badge-sm">{badgeLabel}</span>
        )}
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-6 w-6"
          aria-hidden="true"
        >
          <path d="M3 3h2l.4 2M7 13h10l3-7H5.4" />
          <path d="M7 13l-1.35 2.7A1 1 0 0 0 6.58 17H17" />
          <circle cx="9" cy="19" r="1" />
          <circle cx="17" cy="19" r="1" />
        </svg>
      </div>
    </button>
  );
}
