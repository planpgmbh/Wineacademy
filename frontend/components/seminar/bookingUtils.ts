export const BOOKING_SELECTION_STORAGE_KEY = "booking:lastSelection";

export type BookingSelection = {
  id: string;
  quantity: number;
  dateId?: string | null;
  seminarSlug?: string | null;
  seminarTitle?: string | null;
  createdAt: string;
  updatedAt: string;
};

type BookingSelectionInput = {
  quantity: number;
  dateId?: string | null;
  seminarSlug?: string | null;
  seminarTitle?: string | null;
};

type StoredBookingSelection = BookingSelection & {
  type: "seminar";
};

function now() {
  return new Date().toISOString();
}

function buildSelectionId(selection: BookingSelectionInput): string {
  const slug = selection.seminarSlug?.trim().toLowerCase();
  const date = selection.dateId?.trim().toLowerCase();
  if (slug || date) {
    const slugPart = slug && slug.length > 0 ? slug : "seminar";
    const datePart = date && date.length > 0 ? date : "any";
    return `${slugPart}::${datePart}`;
  }
  return `anonymous::${Date.now()}::${Math.random().toString(36).slice(2, 10)}`;
}

function normalizeStoredSelection(raw: unknown): BookingSelection | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }
  const candidate = raw as Partial<StoredBookingSelection>;
  const id =
    typeof candidate.id === "string" && candidate.id.length > 0
      ? candidate.id
      : buildSelectionId({
          seminarSlug: typeof candidate.seminarSlug === "string" ? candidate.seminarSlug : null,
          dateId: typeof candidate.dateId === "string" ? candidate.dateId : null,
          quantity: typeof candidate.quantity === "number" ? candidate.quantity : 1,
          seminarTitle: typeof candidate.seminarTitle === "string" ? candidate.seminarTitle : null
        });
  const quantity =
    typeof candidate.quantity === "number" && Number.isFinite(candidate.quantity) && candidate.quantity > 0
      ? Math.trunc(candidate.quantity)
      : 1;
  const createdAt =
    typeof candidate.createdAt === "string" && candidate.createdAt
      ? candidate.createdAt
      : now();
  const updatedAt =
    typeof candidate.updatedAt === "string" && candidate.updatedAt
      ? candidate.updatedAt
      : createdAt;
  const seminarSlug = typeof candidate.seminarSlug === "string" ? candidate.seminarSlug : null;
  const seminarTitle = typeof candidate.seminarTitle === "string" ? candidate.seminarTitle : null;
  const dateId = typeof candidate.dateId === "string" ? candidate.dateId : null;

  return {
    id,
    quantity: Math.max(1, quantity),
    dateId,
    seminarSlug,
    seminarTitle,
    createdAt,
    updatedAt
  };
}

function parseSelections(raw: string | null): BookingSelection[] {
  if (!raw) {
    return [];
  }
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed
      .map((entry) => normalizeStoredSelection(entry))
      .filter((entry): entry is BookingSelection => entry !== null);
  } catch {
    return [];
  }
}

function serialiseSelections(selections: BookingSelection[]): StoredBookingSelection[] {
  return selections.map((entry) => ({
    ...entry,
    type: "seminar"
  }));
}

function withLocalStorage<T>(fallback: T, fn: (storage: Storage) => T): T {
  if (typeof window === "undefined" || !window.localStorage) {
    return fallback;
  }
  try {
    return fn(window.localStorage);
  } catch {
    return fallback;
  }
}

function emitBookingChange(selections: BookingSelection[]) {
  if (typeof document !== "undefined") {
    document.dispatchEvent(new CustomEvent("booking:pending", { detail: selections }));
  }
}

export function readBookingSelections(): BookingSelection[] {
  return withLocalStorage<BookingSelection[]>([], (storage) =>
    parseSelections(storage.getItem(BOOKING_SELECTION_STORAGE_KEY))
  );
}

export function writeBookingSelections(selections: BookingSelection[]): BookingSelection[] {
  const normalised = selections.map((selection) => ({
    ...selection,
    quantity: Math.max(1, Math.trunc(selection.quantity)),
    createdAt: selection.createdAt ?? now(),
    updatedAt: selection.updatedAt ?? now()
  }));
  withLocalStorage(undefined, (storage) => {
    storage.setItem(
      BOOKING_SELECTION_STORAGE_KEY,
      JSON.stringify(serialiseSelections(normalised))
    );
    return undefined;
  });
  emitBookingChange(normalised);
  return normalised;
}

export function updateBookingSelections(
  updater: (current: BookingSelection[]) => BookingSelection[]
): BookingSelection[] {
  const current = readBookingSelections();
  const next = updater(current);
  if (next === current) {
    return current;
  }
  return writeBookingSelections(next);
}

export function removeBookingSelection(id: string): BookingSelection[] {
  return updateBookingSelections((current) => current.filter((entry) => entry.id !== id));
}

export function setBookingSelectionQuantity(id: string, quantity: number): BookingSelection[] {
  const nextQuantity = Math.max(1, Math.trunc(quantity));
  return updateBookingSelections((current) => {
    let changed = false;
    const next = current.map((entry) => {
      if (entry.id !== id) {
        return entry;
      }
      if (entry.quantity === nextQuantity) {
        return entry;
      }
      changed = true;
      return {
        ...entry,
        quantity: nextQuantity,
        updatedAt: now()
      } satisfies BookingSelection;
    });
    return changed ? next : current;
  });
}

export function triggerBookingFlow(selection: BookingSelectionInput) {
  const normalizedQuantity = Math.max(1, Math.trunc(selection.quantity));
  const selectionId = buildSelectionId(selection);
  const timestamp = now();

  let quantityDelta = normalizedQuantity;
  const updatedSelections = updateBookingSelections((current) => {
    const existingIndex = current.findIndex((entry) => entry.id === selectionId);
    if (existingIndex >= 0) {
      const existing = current[existingIndex];
      const nextQuantity = normalizedQuantity;
      quantityDelta = nextQuantity - existing.quantity;
      const merged: BookingSelection = {
        ...existing,
        quantity: Math.max(1, nextQuantity),
        seminarTitle: selection.seminarTitle ?? existing.seminarTitle ?? null,
        updatedAt: timestamp
      };
      const clone = [...current];
      clone[existingIndex] = merged;
      return clone;
    }
    quantityDelta = normalizedQuantity;
    const next: BookingSelection = {
      id: selectionId,
      quantity: normalizedQuantity,
      dateId: selection.dateId ?? null,
      seminarSlug: selection.seminarSlug ?? null,
      seminarTitle: selection.seminarTitle ?? null,
      createdAt: timestamp,
      updatedAt: timestamp
    };
    return [...current, next];
  });

  if (typeof document !== "undefined") {
    if (quantityDelta !== 0) {
      document.dispatchEvent(
        new CustomEvent("cart:add", {
          detail: { amount: quantityDelta, item: updatedSelections.find((entry) => entry.id === selectionId) }
        })
      );
    }
    document.dispatchEvent(new CustomEvent("cart:toggle"));
  }
}
