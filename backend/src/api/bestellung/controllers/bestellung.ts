import { factories } from '@strapi/strapi';
import { SevDeskError, downloadDocument } from '../../../services/sevdesk';
import { GutscheinHelper, calculateGutscheinTotals, GutscheinValidationResult } from '../utils/gutschein';
import { verifyPayPalCapture } from '../utils/paypal';
import { syncSevDeskOrder, SevDeskSyncInput } from '../services/sevdesk-order';
import { resolveInvoiceDownloadUrl, buildDocumentFilename, resolveOrderIdentifier } from '../utils/order-links';
import { verifyDownloadToken } from '../utils/download-token';
import {
  summarisePositionsForMail,
  sendOrderNotifications,
  getOrderNotificationFetchOptions,
} from '../utils/notifications';

type PositionInput = {
  typ?: 'seminar' | 'produkt' | 'gutschein';
  titel?: string;
  beschreibung?: string;
  produktId?: number;
  terminId?: number;
  menge?: number;
  einzelpreisNetto?: number;
  einzelpreisBrutto?: number;
  steuerSatz?: number;
  betrag?: number;
};

type TeilnehmerInput = {
  vorname: string;
  nachname: string;
  email?: string;
  wsetCandidateNumber?: string;
  besondereBeduerfnisse?: string;
  anmerkungen?: string;
  terminId: number;
};

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

const findOrderByIdentifier = async (
  strapi: any,
  identifier: string,
  options: Record<string, unknown> = {}
): Promise<any | null> => {
  if (!identifier) return null;
  const trimmed = String(identifier).trim();
  if (!trimmed) return null;

  const baseOptions = {
    fields: ['id', 'bestellnummer', 'documentId', 'sevdeskDocumentId', 'sevdeskStornoDocumentId', 'updatedAt'],
    ...options,
  };

  const isNumeric = /^\d+$/.test(trimmed);
  if (isNumeric) {
    const byId = await strapi.entityService.findOne(
      'api::bestellung.bestellung',
      Number.parseInt(trimmed, 10),
      baseOptions
    );
    if (byId) {
      return byId;
    }
  }

  const findByFilter = async (filters: Record<string, unknown>) => {
    const result = await strapi.entityService.findMany('api::bestellung.bestellung', {
      filters,
      limit: 1,
      ...baseOptions,
    });
    if (Array.isArray(result)) {
      return result[0] ?? null;
    }
    return result as any;
  };

  const byDocument = await findByFilter({ documentId: trimmed });
  if (byDocument) return byDocument;

  const byOrderNumber = await findByFilter({ bestellnummer: trimmed });
  if (byOrderNumber) return byOrderNumber;

  return null;
};

async function streamOrderDocument(
  strapi: any,
  ctx: any,
  order: any,
  variant: 'invoice' | 'storno'
): Promise<void> {
  const documentId =
    variant === 'invoice' ? order?.sevdeskDocumentId : order?.sevdeskStornoDocumentId;
  if (!documentId) {
    ctx.notFound('Dokument nicht vorhanden.');
    return;
  }

  const filename = buildDocumentFilename(order, variant);
  try {
    const download = await downloadDocument(strapi, documentId, filename);
    ctx.set('Content-Type', download.contentType || 'application/pdf');
    ctx.set('Content-Disposition', `attachment; filename="${filename}"`);
    ctx.set('Cache-Control', 'no-store');
    ctx.status = 200;
    ctx.body = download.buffer;
  } catch (error: any) {
    strapi.log.error(`[publicDownload ${variant}] Dokument konnte nicht geladen werden.`, {
      identifier: resolveOrderIdentifier(order),
      documentId,
      error: error?.message ?? error,
    });
    ctx.internalServerError('Dokument konnte nicht geladen werden.');
  }
}

