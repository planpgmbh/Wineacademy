import {
  cancelInvoice,
  fetchInvoiceWithDocument,
  extractDocumentId,
  isSevDeskSyncEnabled,
  SevDeskError,
  findDocumentForInvoice,
} from '../../../../services/sevdesk';
import { sendStornoNotificationsForOrder } from '../../utils/notifications';

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

const isValidSevDeskId = (value: unknown): boolean => {
  if (value === null || value === undefined) return false;
  const numeric = Number(value);
  if (Number.isFinite(numeric)) {
    return numeric > 0;
  }
  return String(value).trim() !== '';
};

const parseSevDeskId = (payload: any): string | null => {
  if (!payload) return null;
  if (isValidSevDeskId(payload.id)) return String(payload.id);
  if (isValidSevDeskId(payload.object?.id)) return String(payload.object.id);
  if (isValidSevDeskId(payload.objects?.id)) return String(payload.objects.id);
  if (isValidSevDeskId(payload.data?.id)) return String(payload.data.id);
  if (payload.objects && typeof payload.objects === 'object' && !Array.isArray(payload.objects)) {
    for (const value of Object.values(payload.objects)) {
      if (isValidSevDeskId((value as any)?.id)) {
        return String((value as any).id);
      }
      if (isValidSevDeskId((value as any)?.object?.id)) {
        return String((value as any).object.id);
      }
    }
  }
  if (Array.isArray(payload.objects)) {
    for (const entry of payload.objects) {
      if (isValidSevDeskId(entry?.id)) return String(entry.id);
    }
  }
  if (Array.isArray(payload.data)) {
    for (const entry of payload.data) {
      if (isValidSevDeskId(entry?.id)) return String(entry.id);
    }
  }
  return null;
};

declare const strapi: any;

