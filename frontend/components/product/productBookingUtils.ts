"use client";

export const PRODUCT_SELECTION_STORAGE_KEY = "cart:productSelection";

export type ProductBookingSelection = {
  quantity: number;
  productSlug?: string | null;
  productTitle?: string | null;
  priceValue?: number | null;
  priceFormatted?: string | null;
  isVoucher?: boolean;
};

export function triggerProductBooking(selection: ProductBookingSelection) {
  const quantity = Math.max(1, Math.trunc(selection.quantity));
  const slug = selection.productSlug ?? null;
  const payload = {
    type: "product" as const,
    slug,
    productSlug: slug,
    title: selection.productTitle ?? null,
    quantity,
    priceValue: typeof selection.priceValue === "number" ? selection.priceValue : null,
    priceFormatted: selection.priceFormatted ?? null,
    isVoucher: Boolean(selection.isVoucher),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  try {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(PRODUCT_SELECTION_STORAGE_KEY, JSON.stringify(payload));
    }
  } catch {
    // Speicherung optional – Fehler werden ignoriert.
  }

  if (typeof document !== "undefined") {
    document.dispatchEvent(new CustomEvent("product:pending", { detail: payload }));
    document.dispatchEvent(new CustomEvent("cart:add", { detail: { amount: quantity, item: payload } }));
    document.dispatchEvent(new CustomEvent("cart:toggle"));
  }
}
