import { useEffect, useState } from "react";

import { fetchJson, mediaUrl } from "@/lib/api";
import { BOOKING_SELECTION_STORAGE_KEY } from "@/components/seminar/bookingUtils";

type SeminarListItem = {
  id: number;
  name: string;
  slug: string;
  kurzbeschreibung?: string | null;
  preis?: string | number | null;
  bild?: { url?: string | null; alternativeText?: string | null } | null;
  termine?: {
    id: number;
    starttag?: string | null;
    standort?: { name?: string | null; stadt?: string | null } | null;
  }[];
};

type SeminarDetailItem = SeminarListItem;

type SeminarTermin = NonNullable<SeminarListItem["termine"]>[number];

export type SeminarCartItem = {
  id: number;
  title: string;
  slug: string;
  description?: string | null;
  price: { value: number | null; formatted: string };
  dates: { id: string; label: string }[];
  imageUrl: string | null;
  imageAlt: string | null;
};

export type BookingSelection = {
  quantity: number;
  dateId?: string | null;
  seminarSlug?: string | null;
  seminarTitle?: string | null;
};

const PRICE_FORMATTER = new Intl.NumberFormat("de-DE", {
  style: "currency",
  currency: "EUR"
});

function parseCurrency(value: string | number | null | undefined): { value: number | null; formatted: string } {
  if (typeof value === "number" && Number.isFinite(value)) {
    return { value, formatted: PRICE_FORMATTER.format(value) };
  }
  if (typeof value === "string") {
    const parsed = Number.parseFloat(value.replace(",", "."));
    if (Number.isFinite(parsed)) {
      return { value: parsed, formatted: PRICE_FORMATTER.format(parsed) };
    }
  }
  return { value: null, formatted: "Preis auf Anfrage" };
}

function ensureWeekdaySuffix(label: string): string {
  return label.endsWith(".") ? label : `${label}.`;
}

function formatSeminarDate(termin: SeminarTermin): string | null {
  if (!termin?.starttag) {
    return null;
  }

  const date = new Date(termin.starttag);
  if (Number.isNaN(date.valueOf())) {
    return null;
  }

  const weekday = ensureWeekdaySuffix(
    new Intl.DateTimeFormat("de-DE", { weekday: "short" }).format(date)
  );
  const datePart = new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  }).format(date);

  return `${weekday} ${datePart}`;
}

function readBookingSelection(): BookingSelection | null {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    const raw = window.localStorage.getItem(BOOKING_SELECTION_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") {
      return null;
    }
    const quantity = typeof parsed.quantity === "number" ? Math.max(1, Math.trunc(parsed.quantity)) : 1;
    const dateId =
      typeof parsed.dateId === "string" && parsed.dateId.length > 0 ? parsed.dateId : undefined;
    const seminarSlug =
      typeof parsed.slug === "string" && parsed.slug.length > 0 ? parsed.slug : undefined;
    const seminarTitle =
      typeof parsed.title === "string" && parsed.title.length > 0
        ? parsed.title
        : typeof parsed.seminarTitle === "string" && parsed.seminarTitle.length > 0
          ? parsed.seminarTitle
          : null;
    return {
      quantity,
      dateId,
      seminarSlug: seminarSlug ?? parsed.seminarSlug ?? null,
      seminarTitle
    };
  } catch {
    return null;
  }
}

function mapSeminar(item: SeminarListItem | SeminarDetailItem | undefined): SeminarCartItem | null {
  if (!item) {
    return null;
  }
  const price = parseCurrency(item.preis ?? null);
  const datesRaw: SeminarTermin[] = Array.isArray(item.termine) ? item.termine : [];
  const dates = datesRaw
    .map((termin) => {
      const label = formatSeminarDate(termin);
      if (!label) return null;
      return { id: String(termin.id), label };
    })
    .filter((entry): entry is { id: string; label: string } => Boolean(entry))
    .slice(0, 5);

  return {
    id: item.id,
    title: item.name,
    slug: item.slug,
    description: item.kurzbeschreibung ?? null,
    price,
    dates,
    imageUrl: mediaUrl(item.bild?.url),
    imageAlt: item.bild?.alternativeText ?? null
  };
}

type CartData = {
  seminar: SeminarCartItem | null;
  selection: BookingSelection | null;
};

type CartState =
  | { status: "loading"; data: CartData }
  | { status: "ready"; data: CartData }
  | { status: "error"; data: CartData; error: unknown };

const EMPTY_DATA: CartData = { seminar: null, selection: null };

export function useCartData(): CartState {
  const [selection, setSelection] = useState<BookingSelection | null>(() => readBookingSelection());
  const [state, setState] = useState<CartState>({
    status: "loading",
    data: { ...EMPTY_DATA, selection }
  });

  useEffect(() => {
    const handleBookingPending = () => {
      setSelection(readBookingSelection());
    };

    const handleStorage = (event: StorageEvent) => {
      if (event.key === BOOKING_SELECTION_STORAGE_KEY) {
        setSelection(readBookingSelection());
      }
    };

    document.addEventListener("booking:pending", handleBookingPending);
    window.addEventListener("storage", handleStorage);

    return () => {
      document.removeEventListener("booking:pending", handleBookingPending);
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  useEffect(() => {
    let active = true;

    async function load(currentSelection: BookingSelection | null) {
      try {
        const seminarPromise = currentSelection?.seminarSlug
          ? fetchJson<SeminarDetailItem>(`/public/seminare/${encodeURIComponent(currentSelection.seminarSlug)}`, {
              next: { revalidate: 30 },
              cache: "force-cache"
            })
              .then((detail) => mapSeminar(detail))
              .catch(() => null)
          : Promise.resolve(null);

        const [seminar] = await Promise.all([seminarPromise]);

        if (!active) return;

        setState({
          status: "ready",
          data: {
            seminar,
            selection: currentSelection
          }
        });
      } catch (error) {
        console.error("[cart] Daten konnten nicht geladen werden:", error);
        if (!active) return;
        setState({
          status: "error",
          data: {
            ...EMPTY_DATA,
            selection: currentSelection
          },
          error
        });
      }
    }

    load(selection);

    return () => {
      active = false;
    };
  }, [selection]);

  return state;
}
