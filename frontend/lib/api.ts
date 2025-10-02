// Use internal URL on server (container network), public URL on client
const SERVER_BASE = process.env.API_INTERNAL_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:1337';

function getClientBase() {
  if (process.env.NEXT_PUBLIC_API_URL) return process.env.NEXT_PUBLIC_API_URL;
  if (typeof window !== 'undefined') return window.location.origin;
  return 'http://localhost:1337';
}

function stripApiSuffix(u: string) {
  return u.replace(/\/?api\/?$/, '');
}

const SERVER_MEDIA_BASE = process.env.ASSETS_INTERNAL_URL
  ? process.env.ASSETS_INTERNAL_URL
  : stripApiSuffix(SERVER_BASE);
const CLIENT_MEDIA_BASE = process.env.NEXT_PUBLIC_ASSETS_URL
  ? process.env.NEXT_PUBLIC_ASSETS_URL
  : stripApiSuffix(typeof window === 'undefined' ? SERVER_BASE : getClientBase());

function joinUrl(base: string, path: string) {
  const b = base.replace(/\/$/, '');
  const hasApi = /\/api$/i.test(b);
  const apiBase = hasApi ? b : `${b}/api`;
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${apiBase}${p}`; // Strapi routes are under /api
}

export async function fetchJSON<T>(path: string, init?: RequestInit): Promise<T> {
  const isServer = typeof window === 'undefined';
  const base = isServer ? SERVER_BASE : getClientBase();
  const url = joinUrl(base, path);
  const res = await fetch(url, { ...init, next: { revalidate: 30 } });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API ${res.status}: ${text}`);
  }
  return (await res.json()) as T;
}

export type SeminarListItem = {
  id: number;
  name: string;
  slug: string;
  kurzbeschreibung?: string;
  beschreibung?: string;
  infos?: string;
  preis?: number;
  mwst?: boolean;
  bild?: { url: string; alternativeText?: string } | null;
  termine?: Array<{
    id: number;
    kapazitaet?: number;
    preis?: number;
    planungsstatus?: string;
    tageMitUhrzeit?: Array<{ datum: string; startzeit?: string; endzeit?: string }>;
    standort?: { name?: string; typ?: string; veranstaltungsort?: string; stadt?: string };
  }>;
};

export async function getSeminare(): Promise<SeminarListItem[]> {
  return fetchJSON<SeminarListItem[]>('/public/seminare');
}

export async function getSeminar(slug: string): Promise<SeminarListItem> {
  return fetchJSON<SeminarListItem>(`/public/seminare/${encodeURIComponent(slug)}`);
}

export function mediaUrl(path?: string): string | undefined {
  if (!path) return undefined;
  const isServer = typeof window === 'undefined';
  // Server (Next/Image fetch) soll über interne URL gehen (z. B. http://backend:1337)
  // Client (Browser) soll die öffentliche Basis sehen (z. B. http://localhost:1337)
  const base = isServer ? SERVER_MEDIA_BASE : CLIENT_MEDIA_BASE;
  return path.startsWith('http') ? path : `${base}${path}`;
}

export type Produkt = {
  id: number;
  name: string;
  slug: string;
  kurzbeschreibung?: string;
  preisBrutto: number;
  preisNetto?: number;
  steuerSatz?: number;
  mwst?: boolean;
  gutschein?: boolean;
  bild?: { url: string; alternativeText?: string } | null;
};

export async function getProdukte(): Promise<Produkt[]> {
  return fetchJSON<Produkt[]>(`/public/produkte`);
}

export type GutscheinTemplate = {
  name: string;
  beschreibung?: string | null;
  minBetrag: number | null;
  maxBetrag: number | null;
  bild?: { url: string; alternativeText?: string } | null;
};

export async function getGutscheinTemplate(): Promise<GutscheinTemplate> {
  return fetchJSON<GutscheinTemplate>(`/public/gutscheine/template`);
}

export async function postGutscheinPricing(betrag: number) {
  return fetchJSON<{ betrag: number; minBetrag: number | null; maxBetrag: number | null }>(`/public/gutscheine/pricing`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ betrag }),
  });
}

export type PublicBestellung = {
  id: number;
  bestellnummer?: string | null;
  status: string;
  zahlungsmethode?: string | null;
  totals: {
    brutto?: number | null;
    netto?: number | null;
    steuer?: number | null;
    gutschein?: number | null;
  };
  gutscheine?: Array<{ code: string; betrag: number }>;
};

export async function getBestellungPublic(id: number): Promise<PublicBestellung> {
  return fetchJSON<PublicBestellung>(`/public/bestellungen/${id}`);
}

export async function postBestellung(payload: unknown) {
  return fetchJSON<PublicBestellung>(`/public/bestellungen`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}
