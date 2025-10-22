"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { removeBookingSelection, setBookingSelectionQuantity } from "@/components/seminar/bookingUtils";
import { CartItemSeminar } from "./CartItemSeminar";
import { CartItemProduct } from "./CartItemProduct";
import { CartItemGutschein } from "./CartItemGutschein";
import { useCartData } from "./useCartData";

type CartDrawerProps = {
  id: string;
  open: boolean;
  onClose: () => void;
};

const PRODUCT_SELECTION_STORAGE_KEY = "cart:productSelection";
const VOUCHER_SELECTION_STORAGE_KEY = "voucher:lastSelection";

function updateStoredProductSelection(
  updater: (current: Record<string, unknown> | null) => Record<string, unknown> | null
) {
  if (typeof window === "undefined") {
    return null;
  }

  let current: Record<string, unknown> | null = null;
  try {
    const raw = window.localStorage.getItem(PRODUCT_SELECTION_STORAGE_KEY);
    current = raw ? JSON.parse(raw) : null;
  } catch {
    current = null;
  }

  const next = updater(current);

  try {
    if (next) {
      window.localStorage.setItem(PRODUCT_SELECTION_STORAGE_KEY, JSON.stringify(next));
    } else {
      window.localStorage.removeItem(PRODUCT_SELECTION_STORAGE_KEY);
    }
  } catch (error) {
    console.warn("[cart] Konnte Produktauswahl nicht speichern:", error);
  }

  if (typeof document !== "undefined") {
    document.dispatchEvent(new CustomEvent("product:pending", { detail: next ?? null }));
  }

  return next;
}

function clearStoredVoucherSelection() {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.localStorage.removeItem(VOUCHER_SELECTION_STORAGE_KEY);
  } catch (error) {
    console.warn("[cart] Konnte Gutschein-Auswahl nicht entfernen:", error);
  }

  if (typeof document !== "undefined") {
    document.dispatchEvent(new CustomEvent("voucher:pending", { detail: null }));
  }
}

