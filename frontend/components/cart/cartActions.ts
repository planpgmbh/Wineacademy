"use client";

import { PRODUCT_SELECTION_STORAGE_KEY } from "@/components/product/productBookingUtils";
import { VOUCHER_SELECTION_STORAGE_KEY } from "@/components/voucher/voucherBookingUtils";
import { normaliseShippingInput } from "@/lib/shipping";

type ProductSelectionRecord = Record<string, unknown> | null;

export function updateStoredProductSelection(
  updater: (current: ProductSelectionRecord) => ProductSelectionRecord
) {
  if (typeof window === "undefined") {
    return null;
  }

  let current: ProductSelectionRecord = null;
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

export function clearStoredVoucherSelection() {
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

export function prepareProductSelectionPayload(
  current: ProductSelectionRecord,
  options: {
    slug?: string | null;
    title?: string | null;
    priceValue?: number | null;
    priceNetto?: number | null;
    priceFormatted?: string | null;
    steuerSatz?: number | null;
    isVoucher?: boolean;
    shippingCost?: number | null;
    quantity: number;
  }
) {
  const base = current && typeof current === "object" ? current : {};
  const createdAt =
    typeof (base as { createdAt?: unknown }).createdAt === "string"
      ? (base as { createdAt?: string }).createdAt
      : new Date().toISOString();

  return {
    ...base,
    type: "product",
    slug: options.slug ?? (typeof (base as { slug?: unknown }).slug === "string" ? (base as { slug?: string }).slug : null),
    productSlug:
      options.slug ?? (typeof (base as { productSlug?: unknown }).productSlug === "string"
        ? (base as { productSlug?: string }).productSlug
        : null),
    title:
      options.title ??
      ((base as { title?: unknown }).title as string | null | undefined) ??
      null,
    quantity: Math.max(1, options.quantity),
    priceValue:
      options.priceValue ??
      (typeof (base as { priceValue?: unknown }).priceValue === "number"
        ? (base as { priceValue?: number }).priceValue
        : null),
    priceNetto:
      options.priceNetto ??
      (typeof (base as { priceNetto?: unknown }).priceNetto === "number"
        ? (base as { priceNetto?: number }).priceNetto
        : null),
    priceFormatted:
      options.priceFormatted ??
      (typeof (base as { priceFormatted?: unknown }).priceFormatted === "string"
        ? (base as { priceFormatted?: string }).priceFormatted
        : null),
    steuerSatz:
      options.steuerSatz ??
      (typeof (base as { steuerSatz?: unknown }).steuerSatz === "number"
        ? (base as { steuerSatz?: number }).steuerSatz
        : null),
    isVoucher:
      options.isVoucher ??
      Boolean((base as { isVoucher?: unknown }).isVoucher),
    shippingCost: normaliseShippingInput(options.shippingCost ?? (base as { shippingCost?: number }).shippingCost ?? null),
    createdAt,
    updatedAt: new Date().toISOString()
  };
}

