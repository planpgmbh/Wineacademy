"use client";

import { useEffect, useMemo, useState } from "react";
import { useCart, type CartItem } from "./CartProvider";

const currencyFormatter = new Intl.NumberFormat("de-DE", {
  style: "currency",
  currency: "EUR",
});

const formatCurrency = (value: number) => currencyFormatter.format(value);

type QuantityControlProps = {
  item: CartItem;
  onIncrement: (id: string) => void;
  onDecrement: (id: string) => void;
};

const baseShadow = "shadow-[0_1px_3px_rgba(0,0,0,0.12),0_1px_6px_rgba(0,0,0,0.08)]";
const panelShadow = "shadow-[0_4px_4px_rgba(0,0,0,0.15)]";
const panelShadowTop = "shadow-[0_-4px_4px_rgba(0,0,0,0.15)]";

function QuantityControl({ item, onIncrement, onDecrement }: QuantityControlProps) {
  return (
    <div className="flex min-w-[104px] items-center gap-0 rounded-full border border-[#e6e6e6] px-[6px] py-[4px]">
      <button
        type="button"
        className="flex h-[30px] w-[30px] items-center justify-center rounded-full border border-[#e6e6e6] text-base-content transition hover:border-base-300 hover:text-base-content"
        onClick={() => onDecrement(item.id)}
        aria-label={`${item.title} Menge verringern`}
      >
        <svg viewBox="0 0 12 12" fill="none" className="h-3 w-3">
          <path d="M2 6h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </button>
      <span className="w-8 text-center text-xs font-semibold leading-tight text-base-content">
        {item.quantity}
      </span>
      <button
        type="button"
        className="flex h-[30px] w-[30px] items-center justify-center rounded-full border border-[#e6e6e6] text-base-content transition hover:border-base-300 hover:text-base-content"
        onClick={() => onIncrement(item.id)}
        aria-label={`${item.title} Menge erhöhen`}
      >
        <svg viewBox="0 0 12 12" fill="none" className="h-3 w-3">
          <path d="M6 2v8M2 6h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </button>
    </div>
  );
}

type CartItemCardProps = {
  item: CartItem;
  onIncrement: (id: string) => void;
  onDecrement: (id: string) => void;
  onRemove: (id: string) => void;
};

