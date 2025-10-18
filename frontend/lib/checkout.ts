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

type VoucherApiEntry = {
  id: number;
  attributes?: {
    code?: string | null;
    betrag?: string | number | null;
    aktiv?: boolean | null;
    eingeloest?: boolean | null;
    beschreibung?: string | null;
  };
};

type VoucherApiResponse = {
  data?: VoucherApiEntry[];
};

export type VoucherCodeLookup = {
  code: string;
  amount: number;
  description?: string | null;
  active: boolean;
  redeemed: boolean;
};

export async function fetchVoucherByCode(code: string): Promise<VoucherCodeLookup | null> {
  const trimmed = code.trim();
  if (!trimmed) {
    return null;
  }

  try {
    const query = `/gutscheine?filters[code][$eq]=${encodeURIComponent(
      trimmed
    )}&filters[istTemplate][$eq]=false&pagination[limit]=1`;
    const response = await fetchJson<VoucherApiResponse>(query, {
      cache: "no-store"
    });
    const entry = response?.data && response.data.length > 0 ? response.data[0] : null;
    if (!entry || !entry.attributes) {
      return null;
    }
    const attributes = entry.attributes;
    const amount = parsePrice(attributes.betrag ?? null) ?? 0;
    return {
      code: attributes.code?.trim() || trimmed,
      amount,
      description: attributes.beschreibung ?? null,
      active: attributes.aktiv !== false,
      redeemed: attributes.eingeloest === true
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
