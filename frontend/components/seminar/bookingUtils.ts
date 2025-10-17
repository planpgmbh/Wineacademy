export type BookingSelection = {
  quantity: number;
  dateId?: string;
  seminarSlug?: string | null;
  seminarTitle?: string;
};

export function triggerBookingFlow(selection: BookingSelection) {
  const payload = {
    type: "seminar" as const,
    slug: selection.seminarSlug ?? null,
    title: selection.seminarTitle ?? null,
    quantity: selection.quantity,
    dateId: selection.dateId ?? null,
    createdAt: new Date().toISOString(),
  };

  try {
    if (typeof window !== "undefined") {
      window.localStorage.setItem("booking:lastSelection", JSON.stringify(payload));
    }
  } catch {
    // Persistenz optional; Fehler bewusst ignoriert.
  }

  if (typeof document !== "undefined") {
    document.dispatchEvent(new CustomEvent("booking:pending", { detail: payload }));
    document.dispatchEvent(
      new CustomEvent("cart:add", { detail: { amount: Math.max(1, selection.quantity), item: payload } })
    );
    document.dispatchEvent(new CustomEvent("cart:toggle"));
  }
}
