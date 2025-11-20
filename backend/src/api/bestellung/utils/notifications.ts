import { getNotificationRecipients } from '../../../services/settings';
import { resolveInvoiceDownloadUrl, resolveAdminOrderLink, resolveOrderIdentifier, resolvePreviewUrl } from './order-links';

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

const formatDateLabel = (input: string | Date): string => {
  const date = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  return date.toLocaleDateString('de-DE', {
    weekday: 'long',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
};

const formatTime = (input?: string | null): string => {
  if (!input) return '';
  const parts = input.split(':');
  if (parts.length >= 2) {
    return `${parts[0]}:${parts[1]}`;
  }
  return input;
};

const buildTermineHtml = (order: any) => {
  const publicBase =
    process.env.EMAIL_LOGO_URL ||
    process.env.PUBLIC_URL ||
    process.env.FRONTEND_BASE_URL ||
    '';
  const logoUrl = publicBase
    ? `${publicBase.replace(/\/$/, '')}/icons/WineAcademy.png`
    : '/icons/WineAcademy.png';

  const buchungen = Array.isArray(order?.buchungen) ? order.buchungen : [];
  const positionen = Array.isArray(order?.positionen) ? order.positionen : [];
  const termineMap = new Map<number, any>();

  const addTermin = (termin: any, snapshot?: any) => {
    if (termin?.id) {
      if (!termineMap.has(termin.id)) {
        termineMap.set(termin.id, termin);
      }
      return;
    }
    if (snapshot?.terminId && !termineMap.has(snapshot.terminId)) {
      termineMap.set(snapshot.terminId, {
        id: snapshot.terminId,
        seminar: { name: snapshot.seminarName },
        tageMitUhrzeit: snapshot.tage,
        standort: snapshot.standort,
      });
    }
  };

  for (const buchung of buchungen) {
    addTermin(buchung?.termin, (buchung as any)?.terminSnapshot);
  }

  for (const position of positionen) {
    addTermin((position as any)?.termin, (position as any)?.terminSnapshot);
  }

  if (termineMap.size === 0) {
    return { html: '', text: '', logoUrl, hasEntries: false };
  }

  const divider = '<hr style="border:0;border-top:1px solid #e2e3e5;margin:20px 0;" />';

  const blocks: string[] = [];
  const textBlocks: string[] = [];

  Array.from(termineMap.values()).forEach((termin, index, arr) => {
    const seminarName = termin?.seminar?.name || 'Seminartermine';
    const tage = Array.isArray(termin?.tageMitUhrzeit) ? termin.tageMitUhrzeit : [];

    const tageHtml = tage
      .map((tag: any) => {
        const datum = formatDateLabel(tag?.datum);
        const start = formatTime(tag?.startzeit);
        const ende = formatTime(tag?.endzeit);
        const timePart = start && ende ? `${start} – ${ende}` : start || ende || '';
        return `<p style="margin:0 0 2px 0;font-size:16px;line-height:1.5;color:#111110;">${datum}${
          timePart ? ` ${timePart}` : ''
        }</p>`;
      })
      .join('');

    const tageText = tage
      .map((tag: any) => {
        const datum = formatDateLabel(tag?.datum);
        const start = formatTime(tag?.startzeit);
        const ende = formatTime(tag?.endzeit);
        const timePart = start && ende ? `${start} – ${ende}` : start || ende || '';
        return `${datum}${timePart ? ` ${timePart}` : ''}`;
      })
      .join('\n');

    const standort = termin?.standort;
    const ortLines = [standort?.strasse, [standort?.plz, standort?.stadt].filter(Boolean).join(' ') || undefined]
      .filter(Boolean)
      .map(
        (line) =>
          `<p style="margin:0 0 2px 0;font-size:16px;line-height:1.5;color:#111110;">${escapeHtml(
            line as string
          )}</p>`
      )
      .join('');

    const ortText = [[standort?.strasse, standort?.plz, standort?.stadt].filter(Boolean).join(' ')]
      .filter(Boolean)
      .join('\n');

    blocks.push(
      `<div style="margin:0 0 16px 0;">
        <h3 style="margin:0 0 6px 0;">${escapeHtml(seminarName)}</h3>
        <p style="margin:15px 0 4px 0;font-size:16px;line-height:1.4;font-weight:700;color:#111110;">Wann:</p>
        <div style="margin:0 0 8px 0;">${tageHtml}</div>
        <p style="margin:15px 0 4px 0;font-weight:700;font-size:16px;color:#111110;">Wo:</p>
        <p style="margin:0 0 2px 0;font-size:16px;line-height:1.5;color:#111110;">${escapeHtml(
          standort?.name || 'Standort'
        )}</p>
        ${ortLines}
      </div>`
    );

    textBlocks.push([seminarName, `Wann:\n${tageText}`, `Wo:\n${ortText}`].filter(Boolean).join('\n'));

    if (index < arr.length - 1) {
      blocks.push(divider);
    }
  });

  return { html: blocks.join(''), text: textBlocks.join('\n\n'), logoUrl, hasEntries: true };
};

const buildTeilnehmerHtml = (order: any) => {
  const buchungen = Array.isArray(order?.buchungen) ? order.buchungen : [];
  if (!buchungen.length) return '';
  const items = buchungen
    .map((b: any) => {
      const seminarName =
        b?.termin?.seminar?.name ||
        b?.terminSnapshot?.seminarName ||
        (b?.termin?.titel ? String(b.termin.titel) : '');
      const startDate = b?.termin?.starttag || b?.terminSnapshot?.starttag;
      const terminLabel = seminarName
        ? `${seminarName}${startDate ? ` (${formatDateLabel(startDate)})` : ''}`
        : startDate
        ? formatDateLabel(startDate)
        : '';
      const zeilen: string[] = [
        `<p style="margin:0 0 2px 0;font-size:16px;line-height:1.5;color:#111110;"><strong>${escapeHtml(
          `${b?.vorname || ''} ${b?.nachname || ''}`.trim() || 'Teilnehmer'
        )}</strong></p>`,
      ];
      if (b?.email) {
        zeilen.push(
          `<p style="margin:0 0 2px 0;font-size:16px;line-height:1.5;color:#111110;">${escapeHtml(b.email)}</p>`
        );
      }
      if (b?.wsetCandidateNumber) {
        zeilen.push(
          `<p style="margin:0 0 2px 0;font-size:15px;line-height:1.5;color:#5c5f63;">WSET Candidate Number: ${escapeHtml(
            b.wsetCandidateNumber
          )}</p>`
        );
      }
      if (terminLabel) {
        zeilen.push(
          `<p style="margin:0 0 8px 0;font-size:16px;line-height:1.5;color:#111110;">${escapeHtml(terminLabel)}</p>`
        );
      }
      if (b?.besondereBeduerfnisse) {
        zeilen.push(
          `<p style="margin:0 0 4px 0;font-size:15px;line-height:1.5;color:#5c5f63;">Besondere Bedürfnisse: ${escapeHtml(
            b.besondereBeduerfnisse
          )}</p>`
        );
      }
      if (b?.anmerkungen) {
        zeilen.push(
          `<p style="margin:0 0 4px 0;font-size:15px;line-height:1.5;color:#5c5f63;">Anmerkungen: ${escapeHtml(
            b.anmerkungen
          )}</p>`
        );
      }
      return zeilen.join('');
    })
    .join('<hr style="border:0;border-top:1px solid #e2e3e5;margin:12px 0;" />');
  return items;
};

const buildTeilnehmerText = (order: any) => {
  const buchungen = Array.isArray(order?.buchungen) ? order.buchungen : [];
  if (!buchungen.length) return '';
  return buchungen
    .map((b: any) => {
      const name = `${b?.vorname || ''} ${b?.nachname || ''}`.trim() || 'Teilnehmer';
      const email = b?.email ? `, E-Mail: ${b.email}` : '';
      const startDate = b?.termin?.starttag || b?.terminSnapshot?.starttag;
      const termin = startDate ? `, Termin: ${formatDateLabel(startDate)}` : '';
      const seminarName =
        b?.termin?.seminar?.name ||
        b?.terminSnapshot?.seminarName ||
        (b?.termin?.titel ? String(b.termin.titel) : '');
      const seminar = seminarName ? `, Seminar: ${seminarName}` : '';
      const wset = b?.wsetCandidateNumber ? `, WSET Candidate Number: ${b.wsetCandidateNumber}` : '';
      const needs = b?.besondereBeduerfnisse ? `, Besondere Bedürfnisse: ${b.besondereBeduerfnisse}` : '';
      const notes = b?.anmerkungen ? `, Anmerkungen: ${b.anmerkungen}` : '';
      return `${name}${email}${seminar}${termin}${wset}${needs}${notes}`;
    })
    .join('\n');
};

export const buildVouchersHtml = (order: any) => {
  const vouchers = Array.isArray(order?.gutscheine) ? order.gutscheine : [];
  if (!vouchers.length) {
    return { html: '', text: '' };
  }
  const htmlItems = vouchers
    .map((voucher: any) => {
      const code = escapeHtml(voucher?.code ?? 'GUTSCHEIN');
      return `<div style="border:2px solid #d7d9dd;border-radius:18px;padding:14px 18px;font-weight:700;font-size:20px;letter-spacing:0.08em;margin:0 0 14px 0;text-align:center;color:#111110;display:block;width:100%;max-width:360px;box-sizing:border-box;">${code}</div>`;
    })
    .join('');
  const textItems = vouchers
    .map((voucher: any) => (voucher?.code ? String(voucher.code) : 'GUTSCHEIN'))
    .join('\n');
  return {
    html: `<div style="margin:18px 0 6px;">${htmlItems}</div>`,
    text: textItems,
  };
};

const hasVoucherPositions = (positions: PositionSummary[]): boolean =>
  positions.some((position) => (position.typ || '').toLowerCase() === 'gutschein');

const shouldSendVoucherMail = (order: any, positions: PositionSummary[]): boolean => {
  const hasVoucherCodes = Array.isArray(order?.gutscheine) && order.gutscheine.length > 0;
  return hasVoucherCodes || hasVoucherPositions(positions);
};

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
    const snapshotName = (position as any)?.terminSnapshot?.seminarName;
    const seminarTitel =
      snapshotName ||
      (position as any)?.termin?.seminar?.name ||
      (position as any)?.produkt?.name ||
      position?.titel ||
      position?.name;
    const titleWithoutDate = String(seminarTitel ?? 'Position');
    const menge = Math.max(1, Number(position?.menge ?? 1)) || 1;
    const summeBrutto = Number(position?.summeBrutto ?? position?.einzelpreisBrutto ?? 0);
    const summeNetto = Number(position?.summeNetto ?? position?.einzelpreisNetto ?? 0);
    return {
      titel: titleWithoutDate,
      beschreibung: position?.beschreibung ? String(position.beschreibung) : undefined,
      typ: position?.typ ? String(position.typ) : undefined,
      menge,
      summeBrutto,
      summeNetto,
    };
  });

