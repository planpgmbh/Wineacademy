import { setTimeout as delay } from 'node:timers/promises';

const DEFAULT_BASE_URL = 'https://my.sevdesk.de/api/v1';
const MAX_RETRIES = 3;
const RETRY_BASE_DELAY_MS = 500;
const DISABLED_FLAGS = ['0', 'false', 'no', 'off', 'disabled'];

const fetchFn: typeof globalThis.fetch = (globalThis as any).fetch;
if (!fetchFn) {
  throw new Error('Global fetch ist nicht verfügbar. Node 18+ wird benötigt.');
}

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

function parsePositiveNumber(value: unknown): number | null {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }
  return parsed;
}

export function isSevDeskSyncEnabled(): boolean {
  const flag = process.env.SEVDESK_SYNC_ENABLED;
  if (!flag) {
    return true;
  }
  const normalised = flag.trim().toLowerCase();
  return !DISABLED_FLAGS.includes(normalised);
}

export interface SevDeskClientOptions {
  baseUrl?: string;
  token?: string;
  userAgent?: string;
}

export interface RequestOptions {
  method?: string;
  path: string;
  query?: Record<string, string | number | undefined | null>;
  body?: unknown;
  headers?: Record<string, string>;
  expectJson?: boolean;
}

export interface DocumentDownloadResult {
  filename?: string;
  contentType?: string;
  buffer: Buffer;
}

const WHITESPACE_BYTES = new Set([0x09, 0x0a, 0x0d, 0x20]);

type StrapiLike = {
  log?: {
    debug?: (msg: string, meta?: Record<string, unknown>) => void;
    warn?: (msg: string, meta?: Record<string, unknown>) => void;
    error?: (msg: string, meta?: Record<string, unknown>) => void;
  };
  entityService?: {
    findMany: (...args: any[]) => Promise<any>;
  };
};

class SevDeskError extends Error {
  status: number;
  url: string;
  details: unknown;

  constructor(status: number, url: string, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.url = url;
    this.details = details;
  }
}

function resolveToken(options?: SevDeskClientOptions): string {
  const token = options?.token || process.env.SEVDESK_API_TOKEN;
  if (!token) {
    throw new Error('SEVDESK_API_TOKEN ist nicht gesetzt.');
  }
  return token.trim();
}

function resolveBaseUrl(options?: SevDeskClientOptions): string {
  const base = options?.baseUrl || process.env.SEVDESK_API_BASE_URL || DEFAULT_BASE_URL;
  return base.replace(/\/$/, '');
}

function buildUrl(baseUrl: string, path: string, query?: RequestOptions['query']): URL {
  const fullPath = path.startsWith('/') ? path : `/${path}`;
  const url = new URL(`${baseUrl}${fullPath}`);
  if (query) {
    Object.entries(query)
      .filter(([_, value]) => value !== undefined && value !== null)
      .forEach(([key, value]) => url.searchParams.set(key, String(value)));
  }
  return url;
}

function createHeaders(
  token: string,
  userAgent?: string,
  extra?: Record<string, string>
): Record<string, string> {
  const headers: Record<string, string> = {
    Authorization: token,
    Accept: 'application/json',
  };
  if (userAgent) {
    headers['User-Agent'] = userAgent;
  }
  if (extra) {
    Object.entries(extra).forEach(([key, value]) => {
      if (value !== undefined) {
        headers[key] = value;
      }
    });
  }
  return headers;
}

async function handleResponse<T>(response: any, expectJson: boolean, url: string): Promise<T> {
  if (response.status === 204) {
    return undefined as T;
  }
  if (expectJson) {
    const text = await response.text();
    try {
      return JSON.parse(text) as T;
    } catch (error) {
      throw new SevDeskError(response.status, url, 'Antwort konnte nicht als JSON geparst werden.', {
        raw: text,
        parseError: error instanceof Error ? error.message : String(error),
      });
    }
  }
  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  return buffer as unknown as T;
}

