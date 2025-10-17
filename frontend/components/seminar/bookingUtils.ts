export const BOOKING_SELECTION_STORAGE_KEY = "booking:lastSelection";

export type BookingSelection = {
  quantity: number;
  dateId?: string;
  seminarSlug?: string | null;
  seminarTitle?: string;
};

export function triggerBookingFlow(selection: BookingSelection) {
  const normalizedQuantity = Math.max(1, Math.trunc(selection.quantity));
  const slug = selection.seminarSlug ?? null;
  const payload = {
    type: "seminar" as const,
    slug,
    seminarSlug: slug,
    title: selection.seminarTitle ?? null,
    quantity: normalizedQuantity,
    dateId: selection.dateId ?? null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  try {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(BOOKING_SELECTION_STORAGE_KEY, JSON.stringify(payload));
    }
  } catch {
    // Persistenz optional; Fehler bewusst ignoriert.
  }

  if (typeof document !== "undefined") {
    document.dispatchEvent(new CustomEvent("booking:pending", { detail: payload }));
    document.dispatchEvent(
      new CustomEvent("cart:add", { detail: { amount: normalizedQuantity, item: payload } })
    );
    document.dispatchEvent(new CustomEvent("cart:toggle"));
  }
}