export function CartDrawer({ id, open, onClose }: CartDrawerProps) {
  const { status, data } = useCartData();
  const [productQuantity, setProductQuantity] = useState(() => data.productSelection?.quantity ?? 1);
  const router = useRouter();
  const seminarEntries = data.seminars;

  useEffect(() => {
    setProductQuantity(data.productSelection?.quantity ?? 1);
  }, [data.productSelection?.quantity]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const voucherCount = data.voucher ? 1 : 0;
    const seminarCount = seminarEntries.reduce((sum, entry) => sum + Math.max(0, entry.selection.quantity ?? 0), 0);
    const count = seminarCount + (data.product ? productQuantity : 0) + voucherCount;
    document.dispatchEvent(new CustomEvent("cart:set", { detail: { count } }));
  }, [seminarEntries, data.product, data.voucher, productQuantity]);

  const totalFormatted = useMemo(() => {
    const seminarTotal = seminarEntries.reduce((sum, entry) => {
      const price = entry.seminar?.price.value ?? 0;
      const quantity = Math.max(0, entry.selection.quantity ?? 0);
      return sum + price * quantity;
    }, 0);
    const productTotal = (data.product?.price.value ?? 0) * productQuantity;
    const voucherTotal = data.voucher?.amount ?? 0;
    const sum = seminarTotal + productTotal + voucherTotal;
    if (!Number.isFinite(sum) || sum <= 0) {
      return "–";
    }
    return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(sum);
  }, [data.product?.price.value, seminarEntries, data.voucher?.amount, productQuantity]);

  const handleSeminarQuantityChange = useCallback((selectionId: string, quantity: number) => {
    setBookingSelectionQuantity(selectionId, quantity);
  }, []);

  const handleSeminarRemove = useCallback((selectionId: string) => {
    removeBookingSelection(selectionId);
  }, []);

  const handleProductQuantityChange = useCallback(
    (quantity: number) => {
      if (!data.product) {
        setProductQuantity(1);
        return;
      }

      const nextQuantity = Math.max(1, quantity);
      setProductQuantity(nextQuantity);

      updateStoredProductSelection((current) => {
        const base = (current && typeof current === "object") ? current : {};
        const slug =
          data.product?.slug ??
          data.productSelection?.productSlug ??
          (typeof (base as { slug?: unknown }).slug === "string" ? (base as { slug?: string }).slug : null);
        const createdAt =
          typeof (base as { createdAt?: unknown }).createdAt === "string"
            ? (base as { createdAt?: string }).createdAt
            : new Date().toISOString();
        const priceValue =
          data.product?.price.value ??
          data.productSelection?.priceValue ??
          (typeof (base as { priceValue?: unknown }).priceValue === "number"
            ? (base as { priceValue?: number }).priceValue
            : null);
        const priceNetto =
          data.product?.priceNetto ??
          data.productSelection?.priceNetto ??
          (typeof (base as { priceNetto?: unknown }).priceNetto === "number"
            ? (base as { priceNetto?: number }).priceNetto
            : null);
        const priceFormatted =
          data.product?.price.formatted ??
          data.productSelection?.priceFormatted ??
          (typeof (base as { priceFormatted?: unknown }).priceFormatted === "string"
            ? (base as { priceFormatted?: string }).priceFormatted
            : null);
        const steuerSatz =
          data.product?.steuerSatz ??
          data.productSelection?.steuerSatz ??
          (typeof (base as { steuerSatz?: unknown }).steuerSatz === "number"
            ? (base as { steuerSatz?: number }).steuerSatz
            : null);

        return {
          ...base,
          type: "product",
          slug,
          productSlug: slug,
          title:
            data.product?.title ??
            data.productSelection?.productTitle ??
            ((base as { title?: unknown }).title as string | null | undefined) ??
            null,
          quantity: nextQuantity,
          priceValue,
          priceNetto,
          priceFormatted,
          steuerSatz,
          isVoucher:
            data.product?.isVoucher ??
            data.productSelection?.isVoucher ??
            Boolean((base as { isVoucher?: unknown }).isVoucher),
          createdAt,
          updatedAt: new Date().toISOString()
        };
      });
    },
    [
      data.product,
      data.productSelection?.isVoucher,
      data.productSelection?.priceFormatted,
      data.productSelection?.priceNetto,
      data.productSelection?.priceValue,
      data.productSelection?.productSlug,
      data.productSelection?.productTitle,
      data.productSelection?.steuerSatz
    ]
  );

  const handleProductRemove = useCallback(() => {
    setProductQuantity(1);
    updateStoredProductSelection(() => null);
  }, []);

  const handleVoucherRemove = useCallback(() => {
    clearStoredVoucherSelection();
  }, []);

  const hasSeminarSelections = seminarEntries.some((entry) => (entry.selection.quantity ?? 0) > 0);
  const canCheckout = Boolean(
    hasSeminarSelections || (data.product && productQuantity > 0) || data.voucher
  );

  const handleCheckoutClick = useCallback(() => {
    if (!canCheckout) {
      return;
    }

    if (typeof document !== "undefined") {
      document.dispatchEvent(new CustomEvent("cart:close"));
    }

    onClose();
    router.push("/checkout");
  }, [canCheckout, onClose, router]);

  const isLoading = status === "loading" && seminarEntries.length === 0 && !data.product && !data.voucher;
  const hasError = status === "error";

  return (
    <div className="drawer drawer-end">
      <input id={id} type="checkbox" className="drawer-toggle" checked={open} readOnly />
      <div className="drawer-content" />
      <div className="drawer-side z-[9999]">
        <label htmlFor={id} className="drawer-overlay z-[9998]" onClick={onClose} />
        <aside className="relative z-[9999] flex h-full w-96 max-w-full flex-col bg-base-100 shadow-xl">
          <header className="relative z-10 flex items-center justify-between ui-border-bottom bg-base-100 px-6 py-4 shadow-[0_10px_16px_-14px_rgba(15,23,42,0.5)]">
            <h2 className="text-lg font-semibold">Warenkorb</h2>
            <button type="button" aria-label="Schließen" className="btn btn-ghost btn-sm" onClick={onClose}>
              ✕
            </button>
          </header>
          <div className="flex-1 overflow-y-auto bg-base-300 px-4 py-4">
            {isLoading ? (
              <div className="flex flex-col gap-4">
                {[0, 1, 2].map((key) => (
                  <div key={key} className="h-32 animate-pulse rounded-2xl bg-base-300" />
                ))}
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                {hasError ? (
                  <div className="rounded-2xl bg-error/10 p-6 text-sm text-error">
                    Der Warenkorb konnte nicht geladen werden. Bitte Seite neu laden oder später erneut versuchen.
                  </div>
                ) : null}
                {seminarEntries.length > 0
                  ? seminarEntries.map((entry) => (
                      <CartItemSeminar
                        key={entry.selection.id}
                        seminar={entry.seminar}
                        selection={entry.selection}
                        onQuantityChange={(nextQuantity) => handleSeminarQuantityChange(entry.selection.id, nextQuantity)}
                        onRemove={() => handleSeminarRemove(entry.selection.id)}
                      />
                    ))
                  : null}
                {data.product ? (
                  <CartItemProduct
                    product={{
                      id: data.product.id,
                      title: data.product.title,
                      description: data.product.description,
                      price: data.product.price,
                      imageUrl: data.product.imageUrl,
                      imageAlt: data.product.imageAlt
                    }}
                    quantity={productQuantity}
                    onQuantityChange={handleProductQuantityChange}
                    onRemove={handleProductRemove}
                  />
                ) : null}
                {data.voucher ? (
                  <CartItemGutschein
                    voucher={{
                      title: data.voucher.title,
                      description: data.voucher.description,
                      formattedValue: data.voucher.formattedValue,
                      imageUrl: data.voucher.imageUrl,
                      imageAlt: data.voucher.imageAlt
                    }}
                    onRemove={handleVoucherRemove}
                  />
                ) : null}
              </div>
            )}
          </div>
          <footer className="relative z-10 flex flex-col gap-4 ui-border-top bg-base-100 px-6 py-6 shadow-[0_-10px_16px_-14px_rgba(15,23,42,0.5)]">
            <dl className="flex justify-between text-base font-semibold">
              <dt>Summe</dt>
              <dd className="text-base font-semibold">{totalFormatted}</dd>
            </dl>
            <button
              type="button"
              className="btn btn-primary btn-lg"
              disabled={!canCheckout}
              onClick={handleCheckoutClick}
            >
              Weiter zur Kasse
            </button>
          </footer>
        </aside>
      </div>
    </div>
  );
}
