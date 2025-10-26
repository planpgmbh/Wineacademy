"use client";

import { normaliseShippingInput, roundCurrency } from "@/lib/shipping";

export const VOUCHER_SELECTION_STORAGE_KEY = "voucher:lastSelection";

export type VoucherSelection = {
  amount: number;
  title: string;
  description?: string | null;
  imageUrl?: string | null;
  imageAlt?: string | null;
  minAmount?: number | null;
  maxAmount?: number | null;
  shippingCost?: number | null;
  createdAt: string;
  updatedAt: string;
};

type TriggerVoucherInput = {
  amount: number;
  title: string;
  description?: string | null;
  imageUrl?: string | null;
  imageAlt?: string | null;
  minAmount?: number | null;
  maxAmount?: number | null;
  shippingCost?: number | null;
};

export function triggerVoucherFlow(input: TriggerVoucherInput) {
  const amount = roundCurrency(input.amount);
  const shippingCost = normaliseShippingInput(input.shippingCost);
  const payload: VoucherSelection = {
    amount,
    title: input.title,
    description: input.description ?? null,
    imageUrl: input.imageUrl ?? null,
    imageAlt: input.imageAlt ?? null,
    minAmount: input.minAmount ?? null,
    maxAmount: input.maxAmount ?? null,
    shippingCost,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  try {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(VOUCHER_SELECTION_STORAGE_KEY, JSON.stringify(payload));
    }
  } catch {
    // Persistenz optional, Fehler ignorieren.
  }

  if (typeof document !== "undefined") {
    document.dispatchEvent(new CustomEvent("voucher:pending", { detail: payload }));
    document.dispatchEvent(new CustomEvent("cart:add", { detail: { amount: 1, item: payload } }));
    document.dispatchEvent(new CustomEvent("cart:toggle"));
  }
}

export function readVoucherSelection(): VoucherSelection | null {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    const raw = window.localStorage.getItem(VOUCHER_SELECTION_STORAGE_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") {
      return null;
    }
    const amountValue =
      typeof parsed.amount === "number" && Number.isFinite(parsed.amount)
        ? roundCurrency(parsed.amount)
        : typeof parsed.amount === "string"
          ? roundCurrency(Number.parseFloat(parsed.amount.replace(/,/g, ".")))
          : null;
    if (amountValue === null || amountValue <= 0 || !Number.isFinite(amountValue)) {
      return null;
    }
    return {
      amount: amountValue,
      title: typeof parsed.title === "string" && parsed.title.length > 0 ? parsed.title : "Geschenkgutschein",
      description: typeof parsed.description === "string" ? parsed.description : null,
      imageUrl: typeof parsed.imageUrl === "string" ? parsed.imageUrl : null,
      imageAlt: typeof parsed.imageAlt === "string" ? parsed.imageAlt : null,
      minAmount: typeof parsed.minAmount === "number" ? parsed.minAmount : null,
      maxAmount: typeof parsed.maxAmount === "number" ? parsed.maxAmount : null,
      shippingCost: normaliseShippingInput(parsed.shippingCost),
      createdAt: typeof parsed.createdAt === "string" ? parsed.createdAt : new Date().toISOString(),
      updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : new Date().toISOString()
    };
  } catch {
    return null;
  }
}
