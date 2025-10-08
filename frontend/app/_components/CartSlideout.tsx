"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useCallback, useEffect } from "react";
import { useCart } from "./CartProvider";

const priceFormatter = new Intl.NumberFormat("de-DE", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 2,
});

const calendarIcon = (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    className="h-4 w-4"
    aria-hidden="true"
  >
    <rect x="3" y="4" width="18" height="17" rx="2" />
    <path d="M8 2v4M16 2v4M3 10h18" />
  </svg>
);

function renderImage(src: string, alt: string) {
  if (!src) {
    return (
      <div className="flex h-24 w-24 items-center justify-center rounded-xl bg-base-200 text-sm text-base-content/60">
        Kein Bild
      </div>
    );
  }

  return (
    <Image
      src={src}
      alt={alt}
      width={96}
      height={96}
      className="h-24 w-24 rounded-xl object-cover shadow-sm"
      priority={false}
    />
  );
}

export function CartSlideout() {
  const {
    items,
    isOpen,
    closeCart,
    incrementQuantity,
    decrementQuantity,
    removeItem,
    total,
  } = useCart();
  const router = useRouter();
  const checkoutDisabled = items.length === 0;

  const checkoutHandler = useCallback(() => {
    if (checkoutDisabled) {
      return;
    }
    closeCart();
    router.push("/checkout");
  }, [checkoutDisabled, closeCart, router]);

  useEffect(() => {
    if (isOpen) {
      document.body.classList.add("overflow-hidden");
      return () => {
        document.body.classList.remove("overflow-hidden");
      };
    }
    document.body.classList.remove("overflow-hidden");
    return undefined;
  }, [isOpen]);

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-40 flex">
      <button
        type="button"
        className="absolute inset-0 bg-base-content/30 backdrop-blur-sm"
        aria-label="Warenkorb schließen"
        onClick={closeCart}
      />
      <aside className="relative ml-auto flex h-full w-full max-w-xl flex-col bg-base-100 shadow-2xl">
        <header className="border-b border-base-200 px-8 pb-6 pt-8">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.2em] text-base-content/60">Ihr Einkauf</p>
              <h2 className="mt-2 text-3xl font-semibold text-base-content">Warenkorb</h2>
            </div>
            <button
              type="button"
              onClick={closeCart}
              className="btn btn-ghost btn-sm rounded-full"
              aria-label="Warenkorb schließen"
            >
              ×
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto px-8 py-6">
          {items.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center text-center text-base-content/70">
              <h3 className="text-xl font-semibold text-base-content">Ihr Warenkorb ist leer</h3>
              <p className="mt-2 max-w-xs text-sm">
                Fügen Sie Produkte oder Seminare hinzu, um mit dem Checkout fortzufahren.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {items.map((item) => (
                <article
                  key={item.id}
                  className="flex flex-col gap-6 rounded-3xl border border-base-200 bg-base-100 p-6 shadow-sm"
                >
                  <div className="flex flex-wrap gap-6">
                    {renderImage(item.imageUrl, item.title)}
                    <div className="flex min-w-[12rem] flex-1 flex-col gap-3">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <h3 className="text-lg font-semibold text-base-content">{item.title}</h3>
                          <p className="mt-1 text-sm text-base-content/70">{item.description}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeItem(item.id)}
                          className="btn btn-ghost btn-xs rounded-full text-base-content/60 hover:text-error"
                          aria-label={`${item.title} entfernen`}
                          title="Entfernen"
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.5"
                            className="h-4 w-4"
                            aria-hidden="true"
                          >
                            <path d="M3 6h18" />
                            <path d="M8 6V4h8v2" />
                            <path d="M10 11v6" />
                            <path d="M14 11v6" />
                            <path d="M5 6l1 14h12l1-14" />
                          </svg>
                        </button>
                      </div>

                      {item.type === "seminar" && item.seminarDays && item.seminarDays.length > 0 && (
                        <div className="rounded-2xl bg-base-200/60 p-4">
                          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-base-content/60">
                            {calendarIcon}
                            Seminartage
                          </p>
                          <ul className="mt-2 space-y-1 text-sm text-base-content/80">
                            {item.seminarDays.map((day) => (
                              <li key={day}>{day}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-6">
                    <div className="flex items-center gap-3">
                      <span className="text-sm uppercase tracking-widest text-base-content/60">Anzahl</span>
                      <div className="join">
                        <button
                          type="button"
                          className="btn join-item btn-ghost btn-sm"
                          onClick={() => decrementQuantity(item.id)}
                          aria-label={`${item.title} Anzahl verringern`}
                        >
                          -
                        </button>
                        <span className="join-item flex min-w-[3rem] items-center justify-center bg-base-200 text-sm font-semibold">
                          {item.quantity}
                        </span>
                        <button
                          type="button"
                          className="btn join-item btn-ghost btn-sm"
                          onClick={() => incrementQuantity(item.id)}
                          aria-label={`${item.title} Anzahl erhöhen`}
                        >
                          +
                        </button>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm uppercase tracking-widest text-base-content/60">Preis</p>
                      <p className="mt-1 text-xl font-semibold text-base-content">
                        {priceFormatter.format(item.price * item.quantity)}
                      </p>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>

        <footer className="border-t border-base-200 px-8 pb-8 pt-6">
          <div className="flex items-center justify-between text-lg font-semibold text-base-content">
            <span>Summe</span>
            <span>{priceFormatter.format(total)}</span>
          </div>
          <button
            type="button"
            className="btn btn-primary btn-lg mt-6 w-full"
            onClick={checkoutHandler}
            disabled={checkoutDisabled}
            aria-disabled={checkoutDisabled}
          >
            Jetzt bezahlen
          </button>
        </footer>
      </aside>
    </div>
  );
}
