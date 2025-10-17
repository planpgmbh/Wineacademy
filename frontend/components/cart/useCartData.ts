import { useEffect, useState } from "react";

import { fetchJson, mediaUrl } from "@/lib/api";

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

type ProductListItem = {
  id: number;
  name: string;
  slug: string;
  kurzbeschreibung?: string | null;
  preisBrutto?: string | number | null;
  bild?: { url?: string | null; alternativeText?: string | null } | null;
};

type VoucherTemplate = {
  name: string;
  beschreibung?: string | null;
  minBetrag?: number | null;
  maxBetrag?: number | null;
  bild?: { url?: string | null; alternativeText?: string | null } | null;
};

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

export type ProductCartItem = {
  id: number;
  title: string;
  slug: string;
  description?: string | null;
  price: { value: number | null; formatted: string };
  imageUrl: string | null;
  imageAlt: string | null;
};

export type VoucherCartItem = {
  title: string;
  description: string;
  value: number | null;
  formattedValue: string | null;
  imageUrl: string | null;
  imageAlt: string | null;
};

export type BookingSelection = {
  quantity: number;
  dateId?: string | null;
  seminarSlug?: string | null;
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

function formatSeminarDate(termin: SeminarListItem["termine"][number]): string | null {
  if (!termin?.starttag) {
    return null;
  }

  const date = new Date(termin.starttag);
  if (Number.isNaN(date.valueOf())) {
    return null;
  }

  const dateLabel = new Intl.DateTimeFormat("de-DE", {
    weekday: "short",
    day: "numeric",
    month: "long"
  }).format(date);

  const locationRaw = termin.standort?.stadt ?? termin.standort?.name ?? "";
  const location = locationRaw.trim();

  return location.length > 0 ? `${dateLabel} · ${location}` : dateLabel;
}

function readBookingSelection(): BookingSelection | null {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    const raw = window.localStorage.getItem("booking:lastSelection");
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
    return { quantity, dateId, seminarSlug: seminarSlug ?? parsed.seminarSlug ?? null };
  } catch {
    return null;
  }
}

function mapSeminar(item: SeminarListItem | SeminarDetailItem | undefined): SeminarCartItem | null {
  if (!item) {
    return null;
  }
  const price = parseCurrency(item.preis ?? null);
  const datesRaw = Array.isArray(item.termine) ? item.termine : [];
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

function mapProductItem(item: ProductListItem | undefined): ProductCartItem | null {
  if (!item) {
    return null;
  }
  const price = parseCurrency(item.preisBrutto ?? null);
  return {
    id: item.id,
    title: item.name,
    slug: item.slug,
    description: item.kurzbeschreibung ?? null,
    price,
    imageUrl: mediaUrl(item.bild?.url),
    imageAlt: item.bild?.alternativeText ?? null
  };
}

function mapVoucherTemplate(template: VoucherTemplate | null | undefined): VoucherCartItem | null {
  if (!template) {
    return null;
  }
  const value = template.minBetrag ?? null;
  const formattedValue = value != null ? PRICE_FORMATTER.format(value) : null;
  return {
    title: "Gutschein",
    description: "Dein Geschenkgutschein zum Verschenken",
    value,
    formattedValue,
    imageUrl: mediaUrl(template.bild?.url),
    imageAlt: template.bild?.alternativeText ?? null
  };
}

type CartData = {
  seminar: SeminarCartItem | null;
  product: ProductCartItem | null;
  voucher: VoucherCartItem | null;
  selection: BookingSelection | null;
};

type CartState =
  | { status: "loading"; data: CartData }
  | { status: "ready"; data: CartData }
  | { status: "error"; data: CartData; error: unknown };

const EMPTY_DATA: CartData = { seminar: null, product: null, voucher: null, selection: null };

const FALLBACK_CART_DATA: Omit<CartData, "selection"> = {
  seminar: {
    id: 0,
    title: "Assistant Sommelier (inkl. WSET® Level 2 Weine)",
    slug: "assistant-sommelier",
    description:
      "Ob Gastronomie, Weinhandel, Tourismus oder Weinliebhaber:innen – der Lehrgang zum Assistant Sommelier inkl. WSET® Level 2 bietet die perfekte Weiterbildung.",
    price: { value: 249, formatted: PRICE_FORMATTER.format(249) },
    dates: [
      { id: "date-1", label: "Fr, 15. November · Hamburg" },
      { id: "date-2", label: "Sa, 23. November · Hamburg" },
      { id: "date-3", label: "Fr, 6. Dezember · Berlin" }
    ],
    imageUrl: null,
    imageAlt: null
  },
  product: {
    id: 0,
    title: "Wine Academy Merch-Set",
    slug: "wine-academy-merch-set",
    description: "Handverlesene Accessoires für perfekte Tastings.",
    price: { value: 98.9, formatted: PRICE_FORMATTER.format(98.9) },
    imageUrl: null,
    imageAlt: null
  },
  voucher: {
    title: "Gutschein",
    description: "Dein Geschenkgutschein zum Verschenken",
    value: 50,
    formattedValue: PRICE_FORMATTER.format(50),
    imageUrl: null,
    imageAlt: null
  }
};

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
      if (event.key === "booking:lastSelection") {
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
          : fetchJson<SeminarListItem[]>("/public/seminare", { next: { revalidate: 60 }, cache: "force-cache" })
              .then((list) => mapSeminar(list?.[0]))
              .catch(() => null);

        const productPromise = fetchJson<ProductListItem[]>("/public/produkte", {
          next: { revalidate: 60 },
          cache: "force-cache"
        })
          .then((list) => mapProductItem(list?.[0]))
          .catch(() => null);

        const voucherPromise = fetchJson<VoucherTemplate>("/public/gutscheine/template", {
          next: { revalidate: 300 },
          cache: "force-cache"
        })
          .then((template) => mapVoucherTemplate(template))
          .catch(() => mapVoucherTemplate(null));

        const [seminar, product, voucher] = await Promise.all([seminarPromise, productPromise, voucherPromise]);

        if (!active) return;

        setState({
          status: "ready",
          data: {
            seminar,
            product,
            voucher,
            selection: currentSelection
          }
        });
      } catch (error) {
        console.error("[cart] Daten konnten nicht geladen werden:", error);
        if (!active) return;
        setState({
          status: "error",
          data: {
            ...FALLBACK_CART_DATA,
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