const buildPositionsTableHtml = (
  positions: PositionSummary[],
  options?: { voucherAmount?: number }
): string => {
  if (!positions.length) {
    return '<p style="font-size:18px;margin:0 0 16px 0;">Keine Positionen vorhanden.</p>';
  }

  const rowEntries = positions.map(
    (position) =>
      `<tr>` +
      `<td style="padding:10px 0;font-size:16px;color:#111110;border:0;">${escapeHtml(position.titel)}</td>` +
      `<td style="padding:10px 0;font-size:16px;color:#111110;text-align:center;border:0;">${escapeHtml(
        position.menge
      )}</td>` +
      `<td style="padding:10px 0;font-size:16px;color:#111110;text-align:right;border:0;">${escapeHtml(
        formatCurrency(position.summeBrutto)
      )}</td>` +
      `</tr>`
  );

  if (options?.voucherAmount && options.voucherAmount > 0) {
    const formattedVoucher = formatCurrency(options.voucherAmount);
    rowEntries.push(
      `<tr>` +
        `<td style="padding:10px 0;font-size:16px;color:#111110;border:0;">Gutschein</td>` +
        `<td style="padding:10px 0;font-size:16px;color:#111110;text-align:center;border:0;">–</td>` +
        `<td style="padding:10px 0;font-size:16px;color:#c0392b;text-align:right;border:0;">-${escapeHtml(
          formattedVoucher
        )}</td>` +
        `</tr>`
    );
  }

  const rows = rowEntries.join('');

  return `<table data-wa-table="true" style="width:100%;border-collapse:collapse;border-spacing:0;margin-top:6px;margin-bottom:10px;">
    <thead>
      <tr>
        <th style="text-align:left;padding:10px 0;font-size:16px;color:#111110;font-weight:700;border:0;">Position</th>
        <th style="text-align:center;padding:10px 0;font-size:16px;color:#111110;font-weight:700;border:0;">Menge</th>
        <th style="text-align:right;padding:10px 0;font-size:16px;color:#111110;font-weight:700;border:0;">Summe</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>`;
};