async function sevDeskRequest<T>(
  strapi: StrapiLike,
  options: RequestOptions,
  clientOptions?: SevDeskClientOptions
): Promise<T> {
  const token = resolveToken(clientOptions);
  const baseUrl = resolveBaseUrl(clientOptions);
  const combinedQuery: Record<string, string | number | undefined | null> = {
    token,
    ...(options.query ?? {}),
  };
  const url = buildUrl(baseUrl, options.path, combinedQuery);
  const expectJson = options.expectJson ?? true;

  let attempt = 0;
  let lastError: unknown;

  while (attempt < MAX_RETRIES) {
    attempt += 1;
    try {
      const headers = createHeaders(
        token,
        clientOptions?.userAgent || 'WineAcademy/Strapi-SevDesk',
        options.headers
      );
      let body: any;

      if (options.body !== undefined && options.body !== null) {
        const contentType = headers['Content-Type'] ?? 'application/json';
        headers['Content-Type'] = contentType;
        body = contentType === 'application/json' ? JSON.stringify(options.body) : (options.body as any);
      }

      const response = await fetchFn(url.toString(), {
        method: options.method ?? 'GET',
        headers,
        body,
      });

      if (response.status >= 200 && response.status < 300) {
        return handleResponse<T>(response, expectJson, url.toString());
      }

      if (response.status === 429 || response.status === 503) {
        const retryAfter = Number(response.headers.get('retry-after'));
        const waitTime = Number.isFinite(retryAfter) ? retryAfter * 1000 : RETRY_BASE_DELAY_MS * attempt;
        if (strapi?.log?.warn) {
          strapi.log.warn('SevDesk-Request wird aufgrund von Rate-Limit erneut versucht.', {
            url: url.toString(),
            status: response.status,
            attempt,
            waitTime,
          });
        }
        await delay(waitTime);
        continue;
      }

      const errorDetails = await response.text();
      throw new SevDeskError(response.status, url.toString(), 'SevDesk-Request fehlgeschlagen.', {
        body: errorDetails,
      });
    } catch (error) {
      lastError = error;
      if (attempt >= MAX_RETRIES) {
        break;
      }
      if (strapi?.log?.warn) {
        strapi.log.warn('Retry nach Fehler beim SevDesk-Request.', {
          url: url.toString(),
          attempt,
          error: error instanceof Error ? error.message : String(error),
        });
      }
      await delay(RETRY_BASE_DELAY_MS * attempt);
    }
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

let cachedCheckAccountId: number | null | undefined;
const invalidCheckAccountIds = new Set<number>();

async function fetchDefaultCheckAccountId(strapi: StrapiLike): Promise<number | null> {
  try {
    const response = await sevDeskRequest<{ objects?: Array<Record<string, any>> }>(
      strapi,
      {
        method: 'GET',
        path: '/CheckAccount',
        query: { limit: 100, status: 100 },
      }
    );
    const accounts = Array.isArray(response?.objects) ? response.objects : [];
    if (accounts.length === 0) {
      return null;
    }

    const preferDefault =
      accounts.find((account) => String(account?.defaultAccount ?? account?.baseAccount) === '1') ||
      accounts[0];
    const id = parsePositiveNumber(preferDefault?.id ?? preferDefault?.object?.id);
    if (id) {
      return id;
    }
  } catch (error) {
    if (strapi?.log?.warn) {
      strapi.log.warn('SevDesk: Standard-Konto konnte nicht ermittelt werden.', {
        error: error instanceof Error ? error.message : error,
      });
    }
  }
  return null;
}

async function resolveCheckAccountId(strapi: StrapiLike): Promise<number | null> {
  const envValue = parsePositiveNumber(process.env.SEVDESK_CHECK_ACCOUNT_ID);
  if (envValue && !invalidCheckAccountIds.has(envValue)) {
    return envValue;
  }

  if (cachedCheckAccountId !== undefined) {
    return cachedCheckAccountId;
  }

  cachedCheckAccountId = await fetchDefaultCheckAccountId(strapi);
  return cachedCheckAccountId ?? null;
}

function normaliseSevDeskId(id: string | number): string | number {
  if (typeof id === 'number') {
    return Number.isFinite(id) ? id : String(id);
  }
  const trimmed = id.trim();
  if (trimmed === '') {
    return trimmed;
  }
  const numeric = Number(trimmed);
  if (Number.isFinite(numeric) && numeric > 0) {
    return numeric;
  }
  return trimmed;
}

function buildObjectRef(id: string | number, objectName: string) {
  return { id: normaliseSevDeskId(id), objectName };
}

type SevDeskObjectRef = { id: number | string; objectName: string };

let cachedContactPersonRef: SevDeskObjectRef | null | undefined;

function hasUsableSevDeskId(value: unknown): boolean {
  if (value === null || value === undefined) {
    return false;
  }
  const numeric = Number(value);
  if (Number.isFinite(numeric)) {
    return numeric > 0;
  }
  return String(value).trim() !== '';
}

function pickFirstEntityWithId(payload: any): SevDeskObjectRef | null {
  if (!payload) {
    return null;
  }

  const directCandidate = payload.id != null ? payload : payload.object;
  if (hasUsableSevDeskId(directCandidate?.id)) {
    return buildObjectRef(directCandidate.id, directCandidate.objectName ?? 'SevUser');
  }

  const list = Array.isArray(payload.objects)
    ? payload.objects
    : Array.isArray(payload.data)
      ? payload.data
      : [];

  if (Array.isArray(list)) {
    for (const entry of list) {
      if (hasUsableSevDeskId(entry?.id)) {
        return buildObjectRef(entry.id, entry.objectName ?? 'SevUser');
      }
    }
  }

  return null;
}

export async function resolveDefaultContactPerson(
  strapi: StrapiLike,
  clientOptions?: SevDeskClientOptions
): Promise<SevDeskObjectRef | null> {
  if (cachedContactPersonRef !== undefined) {
    return cachedContactPersonRef;
  }

  const envRaw = process.env.SEVDESK_CONTACT_PERSON_ID;
  if (envRaw) {
    const trimmed = envRaw.trim();
    if (hasUsableSevDeskId(trimmed)) {
      cachedContactPersonRef = buildObjectRef(trimmed, 'SevUser');
      return cachedContactPersonRef;
    }
    if (strapi?.log?.warn) {
      strapi.log.warn('SevDesk: SEVDESK_CONTACT_PERSON_ID ist ungültig und wird ignoriert.', {
        value: trimmed,
      });
    }
  }

  try {
    const response = await sevDeskRequest<any>(
      strapi,
      {
        method: 'GET',
        path: '/SevUser',
        query: { limit: 1 },
      },
      clientOptions
    );

    const candidate = pickFirstEntityWithId(response);
    if (candidate) {
      cachedContactPersonRef = candidate;
      return candidate;
    }

    if (strapi?.log?.warn) {
      strapi.log.warn('SevDesk: Keine Kontaktperson gefunden (GET /SevUser lieferte keine ID).');
    }
  } catch (error) {
    if (strapi?.log?.warn) {
      strapi.log.warn('SevDesk: Kontaktperson konnte nicht automatisch ermittelt werden.', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  cachedContactPersonRef = null;
  return null;
}

export interface ContactPayload {
  id?: number | string;
  categoryId: number;
  name: string;
  customerType?: 'PERSON' | 'COMPANY';
  surename?: string;
  familyname?: string;
  name2?: string;
  status?: number;
  vatNumber?: string;
  address?: {
    street?: string;
    zip?: string;
    city?: string;
    countryId?: number;
  };
  description?: string;
}

export async function saveContact(
  strapi: StrapiLike,
  payload: ContactPayload,
  clientOptions?: SevDeskClientOptions
) {
  const body: Record<string, unknown> = {
    objectName: 'Contact',
    category: buildObjectRef(payload.categoryId, 'Category'),
    name: payload.name,
    status: payload.status ?? 100,
  };

  if (payload.customerType) body.customerType = payload.customerType;
  if (payload.surename) body.surename = payload.surename;
  if (payload.familyname) body.familyname = payload.familyname;
  if (payload.name2) body.name2 = payload.name2;
  if (payload.vatNumber) body.vatNumber = payload.vatNumber;
  if (payload.description) body.description = payload.description;

  if (payload.address) {
    body.addressStreet = payload.address.street;
    body.addressZip = payload.address.zip;
    body.addressCity = payload.address.city;
    if (payload.address.countryId) {
      body.addressCountry = buildObjectRef(payload.address.countryId, 'StaticCountry');
    }
  }

  if (payload.id) {
    return sevDeskRequest(strapi, {
      method: 'PUT',
      path: `/Contact/${payload.id}`,
      body,
    }, clientOptions);
  }

  return sevDeskRequest(strapi, {
    method: 'POST',
    path: '/Contact',
    body,
  }, clientOptions);
}

export interface CommunicationWayPayload {
  contactId: number | string;
  type: 'EMAIL' | 'PHONE' | 'FAX' | 'MOBILE' | 'WEBSITE';
  value: string;
  keyId?: number | string;
  main?: boolean;
}

export async function createCommunicationWay(
  strapi: StrapiLike,
  payload: CommunicationWayPayload,
  clientOptions?: SevDeskClientOptions
) {
  const body = {
    objectName: 'CommunicationWay',
    type: payload.type,
    value: payload.value,
    object: buildObjectRef(payload.contactId, 'Contact'),
    key: buildObjectRef(payload.keyId ?? 2, 'CommunicationWayKey'),
    main: payload.main ?? true,
  };

  return sevDeskRequest(strapi, {
    method: 'POST',
    path: '/CommunicationWay',
    body,
  }, clientOptions);
}

export interface InvoiceDraftPayload {
  contactId: number | string;
  contactPersonId?: number | string;
  contactPerson?: { id: number | string; objectName?: string };
  invoiceDate: string;
  invoiceNumber?: string;
  timeToPay?: number;
  currency?: string;
  invoiceType?: 'RE' | 'RECUR';
  status?: number;
  customerInternalNote?: string;
  deliveryDate?: string;
  deliveryDateUntil?: string;
}

export async function createInvoiceDraft(
  strapi: StrapiLike,
  payload: InvoiceDraftPayload,
  clientOptions?: SevDeskClientOptions
) {
  const body: Record<string, unknown> = {
    objectName: 'Invoice',
    contact: buildObjectRef(payload.contactId, 'Contact'),
    invoiceDate: payload.invoiceDate,
    currency: payload.currency ?? 'EUR',
    invoiceType: payload.invoiceType ?? 'RE',
    status: payload.status ?? 100,
  };

  const taxRuleIdRaw = process.env.SEVDESK_TAX_RULE_ID;
  const taxRuleId = taxRuleIdRaw ? Number(taxRuleIdRaw) : 1;
  body.taxRule = buildObjectRef(Number.isFinite(taxRuleId) ? taxRuleId : 1, 'TaxRule');

  if (payload.invoiceNumber) {
    body.invoiceNumber = payload.invoiceNumber;
  }

  if (payload.contactPerson) {
    body.contactPerson = buildObjectRef(payload.contactPerson.id, payload.contactPerson.objectName ?? 'SevUser');
  } else if (payload.contactPersonId !== undefined && payload.contactPersonId !== null) {
    body.contactPerson = buildObjectRef(payload.contactPersonId, 'SevUser');
  }

  if (payload.timeToPay !== undefined) body.timeToPay = payload.timeToPay;
  if (payload.customerInternalNote) body.customerInternalNote = payload.customerInternalNote;
  if (payload.deliveryDate) body.deliveryDate = payload.deliveryDate;
  if (payload.deliveryDateUntil) body.deliveryDateUntil = payload.deliveryDateUntil;

  return sevDeskRequest(strapi, {
    method: 'POST',
    path: '/Invoice',
    body,
  }, clientOptions);
}

export interface InvoiceFactoryPayload {
  invoice: Record<string, unknown>;
  invoicePosSave: Array<Record<string, unknown>>;
  invoicePosDelete?: null;
  discountSave?: null;
  discountDelete?: null;
  takeDefaultAddress?: 'true' | 'false';
}

export async function createInvoiceByFactory(
  strapi: StrapiLike,
  payload: InvoiceFactoryPayload,
  clientOptions?: SevDeskClientOptions
) {
  return sevDeskRequest(strapi, {
    method: 'POST',
    path: '/Invoice/Factory/saveInvoice',
    body: payload,
  }, clientOptions);
}

function toUnixTimestamp(date?: string | Date): number {
  const inputDate = date ? new Date(date) : new Date();
  if (Number.isNaN(inputDate.getTime())) {
    return Math.floor(Date.now() / 1000);
  }
  return Math.floor(inputDate.getTime() / 1000);
}

export async function markInvoicePaid(
  strapi: StrapiLike,
  invoiceId: number | string,
  amount: number,
  bookingDate?: string | Date,
  clientOptions?: SevDeskClientOptions
) {
  let checkAccountId = await resolveCheckAccountId(strapi);
  if (!checkAccountId) {
    if (strapi?.log?.warn) {
      strapi.log.warn('SevDesk: Zahlung konnte nicht gebucht werden – kein gültiges CheckAccount ermittelbar.');
    }
    return;
  }

  const resolvedAmount = parsePositiveNumber(amount);
  if (!resolvedAmount) {
    if (strapi?.log?.warn) {
      strapi.log.warn('SevDesk: Zahlung konnte nicht gebucht werden – Betrag ist ungültig.', {
        invoiceId,
        amount,
      });
    }
    return;
  }

  const attemptBooking = async (accountId: number) => {
    const payload = {
      amount: round2(resolvedAmount),
      date: toUnixTimestamp(bookingDate),
      type: 'FULL_PAYMENT',
      checkAccount: buildObjectRef(accountId, 'CheckAccount'),
      createFeed: false,
    };

    await sevDeskRequest(strapi, {
      method: 'PUT',
      path: `/Invoice/${invoiceId}/bookAmount`,
      body: payload,
    }, clientOptions);
  };

  try {
    await attemptBooking(checkAccountId);
  } catch (error) {
    if (error instanceof SevDeskError) {
      if (error.status === 404) {
        const fallbackAccountId = await fetchDefaultCheckAccountId(strapi);
        if (fallbackAccountId && fallbackAccountId !== checkAccountId) {
          invalidCheckAccountIds.add(checkAccountId);
          if (strapi?.log?.warn) {
            strapi.log.warn('SevDesk: Fallback-CheckAccount wird zur Zahlungsbuchung verwendet.', {
              invoiceId,
              previousAccountId: checkAccountId,
              fallbackAccountId,
            });
          }
          cachedCheckAccountId = fallbackAccountId;
          await attemptBooking(fallbackAccountId);
          return;
        }
      }

      const bodyText =
        typeof error.details === 'object' && error.details && 'body' in (error.details as any)
          ? String((error.details as any).body)
          : '';

      if (error.status === 422 && bodyText.includes('Payment difference amount must be 0.0')) {
        if (strapi?.log?.warn) {
          strapi.log.warn('SevDesk: Rechnung bereits vollständig ausgeglichen – Zahlungsbuchung übersprungen.', {
            invoiceId,
          });
        }
        return;
      }
    }
    throw error;
  }
}

function normaliseSendType(input?: string): 'VPR' | 'VP' | 'VM' | 'VPDF' {
  const allowed = new Set(['VPR', 'VP', 'VM', 'VPDF']);
  if (!input) {
    return 'VPDF';
  }
  const upper = input.trim().toUpperCase();
  return allowed.has(upper) ? (upper as any) : 'VPDF';
}

export async function markInvoiceSent(
  strapi: StrapiLike,
  invoiceId: number | string,
  sendType?: string,
  clientOptions?: SevDeskClientOptions
) {
  const resolvedType = normaliseSendType(sendType);

  await sevDeskRequest(strapi, {
    method: 'PUT',
    path: `/Invoice/${invoiceId}/sendBy`,
    body: {
      sendType: resolvedType,
      sendDraft: false,
    },
  }, clientOptions);
}

export interface InvoicePositionPayload {
  invoiceId: number | string;
  quantity: number;
  price: number;
  taxRate: number;
  name: string;
  unityId?: number;
  text?: string;
  discount?: number;
  isPercentageDiscount?: boolean;
}

export async function createInvoicePosition(
  strapi: StrapiLike,
  payload: InvoicePositionPayload,
  clientOptions?: SevDeskClientOptions
) {
  const body: Record<string, unknown> = {
    objectName: 'InvoicePos',
    invoice: buildObjectRef(payload.invoiceId, 'Invoice'),
    quantity: payload.quantity,
    price: payload.price,
    taxRate: payload.taxRate,
    name: payload.name,
    unity: buildObjectRef(payload.unityId ?? 1, 'Unity'),
  };

  if (payload.text) body.text = payload.text;
  if (payload.discount !== undefined) {
    body.discount = payload.discount;
    body.isPercentage = payload.isPercentageDiscount ?? false;
  }

  return sevDeskRequest(strapi, {
    method: 'POST',
    path: '/InvoicePos',
    body,
  }, clientOptions);
}

export async function cancelInvoice(
  strapi: StrapiLike,
  invoiceId: number | string,
  clientOptions?: SevDeskClientOptions
) {
  return sevDeskRequest(strapi, {
    method: 'POST',
    path: `/Invoice/${invoiceId}/cancelInvoice`,
    body: {},
  }, clientOptions);
}

export interface InvoiceWithDocument {
  objects?: Array<{ document?: { id: number | string; filename?: string } }>;
  object?: { document?: { id: number | string; filename?: string } };
  document?: { id: number | string; filename?: string };
}

export interface DocumentListResponse {
  objects?: Array<Record<string, any>>;
}

export function extractDocumentId(payload: InvoiceWithDocument): { id: number | string; filename?: string } | null {
  if (payload?.document) {
    return payload.document;
  }
  if (payload?.object?.document) {
    return payload.object.document;
  }
  if (Array.isArray(payload?.objects)) {
    for (const entry of payload.objects) {
      if (entry?.document) {
        return entry.document;
      }
    }
  }
  return null;
}

export function extractInvoiceNumber(payload: any): string | null {
  const extract = (value: any): string | null => {
    if (!value) return null;
    const keys = ['invoiceNumber', 'number', 'documentNumber'];
    for (const key of keys) {
      const candidate = value[key];
      if (typeof candidate === 'string' && candidate.trim() !== '') {
        return candidate.trim();
      }
    }
    return null;
  };

  if (!payload) {
    return null;
  }

  const direct = extract(payload);
  if (direct) return direct;
  const objectValue = extract(payload.object);
  if (objectValue) return objectValue;
  if (Array.isArray(payload.objects)) {
    for (const entry of payload.objects) {
      const nested = extract(entry);
      if (nested) return nested;
    }
  }
  if (Array.isArray(payload.data)) {
    for (const entry of payload.data) {
      const nested = extract(entry);
      if (nested) return nested;
    }
  }
  return null;
}

export async function fetchInvoiceWithDocument(
  strapi: StrapiLike,
  invoiceId: number | string,
  clientOptions?: SevDeskClientOptions
): Promise<InvoiceWithDocument> {
  return sevDeskRequest(strapi, {
    method: 'GET',
    path: `/Invoice/${invoiceId}`,
    query: { embed: 'document' },
  }, clientOptions);
}

export async function findDocumentForInvoice(
  strapi: StrapiLike,
  invoiceId: number | string,
  clientOptions?: SevDeskClientOptions
): Promise<{ id: number | string; filename?: string } | null> {
  const response = await sevDeskRequest<DocumentListResponse>(
    strapi,
    {
      method: 'GET',
      path: '/Document',
      query: { objectName: 'Invoice', objectId: invoiceId, limit: 5 },
    },
    clientOptions
  );
  const objects = Array.isArray(response?.objects) ? response.objects : [];
  if (!objects.length) {
    return null;
  }
  const entry = objects.find((obj) => {
    const baseObjectId = obj?.baseObject?.id ?? obj?.object?.id;
    if (!baseObjectId) return false;
    return String(baseObjectId) === String(invoiceId);
  }) ?? objects[0];
  if (!entry?.id) {
    return null;
  }
  return {
    id: entry.id,
    filename: entry.filename || entry.documentNumber || entry.name,
  };
}

export async function downloadDocument(
  strapi: StrapiLike,
  documentId: number | string,
  filename?: string,
  clientOptions?: SevDeskClientOptions
): Promise<DocumentDownloadResult> {
  const response = await sevDeskRequest<Buffer>(
    strapi,
    {
      method: 'GET',
      path: `/Document/${documentId}/download`,
      query: filename ? { filename } : undefined,
      headers: { Accept: 'application/pdf' },
      expectJson: false,
    },
    clientOptions
  );

  let resolvedFilename = filename;
  let contentType = 'application/pdf';
  let buffer = response;

  // SevDesk liefert PDFs über die API häufig als JSON (Base64-kodiert). Erkennen & dekodieren.
  let firstNonWsByte: number | null = null;
  for (const byte of response) {
    if (!WHITESPACE_BYTES.has(byte)) {
      firstNonWsByte = byte;
      break;
    }
  }

  if (firstNonWsByte === 0x7b /* '{' */) {
    try {
      const asText = response.toString('utf-8');
      const parsed = JSON.parse(asText);
      const candidate =
        parsed?.objects && !Array.isArray(parsed.objects) ? parsed.objects : Array.isArray(parsed?.objects) ? parsed.objects[0] : parsed?.object;
      const base64Content = candidate?.content;
      const isBase64 = candidate?.base64Encoded === true || candidate?.base64Encoded === 'true';

      if (base64Content && isBase64) {
        const cleaned = String(base64Content).replace(/\s+/g, '');
        buffer = Buffer.from(cleaned, 'base64');
      } else if (typeof base64Content === 'string') {
        buffer = Buffer.from(base64Content, 'utf-8');
      }

      if (!resolvedFilename) {
        const candidateFilename = candidate?.filename;
        if (candidateFilename) {
          resolvedFilename = String(candidateFilename);
        }
      }
      if (candidate?.mimetype) {
        contentType = String(candidate.mimetype);
      }
    } catch (error) {
      strapi?.log?.warn?.('SevDesk-Download konnte nicht als JSON interpretiert werden – Rohdaten werden verwendet.', {
        documentId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return {
    filename: resolvedFilename,
    contentType,
    buffer,
  };
}

export { SevDeskError };
