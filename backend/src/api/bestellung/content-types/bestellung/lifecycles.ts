import {
  cancelInvoice,
  fetchInvoiceWithDocument,
  extractDocumentId,
  isSevDeskSyncEnabled,
} from '../../../../services/sevdesk';
import {
  fetchOrderWithDetails,
  sendPaymentConfirmedEmails,
  sendStornoEmails,
} from '../../../../services/order-notifications';

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

declare const strapi: any;

const ensureFirmaFieldsIfNeeded = (data: Record<string, unknown>) => {
  if (data.rechnungstyp === 'firma') {
    const required = ['firmenname', 'rechnungsEmail', 'strasse', 'plz', 'stadt', 'land'];
    for (const field of required) {
      const value = data[field];
      if (!value || String(value).trim() === '') {
        throw new Error(`Feld '${field}' ist bei Firmenrechnung erforderlich`);
      }
    }
  }
};

const toArray = (raw: any): any[] => {
  if (Array.isArray(raw)) return raw;
  if (raw && typeof raw === 'object') {
    if (Array.isArray(raw.set)) return raw.set;
    if (Array.isArray(raw.create)) return raw.create;
  }
  return [];
};

const assignArrayBack = (target: any, list: any[]) => {
  if (Array.isArray(target)) {
    return list;
  }
  if (target && typeof target === 'object') {
    if (Array.isArray(target.set)) target.set = list;
    if (Array.isArray(target.create)) target.create = list;
  }
  return target;
};

const normalisePositionen = (data: Record<string, any>) => {
  if (data.positionen === undefined) {
    return [];
  }
  const rawList = toArray(data.positionen);
  if (!rawList || rawList.length === 0) {
    throw new Error('Mindestens eine Position ist erforderlich');
  }
  const defaultVat = Number(process.env.VAT_RATE ?? 19);

  const normalised = rawList.map((entry: Record<string, any>) => {
    const base = { ...entry };
    const menge = Math.max(1, Number(entry?.menge ?? 1));
    const rawSteuer = entry?.steuerSatz != null ? Number(entry.steuerSatz) : defaultVat;
    const steuerSatz = Number.isFinite(rawSteuer) ? rawSteuer : defaultVat;

    let einzelpreisBrutto = entry?.einzelpreisBrutto != null ? Number(entry.einzelpreisBrutto) : undefined;
    let einzelpreisNetto = entry?.einzelpreisNetto != null ? Number(entry.einzelpreisNetto) : undefined;

    if (!Number.isFinite(einzelpreisBrutto) && Number.isFinite(Number(entry?.summeBrutto))) {
      einzelpreisBrutto = round2(Number(entry.summeBrutto) / menge);
    }
    if (!Number.isFinite(einzelpreisNetto) && Number.isFinite(Number(entry?.summeNetto))) {
      einzelpreisNetto = round2(Number(entry.summeNetto) / menge);
    }
    if (!Number.isFinite(einzelpreisBrutto) && Number.isFinite(einzelpreisNetto)) {
      einzelpreisBrutto = round2((einzelpreisNetto as number) * (1 + steuerSatz / 100));
    }
    if (!Number.isFinite(einzelpreisNetto) && Number.isFinite(einzelpreisBrutto)) {
      einzelpreisNetto = steuerSatz > 0 ? round2((einzelpreisBrutto as number) / (1 + steuerSatz / 100)) : round2(einzelpreisBrutto as number);
    }

    if (!Number.isFinite(einzelpreisBrutto)) {
      einzelpreisBrutto = 0;
    }
    if (!Number.isFinite(einzelpreisNetto)) {
      einzelpreisNetto = steuerSatz > 0 ? round2((einzelpreisBrutto as number) / (1 + steuerSatz / 100)) : round2(einzelpreisBrutto as number);
    }

    const summeBrutto = Number.isFinite(Number(entry?.summeBrutto))
      ? round2(Number(entry.summeBrutto))
      : round2((einzelpreisBrutto as number) * menge);
    const summeNetto = Number.isFinite(Number(entry?.summeNetto))
      ? round2(Number(entry.summeNetto))
      : round2((einzelpreisNetto as number) * menge);
    const summeSteuer = Number.isFinite(Number(entry?.summeSteuer))
      ? round2(Number(entry.summeSteuer))
      : round2(summeBrutto - summeNetto);

    return {
      ...base,
      menge,
      steuerSatz,
      einzelpreisBrutto: round2(einzelpreisBrutto as number),
      einzelpreisNetto: round2(einzelpreisNetto as number),
      summeBrutto,
      summeNetto,
      summeSteuer,
    };
  });

  data.positionen = assignArrayBack(data.positionen, normalised);
  return normalised;
};

