import { getNotificationRecipients } from '../../../services/settings';
import {
  resolveInvoiceDownloadUrl,
  resolveAdminOrderLink,
  resolveOrderIdentifier,
} from './order-links';

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

const toISODate = (input?: string | Date): string => {
  if (!input) {
    return new Date().toISOString().slice(0, 10);
  }
  const date = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(date.getTime())) {
    return new Date().toISOString().slice(0, 10);
  }
  return date.toISOString().slice(0, 10);
};

const formatCurrency = (value: unknown): string => {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return '';
  }
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(number);
};

const toNumberOrZero = (value: unknown): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const escapeHtml = (input: unknown): string =>
  String(input ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

export type PositionSummary = {
  titel: string;
  beschreibung?: string;
  typ?: string;
  menge: number;
  summeBrutto: number;
  summeNetto: number;
};

export const summarisePositionsForMail = (positions: any[]): PositionSummary[] =>
  (positions || []).map((position) => {
    const menge = Math.max(1, Number(position?.menge ?? 1)) || 1;
    const summeBrutto = Number(position?.summeBrutto ?? position?.einzelpreisBrutto ?? 0);
    const summeNetto = Number(position?.summeNetto ?? position?.einzelpreisNetto ?? 0);
    return {
      titel: String(position?.titel ?? position?.name ?? 'Position'),
      beschreibung: position?.beschreibung ? String(position.beschreibung) : undefined,
      typ: position?.typ ? String(position.typ) : undefined,
      menge,
      summeBrutto,
      summeNetto,
    };
  });

const buildPositionsTableHtml = (positions: PositionSummary[]): string => {
  if (!positions.length) {
    return '<p>Keine Positionen vorhanden.</p>';
  }

  const rows = positions
    .map(
      (position) =>
        `<tr>` +
        `<td style="padding:6px 0;">${escapeHtml(position.titel)}</td>` +
        `<td style="padding:6px 0;text-align:right;">${escapeHtml(position.menge)}</td>` +
        `<td style="padding:6px 0;text-align:right;">${escapeHtml(formatCurrency(position.summeBrutto))}</td>` +
        `</tr>`
    )
    .join('');

  return `<table style="width:100%;border-collapse:collapse;">
    <thead>
      <tr>
        <th style="text-align:left;border-bottom:1px solid #e5e7eb;padding:6px 0;">Position</th>
        <th style="text-align:right;border-bottom:1px solid #e5e7eb;padding:6px 0;">Menge</th>
        <th style="text-align:right;border-bottom:1px solid #e5e7eb;padding:6px 0;">Summe</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>`;
};

const buildPositionsListText = (positions: PositionSummary[]): string => {
  if (!positions.length) {
    return 'Keine Positionen vorhanden.';
  }
  return positions
    .map((position) => {
      const parts: string[] = [position.titel];
      if (position.beschreibung) {
        parts.push(String(position.beschreibung));
      }
      parts.push(`Menge: ${position.menge}`);
      parts.push(`Summe: ${formatCurrency(position.summeBrutto)}`);
      return parts.join(' · ');
    })
    .join('\n');
};

type NotificationTotals = {
  brutto: number;
  netto: number;
  steuer: number;
  gutschein: number;
  versandkosten?: number;
};

export interface OrderNotificationContext {
  order: any;
  positions: PositionSummary[];
  totals: NotificationTotals;
}

const buildCustomerPlatzhalter = (context: OrderNotificationContext) => {
  const { order, positions, totals } = context;
  const orderIdentifier = order.bestellnummer || order.documentId || String(order.id);
  const invoiceLink = resolveInvoiceDownloadUrl(order, 'invoice');

  return {
    kunde: {
      vorname: order.vorname || '',
      nachname: order.nachname || '',
      email: order.email || '',
    },
    bestellung: {
      bestellnummer: orderIdentifier,
      summeBrutto: formatCurrency(totals.brutto ?? order.zuZahlenBrutto ?? order.summePositionenBrutto),
      zahlungsbetrag: formatCurrency(totals.brutto),
      zahlungsstatus: order.bestellstatus,
      zahlungsmethode: order.zahlungsmethode,
      positionen: positions,
      positionenTableHtml: buildPositionsTableHtml(positions),
    },
    links: {
      ...(invoiceLink ? { rechnung: invoiceLink } : {}),
    },
  };
};

const buildBackofficePlatzhalter = (context: OrderNotificationContext) => {
  const { order, positions, totals } = context;
  const orderIdentifier = order.bestellnummer || order.documentId || String(order.id);
  const invoiceLink = resolveInvoiceDownloadUrl(order, 'invoice');

  return {
    bestellung: {
      bestellnummer: orderIdentifier,
      summeBrutto: formatCurrency(totals.brutto ?? order.zuZahlenBrutto ?? order.summePositionenBrutto),
      summeNetto: formatCurrency(totals.netto ?? order.zuZahlenNetto ?? order.summePositionenNetto),
      summeSteuer: formatCurrency(totals.steuer ?? order.zuZahlenSteuer ?? order.summeSteuer),
      gutscheinBetrag: formatCurrency(totals.gutschein ?? order.gutscheinBetrag ?? 0),
      rechnungstyp: order.rechnungstyp,
      status: order.bestellstatus,
      zahlungsmethode: order.zahlungsmethode,
      kunde: {
        vorname: order.vorname || '',
        nachname: order.nachname || '',
        email: order.email || '',
        telefon: order.telefon || '',
      },
      adresse: {
        firmenname: order.firmenname || '',
        rechnungsEmail: order.rechnungsEmail || '',
        ustId: order.ustId || '',
        strasse: order.strasse || '',
        plz: order.plz || '',
        stadt: order.stadt || '',
        land: order.land || '',
      },
      positionenTableHtml: buildPositionsTableHtml(positions),
      positionenText: buildPositionsListText(positions),
      notizen: order.notizen || '',
    },
    links: {
      ...(invoiceLink ? { rechnung: invoiceLink } : {}),
    },
  };
};

const buildStornoCustomerPlatzhalter = (context: OrderNotificationContext) => {
  const base = buildCustomerPlatzhalter(context);
  const stornoLink = resolveInvoiceDownloadUrl(context.order, 'storno');
  const invoiceLink = resolveInvoiceDownloadUrl(context.order, 'invoice');
  const stornoDatum = context.order?.updatedAt ? toISODate(context.order.updatedAt) : toISODate();
  return {
    ...base,
    stornierung: {
      datum: stornoDatum,
    },
    links: {
      ...(base.links || {}),
      ...(invoiceLink ? { rechnung: invoiceLink } : {}),
      ...(stornoLink ? { stornoRechnung: stornoLink } : {}),
    },
  };
};

const buildStornoBackofficePlatzhalter = (context: OrderNotificationContext) => {
  const base = buildBackofficePlatzhalter(context);
  const stornoLink = resolveInvoiceDownloadUrl(context.order, 'storno');
  const invoiceLink = resolveInvoiceDownloadUrl(context.order, 'invoice');
  const stornoDatum = context.order?.updatedAt ? toISODate(context.order.updatedAt) : toISODate();
  return {
    ...base,
    stornierung: {
      datum: stornoDatum,
    },
    links: {
      ...(base.links || {}),
      ...(invoiceLink ? { rechnung: invoiceLink } : {}),
      ...(stornoLink ? { stornoRechnung: stornoLink } : {}),
    },
  };
};

export async function sendOrderNotifications(strapi: any, context: OrderNotificationContext) {
  const notificationService = strapi.service('api::benachrichtigung.benachrichtigung');
  if (!notificationService?.send) {
    strapi.log.warn('[publicCreate Bestellung] Benachrichtigungen können nicht gesendet werden (Service send fehlt).');
    return;
  }

  const isBusiness = (context.order?.rechnungstyp || '').toLowerCase() === 'firma' || !!context.order?.rechnungsEmail;
  const recipients = Array.from(
    new Set(
      [
        context.order?.email,
        ...(isBusiness && context.order?.rechnungsEmail ? [context.order.rechnungsEmail] : []),
      ]
        .filter(Boolean)
        .map((value) => String(value).trim())
    )
  );

  if (recipients.length > 0) {
    try {
      await notificationService.send({
        anwendungsfall: 'bestellbestaetigung',
        recipients,
        platzhalter: buildCustomerPlatzhalter(context),
        categories: ['bestellung', 'kunde'],
      });
    } catch (error: any) {
      strapi.log.error('[publicCreate Bestellung] Kundenbenachrichtigung fehlgeschlagen.', {
        bestellungId: context.order?.id,
        error: error?.message ?? error,
      });
    }
  }

  try {
    const backofficeRecipients = await getNotificationRecipients(strapi, 'bestellung');
    const recipientEmails = backofficeRecipients
      .map((recipient) => recipient.email?.trim())
      .filter((email) => !!email) as string[];

    if (recipientEmails.length > 0) {
      await notificationService.send({
        anwendungsfall: 'backoffice_benachrichtigung',
        recipients: recipientEmails,
        platzhalter: buildBackofficePlatzhalter(context),
        categories: ['bestellung', 'backoffice'],
      });
    }
  } catch (error: any) {
    strapi.log.error('[publicCreate Bestellung] Backoffice-Benachrichtigung fehlgeschlagen.', {
      bestellungId: context.order?.id,
      error: error?.message ?? error,
    });
  }
}

async function sendStornoNotifications(strapi: any, context: OrderNotificationContext) {
  const notificationService = strapi.service('api::benachrichtigung.benachrichtigung');
  if (!notificationService?.send) {
    strapi.log.warn('[bestellung.storno] Benachrichtigungen können nicht gesendet werden (Service send fehlt).');
    return;
  }

  const isBusiness = (context.order?.rechnungstyp || '').toLowerCase() === 'firma' || !!context.order?.rechnungsEmail;
  const customerRecipients = Array.from(
    new Set(
      [
        context.order?.email,
        ...(isBusiness && context.order?.rechnungsEmail ? [context.order.rechnungsEmail] : []),
      ]
        .filter(Boolean)
        .map((value) => String(value).trim())
    )
  );

  if (customerRecipients.length > 0) {
    try {
      await notificationService.send({
        anwendungsfall: 'storno_bestaetigung',
        recipients: customerRecipients,
        platzhalter: buildStornoCustomerPlatzhalter(context),
        categories: ['bestellung', 'storno', 'kunde'],
      });
    } catch (error: any) {
      strapi.log.error('[bestellung.storno] Kundenbenachrichtigung fehlgeschlagen.', {
        bestellungId: context.order?.id,
        error: error?.message ?? error,
      });
    }
  }

  try {
    const stornoRecipients = await getNotificationRecipients(strapi, 'storno');
    const recipientEmails = stornoRecipients
      .map((recipient) => recipient.email?.trim())
      .filter((email) => !!email) as string[];

    if (recipientEmails.length > 0) {
      await notificationService.send({
        anwendungsfall: 'storno_backoffice',
        recipients: recipientEmails,
        platzhalter: buildStornoBackofficePlatzhalter(context),
        categories: ['bestellung', 'storno', 'backoffice'],
      });
    }
  } catch (error: any) {
    strapi.log.error('[bestellung.storno] Storno-Backoffice-Benachrichtigung fehlgeschlagen.', {
      bestellungId: context.order?.id,
      error: error?.message ?? error,
    });
  }
}

export const getOrderNotificationFetchOptions = (): Record<string, unknown> => ({
  populate: {
    positionen: true,
    gutscheine: { fields: ['code', 'betrag'] },
  },
  fields: ['*'] as any,
});

export async function sendStornoNotificationsForOrder(strapi: any, orderId: number): Promise<void> {
  if (!orderId) {
    return;
  }
  try {
    const fetchOptions: any = getOrderNotificationFetchOptions();
    const order = await strapi.entityService.findOne('api::bestellung.bestellung', orderId, fetchOptions);
    if (!order) {
      strapi.log.warn('[bestellung.storno] Bestellung für Benachrichtigung nicht gefunden.', { orderId });
      return;
    }

    const positionsSource = Array.isArray((order as any)?.positionen) ? (order as any).positionen : [];
    const positions = summarisePositionsForMail(positionsSource);
    const totals: NotificationTotals = {
      brutto: toNumberOrZero(order.zuZahlenBrutto ?? order.summePositionenBrutto),
      netto: toNumberOrZero(order.zuZahlenNetto ?? order.summePositionenNetto),
      steuer: toNumberOrZero(order.zuZahlenSteuer ?? order.summeSteuer),
      gutschein: toNumberOrZero(order.gutscheinBetrag),
      versandkosten: toNumberOrZero(order.versandkosten),
    };

    await sendStornoNotifications(strapi, {
      order,
      positions,
      totals,
    });
  } catch (error: any) {
    strapi.log.error('[bestellung.storno] Benachrichtigung konnte nicht erzeugt werden.', {
      orderId,
      error: error?.message ?? error,
    });
  }
}