export default factories.createCoreController('api::bestellung.bestellung', ({ strapi }) => ({
  async publicDownloadInvoice(ctx) {
    const identifier = ctx.params?.id;
    if (!identifier) {
      return ctx.badRequest('Ungültige Bestellung.');
    }
    const tokenParam = ctx.query?.token;
    const token = Array.isArray(tokenParam) ? tokenParam[0] : tokenParam;
    if (!verifyDownloadToken(String(identifier), 'invoice', token)) {
      return ctx.forbidden('Download-Link ist ungültig oder abgelaufen.');
    }
    try {
      const order = await findOrderByIdentifier(
        strapi,
        identifier,
        getOrderNotificationFetchOptions()
      );
      if (!order) {
        return ctx.notFound('Bestellung nicht gefunden.');
      }
      await streamOrderDocument(strapi, ctx, order, 'invoice');
    } catch (error: any) {
      strapi.log.error('[publicDownloadInvoice] Fehler beim Versand der Rechnung.', {
        identifier,
        error: error?.message ?? error,
      });
      if (!ctx.body) {
        ctx.internalServerError('Rechnung konnte nicht geladen werden.');
      }
    }
  },

  async publicDownloadStorno(ctx) {
    const identifier = ctx.params?.id;
    if (!identifier) {
      return ctx.badRequest('Ungültige Bestellung.');
    }
    const tokenParam = ctx.query?.token;
    const token = Array.isArray(tokenParam) ? tokenParam[0] : tokenParam;
    if (!verifyDownloadToken(String(identifier), 'storno', token)) {
      return ctx.forbidden('Download-Link ist ungültig oder abgelaufen.');
    }
    try {
      const order = await findOrderByIdentifier(
        strapi,
        identifier,
        getOrderNotificationFetchOptions()
      );
      if (!order) {
        return ctx.notFound('Bestellung nicht gefunden.');
      }
      await streamOrderDocument(strapi, ctx, order, 'storno');
    } catch (error: any) {
      strapi.log.error('[publicDownloadStorno] Fehler beim Versand der Stornorechnung.', {
        identifier,
        error: error?.message ?? error,
      });
      if (!ctx.body) {
        ctx.internalServerError('Stornorechnung konnte nicht geladen werden.');
      }
    }
  },

  async publicGet(ctx) {
    const id = Number(ctx.params?.id);
    if (!Number.isFinite(id)) return ctx.badRequest('Ungültige ID');
    try {
      const bestellung = await strapi.entityService.findOne('api::bestellung.bestellung', id, {
        populate: { gutscheine: { filters: { istTemplate: false }, fields: ['code', 'betrag', 'eingeloest'] } },
      });
      if (!bestellung) return ctx.notFound('Nicht gefunden');
      const vouchers = Array.isArray((bestellung as any)?.gutscheine) ? (bestellung as any).gutscheine : [];
      const invoiceDownload = resolveInvoiceDownloadUrl(bestellung, 'invoice');
      const stornoDownload = resolveInvoiceDownloadUrl(bestellung, 'storno');

      ctx.body = {
        id: bestellung.id,
        bestellnummer: bestellung.bestellnummer ?? null,
        status: bestellung.bestellstatus,
        zahlungsmethode: bestellung.zahlungsmethode,
        totals: {
          brutto: bestellung.zuZahlenBrutto ?? bestellung.summePositionenBrutto,
          netto: bestellung.zuZahlenNetto ?? bestellung.summePositionenNetto,
          steuer: bestellung.zuZahlenSteuer ?? bestellung.summeSteuer,
          gutschein: bestellung.gutscheinBetrag ?? 0,
        },
        gutscheine: vouchers.map((g: any) => ({
          code: g.code,
          betrag: g.betrag,
          eingelöst: g.eingeloest,
        })),
        downloads: {
          rechnung: invoiceDownload,
          storno: stornoDownload,
        },
      };
    } catch (e) {
      strapi.log.error('[publicGet Bestellung] Fehler', e);
      return ctx.internalServerError('Fehler');
    }
  },

  async publicCreate(ctx) {
    const body = ctx.request.body as any;
    if (!body || typeof body !== 'object') return ctx.badRequest('Ungültiger Payload');

    const rechnungstyp = body.rechnungstyp === 'firma' ? 'firma' : 'privat';
    if (!body.vorname?.trim()) return ctx.badRequest('Vorname erforderlich');
    if (!body.nachname?.trim()) return ctx.badRequest('Nachname erforderlich');
    if (!body.email?.trim()) return ctx.badRequest('E-Mail erforderlich');
    if (!body.agbAkzeptiert) return ctx.badRequest('AGB müssen akzeptiert werden');
    if (!body.datenschutzGelesen) return ctx.badRequest('Datenschutzhinweis muss bestätigt werden');

    if (rechnungstyp === 'firma') {
      const required = ['firmenname', 'rechnungsEmail', 'strasse', 'plz', 'stadt', 'land'];
      for (const key of required) {
        if (!body[key] || String(body[key]).trim() === '') {
          return ctx.badRequest(`Feld '${key}' ist bei Firmenrechnung erforderlich`);
        }
      }
    }

    const positionsInput: PositionInput[] = Array.isArray(body.positionen) ? body.positionen : [];
    if (!positionsInput.length) return ctx.badRequest('Mindestens eine Position erforderlich');

    const teilnehmerInput: TeilnehmerInput[] = Array.isArray(body.buchungen) ? body.buchungen : [];

    const seminarSeats = new Map<number, { menge: number; brutto: number; netto: number; titel: string; steuerSatz: number }>();
    const positionen: any[] = [];
    const loadProdukt = async (id: number) => {
      return strapi.db.query('api::produkt.produkt').findOne({
        where: { id, aktiv: true },
        select: ['id', 'name', 'preisNetto', 'preisBrutto', 'steuerSatz', 'mwst', 'gutschein'],
      });
    };

    const loadTermin = async (id: number) => {
      return strapi.db.query('api::termin.termin').findOne({
        where: { id },
        select: ['id', 'planungsstatus', 'publishedAt', 'starttag'],
        populate: {
          seminar: { select: ['id', 'name', 'mwst', 'preis'] },
          tageMitUhrzeit: { select: ['datum', 'startzeit', 'endzeit'] },
          standort: { select: ['name', 'typ', 'veranstaltungsort', 'stadt'] },
        },
      });
    };

    const gutscheinHelper = new GutscheinHelper(strapi);
    for (const raw of positionsInput) {
      const menge = Math.max(1, Number(raw.menge ?? 1));
      const typ = raw.typ === 'seminar' || raw.typ === 'gutschein' || raw.typ === 'produkt'
        ? raw.typ
        : raw.terminId
          ? 'seminar'
          : 'produkt';

      if (typ === 'seminar') {
        const terminId = Number(raw.terminId);
        if (!Number.isFinite(terminId)) return ctx.badRequest('Termin für Seminar-Position fehlt');
        const termin = await loadTermin(terminId);
        if (!termin || termin.planungsstatus !== 'geplant' || !termin.publishedAt) {
          return ctx.badRequest('Termin nicht verfügbar');
        }
        const seminar = (termin as any).seminar;
        const defaultVat = Number(process.env.VAT_RATE ?? 19);
        const mwstAktiv = seminar?.mwst !== false;
        const steuerSatz = mwstAktiv ? defaultVat : 0;

        const seminarPreis = Number(seminar?.preis);
        if (!Number.isFinite(seminarPreis)) {
          strapi.log.error(`[publicCreate Bestellung] Kein Preis für Termin ${terminId} (seminarPreis=${seminar?.preis})`);
          return ctx.badRequest('Preis für Termin nicht verfügbar');
        }
        const brutto = round2(seminarPreis);
        const netto = mwstAktiv ? round2(brutto / (1 + steuerSatz / 100)) : brutto;

        const titel = raw.titel?.trim() || `${seminar?.name || 'Seminar'} · Termin #${termin.id}`;
        const summeBrutto = round2(brutto * menge);
        const summeNetto = round2(netto * menge);
        const summeSteuer = round2(summeBrutto - summeNetto);
        const position = {
          typ: 'seminar',
          titel,
          beschreibung: raw.beschreibung || termin?.standort?.name,
          termin: termin.id,
          menge,
          steuerSatz,
          einzelpreisBrutto: brutto,
          einzelpreisNetto: netto,
          summeBrutto,
          summeNetto,
          summeSteuer,
        };
        positionen.push(position);
        seminarSeats.set(termin.id, {
          menge,
          brutto,
          netto,
          titel,
          steuerSatz,
        });
      } else if (typ === 'gutschein' && !Number.isFinite(Number(raw.produktId))) {
        let adjustment;
        try {
          adjustment = await gutscheinHelper.applyAdjustments(raw, null);
        } catch (voucherError: any) {
          return ctx.badRequest(voucherError?.message ?? 'Gutschein ungültig');
        }
        if (!adjustment || !Number.isFinite(adjustment.brutto) || adjustment.brutto <= 0) {
          return ctx.badRequest('Gutscheinbetrag ungültig');
        }
        const titel = raw.titel?.trim() || 'Geschenkgutschein';
        const beschreibung = raw.beschreibung ? String(raw.beschreibung) : undefined;
        const einzelpreisBrutto = round2(adjustment.brutto);
        const einzelpreisNetto = round2(adjustment.netto);
        const summeBrutto = round2(einzelpreisBrutto * menge);
        const summeNetto = round2(einzelpreisNetto * menge);
        const summeSteuer = round2(summeBrutto - summeNetto);

        positionen.push({
          typ: 'gutschein',
          titel,
          beschreibung,
          menge,
          steuerSatz: adjustment.steuerSatz,
          einzelpreisBrutto,
          einzelpreisNetto,
          summeBrutto,
          summeNetto,
          summeSteuer,
        });
      } else {
        const produktId = Number(raw.produktId);
        if (!Number.isFinite(produktId)) return ctx.badRequest('Produkt-ID fehlt');
        const produkt = await loadProdukt(produktId);
        if (!produkt) return ctx.badRequest('Produkt nicht verfügbar');

        const istGutschein = gutscheinHelper.isGutscheinPosition(raw, produkt);
        let brutto: number | undefined = produkt.preisBrutto != null ? Number(produkt.preisBrutto) : undefined;
        let netto: number | undefined = produkt.preisNetto != null ? Number(produkt.preisNetto) : undefined;
        let steuerSatz = produkt.steuerSatz != null ? Number(produkt.steuerSatz) : Number(process.env.VAT_RATE ?? 19);
        if (produkt.mwst === false) {
          steuerSatz = 0;
        }

        try {
          const gutscheinAdjustment = await gutscheinHelper.applyAdjustments(raw, produkt);
          if (gutscheinAdjustment) {
            brutto = gutscheinAdjustment.brutto;
            netto = gutscheinAdjustment.netto;
            steuerSatz = gutscheinAdjustment.steuerSatz;
          }
        } catch (voucherError: any) {
          return ctx.badRequest(voucherError?.message ?? 'Gutschein ungültig');
        }

        if (!Number.isFinite(brutto as number) && Number.isFinite(netto as number)) {
          brutto = round2((netto as number) * (1 + steuerSatz / 100));
        }
        if (!Number.isFinite(netto as number) && Number.isFinite(brutto as number)) {
          netto = round2((brutto as number) / (1 + steuerSatz / 100));
        }

        if (!Number.isFinite(brutto as number) || !Number.isFinite(netto as number)) {
          return ctx.badRequest('Preis für Produktposition fehlt');
        }

        const summeBrutto = round2((brutto as number) * menge);
        const summeNetto = round2((netto as number) * menge);
        const summeSteuer = round2(summeBrutto - summeNetto);
        const position = {
          typ: istGutschein ? 'gutschein' : 'produkt',
          titel: raw.titel?.trim() || produkt.name,
          beschreibung: raw.beschreibung,
          produkt: produkt.id,
          menge,
          steuerSatz,
          einzelpreisBrutto: round2(brutto as number),
          einzelpreisNetto: round2(netto as number),
          summeBrutto,
          summeNetto,
          summeSteuer,
        };
        positionen.push(position);
      }
    }

        const buchungenPayload: any[] = [];
    if (teilnehmerInput.length > 0) {
      const counter = new Map<number, number>();
      for (const teilnehmer of teilnehmerInput) {
        const terminId = Number(teilnehmer.terminId);
        if (!Number.isFinite(terminId)) return ctx.badRequest('Buchung ohne Termin');
        const seatInfo = seminarSeats.get(terminId);
        if (!seatInfo) return ctx.badRequest('Teilnehmer-Termin nicht im Warenkorb enthalten');
        if (!teilnehmer.vorname?.trim()) return ctx.badRequest('Teilnehmer Vorname fehlt');
        if (!teilnehmer.nachname?.trim()) return ctx.badRequest('Teilnehmer Nachname fehlt');

        counter.set(terminId, (counter.get(terminId) || 0) + 1);
        buchungenPayload.push({
          vorname: teilnehmer.vorname.trim(),
          nachname: teilnehmer.nachname.trim(),
          email: teilnehmer.email?.trim(),
          wsetCandidateNumber: teilnehmer.wsetCandidateNumber,
          besondereBeduerfnisse: teilnehmer.besondereBeduerfnisse,
          anmerkungen: teilnehmer.anmerkungen,
          termin: terminId,
          preisBrutto: seatInfo.brutto,
          preisNetto: seatInfo.netto,
          steuerSatz: seatInfo.steuerSatz,
        });
      }
      for (const [terminId, info] of seminarSeats.entries()) {
        const count = counter.get(terminId) || 0;
        if (count !== info.menge) {
          return ctx.badRequest(`Anzahl der Teilnehmer (${count}) stimmt nicht mit der Position für Termin ${terminId} (${info.menge}) überein`);
        }
      }
    } else if (Array.from(seminarSeats.values()).some((s) => s.menge > 0)) {
      return ctx.badRequest('Teilnehmerdaten für Seminarbuchungen fehlen');
    }

    const debugInvalid = positionen.find((p) => !Number.isFinite(Number(p?.einzelpreisBrutto)) || !Number.isFinite(Number(p?.einzelpreisNetto)));
    if (debugInvalid) {
      strapi.log.error(`[publicCreate Bestellung] Ungültige Positionsdaten: ${JSON.stringify(debugInvalid)}`);
      return ctx.badRequest('Preis für Position fehlt');
    }
    const normalisedPositions = positionen;
    const summePositionenNetto = round2(normalisedPositions.reduce((acc, p) => acc + (p.summeNetto ?? 0), 0));
    const summePositionenBrutto = round2(normalisedPositions.reduce((acc, p) => acc + (p.summeBrutto ?? 0), 0));
    const summeSteuer = round2(normalisedPositions.reduce((acc, p) => acc + (p.summeSteuer ?? 0), 0));

    const voucherCodeRaw = typeof body.gutscheinCode === 'string' ? body.gutscheinCode : '';
    let appliedVoucher: GutscheinValidationResult | null = null;
    let gutscheinBetrag = 0;

    if (voucherCodeRaw) {
      try {
        appliedVoucher = await gutscheinHelper.validateVoucher(voucherCodeRaw, {
          brutto: summePositionenBrutto,
          netto: summePositionenNetto,
          steuer: summeSteuer,
        });
        gutscheinBetrag = appliedVoucher.betrag;
      } catch (voucherError: any) {
        return ctx.badRequest(voucherError?.message ?? 'Gutschein ungültig');
      }
    } else if (Number.isFinite(Number(body.gutscheinBetrag)) && Number(body.gutscheinBetrag) > 0) {
      // Legacy-Fallback: erlaubt bestehende Integrationen ohne Gutschein-Code.
      gutscheinBetrag = round2(Number(body.gutscheinBetrag));
    }

    const gutscheinTotals = calculateGutscheinTotals(
      summePositionenBrutto,
      summePositionenNetto,
      summeSteuer,
      gutscheinBetrag
    );
    const expectedTotal = gutscheinTotals.dueBrutto;

    const zahlungsmethode = body.zahlungsmethode === 'paypal' ? 'paypal' : (body.zahlungsmethode === 'rechnung' ? 'rechnung' : body.zahlungsmethode || 'rechnung');
    let zahlungsreferenz: string | undefined = body.zahlungsreferenz ? String(body.zahlungsreferenz) : undefined;
    const bestellstatus: 'offen' | 'bezahlt' | 'storniert' = 'offen';

    try {
      if (zahlungsmethode === 'paypal' && body.paypalCaptureId) {
        const captureId = await verifyPayPalCapture(String(body.paypalCaptureId), expectedTotal);
        zahlungsreferenz = captureId;
      }

      const { summeGutschein, dueBrutto, dueNetto, dueSteuer } = gutscheinTotals;
      const newsletterOptIn = !!body.newsletterOptIn;
      const normalisedVoucherCode = appliedVoucher?.code
        ? appliedVoucher.code
        : voucherCodeRaw
          ? gutscheinHelper.normaliseCode(voucherCodeRaw)
          : undefined;

            const bestellungData: any = {
        rechnungstyp,
        firmenname: body.firmenname,
        ustId: body.ustId,
        rechnungsEmail: body.rechnungsEmail,
        strasse: body.strasse,
        plz: body.plz,
        stadt: body.stadt,
        land: body.land,
        vorname: body.vorname,
        nachname: body.nachname,
        email: body.email,
        telefon: body.telefon,
        positionen: normalisedPositions,
        summePositionenNetto,
        summePositionenBrutto,
        summeSteuer,
        gutscheinBetrag: summeGutschein,
        gutscheinCode: normalisedVoucherCode,
        zuZahlenBrutto: dueBrutto,
        zuZahlenNetto: dueNetto,
        zuZahlenSteuer: dueSteuer,
        zahlungsmethode,
        zahlungsreferenz,
        paypalOrderId: body.paypalOrderId ? String(body.paypalOrderId) : undefined,
        agbAkzeptiert: !!body.agbAkzeptiert,
        datenschutzGelesen: !!body.datenschutzGelesen,
        newsletterOptIn,
        notizen: body.notizen,
        bestellstatus,
        waehrung: body.waehrung || 'EUR',
      };

            const created = await strapi.entityService.create('api::bestellung.bestellung', { data: bestellungData });
      const createdAny = created as any;
      const bestellungId = createdAny.id;
      if (buchungenPayload.length > 0) {
                for (const teilnehmer of buchungenPayload) {
          await strapi.entityService.create('api::buchung.buchung', {
            data: {
              ...teilnehmer,
              bestellung: bestellungId,
            },
          });
        }
      }

      if (appliedVoucher) {
        try {
          await gutscheinHelper.registerVoucherRedemption(
            appliedVoucher.voucher,
            appliedVoucher.betrag,
            appliedVoucher.restbetrag
          );
        } catch (voucherUpdateErr: any) {
          strapi.log.error('[publicCreate Bestellung] Gutscheincode konnte nicht aktualisiert werden.', {
            bestellungId,
            gutscheinId: appliedVoucher.gutscheinId,
            error: voucherUpdateErr?.message ?? voucherUpdateErr,
          });
        }
      }

      const orderFetchOptions: any = getOrderNotificationFetchOptions();
      const full = await strapi.entityService.findOne('api::bestellung.bestellung', bestellungId, orderFetchOptions);

      let orderSnapshot = full as any;

      try {
                await syncSevDeskOrder(strapi, {
          bestellungId,
          bestellung: orderSnapshot,
          positions: normalisedPositions,
          dueTotals: { brutto: dueBrutto, netto: dueNetto, steuer: dueSteuer },
          gutscheinBetrag: summeGutschein,
        });
        const refreshed = await strapi.entityService.findOne(
          'api::bestellung.bestellung',
          bestellungId,
          orderFetchOptions
        );
        orderSnapshot = refreshed as any;
      } catch (sevdeskErr) {
        const meta: Record<string, unknown> = {
          bestellungId,
          error: sevdeskErr instanceof Error ? sevdeskErr.message : sevdeskErr,
        };
        if (sevdeskErr instanceof SevDeskError) {
          meta.status = sevdeskErr.status;
          meta.url = sevdeskErr.url;
          meta.details = sevdeskErr.details;
        }
        strapi.log.error(
          `[publicCreate Bestellung] SevDesk-Synchronisation fehlgeschlagen ${JSON.stringify(meta)}`
        );
      }

      const positionsForNotifications = Array.isArray(orderSnapshot?.positionen) && orderSnapshot.positionen.length
        ? orderSnapshot.positionen
        : normalisedPositions;
      try {
        await sendOrderNotifications(strapi, {
          order: orderSnapshot,
          positions: summarisePositionsForMail(positionsForNotifications),
          totals: {
            brutto: dueBrutto,
            netto: dueNetto,
            steuer: dueSteuer,
            gutschein: summeGutschein,
          },
        });
      } catch (notificationErr: any) {
        strapi.log.error('[publicCreate Bestellung] Benachrichtigungen fehlgeschlagen.', {
          bestellungId,
          error: notificationErr?.message ?? notificationErr,
        });
      }

      const gutscheine = Array.isArray(orderSnapshot?.gutscheine) ? orderSnapshot.gutscheine : [];
      ctx.body = {
        id: orderSnapshot.id,
        bestellnummer: orderSnapshot.bestellnummer,
        status: orderSnapshot.bestellstatus,
        zahlungsmethode: orderSnapshot.zahlungsmethode,
        totals: {
          brutto: orderSnapshot.zuZahlenBrutto ?? orderSnapshot.summePositionenBrutto,
          netto: orderSnapshot.zuZahlenNetto ?? orderSnapshot.summePositionenNetto,
          steuer: orderSnapshot.zuZahlenSteuer ?? orderSnapshot.summeSteuer,
          gutschein: orderSnapshot.gutscheinBetrag ?? 0,
        },
        gutscheine: gutscheine.map((g: any) => ({ code: g.code, betrag: g.betrag })),
      };
    } catch (err: any) {
      strapi.log.error('[publicCreate Bestellung] Fehler', err);
      return ctx.badRequest(err?.message || 'Bestellung fehlgeschlagen');
    }
  },
}));
