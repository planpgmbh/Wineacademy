import { fetchJson, postJson } from "./api";

type SeminarTermin = {
  id: number;
  starttag?: string | null;
  standort?: {
    name?: string | null;
    stadt?: string | null;
  } | null;
};

type PublicSeminarDetail = {
  id: number;
  name: string;
  slug: string;
  preis?: string | number | null;
  mwst?: boolean | null;
  termine?: SeminarTermin[];
};

type PublicProductDetail = {
  id: number;
  name: string;
  slug: string;
  preisBrutto?: string | number | null;
  preisNetto?: string | number | null;
  steuerSatz?: string | number | null;
  gutschein?: boolean | null;
};

export type SeminarCheckoutData = {
  seminarId: number;
  seminarTitle: string;
  preisBrutto: number | null;
  steuerSatz: number | null;
  termine: {
    id: number;
    label: string;
    description: string | null;
  }[];
};

export type ProductCheckoutData = {
  productId: number;
  productTitle: string;
  preisBrutto: number | null;
  preisNetto: number | null;
  steuerSatz: number | null;
  isVoucher: boolean;
};

const PRICE_FORMATTER = new Intl.NumberFormat("de-DE", {
  style: "currency",
  currency: "EUR"
});

const DEFAULT_VAT_RATE = 19;

const WEEKDAY_FORMATTER = new Intl.DateTimeFormat("de-DE", { weekday: "short" });
const DATE_FORMATTER = new Intl.DateTimeFormat("de-DE", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric"
});

