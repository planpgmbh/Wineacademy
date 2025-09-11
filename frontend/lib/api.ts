// Use internal URL on server (container network), public URL on client
const SERVER_BASE = process.env.API_INTERNAL_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:1337';
const CLIENT_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:1337';

function stripApiSuffix(u: string) {
  return u.replace(/\/?api\/?$/, '');
}

const SERVER_MEDIA_BASE = process.env.ASSETS_INTERNAL_URL
  ? process.env.ASSETS_INTERNAL_URL
  : stripApiSuffix(SERVER_BASE);
const CLIENT_MEDIA_BASE = process.env.NEXT_PUBLIC_ASSETS_URL
  ? process.env.NEXT_PUBLIC_ASSETS_URL
  : stripApiSuffix(CLIENT_BASE);

function joinUrl(base: string, path: string) {
  const b = base.replace(/\/$/, '');
  const hasApi = /\/api$/i.test(b);
  const apiBase = hasApi ? b : `${b}/api`;
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${apiBase}${p}`; // Strapi routes are under /api
}

export async function fetchJSON<T>(path: string, init?: RequestInit): Promise<T> {
  const isServer = typeof window === 'undefined';
  const base = isServer ? SERVER_BASE : CLIENT_BASE;
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
  seminarname: string;
  slug: string;
  kurzbeschreibung?: string;
  beschreibung?: string;
  infos?: string;
  standardPreis?: number;
  mitMwst?: boolean;
  bild?: { url: string; alternativeText?: string } | null;
  termine?: Array<{
    id: number;
    kapazitaet?: number;
    preis?: number;
    planungsstatus?: string;
    tage?: Array<{ datum: string; startzeit?: string; endzeit?: string }>;
    ort?: { standort?: string; typ?: string; veranstaltungsort?: string; stadt?: string };
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

export type PublicBuchung = {
  id: number;
  status: string;
  zahlungsmethode?: string | null;
  anzahl: number;
  gesamtpreisBrutto: number;
  gesamtpreisNetto?: number;
  gesamtsteuerBetrag?: number;
};

export async function getBuchungPublic(id: number): Promise<PublicBuchung> {
  return fetchJSON<PublicBuchung>(`/public/buchungen/${id}`);
}