const buildPositionsListText = (positions: PositionSummary[], options?: { voucherAmount?: number }): string => {
  if (!positions.length) {
    return 'Keine Positionen vorhanden.';
  }
  const lines = positions.map((position) => {
    const parts: string[] = [position.titel];
    if (position.beschreibung) {
      parts.push(String(position.beschreibung));
    }
    parts.push(`Menge: ${position.menge}`);
    parts.push(`Summe: ${formatCurrency(position.summeBrutto)}`);
    return parts.join(' · ');
  });

  if (options?.voucherAmount && options.voucherAmount > 0) {
    lines.push(`Gutschein: -${formatCurrency(options.voucherAmount)}`);
  }

  return lines.join('\n');
};

export type NotificationTotals = {
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

export const buildCustomerPlatzhalter = (
  context: OrderNotificationContext,
  options?: { previewTemplate?: string }
) => {
  const { order, positions, totals } = context;
  const orderIdentifier = order.bestellnummer || order.documentId || String(order.id);
  const invoiceLink = resolveInvoiceDownloadUrl(order, 'invoice');
  const previewLink = resolvePreviewUrl(order, options?.previewTemplate);
  const termine = buildTermineHtml(order);
  const voucherAmount = totals.gutschein > 0 ? totals.gutschein : 0;

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
      positionenTableHtml: buildPositionsTableHtml(positions, { voucherAmount }),
      positionenText: buildPositionsListText(positions, { voucherAmount }),
      gutscheinBetrag: voucherAmount ? formatCurrency(voucherAmount) : '',
      termineHtml: termine.html,
      termineText: termine.text,
      termineSectionHtml: termine.hasEntries
        ? `<hr style="border:0;border-top:1px solid #e2e3e5;margin:18px 0 22px;" />
<h2 style="margin:0 0 12px 0;">Termine</h2>
${termine.html}`
        : '',
    },
    links: {
      ...(invoiceLink ? { rechnung: invoiceLink } : {}),
      ...(previewLink ? { preview: previewLink } : {}),
      ...(termine.logoUrl ? { logo: termine.logoUrl } : {}),
    },
  };
};

