"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const CART_STORAGE_KEYS = ["wineacademy-cart", "wineacademy.cart", "cart"];
const CART_UPDATE_EVENT = "wineacademy:cart:update";

type CartLike =
  | { items?: unknown }
  | { products?: unknown }
  | { length?: number }
  | Array<unknown>;

const parseCartCount = (value: unknown): number => {
  if (!value) {
    return 0;
  }

  if (Array.isArray(value)) {
    return value.reduce<number>((acc, item) => {
      if (item && typeof item === "object" && "quantity" in item) {
        const quantity = Number((item as { quantity?: unknown }).quantity);
        return acc + (Number.isFinite(quantity) ? quantity : 1);
      }
      return acc + 1;
    }, 0);
  }

  if (typeof value === "object") {
    if ("items" in value && Array.isArray((value as { items?: CartLike }).items)) {
      return parseCartCount((value as { items?: CartLike }).items);
    }
    if ("products" in value && Array.isArray((value as { products?: CartLike }).products)) {
      return parseCartCount((value as { products?: CartLike }).products);
    }
    if (typeof (value as { length?: unknown }).length === "number") {
      return Number((value as { length?: number }).length);
    }
  }

  if (typeof value === "number") {
    return value;
  }

  if (typeof value === "string") {
    const parsedNumber = Number(value);
    return Number.isFinite(parsedNumber) ? parsedNumber : 0;
  }

  return 0;
};

const readCartCount = (): number => {
  if (typeof window === "undefined") {
    return 0;
  }

  for (const key of CART_STORAGE_KEYS) {
    try {
      const rawValue = window.localStorage.getItem(key);
      if (!rawValue) {
        continue;
      }

      try {
        const parsed = JSON.parse(rawValue) as CartLike;
        const count = parseCartCount(parsed);
        if (count > 0) {
          return count;
        }
      } catch {
        const numeric = Number(rawValue);
        if (Number.isFinite(numeric) && numeric > 0) {
          return numeric;
        }
      }
    } catch {
      // Ignorieren – bei Zugriffproblemen einfach weiterprobieren.
    }
  }

  return 0;
};

export function CartButton() {
  const [cartCount, setCartCount] = useState(0);

  useEffect(() => {
    setCartCount(readCartCount());

    const handleStorage = (event: StorageEvent) => {
      if (!event.key || CART_STORAGE_KEYS.includes(event.key)) {
        setCartCount(readCartCount());
      }
    };

    const handleCartEvent = (event: Event) => {
      const customEvent = event as CustomEvent<{ count?: number }>;
      if (customEvent.detail && typeof customEvent.detail.count === "number") {
        setCartCount(Math.max(0, Math.floor(customEvent.detail.count)));
      } else {
        setCartCount(readCartCount());
      }
    };

    window.addEventListener("storage", handleStorage);
    window.addEventListener(CART_UPDATE_EVENT, handleCartEvent as EventListener);

    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener(CART_UPDATE_EVENT, handleCartEvent as EventListener);
    };
  }, []);

  const badgeLabel = cartCount > 99 ? "99+" : `${cartCount}`;
  const ariaLabel =
    cartCount > 0
      ? `Warenkorb öffnen, ${badgeLabel} Artikel im Warenkorb`
      : "Warenkorb öffnen";

  return (
    <Link
      href="/checkout"
      className="btn btn-ghost btn-circle"
      aria-label={ariaLabel}
      prefetch={false}
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
    </Link>
  );
}
