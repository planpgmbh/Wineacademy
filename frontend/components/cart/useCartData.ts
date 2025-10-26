import { useEffect, useState } from "react";

import { fetchJson, mediaUrl } from "@/lib/api";
import { normaliseShippingInput } from "@/lib/shipping";
import {
  BOOKING_SELECTION_STORAGE_KEY,
  readBookingSelections,
  type BookingSelection
} from "@/components/seminar/bookingUtils";
import {
  readVoucherSelection,
  VOUCHER_SELECTION_STORAGE_KEY,
  type VoucherSelection
} from "@/components/voucher/voucherBookingUtils";
export type { BookingSelection } from "@/components/seminar/bookingUtils";

type SeminarListItem = {
  id: number;
  name: string;
  slug: string;
  kurzbeschreibung?: string | null;
  preis?: string | number | null;
  mwst?: boolean | null;
  bild?: { url?: string | null; alternativeText?: string | null } | null;
  termine?: {
    id: number;
    starttag?: string | null;
    standort?: { name?: string | null; stadt?: string | null } | null;
    tageMitUhrzeit?: { datum?: string | null; startzeit?: string | null; endzeit?: string | null }[];
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
  steuerSatz: number | null;
  dates: { id: string; label: string; days: string[]; slots: string[] }[];
  imageUrl: string | null;
  imageAlt: string | null;
};

const PRODUCT_SELECTION_STORAGE_KEY = "cart:productSelection";

type ProductDetailItem = {
  id: number;
  name: string;
  slug: string;
  kurzbeschreibung?: string | null;
  preisBrutto?: string | number | null;
  preisNetto?: string | number | null;
  steuerSatz?: string | number | null;
  mwst?: boolean | null;
  gutschein?: boolean | null;
  bild?: { url?: string | null; alternativeText?: string | null } | null;
};

export type ProductCartItem = {
  id: number;
  title: string;
  slug: string;
  description?: string | null;
  price: { value: number | null; formatted: string };
  priceNetto: number | null;
  steuerSatz: number | null;
  imageUrl: string | null;
  imageAlt: string | null;
  isVoucher: boolean;
};

export type ProductSelection = {
  quantity: number;
  productSlug?: string | null;
  productTitle?: string | null;
  priceValue?: number | null;
  priceNetto?: number | null;
  priceFormatted?: string | null;
  isVoucher?: boolean;
  steuerSatz?: number | null;
  shippingCost?: number | null;
};

export type VoucherCartItem = {
  title: string;
  description?: string | null;
  amount: number;
  formattedValue: string;
  imageUrl: string | null;
  imageAlt: string | null;
};

const PRICE_FORMATTER = new Intl.NumberFormat("de-DE", {
  style: "currency",
  currency: "EUR"
});

const DEFAULT_VAT_RATE = 19;

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

function formatDateLabel(date: Date): string {
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

function parseIsoDateLabel(isoDate: string | null | undefined): string | null {
  if (!isoDate) {
    return null;
  }
  const date = new Date(isoDate);
  if (Number.isNaN(date.valueOf())) {
    return null;
  }
  return formatDateLabel(date);
}

function formatSeminarDate(termin: SeminarTermin): string | null {
  return parseIsoDateLabel(termin?.starttag);
}

function formatTimeComponent(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }
  const parts = value.trim().split(":");
  if (parts.length >= 2) {
    const [hour, minute] = parts;
    return `${hour.padStart(2, "0")}:${minute.padStart(2, "0")}`;
  }
  return value.trim().length > 0 ? value.trim() : null;
}

function formatSeminarTimeSlot(slot: { datum?: string | null; startzeit?: string | null; endzeit?: string | null }): string | null {
  const dayLabel = parseIsoDateLabel(slot?.datum);
  if (!dayLabel) {
    return null;
  }
  const start = formatTimeComponent(slot?.startzeit);
  const end = formatTimeComponent(slot?.endzeit);
  if (start && end) {
    return `${dayLabel} ${start} – ${end}`;
  }
  if (start) {
    return `${dayLabel} ${start}`;
  }
  return dayLabel;
}

export function readProductSelection(): ProductSelection | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(PRODUCT_SELECTION_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") {
      return null;
    }
    const quantity = typeof parsed.quantity === "number" ? Math.max(1, Math.trunc(parsed.quantity)) : 1;
    const productSlug =
      typeof parsed.slug === "string" && parsed.slug.length > 0
        ? parsed.slug
        : typeof parsed.productSlug === "string" && parsed.productSlug.length > 0
          ? parsed.productSlug
          : undefined;
    const productTitle =
      typeof parsed.title === "string" && parsed.title.length > 0
        ? parsed.title
        : typeof parsed.productTitle === "string" && parsed.productTitle.length > 0
          ? parsed.productTitle
          : null;
    const priceValue =
      typeof parsed.priceValue === "number" && Number.isFinite(parsed.priceValue) ? parsed.priceValue : null;
    const priceNetto =
      typeof parsed.priceNetto === "number" && Number.isFinite(parsed.priceNetto) ? parsed.priceNetto : null;
    const steuerSatz =
      typeof parsed.steuerSatz === "number" && Number.isFinite(parsed.steuerSatz) ? parsed.steuerSatz : null;
  const priceFormatted =
    typeof parsed.priceFormatted === "string" && parsed.priceFormatted.length > 0 ? parsed.priceFormatted : null;
  const isVoucher = Boolean(parsed.isVoucher);
  const shippingCost =
    typeof parsed.shippingCost === "number" && Number.isFinite(parsed.shippingCost) ? parsed.shippingCost : null;

  return {
    quantity,
    productSlug: productSlug ?? null,
    productTitle,
    priceValue,
    priceNetto,
    priceFormatted,
    isVoucher,
    steuerSatz,
    shippingCost: normaliseShippingInput(shippingCost)
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
  const hasBrutto = price.value != null;
  const steuerSatz = item.mwst === false ? 0 : hasBrutto ? DEFAULT_VAT_RATE : null;
  const datesRaw: SeminarTermin[] = Array.isArray(item.termine) ? item.termine : [];
  const dates = datesRaw
    .map((termin) => {
      const label = formatSeminarDate(termin);
      if (!label) return null;
      const slotsRaw = Array.isArray(termin.tageMitUhrzeit) ? termin.tageMitUhrzeit : [];
      const slots = slotsRaw
        .map((slot) => formatSeminarTimeSlot(slot))
        .filter((entry): entry is string => Boolean(entry));
      const days = slotsRaw
        .map((slot) => parseIsoDateLabel(slot?.datum))
        .filter((entry): entry is string => Boolean(entry));
      const uniqueDays = Array.from(new Set<string>(days));
      return { id: String(termin.id), label, days: uniqueDays.length > 0 ? uniqueDays : [label], slots };
    })
    .filter((entry): entry is { id: string; label: string; days: string[]; slots: string[] } => Boolean(entry))
    .slice(0, 5);

  return {
    id: item.id,
    title: item.name,
    slug: item.slug,
    description: item.kurzbeschreibung ?? null,
    price,
    steuerSatz,
    dates,
    imageUrl: mediaUrl(item.bild?.url),
    imageAlt: item.bild?.alternativeText ?? null
  };
}

function mapProduct(item: ProductDetailItem | null | undefined): ProductCartItem | null {
  if (!item) {
    return null;
  }

  const priceSource = item.preisBrutto ?? item.preisNetto ?? null;
  const price = parseCurrency(priceSource);
  const priceNetto = parseCurrency(item.preisNetto ?? null).value;
  const steuerRaw =
    typeof item.steuerSatz === "number"
      ? item.steuerSatz
      : typeof item.steuerSatz === "string"
        ? Number.parseFloat(item.steuerSatz.replace(",", "."))
        : null;
  const fallbackTax = item.mwst === false ? 0 : DEFAULT_VAT_RATE;
  const steuerSatz =
    item.gutschein
      ? 0
      : Number.isFinite(steuerRaw)
        ? Number(steuerRaw)
        : fallbackTax;

  return {
    id: item.id,
    title: item.name,
    slug: item.slug,
    description: item.kurzbeschreibung ?? null,
    price,
    priceNetto,
    steuerSatz,
    imageUrl: mediaUrl(item.bild?.url),
    imageAlt: item.bild?.alternativeText ?? null,
    isVoucher: Boolean(item.gutschein)
  };
}

function mapVoucher(selection: VoucherSelection | null): VoucherCartItem | null {
  if (!selection) {
    return null;
  }
  return {
    title: selection.title,
    description: selection.description ?? null,
    amount: selection.amount,
    formattedValue: PRICE_FORMATTER.format(selection.amount),
    imageUrl: selection.imageUrl ?? null,
    imageAlt: selection.imageAlt ?? null
  };
}

export type SeminarCartEntry = {
  selection: BookingSelection;
  seminar: SeminarCartItem | null;
};

type CartData = {
  seminars: SeminarCartEntry[];
  product: ProductCartItem | null;
  productSelection: ProductSelection | null;
  voucher: VoucherCartItem | null;
  voucherSelection: VoucherSelection | null;
};

type CartState =
  | { status: "loading"; data: CartData }
  | { status: "ready"; data: CartData }
  | { status: "error"; data: CartData; error: unknown };

const EMPTY_DATA: CartData = {
  seminars: [],
  product: null,
  productSelection: null,
  voucher: null,
  voucherSelection: null
};

export function useCartData(): CartState {
  const [seminarSelections, setSeminarSelections] = useState<BookingSelection[]>(() => readBookingSelections());
  const [productSelection, setProductSelection] = useState<ProductSelection | null>(() => readProductSelection());
  const [voucherSelection, setVoucherSelection] = useState<VoucherSelection | null>(() => readVoucherSelection());
  const [state, setState] = useState<CartState>({
    status: "loading",
    data: {
      ...EMPTY_DATA,
      seminars: seminarSelections.map((selection) => ({ selection, seminar: null })),
      productSelection,
      voucherSelection,
      voucher: mapVoucher(voucherSelection)
    }
  });

  useEffect(() => {
    const handleBookingPending = () => {
      setSeminarSelections(readBookingSelections());
    };

    const handleProductPending = () => {
      setProductSelection(readProductSelection());
    };

    const handleVoucherPending = () => {
      setVoucherSelection(readVoucherSelection());
    };

    const handleStorage = (event: StorageEvent) => {
      if (event.key === BOOKING_SELECTION_STORAGE_KEY) {
        setSeminarSelections(readBookingSelections());
      }
      if (event.key === PRODUCT_SELECTION_STORAGE_KEY) {
        setProductSelection(readProductSelection());
      }
      if (event.key === VOUCHER_SELECTION_STORAGE_KEY) {
        setVoucherSelection(readVoucherSelection());
      }
    };

    document.addEventListener("booking:pending", handleBookingPending);
    document.addEventListener("product:pending", handleProductPending);
    document.addEventListener("voucher:pending", handleVoucherPending);
    window.addEventListener("storage", handleStorage);

    return () => {
      document.removeEventListener("booking:pending", handleBookingPending);
      document.removeEventListener("product:pending", handleProductPending);
      document.removeEventListener("voucher:pending", handleVoucherPending);
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  useEffect(() => {
    let active = true;

    async function load(
      currentSeminarSelections: BookingSelection[],
      currentProductSelection: ProductSelection | null,
      currentVoucherSelection: VoucherSelection | null
    ) {
      try {
        const seminarPromises = currentSeminarSelections.map(async (selection) => {
          if (!selection.seminarSlug) {
            return { selection, seminar: null as SeminarCartItem | null };
          }
          try {
            const detail = await fetchJson<SeminarDetailItem>(
              `/public/seminare/${encodeURIComponent(selection.seminarSlug)}`,
              {
                next: { revalidate: 30 },
                cache: "force-cache"
              }
            );
            return { selection, seminar: mapSeminar(detail) };
          } catch (error) {
            if (
              error &&
              typeof error === "object" &&
              "status" in error &&
              (error as { status?: number }).status === 404
            ) {
              return { selection, seminar: null as SeminarCartItem | null };
            }
            throw error;
          }
        });

        const productPromise = currentProductSelection?.productSlug
          ? fetchJson<ProductDetailItem>(
              `/public/produkte/${encodeURIComponent(currentProductSelection.productSlug)}`,
              {
                next: { revalidate: 30 },
                cache: "force-cache"
              }
            )
              .then((detail) => mapProduct(detail))
              .catch((error) => {
                if (error && typeof error === "object" && "status" in error && (error as { status?: number }).status === 404) {
                  return null;
                }
                throw error;
              })
          : Promise.resolve(null);

        const [seminars, product] = await Promise.all([
          Promise.all(seminarPromises),
          productPromise
        ]);
        const voucher = mapVoucher(currentVoucherSelection);

        if (!active) return;

        setState({
          status: "ready",
          data: {
            seminars,
            product,
            productSelection: currentProductSelection,
            voucher,
            voucherSelection: currentVoucherSelection
          }
        });
      } catch (error) {
        console.error("[cart] Daten konnten nicht geladen werden:", error);
        if (!active) return;
        setState({
          status: "error",
          data: {
            ...EMPTY_DATA,
            seminars: currentSeminarSelections.map((selection) => ({ selection, seminar: null })),
            productSelection: currentProductSelection,
            voucherSelection: currentVoucherSelection,
            voucher: mapVoucher(currentVoucherSelection)
          },
          error
        });
      }
    }

    load(seminarSelections, productSelection, voucherSelection);

    return () => {
      active = false;
    };
  }, [seminarSelections, productSelection, voucherSelection]);

  return state;
}
