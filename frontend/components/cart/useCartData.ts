import { useEffect, useState } from "react";

import { fetchJson, mediaUrl } from "@/lib/api";
import { BOOKING_SELECTION_STORAGE_KEY } from "@/components/seminar/bookingUtils";
import {
  readVoucherSelection,
  VOUCHER_SELECTION_STORAGE_KEY,
  type VoucherSelection
} from "@/components/voucher/voucherBookingUtils";

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

const PRODUCT_SELECTION_STORAGE_KEY = "cart:productSelection";

type ProductDetailItem = {
  id: number;
  name: string;
  slug: string;
  kurzbeschreibung?: string | null;
  preisBrutto?: string | number | null;
  preisNetto?: string | number | null;
  gutschein?: boolean | null;
  bild?: { url?: string | null; alternativeText?: string | null } | null;
};

export type ProductCartItem = {
  id: number;
  title: string;
  slug: string;
  description?: string | null;
  price: { value: number | null; formatted: string };
  imageUrl: string | null;
  imageAlt: string | null;
  isVoucher: boolean;
};

export type ProductSelection = {
  quantity: number;
  productSlug?: string | null;
  productTitle?: string | null;
  priceValue?: number | null;
  priceFormatted?: string | null;
  isVoucher?: boolean;
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

export function readBookingSelection(): BookingSelection | null {
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
    const priceFormatted =
      typeof parsed.priceFormatted === "string" && parsed.priceFormatted.length > 0 ? parsed.priceFormatted : null;
    const isVoucher = Boolean(parsed.isVoucher);

    return {
      quantity,
      productSlug: productSlug ?? null,
      productTitle,
      priceValue,
      priceFormatted,
      isVoucher
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

function mapProduct(item: ProductDetailItem | null | undefined): ProductCartItem | null {
  if (!item) {
    return null;
  }

  const priceSource = item.preisBrutto ?? item.preisNetto ?? null;
  const price = parseCurrency(priceSource);

  return {
    id: item.id,
    title: item.name,
    slug: item.slug,
    description: item.kurzbeschreibung ?? null,
    price,
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

type CartData = {
  seminar: SeminarCartItem | null;
  seminarSelection: BookingSelection | null;
  product: ProductCartItem | null;
  productSelection: ProductSelection | null;
  voucher: VoucherCartItem | null;
  voucherSelection: VoucherSelection | null;
};

type CartState =
  | { status: "loading"; data: CartData }
  | { status: "ready"; data: CartData }
  | { status: "error"; data: CartData; error: unknown };

const EXTENDED_EMPTY_DATA: CartData = {
  seminar: null,
  seminarSelection: null,
  product: null,
  productSelection: null,
  voucher: null,
  voucherSelection: null
};

export function useCartData(): CartState {
  const [seminarSelection, setSeminarSelection] = useState<BookingSelection | null>(() => readBookingSelection());
  const [productSelection, setProductSelection] = useState<ProductSelection | null>(() => readProductSelection());
  const [voucherSelection, setVoucherSelection] = useState<VoucherSelection | null>(() => readVoucherSelection());
  const [state, setState] = useState<CartState>({
    status: "loading",
    data: {
      ...EXTENDED_EMPTY_DATA,
      seminarSelection,
      productSelection,
      voucherSelection,
      voucher: mapVoucher(voucherSelection)
    }
  });

  useEffect(() => {
    const handleBookingPending = () => {
      setSeminarSelection(readBookingSelection());
    };

    const handleProductPending = () => {
      setProductSelection(readProductSelection());
    };

    const handleVoucherPending = () => {
      setVoucherSelection(readVoucherSelection());
    };

    const handleStorage = (event: StorageEvent) => {
      if (event.key === BOOKING_SELECTION_STORAGE_KEY) {
        setSeminarSelection(readBookingSelection());
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
      currentSeminarSelection: BookingSelection | null,
      currentProductSelection: ProductSelection | null,
      currentVoucherSelection: VoucherSelection | null
    ) {
      try {
        const seminarPromise = currentSeminarSelection?.seminarSlug
          ? fetchJson<SeminarDetailItem>(
              `/public/seminare/${encodeURIComponent(currentSeminarSelection.seminarSlug)}`,
              {
                next: { revalidate: 30 },
                cache: "force-cache"
              }
            )
              .then((detail) => mapSeminar(detail))
              .catch((error) => {
                if (error && typeof error === "object" && "status" in error && (error as { status?: number }).status === 404) {
                  return null;
                }
                throw error;
              })
          : Promise.resolve(null);

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

        const [seminar, product] = await Promise.all([seminarPromise, productPromise]);
        const voucher = mapVoucher(currentVoucherSelection);

        if (!active) return;

        setState({
          status: "ready",
          data: {
            seminar,
            seminarSelection: currentSeminarSelection,
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
            ...EXTENDED_EMPTY_DATA,
            seminarSelection: currentSeminarSelection,
            productSelection: currentProductSelection,
            voucherSelection: currentVoucherSelection,
            voucher: mapVoucher(currentVoucherSelection)
          },
          error
        });
      }
    }

    load(seminarSelection, productSelection, voucherSelection);

    return () => {
      active = false;
    };
  }, [seminarSelection, productSelection, voucherSelection]);

  return state;
}
