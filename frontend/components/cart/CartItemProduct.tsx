"use client";

import Image from "next/image";
import { useState } from "react";

export function CartItemProduct() {
  const [quantity, setQuantity] = useState(1);

  const decrease = () => setQuantity((prev) => Math.max(1, prev - 1));
  const increase = () => setQuantity((prev) => prev + 1);

  return (
    <article className="relative flex items-start gap-4 rounded-2xl bg-base-100 p-4 shadow-sm">
      <button
        type="button"
        aria-label="Entfernen"
        className="btn btn-ghost btn-circle btn-xs absolute right-3 top-3"
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
      <div className="relative size-20 flex-shrink-0 overflow-hidden rounded-2xl bg-primary/10">
        <Image
          src="https://picsum.photos/seed/product/200"
          alt="Produkt"
          fill
          sizes="80px"
          className="object-cover"
          unoptimized
        />
      </div>
      <div className="flex flex-1 flex-col gap-3 pr-4">
        <header className="flex items-start justify-between gap-2">
          <h3 className="text-base font-semibold leading-snug">Cart Item Product</h3>
        </header>
        <p className="text-sm text-base-content/80">Hier die Beschreibung</p>
        <footer className="flex items-center justify-start">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1 rounded-full border border-base-300 bg-base-100 px-2 py-1">
              <button
                type="button"
                className="flex size-8 items-center justify-center rounded-full border border-base-300 text-lg leading-none transition-colors hover:bg-base-200"
                onClick={decrease}
                aria-label="Menge verringern"
              >
                −
              </button>
              <span className="min-w-[1.5rem] text-center text-sm font-medium">{quantity}</span>
              <button
                type="button"
                className="flex size-8 items-center justify-center rounded-full border border-base-300 text-lg leading-none transition-colors hover:bg-base-200"
                onClick={increase}
                aria-label="Menge erhöhen"
              >
                +
              </button>
            </div>
          </div>
        </footer>
        <p className="absolute bottom-4 right-4 text-base font-semibold">98,90 €</p>
      </div>
    </article>
  );
}