async function handleSevDeskStorno(bestellungId: number) {
  if (!isSevDeskSyncEnabled()) {
    if (strapi?.log?.debug) {
      strapi.log.debug('SevDesk-Storno übersprungen: Sync deaktiviert.');
    }
    return;
  }

  if (!process.env.SEVDESK_API_TOKEN) {
    if (strapi?.log?.warn) {
      strapi.log.warn('[Bestellung lifecycles] SevDesk-Storno übersprungen: Kein API-Token gesetzt.', {
        bestellungId,
      });
    }
    return;
  }

  let resolvedDocumentId: string | null = null;
  let encounteredError = false;

  try {
    if (strapi?.log?.info) {
      strapi.log.info('[Bestellung lifecycles] SevDesk-Storno gestartet.', {
        bestellungId,
      });
    }

    const order = await strapi.entityService.findOne('api::bestellung.bestellung', bestellungId, {
      fields: ['id', 'bestellstatus', 'sevdeskInvoiceId', 'sevdeskStornoDocumentId'],
    });

    if (!order?.sevdeskInvoiceId) {
      strapi.log.warn('[Bestellung lifecycles] SevDesk-Storno übersprungen: Keine Rechnungs-ID vorhanden.', {
        bestellungId,
      });
      return;
    }

    const cancelResponse: any = await cancelInvoice(strapi, order.sevdeskInvoiceId);

    if (strapi?.log?.info) {
      const responseMeta = {
        hasObjects: Boolean(cancelResponse?.objects),
        hasObject: Boolean(cancelResponse?.object),
        rawType: cancelResponse ? typeof cancelResponse : 'undefined',
      };
      strapi.log.info('[Bestellung lifecycles] SevDesk-Storno cancelInvoice aufgerufen.', {
        bestellungId,
        invoiceId: order.sevdeskInvoiceId,
        response: responseMeta,
      });
    }

    let currentStornoDocumentId = order?.sevdeskStornoDocumentId
      ? String(order.sevdeskStornoDocumentId)
      : null;

    const setDocumentIdIfNeeded = async (documentId: string, source: string) => {
      const normalizedId = String(documentId).trim();
      if (!normalizedId) return;
      if (resolvedDocumentId === normalizedId) return;
      if (currentStornoDocumentId === normalizedId) {
        resolvedDocumentId = normalizedId;
        return;
      }

      await strapi.entityService.update('api::bestellung.bestellung', bestellungId, {
        data: {
          sevdeskStornoDocumentId: normalizedId,
        },
      });

      resolvedDocumentId = normalizedId;
      currentStornoDocumentId = normalizedId;

      strapi?.log?.info?.('[Bestellung lifecycles] SevDesk-Storno Dokument aktualisiert.', {
        bestellungId,
        documentId: normalizedId,
        source,
      });
    };

    const cancelInvoiceId = parseSevDeskId(cancelResponse);
    const candidateInvoiceIds = Array.from(
      new Set(
        [cancelInvoiceId, order.sevdeskInvoiceId]
          .filter((value): value is string | number => value !== null && value !== undefined)
          .map((value) => String(value))
      )
    );

    for (const invoiceId of candidateInvoiceIds) {
      try {
        const documentEntry = await findDocumentForInvoice(strapi, invoiceId);
        if (documentEntry?.id) {
          await setDocumentIdIfNeeded(String(documentEntry.id), `Document lookup (Invoice ${invoiceId})`);
          if (resolvedDocumentId) {
            break;
          }
        }
      } catch (docErr) {
        strapi?.log?.warn?.('[Bestellung lifecycles] SevDesk-Storno Dokument konnte nicht via /Document ermittelt werden.', {
          bestellungId,
          invoiceId,
          error: docErr instanceof Error ? docErr.message : docErr,
        });
      }
    }

    if (!resolvedDocumentId) {
      for (const invoiceId of candidateInvoiceIds) {
        try {
          const invoiceWithDocument = await fetchInvoiceWithDocument(strapi, invoiceId);
          const documentRef = extractDocumentId(invoiceWithDocument);
          if (documentRef?.id) {
            await setDocumentIdIfNeeded(String(documentRef.id), `fetchInvoiceWithDocument (Invoice ${invoiceId})`);
            if (resolvedDocumentId) {
              break;
            }
          }
        } catch (docErr) {
          strapi?.log?.warn?.('[Bestellung lifecycles] SevDesk-Storno Dokument konnte nicht über fetchInvoiceWithDocument ermittelt werden.', {
            bestellungId,
            invoiceId,
            error: docErr instanceof Error ? docErr.message : docErr,
          });
        }
      }
    }
  } catch (err) {
    const baseMeta: Record<string, unknown> = {
      bestellungId,
      error: err instanceof Error ? err.message : err,
    };

    if (err instanceof SevDeskError) {
      baseMeta.status = err.status;
      baseMeta.url = err.url;
      baseMeta.details = err.details;
    }

    if (strapi?.log?.error) {
      strapi.log.error('[Bestellung lifecycles] SevDesk-Storno fehlgeschlagen.', baseMeta);
    }

    encounteredError = true;
  }

  if (strapi?.log?.info) {
    const message = encounteredError
      ? '[Bestellung lifecycles] SevDesk-Storno beendet (mit Fehler).'
      : '[Bestellung lifecycles] SevDesk-Storno abgeschlossen.';

    strapi.log.info(message, {
      bestellungId,
      documentId: resolvedDocumentId,
    });
  }
}

export default {
  async beforeUpdate(event) {
    const data = event.params?.data ?? {};
    if (!data) return;
    const id = event.params?.where?.id;
    if (id) {
      try {
        const previous = await strapi.entityService.findOne('api::bestellung.bestellung', id, {
          fields: ['id', 'bestellstatus'],
        });
        event.state = {
          ...(event.state || {}),
          previousBestellung: previous,
        };
      } catch (err) {
        strapi.log.warn('[Bestellung lifecycles] Vorherige Bestellung konnte nicht geladen werden.', {
          id,
          error: err instanceof Error ? err.message : err,
        });
      }
    }
  },
  async afterUpdate(event) {
    const previousStatus: string | undefined = event.state?.previousBestellung?.bestellstatus;
    const currentStatus: string | undefined = event.result?.bestellstatus;
    const bestellungId = event.result?.id;

    if (strapi?.log?.debug && bestellungId) {
      strapi.log.debug('[Bestellung lifecycles] Statusänderung verarbeitet.', {
        bestellungId,
        previousStatus,
        currentStatus,
      });
    }

    if (bestellungId && currentStatus === 'storniert' && previousStatus !== 'storniert') {
      await handleSevDeskStorno(bestellungId);
      await sendStornoNotificationsForOrder(strapi, bestellungId);
    }
  },
};