function CartItemCard({ item, onIncrement, onDecrement, onRemove }: CartItemCardProps) {
  const hasSeminarDays = item.type === "seminar" && item.seminarDays && item.seminarDays.length > 0;
  const hasDescription = Boolean(item.description && item.description.trim().length > 0);
  const descriptionLabel = hasSeminarDays ? "Seminartage" : null;
  const showQuantityControl = item.quantityEditable !== false;

  return (
    <article className={`rounded-2xl bg-white p-5 ${baseShadow}`}>
      <div className="flex items-start gap-4">
        <div className="relative h-[90px] w-[90px] shrink-0 overflow-hidden rounded-2xl bg-base-300">
          {/* Die Bildquelle kann aus Strapi oder Platzhaltern stammen; Next/Image wäre hier ohne zusätzliche Remote-Konfiguration nicht einsetzbar. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={item.imageUrl || "/placeholder.png"}
            alt={item.title}
            className="h-full w-full object-cover"
            loading="lazy"
          />
        </div>
        <div className="flex flex-1 flex-col gap-4">
          <div className="flex items-start justify-between gap-4">
            <h3 className="flex-1 text-base font-semibold leading-6 text-base-content">{item.title}</h3>
            <button
              type="button"
              onClick={() => onRemove(item.id)}
              aria-label={`${item.title} aus Warenkorb entfernen`}
              className="flex h-8 w-8 items-center justify-center rounded-full text-base-content/70 transition hover:text-base-content"
            >
              {/* SVG-Icon aus dem öffentlichen Icon-Verzeichnis, damit es konsistent mehrfach genutzt werden kann. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/icons/trash3.svg"
                alt=""
                aria-hidden="true"
                className="h-5 w-[18px]"
                loading="lazy"
              />
            </button>
          </div>
          <div className="flex-1">
            {hasSeminarDays && (
              <div className="mt-3 space-y-1.5">
                <p className="text-sm font-semibold text-base-content/70">
                  {descriptionLabel}
                </p>
                <ul className="space-y-1 text-sm text-base-content/80">
                  {item.seminarDays!.map((day) => (
                    <li key={day}>{day}</li>
                  ))}
                </ul>
              </div>
            )}
            {!hasSeminarDays && hasDescription && (
              <p className="mt-2 text-sm leading-6 text-base-content/80">{item.description}</p>
            )}
          </div>

          {showQuantityControl ? (
            <div className="flex items-center justify-between gap-4">
              <QuantityControl item={item} onIncrement={onIncrement} onDecrement={onDecrement} />
              <span className="text-base font-semibold text-base-content">
                {formatCurrency(item.price)}
              </span>
            </div>
          ) : (
            <div className="flex justify-end">
              <span className="text-base font-semibold text-base-content">
                {formatCurrency(item.price)}
              </span>
            </div>
          )}
        </div>
      </div>
    </article>
  );
}

function CartSlideoutEmpty() {
  return (
    <div className="flex flex-1 items-center justify-center px-6 text-center text-base-content/70">
      <div className="space-y-2">
        <p className="text-base font-semibold">Dein Warenkorb ist leer</p>
        <p className="text-sm leading-6">Füge Produkte oder Seminare hinzu, um hier fortzufahren.</p>
      </div>
    </div>
  );
}

export function CartSlideout() {
  const {
    isOpen,
    closeCart,
    items,
    incrementQuantity,
    decrementQuantity,
    removeItem,
    total,
  } = useCart();

  const [shouldRender, setShouldRender] = useState(isOpen);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setShouldRender(true);
    } else {
      const timeout = window.setTimeout(() => {
        setShouldRender(false);
      }, 250);
      return () => window.clearTimeout(timeout);
    }
    return undefined;
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      const raf = window.requestAnimationFrame(() => {
        setIsVisible(true);
      });
      return () => window.cancelAnimationFrame(raf);
    }
    setIsVisible(false);
    return undefined;
  }, [isOpen]);

  useEffect(() => {
    if (shouldRender) {
      document.body.classList.add("overflow-hidden");
      return () => {
        document.body.classList.remove("overflow-hidden");
      };
    }
    document.body.classList.remove("overflow-hidden");
    return undefined;
  }, [shouldRender]);

  const hasItems = items.length > 0;

  const sumLabel = useMemo(
    () => (hasItems ? formatCurrency(total) : formatCurrency(0)),
    [hasItems, total],
  );

  if (!shouldRender) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-40 flex items-stretch justify-end">
      <button
        type="button"
        className={`absolute inset-0 cursor-pointer bg-black/50 transition-opacity duration-300 ease-out ${isVisible ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}`}
        onClick={closeCart}
        aria-label="Warenkorb schließen"
      />
      <aside
        className={`relative z-10 flex h-full w-full max-w-[400px] flex-col bg-[#eeeeee] transition-transform duration-300 ease-out ${isVisible ? "translate-x-0" : "translate-x-full"}`}
      >
        <header className={`relative flex h-16 items-center justify-center bg-white px-4 ${panelShadow}`}>
          <h2 className="text-center text-xl font-semibold text-base-content">Warenkorb</h2>
          <button
            type="button"
            onClick={closeCart}
            aria-label="Warenkorb schließen"
            className="absolute right-4 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center text-base-content/70 transition hover:text-base-content"
          >
            <svg viewBox="0 0 20 20" fill="none" className="h-5 w-5">
              <path d="M5 5l10 10M15 5 5 15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          {hasItems ? (
            items.map((item) => (
              <CartItemCard
                key={item.id}
                item={item}
                onIncrement={incrementQuantity}
                onDecrement={decrementQuantity}
                onRemove={removeItem}
              />
            ))
          ) : (
            <CartSlideoutEmpty />
          )}
        </div>

        <footer className={`bg-white px-6 py-6 ${panelShadowTop}`}>
          <div className="flex items-center justify-between pb-6">
            <span className="text-lg font-semibold text-base-content">Summe</span>
            <span className="text-lg font-semibold text-base-content">{sumLabel}</span>
          </div>
          <button
            type="button"
            className="btn h-14 w-full rounded-[4px] border-0 bg-[#8bb5d7] text-lg font-semibold text-white normal-case transition hover:bg-[#7aa6ce] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#568fc0]"
          >
            Weiter zur Kasse
          </button>
        </footer>
      </aside>
    </div>
  );
}
