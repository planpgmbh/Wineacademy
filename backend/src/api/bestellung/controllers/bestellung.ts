import { factories } from '@strapi/strapi';
import {
  saveContact,
  createCommunicationWay,
  createInvoiceViaFactory,
  updateInvoiceStatus,
  markInvoicePaid,
  fetchInvoiceWithDocument,
  extractDocumentId,
  SevDeskError,
  isSevDeskSyncEnabled,
} from '../../../services/sevdesk';
import {
  fetchOrderWithDetails,
  sendOrderCreatedEmails,
  sendPaymentConfirmedEmails,
} from '../../../services/order-notifications';

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

const normalisePosition = (entry: any) => {
  const menge = Math.max(1, Number(entry?.menge ?? 1));
  const steuerSatz = Number.isFinite(Number(entry?.steuerSatz)) ? Number(entry.steuerSatz) : Number(process.env.VAT_RATE ?? 19);

  let brutto = Number(entry?.einzelpreisBrutto);
  let netto = Number(entry?.einzelpreisNetto);

  if (!Number.isFinite(brutto) && Number.isFinite(Number(entry?.summeBrutto))) {
    brutto = round2(Number(entry.summeBrutto) / menge);
  }
  if (!Number.isFinite(netto) && Number.isFinite(Number(entry?.summeNetto))) {
    netto = round2(Number(entry.summeNetto) / menge);
  }
  if (!Number.isFinite(brutto) && Number.isFinite(netto)) {
    brutto = round2(netto * (1 + steuerSatz / 100));
  }
  if (!Number.isFinite(netto) && Number.isFinite(brutto)) {
    netto = steuerSatz > 0 ? round2(brutto / (1 + steuerSatz / 100)) : round2(brutto);
  }

  if (!Number.isFinite(brutto) || !Number.isFinite(netto)) {
    throw new Error(`Position '${entry?.titel ?? ''}' benötigt einen Einzelpreis (netto oder brutto)`);
  }

  const resolvedBrutto = round2(brutto);
  const resolvedNetto = round2(netto);
  const summeBrutto = Number.isFinite(Number(entry?.summeBrutto)) ? round2(Number(entry.summeBrutto)) : round2(resolvedBrutto * menge);
  const summeNetto = Number.isFinite(Number(entry?.summeNetto)) ? round2(Number(entry.summeNetto)) : round2(resolvedNetto * menge);
  const summeSteuer = Number.isFinite(Number(entry?.summeSteuer)) ? round2(Number(entry.summeSteuer)) : round2(summeBrutto - summeNetto);

  return {
    ...entry,
    menge,
    steuerSatz,
    einzelpreisBrutto: resolvedBrutto,
    einzelpreisNetto: resolvedNetto,
    summeBrutto,
    summeNetto,
    summeSteuer,
  };
};

