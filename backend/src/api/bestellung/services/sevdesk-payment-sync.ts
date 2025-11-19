import {
  fetchInvoice,
  fetchInvoiceWithDocument,
  findCancellationInvoice,
  findDocumentForInvoice,
  isSevDeskSyncEnabled,
  SevDeskError,
  extractDocumentId,
} from '../../../services/sevdesk';

const DISABLED_FLAGS = new Set(['0', 'false', 'no', 'off', 'disabled']);
const DEFAULT_BATCH_SIZE = 25;
const AMOUNT_TOLERANCE = 0.05;

type Numeric = number | null;

type PaymentEvaluation = {
  paid: boolean;
  cancelled: boolean;
  reason?: string;
  status?: Numeric;
  statusCalculated?: Numeric;
  statusText?: string;
  openAmount?: Numeric;
  paidAmount?: Numeric;
  sumGross?: Numeric;
  payDate?: string | null;
};

let syncInFlight = false;

function parsePositiveInteger(value: string | undefined, fallback: number): number {
  if (!value) {
    return fallback;
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return Math.max(1, Math.floor(parsed));
}

function isFlagEnabled(rawValue: string | undefined, defaultEnabled = true): boolean {
  if (!rawValue) {
    return defaultEnabled;
  }
  return !DISABLED_FLAGS.has(rawValue.trim().toLowerCase());
}

function isPaymentSyncEnabled(): boolean {
  return isFlagEnabled(process.env.SEVDESK_PAYMENT_SYNC_ENABLED, true);
}

function parseNumber(value: unknown): Numeric {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }
    const cleaned = trimmed.replace(/[^0-9,.\-]/g, '');
    if (!cleaned) {
      return null;
    }
    const usesComma = cleaned.includes(',') && cleaned.lastIndexOf(',') > cleaned.lastIndexOf('.');
    const normalised = usesComma ? cleaned.replace(/\./g, '').replace(',', '.') : cleaned.replace(',', '.');
    const parsed = Number.parseFloat(normalised);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function pickInvoiceEntity(payload: any): any | null {
  if (!payload) {
    return null;
  }
  const direct = payload.invoiceNumber || payload.sumGross != null || payload.status != null ? payload : null;
  if (direct) {
    return payload;
  }

  if (payload.object && typeof payload.object === 'object') {
    const nested = payload.object;
    if (nested.invoiceNumber || nested.sumGross != null || nested.status != null) {
      return nested;
    }
  }

  const candidates = [payload.objects, payload.data];
  for (const list of candidates) {
    if (Array.isArray(list) && list.length > 0) {
      const entry =
        list.find((item) => {
          if (!item) {
            return false;
          }
          if (item.invoiceNumber || item.sumGross != null || item.status != null) {
            return true;
          }
          const name = typeof item.objectName === 'string' ? item.objectName.toLowerCase() : '';
          return name === 'invoice';
        }) ?? list[0];
      if (entry) {
        return entry;
      }
    }
  }

  return null;
}

function normaliseDateish(value: unknown): string | null {
  if (!value) {
    return null;
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed ? trimmed : null;
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      return null;
    }
    const ms = value > 1_000_000_000_000 ? value : value * 1000;
    const date = new Date(ms);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }
  if (typeof value === 'object') {
    if ('date' in (value as any) && typeof (value as any).date === 'string') {
      return (value as any).date;
    }
    if ('iso' in (value as any) && typeof (value as any).iso === 'string') {
      return (value as any).iso;
    }
  }
  return null;
}

