const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:1337';

function joinUrl(base: string, path: string) {
  const b = base.replace(/\/$/, '');
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${b}/api${p}`; // Strapi routes are under /api
}

export async function fetchJSON<T>(path: string, init?: RequestInit): Promise<T> {
  const url = joinUrl(API_BASE, path);
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
  standardPreis?: number;
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