const generateVoucherCode = async (strapi: any): Promise<string> => {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  for (let attempt = 0; attempt < 20; attempt += 1) {
    let code = '';
    for (let i = 0; i < 4; i += 1) {
      const block = Array.from({ length: 4 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join('');
      code += block;
      if (i < 3) code += '-';
    }
    const existing = await strapi.db.query('api::gutschein.gutschein').findOne({ where: { code } });
    if (!existing) return code;
  }
  throw new Error('Konnte keinen eindeutigen Gutscheincode erzeugen');
};

const formatOrderNumber = (id: unknown) => {
  const prefix = process.env.ORDER_NUMBER_PREFIX || 'WA';
  const numeric = Number(id);
  const suffix = Number.isFinite(numeric) ? String(numeric).padStart(6, '0') : String(id ?? '').padStart(6, '0');
  return `${prefix}-${suffix}`;
};

const parseSevDeskId = (payload: any): string | null => {
  if (!payload) return null;
  if (payload.id != null) return String(payload.id);
  if (payload.object?.id != null) return String(payload.object.id);
  if (payload.objects?.id != null) return String(payload.objects.id);
  if (payload.data?.id != null) return String(payload.data.id);
  if (Array.isArray(payload.objects)) {
    for (const entry of payload.objects) {
      if (entry?.id != null) return String(entry.id);
    }
  }
  if (Array.isArray(payload.data)) {
    for (const entry of payload.data) {
      if (entry?.id != null) return String(entry.id);
    }
  }
  return null;
};

const makeObjectRef = (id: string | number, objectName: string) => ({ id, objectName });

const resolveSevDeskCategoryId = (rechnungstyp: string | undefined): number => {
  const envValue =
    rechnungstyp === 'firma' ? process.env.SEVDESK_CATEGORY_COMPANY_ID : process.env.SEVDESK_CATEGORY_PRIVATE_ID;
  const fallback = rechnungstyp === 'firma' ? 4 : 3;
  if (!envValue) {
    return fallback;
  }
  const parsed = Number(envValue);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const resolveSevDeskTimeToPay = (): number | undefined => {
  const raw = process.env.SEVDESK_DEFAULT_TIME_TO_PAY_DAYS;
  if (!raw) return undefined;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : undefined;
};

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

const ensureSevDeskCommunicationWay = async (strapi: any, contactId: string, email: string) => {
  try {
    await createCommunicationWay(strapi, {
      contactId,
      type: 'EMAIL',
      value: email,
      main: true,
    });
  } catch (error: any) {
    if (error instanceof SevDeskError && (error.status === 409 || error.status === 422)) {
      if (strapi?.log?.debug) {
        strapi.log.debug('SevDesk: Kommunikationseintrag bereits vorhanden oder abgelehnt.', {
          contactId,
          email,
          status: error.status,
        });
      }
      return;
    }
    throw error;
  }
};

interface SevDeskSyncInput {
  bestellungId: number;
  bestellung: any;
  kundeId?: string | number;
  kunde?: any;
  positions: any[];
  dueTotals: { brutto: number; netto: number; steuer: number };
  gutscheinBetrag: number;
}

const createDiscountInvoicePositions = (positions: any[], discountAmount: number) => {
  const totalBrutto = positions.reduce((acc, pos) => acc + Number(pos?.summeBrutto ?? 0), 0);
  const effectiveDiscount = Number.isFinite(Number(discountAmount))
    ? Math.min(Math.max(Number(discountAmount), 0), totalBrutto)
    : 0;
  if (totalBrutto <= 0 || effectiveDiscount <= 0) {
    return [] as Array<{ quantity: number; price: number; taxRate: number; name: string; text?: string }>;
  }

  const sumsByTax = new Map<number, number>();
  const taxOrder: number[] = [];
  for (const pos of positions) {
    const taxRateRaw = pos?.steuerSatz;
    const taxRate = Number.isFinite(Number(taxRateRaw)) ? Number(taxRateRaw) : 0;
    const sumBrutto = Number(pos?.summeBrutto ?? 0);
    if (sumBrutto <= 0) continue;
    if (!sumsByTax.has(taxRate)) {
      taxOrder.push(taxRate);
      sumsByTax.set(taxRate, sumBrutto);
    } else {
      sumsByTax.set(taxRate, (sumsByTax.get(taxRate) ?? 0) + sumBrutto);
    }
  }

  const discountPositions: Array<{ quantity: number; price: number; taxRate: number; name: string; text?: string }> = [];
  let remaining = round2(effectiveDiscount);

  taxOrder.forEach((taxRate, index) => {
    const sumForRate = sumsByTax.get(taxRate) ?? 0;
    if (sumForRate <= 0 || remaining <= 0) {
      return;
    }
    let share = (sumForRate / totalBrutto) * effectiveDiscount;
    if (index === taxOrder.length - 1) {
      share = remaining;
    } else {
      share = round2(Math.min(remaining, share));
    }

    if (share <= 0) {
      return;
    }

    remaining = round2(remaining - share);
    const label = taxRate > 0 ? `Gutscheinrabatt (${taxRate}% MwSt)` : 'Gutscheinrabatt';

    discountPositions.push({
      quantity: 1,
      price: -round2(share),
      taxRate,
      name: label,
      text: 'Automatischer Gutscheinabzug',
    });
  });

  if (remaining > 0.01 && discountPositions.length > 0) {
    const last = discountPositions[discountPositions.length - 1];
    discountPositions[discountPositions.length - 1] = {
      ...last,
      price: round2(last.price - remaining),
    };
    remaining = 0;
  }

  return discountPositions;
};

async function syncSevDeskOrder(strapi: any, input: SevDeskSyncInput): Promise<void> {
  if (!isSevDeskSyncEnabled()) {
    if (strapi?.log?.debug) {
    strapi.log.debug('SevDesk-Synchronisation deaktiviert (SEVDESK_ENABLED=false).');
    }
    return;
  }

  if (!process.env.SEVDESK_API_TOKEN) {
    if (strapi?.log?.debug) {
      strapi.log.debug('SevDesk-Synchronisation übersprungen: Kein API-Token konfiguriert.');
    }
    return;
  }

  const bestellung = input.bestellung ?? {};
  const kunde = input.kunde ?? null;

  const existingContactId = bestellung.sevdeskContactId || kunde?.sevdeskContactId;
  const rechnungstyp = bestellung.rechnungstyp === 'firma' ? 'firma' : 'privat';
  const companyName = rechnungstyp === 'firma' ? String(bestellung.firmenname || '').trim() : undefined;
  const fallbackName = `${bestellung.vorname || ''} ${bestellung.nachname || ''}`.trim() || companyName || 'Kontakt';

  const contactPayload: Record<string, unknown> = {
    categoryId: resolveSevDeskCategoryId(rechnungstyp),
    name: companyName || fallbackName,
    status: 100,
  };

  if (existingContactId) {
    contactPayload.id = existingContactId;
  }

  if (bestellung.bestellnummer) {
    contactPayload.customerNumber = bestellung.bestellnummer;
    contactPayload.description = `Bestellung ${bestellung.bestellnummer}`;
  } else {
    contactPayload.description = `Bestellung #${input.bestellungId}`;
  }

  if (rechnungstyp === 'firma') {
    const name2 = `${bestellung.vorname || ''} ${bestellung.nachname || ''}`.trim();
    if (name2) {
      contactPayload.name2 = name2;
    }
    if (bestellung.ustId) {
      contactPayload.vatNumber = String(bestellung.ustId).trim();
    }
  } else {
    if (bestellung.vorname) contactPayload.surename = bestellung.vorname;
    if (bestellung.nachname) contactPayload.familyname = bestellung.nachname;
  }

  const address: Record<string, unknown> = {};
  if (bestellung.strasse) address.street = bestellung.strasse;
  if (bestellung.plz) address.zip = bestellung.plz;
  if (bestellung.stadt) address.city = bestellung.stadt;
  const rawCountry = process.env.SEVDESK_DEFAULT_COUNTRY_ID;
  if (rawCountry) {
    const countryId = Number(rawCountry);
    if (Number.isFinite(countryId)) {
      address.countryId = countryId;
    }
  }
  if (Object.keys(address).length > 0) {
    contactPayload.address = address;
  }

  const contactResponse = await saveContact(strapi, contactPayload as any);
  const contactId = parseSevDeskId(contactResponse) ?? (existingContactId ? String(existingContactId) : null);
  if (!contactId) {
    throw new Error('SevDesk: Kontakt-ID konnte nicht ermittelt werden.');
  }

  await strapi.entityService.update('api::bestellung.bestellung', input.bestellungId, {
    data: { sevdeskContactId: contactId },
  });

  if (input.kundeId && (!kunde?.sevdeskContactId || String(kunde.sevdeskContactId) !== contactId)) {
    await strapi.entityService.update('api::kunde.kunde', input.kundeId, {
      data: { sevdeskContactId: contactId },
    });
  }

  const primaryEmail =
    rechnungstyp === 'firma'
      ? bestellung.rechnungsEmail || bestellung.email
      : bestellung.email;
  if (primaryEmail) {
    await ensureSevDeskCommunicationWay(strapi, contactId, primaryEmail);
  }

  if (!input.positions || input.positions.length === 0) {
    strapi.log.warn('SevDesk-Sync übersprungen: Keine Positionen vorhanden, Rechnung nicht erzeugt.', {
      bestellungId: input.bestellungId,
    });
    return;
  }

  const invoicePositions: Array<{ quantity: number; price: number; taxRate: number; name: string; text?: string }> = [];

  for (const rawPos of input.positions) {
    const quantityRaw = Number(rawPos?.menge ?? 1);
    const quantity = Number.isFinite(quantityRaw) && quantityRaw > 0 ? quantityRaw : 1;
    const priceRaw = Number(rawPos?.einzelpreisBrutto ?? rawPos?.summeBrutto ?? 0);
    const price = Number.isFinite(priceRaw) ? priceRaw : 0;
    const taxRateRaw = Number(rawPos?.steuerSatz ?? 0);
    const taxRate = Number.isFinite(taxRateRaw) ? taxRateRaw : 0;

    invoicePositions.push({
      quantity,
      price,
      taxRate,
      name: rawPos?.titel || 'Position',
      text: rawPos?.beschreibung,
    });
  }

  const discountPositions = createDiscountInvoicePositions(input.positions, input.gutscheinBetrag);
  if (discountPositions.length > 0) {
    invoicePositions.push(...discountPositions);
  }

  const primaryTaxRate = invoicePositions.find((pos) => Number.isFinite(pos.taxRate))?.taxRate ?? 0;
  const taxText = primaryTaxRate > 0 ? `Umsatzsteuer ${primaryTaxRate}%` : 'Umsatzsteuer 0%';

  const addressName = rechnungstyp === 'firma'
    ? bestellung.firmenname || `${bestellung.vorname} ${bestellung.nachname}`
    : `${bestellung.vorname ?? ''} ${bestellung.nachname ?? ''}`.trim() || primaryEmail;

  const addressLines = [addressName, bestellung.strasse, `${bestellung.plz ?? ''} ${bestellung.stadt ?? ''}`.trim()].filter(
    (value) => value && value.trim().length > 0
  );

  const sevdeskCountryId = Number(process.env.SEVDESK_DEFAULT_COUNTRY_ID ?? '1');
  const contactPersonIdRaw = process.env.SEVDESK_CONTACT_PERSON_ID;
  const parsedContactPersonId = contactPersonIdRaw && contactPersonIdRaw.trim().length > 0
    ? Number(contactPersonIdRaw)
    : undefined;
  const contactPersonRef = Number.isFinite(parsedContactPersonId)
    ? makeObjectRef(parsedContactPersonId as number, 'SevUser')
    : undefined;

  const timeToPay = resolveSevDeskTimeToPay();

  const takeDefaultAddress: 'true' | 'false' = addressLines.length === 0 ? 'true' : 'false';

  const invoiceFactoryPayload = {
    invoice: {
      objectName: 'Invoice',
      contact: makeObjectRef(contactId, 'Contact'),
      invoiceDate: toISODate(bestellung.createdAt),
      deliveryDate: toISODate(bestellung.createdAt),
      status: 100,
      invoiceType: 'RE',
      currency: bestellung.waehrung || 'EUR',
      taxRule: makeObjectRef(Number(process.env.SEVDESK_TAX_RULE_ID ?? '1') || 1, 'TaxRule'),
      taxRate: primaryTaxRate,
      taxText,
      timeToPay: timeToPay ?? undefined,
      discountTime: bestellung.bestellstatus === 'bezahlt' ? 0 : undefined,
      discount: bestellung.gutscheinBetrag ?? 0,
      addressName: addressName ?? undefined,
      addressStreet: bestellung.strasse ?? undefined,
      addressZip: bestellung.plz ?? undefined,
      addressCity: bestellung.stadt ?? undefined,
      addressCountry: makeObjectRef(Number.isFinite(sevdeskCountryId) ? sevdeskCountryId : 1, 'StaticCountry'),
      address: addressLines.join('\n') || undefined,
      contactPerson: contactPersonRef,
      showNet: '1',
      mapAll: 'true',
      customerInternalNote: bestellung.bestellnummer ? `Bestellung ${bestellung.bestellnummer}` : undefined,
    },
    invoicePosSave: invoicePositions.map((pos) => ({
      objectName: 'InvoicePos',
      mapAll: 'true',
      quantity: pos.quantity,
      price: pos.price,
      priceGross: pos.price,
      name: pos.name,
      text: pos.text ?? undefined,
      taxRate: pos.taxRate,
      unity: makeObjectRef(1, 'Unity'),
    })),
    takeDefaultAddress,
  };

  const invoiceResponse = await createInvoiceViaFactory(strapi, invoiceFactoryPayload, undefined);
  const invoiceId = parseSevDeskId(invoiceResponse);
  if (!invoiceId) {
    throw new Error('SevDesk: Rechnungs-ID konnte nicht ermittelt werden.');
  }

  await updateInvoiceStatus(strapi, invoiceId, 200);

  if (bestellung.bestellstatus === 'bezahlt') {
    await markInvoicePaid(strapi, invoiceId, toISODate(new Date()), Number(input.dueTotals?.brutto ?? 0));
  }

  const invoiceWithDocument = await fetchInvoiceWithDocument(strapi, invoiceId);
  const documentRef = extractDocumentId(invoiceWithDocument);

  const updateData: Record<string, unknown> = {
    sevdeskContactId: contactId,
    sevdeskInvoiceId: invoiceId,
  };
  if (documentRef?.id) {
    updateData.sevdeskDocumentId = String(documentRef.id);
  }
  await strapi.entityService.update('api::bestellung.bestellung', input.bestellungId, { data: updateData });
}

export default factories.createCoreController('api::bestellung.bestellung', ({ strapi }) => ({
  async publicGet(ctx) {
    const id = Number(ctx.params?.id);
    if (!Number.isFinite(id)) return ctx.badRequest('Ungültige ID');
    try {
      const bestellung = await strapi.entityService.findOne('api::bestellung.bestellung', id, {
        populate: { gutscheine: { filters: { istTemplate: false }, fields: ['code', 'betrag', 'eingeloest'] } },
        fields: [
          'id',
          'bestellstatus',
          'zahlungsmethode',
          'zuZahlenBrutto',
          'zuZahlenNetto',
          'zuZahlenSteuer',
          'summePositionenBrutto',
          'summePositionenNetto',
          'summeSteuer',
          'gutscheinBetrag',
        ],
      });
      if (!bestellung) return ctx.notFound('Nicht gefunden');
      const vouchers = Array.isArray((bestellung as any)?.gutscheine) ? (bestellung as any).gutscheine : [];
      ctx.body = {
        id: bestellung.id,
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

    const discountRaw = Number(body.gutscheinBetrag ?? 0);
    const gutscheinBetrag = Number.isFinite(discountRaw) && discountRaw > 0 ? round2(discountRaw) : 0;

    const seminarSeats = new Map<number, { menge: number; brutto: number; netto: number; titel: string; steuerSatz: number }>();
    const positionen: any[] = [];
    const voucherRequests: Array<{ betrag: number; name: string; beschreibung?: string; produktId?: number; menge: number }> = [];

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

    const loadGutscheinTemplate = async () => {
      return strapi.db.query('api::gutschein.gutschein').findOne({
        where: { istTemplate: true },
        select: ['id', 'minBetrag', 'maxBetrag', 'name'],
      });
    };

    const templatePromise = loadGutscheinTemplate();

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
        const fallbackPreis = Number(raw.einzelpreisBrutto);
        const basisPreis = Number.isFinite(seminarPreis) ? seminarPreis : fallbackPreis;
        if (!Number.isFinite(basisPreis)) {
          strapi.log.error(`[publicCreate Bestellung] Kein Preis für Termin ${terminId} (raw=${JSON.stringify({ terminId, rawPreis: raw.einzelpreisBrutto, seminarPreis: seminar?.preis })})`);
          return ctx.badRequest('Preis für Termin nicht verfügbar');
        }
        const brutto = round2(basisPreis);
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
      } else {
        const produktId = Number(raw.produktId);
        if (!Number.isFinite(produktId)) return ctx.badRequest('Produkt-ID fehlt');
        const produkt = await loadProdukt(produktId);
        if (!produkt) return ctx.badRequest('Produkt nicht verfügbar');

        const istGutschein = !!produkt.gutschein || typ === 'gutschein';
        let brutto: number | undefined = produkt.preisBrutto != null ? Number(produkt.preisBrutto) : undefined;
        let netto: number | undefined = produkt.preisNetto != null ? Number(produkt.preisNetto) : undefined;
        let steuerSatz = produkt.steuerSatz != null ? Number(produkt.steuerSatz) : Number(process.env.VAT_RATE ?? 19);
        if (produkt.mwst === false) {
          steuerSatz = 0;
        }

        if (istGutschein) {
          const template = await templatePromise;
          if (!template) {
            return ctx.badRequest('Kein Gutschein-Template konfiguriert');
          }
          const betrag = raw.betrag != null ? Number(raw.betrag) : Number(raw.einzelpreisBrutto ?? brutto);
          if (!Number.isFinite(betrag) || betrag <= 0) {
            return ctx.badRequest('Gutscheinbetrag ungültig');
          }
          const min = template.minBetrag != null ? Number(template.minBetrag) : undefined;
          const max = template.maxBetrag != null ? Number(template.maxBetrag) : undefined;
          if (min != null && betrag < min) return ctx.badRequest(`Gutscheinbetrag muss mindestens ${min} sein`);
          if (max != null && betrag > max) return ctx.badRequest(`Gutscheinbetrag darf höchstens ${max} sein`);
          brutto = round2(betrag);
          netto = brutto;
          steuerSatz = 0;
          voucherRequests.push({
            betrag: brutto,
            name: raw.titel?.trim() || produkt.name,
            beschreibung: raw.beschreibung,
            produktId,
            menge,
          });
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

    // Teilnehmer prüfen und vorbereiten
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

    const expectedBrutto = summePositionenBrutto;
    const expectedTotal = round2(Math.max(0, expectedBrutto - gutscheinBetrag));

    const zahlungsmethode = body.zahlungsmethode === 'paypal' ? 'paypal' : (body.zahlungsmethode === 'rechnung' ? 'rechnung' : body.zahlungsmethode || 'rechnung');
    let zahlungsreferenz: string | undefined = body.zahlungsreferenz ? String(body.zahlungsreferenz) : undefined;
    let bestellstatus: 'offen' | 'bezahlt' | 'storniert' = 'offen';

    const verifyPayPalCapture = async (captureId: string) => {
      const mode = String(process.env.PAYPAL_MODE || 'sandbox').toLowerCase();
      const base = mode === 'live' ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com';
      const client = process.env.PAYPAL_CLIENT_ID || '';
      const secret = process.env.PAYPAL_CLIENT_SECRET || process.env.PAYPAL_SECRET || '';
      if (!client || !secret) throw new Error('PayPal Credentials fehlen');
      const tokenRes = await fetch(`${base}/v1/oauth2/token`, {
        method: 'POST',
        headers: {
          Authorization: 'Basic ' + Buffer.from(`${client}:${secret}`).toString('base64'),
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: 'grant_type=client_credentials',
      });
      if (!tokenRes.ok) throw new Error(`PayPal Token Fehler ${tokenRes.status}`);
      const tokenJson = (await tokenRes.json()) as { access_token?: string };
      const accessToken = tokenJson.access_token;
      if (!accessToken) throw new Error('PayPal Token fehlt');

      const capRes = await fetch(`${base}/v2/payments/captures/${encodeURIComponent(captureId)}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!capRes.ok) {
        const txt = await capRes.text();
        throw new Error(`PayPal Capture Fehler ${capRes.status}: ${txt}`);
      }
      const cap = (await capRes.json()) as { status?: string; amount?: { value?: string; currency_code?: string } };
      if ((cap.status || '').toUpperCase() !== 'COMPLETED') throw new Error('PayPal Capture nicht abgeschlossen');
      if ((cap.amount?.currency_code || '').toUpperCase() !== 'EUR') throw new Error('PayPal-Währung ist nicht EUR');
      const value = cap.amount?.value ? Number(cap.amount.value) : NaN;
      if (!Number.isFinite(value)) throw new Error('PayPal-Wert ungültig');
      if (Math.abs(value - expectedTotal) > 0.01) {
        throw new Error('PayPal-Betrag weicht vom erwarteten Betrag ab');
      }
    };

    try {
      if (zahlungsmethode === 'paypal') {
        if (body.paypalCaptureId) {
          await verifyPayPalCapture(String(body.paypalCaptureId));
          bestellstatus = 'bezahlt';
          zahlungsreferenz = String(body.paypalCaptureId);
        } else {
          bestellstatus = 'offen';
        }
      }

      const summeGutschein = round2(gutscheinBetrag);
      const dueBrutto = round2(Math.max(0, summePositionenBrutto - summeGutschein));
      const ratio = summePositionenBrutto > 0 ? summePositionenNetto / summePositionenBrutto : 1;
      const gutscheinNetto = round2(summeGutschein * ratio);
      const gutscheinSteuer = round2(summeGutschein - gutscheinNetto);
      const dueNetto = round2(Math.max(0, summePositionenNetto - gutscheinNetto));
      const dueSteuer = round2(Math.max(0, summeSteuer - gutscheinSteuer));

      const newsletterOptIn = !!body.newsletterOptIn;
      const newsletterOptInAt = newsletterOptIn ? new Date().toISOString() : undefined;

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
        gutscheinCode: body.gutscheinCode,
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
      let bestellnummer = createdAny.bestellnummer as string | undefined;

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

      let kundeId: string | number | undefined;

      try {
        const email: string | undefined = rechnungstyp === 'firma' ? (bestellungData.rechnungsEmail || bestellungData.email) : bestellungData.email;
        if (email) {
          const existingCustomer = await strapi.db.query('api::kunde.kunde').findOne({
            where: { email },
            select: ['id', 'newsletterOptIn', 'newsletterOptInAt'],
          });
          kundeId = existingCustomer?.id;
          if (!kundeId) {
            const createdCustomer = await strapi.entityService.create('api::kunde.kunde', {
              data: {
                vorname: bestellungData.vorname || '—',
                nachname: bestellungData.nachname || (rechnungstyp === 'firma' ? bestellungData.firmenname || '—' : '—'),
                email,
                telefon: bestellungData.telefon,
                strasse: bestellungData.strasse,
                plz: bestellungData.plz,
                stadt: bestellungData.stadt,
                land: bestellungData.land,
                ...(newsletterOptIn
                  ? {
                      newsletterOptIn: true,
                      newsletterOptInAt: newsletterOptInAt || new Date().toISOString(),
                    }
                  : {}),
              },
            });
            kundeId = createdCustomer.id;
          } else if (newsletterOptIn && (!existingCustomer?.newsletterOptIn || !existingCustomer?.newsletterOptInAt)) {
            await strapi.entityService.update('api::kunde.kunde', kundeId, {
              data: {
                newsletterOptIn: true,
                newsletterOptInAt: existingCustomer?.newsletterOptInAt || newsletterOptInAt || new Date().toISOString(),
              },
            });
          }
          if (kundeId) {
            await strapi.entityService.update('api::bestellung.bestellung', bestellungId, { data: { kunde: kundeId } });
          }
        }
      } catch (linkErr) {
        strapi.log.warn(`[publicCreate Bestellung] Kunde-Verknüpfung übersprungen: ${(linkErr as any)?.message || linkErr}`);
      }

      try {
        if (!bestellnummer) {
          bestellnummer = formatOrderNumber(bestellungId);
          await strapi.entityService.update('api::bestellung.bestellung', bestellungId, {
            data: { bestellnummer },
          });
        }
      } catch (titleErr) {
        strapi.log.warn(`[publicCreate Bestellung] Nummer-Setzung übersprungen: ${(titleErr as any)?.message || titleErr}`);
      }

      let generatedCodes: string[] = [];
      if (bestellstatus === 'bezahlt' && voucherRequests.length > 0) {
        for (const req of voucherRequests) {
          const count = Math.max(1, Number(req.menge));
          for (let i = 0; i < count; i += 1) {
            const code = await generateVoucherCode(strapi);
            generatedCodes.push(code);
            await strapi.entityService.create('api::gutschein.gutschein', {
              data: {
                name: req.name,
                beschreibung: req.beschreibung,
                code,
                betrag: req.betrag,
                istTemplate: false,
                aktiv: true,
                bestellung: bestellungId,
              },
            });
          }
        }
        if (generatedCodes.length > 0) {
          await strapi.entityService.update('api::bestellung.bestellung', bestellungId, {
            data: { gutscheinCode: generatedCodes.join(', ') },
          });
        }
      }

      const full = await strapi.entityService.findOne('api::bestellung.bestellung', bestellungId, {
        populate: { gutscheine: { filters: { istTemplate: false }, fields: ['code', 'betrag'] } },
        fields: ['*'] as any,
      });

      const fullAny = full as any;

      let kundeEntity: any = null;
      if (kundeId) {
        try {
          kundeEntity = await strapi.entityService.findOne('api::kunde.kunde', kundeId);
        } catch (kundeLoadErr) {
          strapi.log.warn(
            `[publicCreate Bestellung] Kunde für SevDesk konnte nicht geladen werden: ${(kundeLoadErr as any)?.message || kundeLoadErr}`
          );
        }
      }

      try {
        await syncSevDeskOrder(strapi, {
          bestellungId,
          bestellung: fullAny,
          kundeId,
          kunde: kundeEntity,
          positions: normalisedPositions,
          dueTotals: { brutto: dueBrutto, netto: dueNetto, steuer: dueSteuer },
          gutscheinBetrag: summeGutschein,
        });
      } catch (sevdeskErr) {
        strapi.log.error('[publicCreate Bestellung] SevDesk-Synchronisation fehlgeschlagen', {
          bestellungId,
          error: sevdeskErr instanceof Error ? sevdeskErr.message : sevdeskErr,
        });
      }

      let orderForNotifications = fullAny;
      try {
        const reloaded = await fetchOrderWithDetails(strapi, bestellungId);
        if (reloaded) {
          orderForNotifications = reloaded;
        }
      } catch (reloadErr) {
        strapi.log.warn('[publicCreate Bestellung] Bestellung konnte für Benachrichtigungen nicht neu geladen werden.', {
          bestellungId,
          error: reloadErr instanceof Error ? reloadErr.message : reloadErr,
        });
      }

      const gutscheine = Array.isArray(fullAny?.gutscheine) ? fullAny.gutscheine : [];
      ctx.body = {
        id: fullAny.id,
        bestellnummer: fullAny.bestellnummer,
        status: fullAny.bestellstatus,
        zahlungsmethode: fullAny.zahlungsmethode,
        totals: {
          brutto: fullAny.zuZahlenBrutto ?? fullAny.summePositionenBrutto,
          netto: fullAny.zuZahlenNetto ?? fullAny.summePositionenNetto,
          steuer: fullAny.zuZahlenSteuer ?? fullAny.summeSteuer,
          gutschein: fullAny.gutscheinBetrag ?? 0,
        },
        gutscheine: gutscheine.map((g: any) => ({ code: g.code, betrag: g.betrag })),
      };

      try {
        await sendOrderCreatedEmails(strapi, orderForNotifications);
        if (bestellstatus === 'bezahlt') {
          await sendPaymentConfirmedEmails(strapi, orderForNotifications, {
            paymentAmount: dueBrutto,
            paymentDate: new Date(),
          });
        }
      } catch (notificationErr) {
        strapi.log.error('[publicCreate Bestellung] Benachrichtigungen fehlgeschlagen.', {
          bestellungId,
          error: notificationErr instanceof Error ? notificationErr.message : notificationErr,
        });
      }
    } catch (err: any) {
      strapi.log.error('[publicCreate Bestellung] Fehler', err);
      return ctx.badRequest(err?.message || 'Bestellung fehlgeschlagen');
    }
  },
}));