function evaluateInvoicePaymentState(payload: any): PaymentEvaluation {
  const invoice = pickInvoiceEntity(payload);
  const status = parseNumber(invoice?.status);
  const statusCalculated = parseNumber(invoice?.statusCalculated);
  const statusText =
    typeof invoice?.statusText === 'string' && invoice.statusText.trim()
      ? invoice.statusText.trim()
      : typeof invoice?.statusTranslated === 'string'
        ? invoice.statusTranslated.trim()
        : undefined;
  const openAmount =
    parseNumber(invoice?.openAmount) ??
    parseNumber(invoice?.openAmountConverted) ??
    parseNumber(invoice?.sumOpen) ??
    parseNumber(invoice?.sumNetOutstanding);
  const paidAmount =
    parseNumber(invoice?.amountPaid) ??
    parseNumber(invoice?.sumPaid) ??
    parseNumber(invoice?.paymentAmount) ??
    parseNumber(invoice?.payAmount);
  const sumGross =
    parseNumber(invoice?.sumGross) ??
    parseNumber(invoice?.amountGross) ??
    parseNumber(invoice?.amount) ??
    parseNumber(invoice?.totalGross);
  const payDate =
    normaliseDateish(invoice?.payDate) ??
    normaliseDateish(invoice?.paidDate) ??
    normaliseDateish(invoice?.payDateObject) ??
    normaliseDateish(invoice?.lastPaymentDate);

  const result: PaymentEvaluation = {
    paid: false,
    cancelled: false,
    status,
    statusCalculated,
    statusText,
    openAmount,
    paidAmount,
    sumGross,
    payDate,
  };

  const resolvedStatus = status ?? statusCalculated;
  if (typeof resolvedStatus === 'number' && resolvedStatus >= 1000) {
    result.paid = true;
    result.reason = 'status>=1000';
    return result;
  }

  if (statusText) {
    const statusLower = statusText.toLowerCase();
    if (statusLower.includes('bezahlt') || statusLower.includes('paid')) {
      result.paid = true;
      result.reason = 'statusText';
      return result;
    }
  }

  if (payDate) {
    result.paid = true;
    result.reason = 'payDate';
    return result;
  }

  if (typeof openAmount === 'number' && openAmount <= AMOUNT_TOLERANCE) {
    result.paid = true;
    result.reason = 'openAmount<=tolerance';
    return result;
  }

  if (
    typeof sumGross === 'number' &&
    typeof paidAmount === 'number' &&
    paidAmount + AMOUNT_TOLERANCE >= sumGross
  ) {
    result.paid = true;
    result.reason = 'paidAmount>=sumGross';
    return result;
  }

  return result;
}

async function findPendingInvoiceOrders(strapi: any, limit: number) {
  const candidates = await strapi.entityService.findMany('api::bestellung.bestellung', {
    fields: ['id', 'bestellnummer', 'sevdeskInvoiceId', 'zahlungsmethode'],
    filters: {
      bestellstatus: 'offen',
      zahlungsmethode: 'rechnung',
      sevdeskInvoiceId: {
        $notNull: true,
        $not: '',
      },
    },
    sort: { updatedAt: 'desc' },
    limit,
  });
  return Array.isArray(candidates) ? candidates : [];
}

async function resolveDocumentIdForInvoice(strapi: any, invoiceId: number | string): Promise<string | null> {
  const documentEntry = await findDocumentForInvoice(strapi, invoiceId);
  if (documentEntry?.id) {
    return String(documentEntry.id);
  }
  try {
    const invoiceWithDocument = await fetchInvoiceWithDocument(strapi, invoiceId);
    const documentRef = extractDocumentId(invoiceWithDocument);
    if (documentRef?.id) {
      return String(documentRef.id);
    }
  } catch (error) {
    strapi?.log?.warn?.('[SevDesk Payment Sync] Dokument konnte nicht ermittelt werden.', {
      invoiceId,
      error: error instanceof Error ? error.message : error,
    });
  }
  return null;
}

export function resolvePaymentSyncBatchSize(): number {
  return parsePositiveInteger(process.env.SEVDESK_PAYMENT_SYNC_BATCH, DEFAULT_BATCH_SIZE);
}