async function handleSevDeskStorno(bestellungId: number) {
  if (!isSevDeskSyncEnabled()) {
    if (strapi?.log?.debug) {
      strapi.log.debug('SevDesk-Storno übersprungen: Sync deaktiviert.');
    }
    return;
  }

  if (!process.env.SEVDESK_API_TOKEN) {
    return;
  }

  try {
    const order = await strapi.entityService.findOne('api::bestellung.bestellung', bestellungId, {
      fields: ['id', 'bestellstatus', 'sevdeskInvoiceId', 'sevdeskStornoDocumentId'],
    });

    if (!order?.sevdeskInvoiceId) {
      strapi.log.warn('[Bestellung lifecycles] SevDesk-Storno übersprungen: Keine Rechnungs-ID vorhanden.', {
        bestellungId,
      });
      return;
    }

    await cancelInvoice(strapi, order.sevdeskInvoiceId);

    try {
      const invoiceWithDocument = await fetchInvoiceWithDocument(strapi, order.sevdeskInvoiceId);
      const documentRef = extractDocumentId(invoiceWithDocument);
      if (documentRef?.id && String(documentRef.id) !== order.sevdeskStornoDocumentId) {
        await strapi.entityService.update('api::bestellung.bestellung', bestellungId, {
          data: {
            sevdeskStornoDocumentId: String(documentRef.id),
          },
        });
      }
    } catch (docErr) {
      strapi.log.warn('[Bestellung lifecycles] SevDesk-Storno Dokument konnte nicht geladen werden.', {
        bestellungId,
        error: docErr instanceof Error ? docErr.message : docErr,
      });
    }
  } catch (err) {
    strapi.log.error('[Bestellung lifecycles] SevDesk-Storno fehlgeschlagen.', {
      bestellungId,
      error: err instanceof Error ? err.message : err,
    });
  }
}

async function notifyPaymentReceived(bestellungId: number) {
  try {
    const order = await fetchOrderWithDetails(strapi, bestellungId);
    if (!order) {
      return;
    }
    await sendPaymentConfirmedEmails(strapi, order, {
      paymentAmount: order.zuZahlenBrutto ?? order.summePositionenBrutto,
      paymentDate: order.updatedAt ?? new Date().toISOString(),
    });
  } catch (err) {
    strapi.log?.error?.('[Bestellung lifecycles] Zahlungsbenachrichtigung fehlgeschlagen.', {
      bestellungId,
      error: err instanceof Error ? err.message : err,
    });
  }
}

async function notifyStorno(bestellungId: number) {
  try {
    const order = await fetchOrderWithDetails(strapi, bestellungId);
    if (!order) {
      return;
    }
    await sendStornoEmails(strapi, order, {
      stornoDate: order.updatedAt ?? new Date().toISOString(),
    });
  } catch (err) {
    strapi.log?.error?.('[Bestellung lifecycles] Stornobenachrichtigung fehlgeschlagen.', {
      bestellungId,
      error: err instanceof Error ? err.message : err,
    });
  }
}

export default {
  async beforeCreate(event) {
    const data = event.params?.data ?? {};
    ensureFirmaFieldsIfNeeded(data);
    normalisePositionen(data);
  },
  async beforeUpdate(event) {
    const data = event.params?.data ?? {};
    if (!data) return;
    ensureFirmaFieldsIfNeeded(data);
    normalisePositionen(data);

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

    if (bestellungId && currentStatus === 'storniert' && previousStatus !== 'storniert') {
      await handleSevDeskStorno(bestellungId);
      await notifyStorno(bestellungId);
    }

    if (bestellungId && currentStatus === 'bezahlt' && previousStatus !== 'bezahlt') {
      await notifyPaymentReceived(bestellungId);
    }
  },
};
