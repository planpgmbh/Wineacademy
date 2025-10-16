"use client";

import { CartItemGutschein } from "./CartItemGutschein";
import { CartItemProduct } from "./CartItemProduct";
import { CartItemSeminar } from "./CartItemSeminar";

type CartDrawerProps = {
  id: string;
  open: boolean;
  onClose: () => void;
};

export function CartDrawer({ id, open, onClose }: CartDrawerProps) {
  return (
    <div className="drawer drawer-end">
      <input id={id} type="checkbox" className="drawer-toggle" checked={open} readOnly />
      <div className="drawer-content" />
      <div className="drawer-side">
        <label htmlFor={id} className="drawer-overlay" onClick={onClose} />
        <aside className="flex h-full w-96 max-w-full flex-col bg-base-100 shadow-xl">
          <header className="relative z-10 flex items-center justify-center border-b border-base-300 bg-base-100 px-6 py-4 shadow-[0_10px_16px_-14px_rgba(15,23,42,0.5)]">
            <div className="absolute right-6">
              <button type="button" aria-label="Schließen" className="btn btn-ghost btn-sm" onClick={onClose}>
                ✕
              </button>
            </div>
            <h2 className="text-lg font-semibold">Warenkorb</h2>
          </header>
          <div className="flex-1 overflow-y-auto bg-base-200 px-4 py-4">
            <div className="flex flex-col gap-4">
              <CartItemSeminar />
              <CartItemProduct />
              <CartItemGutschein />
            </div>
          </div>
          <footer className="relative z-10 flex flex-col gap-4 border-t border-base-300 bg-base-100 px-6 py-6 shadow-[0_-10px_16px_-14px_rgba(15,23,42,0.5)]">
            <dl className="flex justify-between text-base font-semibold">
              <dt>Summe</dt>
              <dd className="text-base font-semibold">98,90 €</dd>
            </dl>
            <button type="button" className="btn btn-primary btn-lg rounded-full">Weiter zur Kasse</button>
          </footer>
        </aside>
      </div>
    </div>
  );
}
