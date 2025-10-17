"use client";

import { CartItemGutschein } from "./CartItemGutschein";
import { CartItemProduct } from "./CartItemProduct";
import { CartItemSeminar } from "./CartItemSeminar";
import { useCartData } from "./useCartData";
import { useEffect, useMemo, useState } from "react";

type CartDrawerProps = {
  id: string;
  open: boolean;
  onClose: () => void;
};

export function CartDrawer({ id, open, onClose }: CartDrawerProps) {
  const { status, data } = useCartData();
  const [seminarQuantity, setSeminarQuantity] = useState(() => data.selection?.quantity ?? 1);
  const [productQuantity, setProductQuantity] = useState(1);
  const [voucherQuantity, setVoucherQuantity] = useState(1);

  useEffect(() => {
    setSeminarQuantity(data.selection?.quantity ?? 1);
  }, [data.selection?.quantity]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const count =
      (data.seminar ? seminarQuantity : 0) +
      (data.product ? productQuantity : 0) +
      (data.voucher ? voucherQuantity : 0);
    document.dispatchEvent(new CustomEvent("cart:set", { detail: { count } }));
  }, [data.product, data.seminar, data.voucher, productQuantity, seminarQuantity, voucherQuantity]);

  const totalFormatted = useMemo(() => {
    const seminarTotal = (data.seminar?.price.value ?? 0) * seminarQuantity;
    const productTotal = (data.product?.price.value ?? 0) * productQuantity;
    const voucherValue = data.voucher?.value ?? 0;
    const voucherTotal = voucherValue * voucherQuantity;
    const sum = seminarTotal + productTotal + voucherTotal;
    if (!Number.isFinite(sum) || sum <= 0) {
      return "–";
    }
    return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(sum);
  }, [data.product?.price.value, data.seminar?.price.value, data.voucher?.value, productQuantity, seminarQuantity, voucherQuantity]);

  const handleSeminarQuantityChange = (quantity: number) => {
    const nextQuantity = Math.max(1, quantity);
    setSeminarQuantity(nextQuantity);
    if (typeof window !== "undefined") {
      try {
        const raw = window.localStorage.getItem("booking:lastSelection");
        const parsed = raw ? JSON.parse(raw) : {};
        window.localStorage.setItem(
          "booking:lastSelection",
          JSON.stringify({ ...parsed, quantity: nextQuantity, slug: data.seminar?.slug ?? parsed.slug ?? null })
        );
      } catch {
        // Ignoriert: Persistenz optional.
      }
    }
  };

  const isLoading = status === "loading" && !data.seminar && !data.product && !data.voucher;

  return (
    <div className="drawer drawer-end">
      <input id={id} type="checkbox" className="drawer-toggle" checked={open} readOnly />
      <div className="drawer-content" />
      <div className="drawer-side z-[9999]">
        <label htmlFor={id} className="drawer-overlay z-[9998]" onClick={onClose} />
        <aside className="relative z-[9999] flex h-full w-96 max-w-full flex-col bg-base-100 shadow-xl">
          <header className="relative z-10 flex items-center justify-center border-b border-base-300 bg-base-100 px-6 py-4 shadow-[0_10px_16px_-14px_rgba(15,23,42,0.5)]">
            <div className="absolute right-6">
              <button type="button" aria-label="Schließen" className="btn btn-ghost btn-sm" onClick={onClose}>
                ✕
              </button>
            </div>
            <h2 className="text-lg font-semibold">Warenkorb</h2>
          </header>
          <div className="flex-1 overflow-y-auto bg-base-200 px-4 py-4">
            {isLoading ? (
              <div className="flex flex-col gap-4">
                {[0, 1, 2].map((key) => (
                  <div key={key} className="h-32 animate-pulse rounded-2xl bg-base-300" />
                ))}
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                <CartItemSeminar seminar={data.seminar} selection={data.selection} onQuantityChange={handleSeminarQuantityChange} />
                <CartItemProduct product={data.product} onQuantityChange={setProductQuantity} />
                <CartItemGutschein voucher={data.voucher} />
              </div>
            )}
          </div>
          <footer className="relative z-10 flex flex-col gap-4 border-t border-base-300 bg-base-100 px-6 py-6 shadow-[0_-10px_16px_-14px_rgba(15,23,42,0.5)]">
            <dl className="flex justify-between text-base font-semibold">
              <dt>Summe</dt>
              <dd className="text-base font-semibold">{totalFormatted}</dd>
            </dl>
            <button type="button" className="btn btn-primary btn-lg">Weiter zur Kasse</button>
          </footer>
        </aside>
      </div>
    </div>
  );
}
