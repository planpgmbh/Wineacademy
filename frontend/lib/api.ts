type FetchOptions = RequestInit & {
  readonly next?: {
    readonly revalidate?: number | false;
    readonly tags?: string[];
  };
};

function normaliseBase(url: string): string {
  return url.replace(/\/*$/, "");
}

function ensureLeadingSlash(path: string): string {
  return path.startsWith("/") ? path : `/${path}`;
}

export function getApiBaseUrl(): string | null {
  const base = process.env.API_INTERNAL_URL ?? process.env.NEXT_PUBLIC_API_URL;
  return base ? normaliseBase(base) : null;
}

export function buildApiUrl(path: string): string {
  const base = getApiBaseUrl();
  if (!base) {
    throw new Error("Keine API-Basis-URL konfiguriert (API_INTERNAL_URL oder NEXT_PUBLIC_API_URL).");
  }
  return `${base}${ensureLeadingSlash(path)}`;
}

export async function fetchJson<T>(path: string, init?: FetchOptions): Promise<T> {
  const url = buildApiUrl(path);
  const response = await fetch(url, {
    cache: "force-cache",
    ...init,
    headers: {
      Accept: "application/json",
      ...init?.headers,
    },
  });

  if (!response.ok) {
    const error = new Error(`Request fehlgeschlagen (${response.status} ${response.statusText}) für ${url}`) as Error & {
      status?: number;
      url?: string;
    };
    error.status = response.status;
    error.url = url;
    throw error;
  }

  return (await response.json()) as T;
}

export function getAssetsBaseUrl(): string | null {
  const assets =
    process.env.ASSETS_INTERNAL_URL ??
    process.env.NEXT_PUBLIC_ASSETS_URL ??
    process.env.API_INTERNAL_URL ??
    process.env.NEXT_PUBLIC_API_URL;

  if (!assets) {
    return null;
  }

  const cleaned = assets.endsWith("/api") ? assets.slice(0, -4) : assets;
  return normaliseBase(cleaned);
}

export function mediaUrl(path?: string | null): string | null {
  if (!path || path.length === 0) {
    return null;
  }
  if (/^https?:\/\//i.test(path)) {
    return path;
  }
  const base = getAssetsBaseUrl();
  if (!base) {
    return path;
  }
  return `${base}${ensureLeadingSlash(path)}`;
}