export async function runSevDeskPaymentStatusSync(strapi: any): Promise<void> {
  if (!isSevDeskSyncEnabled()) {
    return;
  }
  if (!isPaymentSyncEnabled()) {
    return;
  }
  if (!process.env.SEVDESK_API_TOKEN) {
    strapi?.log?.debug?.('[SevDesk Payment Sync] Übersprungen: Kein API-Token gesetzt.');
    return;
  }
  if (syncInFlight) {
    strapi?.log?.warn?.('[SevDesk Payment Sync] Läuft bereits – erneuter Start übersprungen.');
    return;
  }

  syncInFlight = true;
const runMeta = {
  startedAt: new Date().toISOString(),
};
  strapi?.log?.info?.('[SevDesk Payment Sync] Cronlauf gestartet.', runMeta);
  const startedAt = Date.now();
  const summary = {
    processed: 0,
    markedPaid: 0,
    markedCancelled: 0,
    skipped: 0,
    errors: 0,
  };

  try {
    const batchSize = resolvePaymentSyncBatchSize();
    const candidates = await findPendingInvoiceOrders(strapi, batchSize);
    if (!candidates.length) {
      strapi?.log?.debug?.('[SevDesk Payment Sync] Keine offenen Rechnungen zur Prüfung gefunden.');
      return;
    }

    for (const order of candidates) {
      summary.processed += 1;
      const invoiceId = order.sevdeskInvoiceId;
      if (!invoiceId) {
        summary.skipped += 1;
        continue;
      }

      try {
        const invoicePayload = await fetchInvoice(strapi, invoiceId);
        const evaluation = evaluateInvoicePaymentState(invoicePayload);
        const logMeta = {
          orderId: order.id,
          bestellnummer: order.bestellnummer,
          invoiceId,
          status: evaluation.status ?? evaluation.statusCalculated ?? null,
          statusText: evaluation.statusText,
          openAmount: evaluation.openAmount,
          paidAmount: evaluation.paidAmount,
          sumGross: evaluation.sumGross,
          payDate: evaluation.payDate,
        };

        let cancellationInvoice: { id: string | number; invoiceNumber?: string } | null = null;
        cancellationInvoice = await findCancellationInvoice(strapi, invoiceId);
        if (cancellationInvoice) {
          evaluation.cancelled = true;
          evaluation.paid = false;
        }

        if (evaluation.paid) {
          await strapi.entityService.update('api::bestellung.bestellung', order.id, {
            data: { bestellstatus: 'bezahlt' },
          });
          summary.markedPaid += 1;
          strapi?.log?.info?.('[SevDesk Payment Sync] Bestellung als bezahlt markiert.', {
            ...logMeta,
            reason: evaluation.reason,
          });
        } else if (evaluation.cancelled && cancellationInvoice) {
          const updateData: Record<string, unknown> = { bestellstatus: 'storniert' };
          const documentId = await resolveDocumentIdForInvoice(strapi, cancellationInvoice.id);
          if (documentId) {
            updateData.sevdeskStornoDocumentId = documentId;
          }
          await strapi.entityService.update('api::bestellung.bestellung', order.id, {
            data: updateData,
          });
          summary.markedCancelled += 1;
          strapi?.log?.info?.('[SevDesk Payment Sync] Bestellung als storniert markiert.', {
            ...logMeta,
            cancellationInvoiceId: cancellationInvoice.id,
            cancellationInvoiceNumber: cancellationInvoice.invoiceNumber,
          });
        } else {
          summary.skipped += 1;
          strapi?.log?.debug?.('[SevDesk Payment Sync] Rechnung weiterhin offen.', {
            ...logMeta,
            reason: evaluation.reason ?? 'pending',
          });
        }
      } catch (error) {
        summary.errors += 1;
        const meta: Record<string, unknown> = {
          orderId: order.id,
          bestellnummer: order.bestellnummer,
          invoiceId,
          error: error instanceof Error ? error.message : error,
        };
        if (error instanceof SevDeskError) {
          meta.status = error.status;
          meta.url = error.url;
          meta.details = error.details;
        }
        strapi?.log?.error?.('[SevDesk Payment Sync] Prüfung fehlgeschlagen.', meta);
      }
    }
  } finally {
    syncInFlight = false;
    strapi?.log?.info?.('[SevDesk Payment Sync] Lauf beendet.', {
      durationMs: Date.now() - startedAt,
      ...summary,
    });
  }
}