function parsePrice(value: string | number | null | undefined): number | null {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === "string") {
    const normalised = value.replace(",", ".").trim();
    if (!normalised) return null;
    const parsed = Number.parseFloat(normalised);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function ensureWeekdaySuffix(label: string): string {
  return label.endsWith(".") ? label : `${label}.`;
}

function formatTerminLabel(termin: SeminarTermin): string | null {
  if (!termin.starttag) {
    return null;
  }
  const date = new Date(termin.starttag);
  if (Number.isNaN(date.valueOf())) {
    return null;
  }
  const weekday = ensureWeekdaySuffix(WEEKDAY_FORMATTER.format(date));
  const datePart = DATE_FORMATTER.format(date);
  return `${weekday} ${datePart}`;
}

function formatTerminDescription(termin: SeminarTermin): string | null {
  const standort = termin.standort;
  if (!standort) {
    return null;
  }
  const parts: string[] = [];
  if (standort.name?.trim()) {
    parts.push(standort.name.trim());
  }
  if (standort.stadt?.trim()) {
    parts.push(standort.stadt.trim());
  }
  return parts.length ? parts.join(" · ") : null;
}

export async function fetchSeminarCheckoutData(slug: string): Promise<SeminarCheckoutData> {
  const payload = await fetchJson<PublicSeminarDetail>(`/public/seminare/${encodeURIComponent(slug)}`, {
    next: { revalidate: 30 },
    cache: "force-cache"
  });

  const preisBrutto = parsePrice(payload.preis ?? null);
  const termine = Array.isArray(payload.termine) ? payload.termine : [];
  const steuerSatz = payload.mwst === false ? 0 : DEFAULT_VAT_RATE;

  return {
    seminarId: payload.id,
    seminarTitle: payload.name,
    preisBrutto,
    steuerSatz,
    termine: termine.map((entry) => ({
      id: entry.id,
      label: formatTerminLabel(entry) ?? `Termin #${entry.id}`,
      description: formatTerminDescription(entry)
    }))
  };
}

export async function fetchProductCheckoutData(slug: string): Promise<ProductCheckoutData> {
  const payload = await fetchJson<PublicProductDetail>(`/public/produkte/${encodeURIComponent(slug)}`, {
    next: { revalidate: 30 },
    cache: "force-cache"
  });

  const preisBrutto = parsePrice(payload.preisBrutto ?? payload.preisNetto ?? null);
  const preisNetto = parsePrice(payload.preisNetto ?? null);
  const steuerSatz = parsePrice(payload.steuerSatz ?? null);

  return {
    productId: payload.id,
    productTitle: payload.name,
    preisBrutto,
    preisNetto,
    steuerSatz,
    isVoucher: Boolean(payload.gutschein)
  };
}

export type OrderPositionInput = {
  typ?: "seminar" | "produkt" | "gutschein";
  titel?: string;
  beschreibung?: string;
  produktId?: number;
  terminId?: number;
  menge: number;
  einzelpreisBrutto?: number;
  einzelpreisNetto?: number;
  steuerSatz?: number;
  betrag?: number;
};

export type OrderParticipantInput = {
  vorname: string;
  nachname: string;
  email?: string;
  terminId: number;
  wsetCandidateNumber?: string;
  besondereBeduerfnisse?: string;
  anmerkungen?: string;
};

export type OrderPayload = {
  rechnungstyp: "privat" | "firma";
  vorname: string;
  nachname: string;
  email: string;
  agbAkzeptiert: boolean;
  datenschutzGelesen: boolean;
  newsletterOptIn?: boolean;
  positionen: OrderPositionInput[];
  buchungen: OrderParticipantInput[];
  zahlungsmethode?: "rechnung" | "paypal" | "karte" | "ueberweisung" | "sonstiges";
  notizen?: string;
  firmenname?: string;
  ustId?: string;
  rechnungsEmail?: string;
  strasse: string;
  plz: string;
  stadt: string;
  land: string;
  telefon?: string;
  gutscheinBetrag?: number;
  gutscheinCode?: string;
  paypalOrderId?: string;
  paypalCaptureId?: string;
};

export type OrderResponse = {
  id: number;
  bestellnummer?: string | null;
  status?: string;
  zahlungsmethode?: string;
  totals?: {
    brutto?: number;
    netto?: number;
    steuer?: number;
    gutschein?: number;
  };
};

export async function submitOrder(payload: OrderPayload): Promise<OrderResponse> {
  return postJson<OrderResponse>("/public/bestellungen", payload, {
    cache: "no-store"
  });
}

export type OrderStatusResponse = {
  id: number;
  bestellnummer?: string | null;
  status?: string;
  zahlungsmethode?: string;
  totals?: {
    brutto?: number;
    netto?: number;
    steuer?: number;
    gutschein?: number;
  };
  gutscheine?: { code: string; betrag: number }[];
};

export async function fetchOrderById(id: number): Promise<OrderStatusResponse> {
  return fetchJson<OrderStatusResponse>(`/public/bestellungen/${id}`, {
    cache: "no-store"
  });
}

export type VoucherCodeLookup = {
  code: string;
  amount: number;
  remaining: number;
  typ: "betrag" | "prozent";
  name?: string | null;
  description?: string | null;
};

type VoucherValidateResponse = {
  code: string;
  typ: "betrag" | "prozent";
  amount: number;
  remaining: number;
  name?: string | null;
  description?: string | null;
};

type VoucherTotalsInput = {
  brutto: number;
  netto?: number;
  steuer?: number;
};

export async function fetchVoucherByCode(
  code: string,
  totals: VoucherTotalsInput
): Promise<VoucherCodeLookup | null> {
  const trimmed = code.trim();
  if (!trimmed) {
    return null;
  }

  try {
    const payload = {
      code: trimmed,
      totals: {
        brutto: totals.brutto,
        netto: totals.netto,
        steuer: totals.steuer
      }
    };
    const response = await postJson<VoucherValidateResponse>("/public/gutscheine/validate", payload, {
      cache: "no-store"
    });
    if (!response) {
      return null;
    }
    const amount = Number.isFinite(response.amount) ? response.amount : 0;
    const remaining = Number.isFinite(response.remaining) ? response.remaining : 0;
    return {
      code: response.code?.trim() || trimmed.toUpperCase(),
      amount,
      remaining,
      typ: response.typ === "prozent" ? "prozent" : "betrag",
      name: response.name ?? null,
      description: response.description ?? null
    };
  } catch (error) {
    console.warn("[checkout] Gutschein konnte nicht geladen werden:", error);
    return null;
  }
}

export function formatCurrency(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) {
    return "Preis auf Anfrage";
  }
  return PRICE_FORMATTER.format(value);
}
