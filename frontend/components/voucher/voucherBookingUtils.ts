"use client";

export const VOUCHER_SELECTION_STORAGE_KEY = "voucher:lastSelection";

export type VoucherSelection = {
  amount: number;
  title: string;
  description?: string | null;
  imageUrl?: string | null;
  imageAlt?: string | null;
  minAmount?: number | null;
  maxAmount?: number | null;
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
};

export function triggerVoucherFlow(input: TriggerVoucherInput) {
  const amount = Math.round(input.amount * 100) / 100;
  const payload: VoucherSelection = {
    amount,
    title: input.title,
    description: input.description ?? null,
    imageUrl: input.imageUrl ?? null,
    imageAlt: input.imageAlt ?? null,
    minAmount: input.minAmount ?? null,
    maxAmount: input.maxAmount ?? null,
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
    const amount =
      typeof parsed.amount === "number" && Number.isFinite(parsed.amount) ? Math.round(parsed.amount * 100) / 100 : null;
    if (amount === null || amount <= 0) {
      return null;
    }
    return {
      amount,
      title: typeof parsed.title === "string" && parsed.title.length > 0 ? parsed.title : "Geschenkgutschein",
      description: typeof parsed.description === "string" ? parsed.description : null,
      imageUrl: typeof parsed.imageUrl === "string" ? parsed.imageUrl : null,
      imageAlt: typeof parsed.imageAlt === "string" ? parsed.imageAlt : null,
      minAmount: typeof parsed.minAmount === "number" ? parsed.minAmount : null,
      maxAmount: typeof parsed.maxAmount === "number" ? parsed.maxAmount : null,
      createdAt: typeof parsed.createdAt === "string" ? parsed.createdAt : new Date().toISOString(),
      updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : new Date().toISOString()
    };
  } catch {
    return null;
  }
}