const buildBackofficePlatzhalter = (context: OrderNotificationContext) => {
  const { order, positions, totals } = context;
  const orderIdentifier = order.bestellnummer || order.documentId || String(order.id);
  const invoiceLink = resolveInvoiceDownloadUrl(order, 'invoice');
  const publicBase =
    process.env.EMAIL_LOGO_URL ||
    process.env.PUBLIC_URL ||
    process.env.FRONTEND_BASE_URL ||
    '';
  const logoUrl = publicBase ? `${publicBase.replace(/\/$/, '')}/icons/WineAcademy.png` : '/icons/WineAcademy.png';
  const teilnehmerHtml = buildTeilnehmerHtml(order);
  const teilnehmerText = buildTeilnehmerText(order);

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
      teilnehmerHtml,
      teilnehmerText,
    },
    links: {
      ...(invoiceLink ? { rechnung: invoiceLink } : {}),
      ...(logoUrl ? { logo: logoUrl } : {}),
    },
  };
};

export const buildStornoCustomerPlatzhalter = (context: OrderNotificationContext) => {
  const base = buildCustomerPlatzhalter(context, { previewTemplate: 'storno_bestaetigung' });
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

export const buildVoucherPlatzhalter = (
  context: OrderNotificationContext,
  voucherList: { html: string; text: string },
  options?: { previewTemplate?: string }
) => {
  const orderIdentifier = context.order.bestellnummer || context.order.documentId || String(context.order.id);
  const invoiceLink = resolveInvoiceDownloadUrl(context.order, 'invoice');
  const previewLink = resolvePreviewUrl(context.order, options?.previewTemplate);
  const publicBase =
    process.env.EMAIL_LOGO_URL ||
    process.env.PUBLIC_URL ||
    process.env.FRONTEND_BASE_URL ||
    '';
  const logoUrl = publicBase ? `${publicBase.replace(/\/$/, '')}/icons/WineAcademy.png` : '/icons/WineAcademy.png';

  return {
    kunde: {
      vorname: context.order.vorname || '',
      nachname: context.order.nachname || '',
      email: context.order.email || '',
    },
    bestellung: {
      bestellnummer: orderIdentifier,
      summeBrutto: formatCurrency(
        context.totals.brutto ?? context.order.zuZahlenBrutto ?? context.order.summePositionenBrutto
      ),
    },
    anhang: {
      rechnungUrl: invoiceLink,
      gutscheineHtml: voucherList.html,
      gutscheineText: voucherList.text,
    },
    links: {
      ...(invoiceLink ? { rechnung: invoiceLink } : {}),
      ...(previewLink ? { preview: previewLink } : {}),
      ...(logoUrl ? { logo: logoUrl } : {}),
    },
  };
};

export const buildPaymentConfirmationPlatzhalter = (order: any, totals: NotificationTotals) => {
  const paymentDateSource = order?.zahlungsdatum || order?.updatedAt || order?.createdAt || new Date();
  const paymentDate = formatDateLabel(paymentDateSource);
  const invoiceLink = resolveInvoiceDownloadUrl(order, 'invoice');
  const previewLink = resolvePreviewUrl(order, 'zahlungsbestaetigung');
  const { html: vouchersHtml } = buildVouchersHtml(order);
  const termineInfo = buildTermineHtml(order);

  return {
    kunde: {
      vorname: order.vorname || '',
      nachname: order.nachname || '',
      email: order.email || '',
    },
    bestellung: {
      bestellnummer: order.bestellnummer || order.documentId || String(order.id),
      zahlungsbetrag: formatCurrency(totals.brutto),
      zahlungsdatum: paymentDate,
    },
    gutscheineHtml: vouchersHtml,
    links: {
      ...(invoiceLink ? { rechnung: invoiceLink } : {}),
      ...(previewLink ? { preview: previewLink } : {}),
      ...(termineInfo.logoUrl ? { logo: termineInfo.logoUrl } : {}),
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
        platzhalter: buildCustomerPlatzhalter(context, { previewTemplate: 'bestellbestaetigung' }),
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

export async function sendVoucherMail(strapi: any, context: OrderNotificationContext): Promise<void> {
  if (String(context.order?.bestellstatus || '').toLowerCase() !== 'bezahlt') {
    return;
  }
  if (!shouldSendVoucherMail(context.order, context.positions)) {
    return;
  }
  const voucherList = buildVouchersHtml(context.order);
  if (!voucherList.html && !voucherList.text) {
    return;
  }
  const notificationService = strapi.service('api::benachrichtigung.benachrichtigung');
  if (!notificationService?.send) {
    strapi.log.warn('[gutschein-mail] Versand nicht möglich (Service send fehlt).');
    return;
  }

  const recipients = Array.from(
    new Set(
      [context.order?.email, context.order?.rechnungsEmail]
        .filter(Boolean)
        .map((value) => String(value).trim())
    )
  );
  if (!recipients.length) {
    return;
  }

  try {
    await notificationService.send({
      anwendungsfall: 'rechnung_gutschein',
      recipients,
      platzhalter: buildVoucherPlatzhalter(context, voucherList, { previewTemplate: 'rechnung_gutschein' }),
      categories: ['bestellung', 'gutschein', 'kunde'],
    });
  } catch (error: any) {
    strapi.log.error('[gutschein-mail] Versand fehlgeschlagen.', {
      bestellungId: context.order?.id,
      error: error?.message ?? error,
    });
  }
}

export async function sendVoucherMailForOrder(strapi: any, orderId: number): Promise<void> {
  if (!orderId) {
    return;
  }
  try {
    const fetchOptions: any = getOrderNotificationFetchOptions();
    const order = await strapi.entityService.findOne('api::bestellung.bestellung', orderId, fetchOptions);
    if (!order) {
      return;
    }
    const positionsSource = Array.isArray(order?.positionen) ? order.positionen : [];
    const positions = summarisePositionsForMail(positionsSource);
    const totals: NotificationTotals = {
      brutto: toNumberOrZero(order.zuZahlenBrutto ?? order.summePositionenBrutto),
      netto: toNumberOrZero(order.zuZahlenNetto ?? order.summePositionenNetto),
      steuer: toNumberOrZero(order.zuZahlenSteuer ?? order.summeSteuer),
      gutschein: toNumberOrZero(order.gutscheinBetrag),
      versandkosten: toNumberOrZero(order.versandkosten),
    };
    await sendVoucherMail(strapi, {
      order,
      positions,
      totals,
    });
  } catch (error: any) {
    strapi.log.error('[gutschein-mail] Benachrichtigung konnte nicht erzeugt werden.', {
      orderId,
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
    positionen: {
      populate: {
        termin: { populate: '*' },
        produkt: { populate: '*' },
      },
    },
    gutscheine: true,
    buchungen: {
      populate: {
        termin: { populate: '*' },
      },
    },
  },
  publicationState: 'preview',
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

export async function sendPaymentConfirmationForOrder(strapi: any, orderId: number): Promise<void> {
  if (!orderId) {
    return;
  }
  try {
    const fetchOptions: any = getOrderNotificationFetchOptions();
    const order = await strapi.entityService.findOne('api::bestellung.bestellung', orderId, fetchOptions);
    if (!order) {
      return;
    }
    const paymentMethod = String(order?.zahlungsmethode || '').toLowerCase();
    if (paymentMethod !== 'rechnung') {
      return;
    }
    const notificationService = strapi.service('api::benachrichtigung.benachrichtigung');
    if (!notificationService?.send) {
      strapi.log.warn('[zahlungsbestaetigung] Benachrichtigung kann nicht gesendet werden (Service send fehlt).');
      return;
    }
    const recipients = Array.from(
      new Set(
        [
          order?.email,
          ...(order?.rechnungsEmail ? [order.rechnungsEmail] : []),
        ]
          .filter(Boolean)
          .map((value) => String(value).trim())
      )
    );
    if (!recipients.length) {
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
    const platzhalter = buildPaymentConfirmationPlatzhalter(order, totals);
    await notificationService.send({
      anwendungsfall: 'zahlungsbestaetigung',
      recipients,
      platzhalter,
      categories: ['bestellung', 'zahlung', 'kunde'],
    });
  } catch (error: any) {
    strapi.log.error('[zahlungsbestaetigung] Benachrichtigung konnte nicht gesendet werden.', {
      orderId,
      error: error?.message ?? error,
    });
  }
}
