import {
  saveContact,
  createCommunicationWay,
  createInvoiceByFactory,
  markInvoicePaid,
  markInvoiceSent,
  fetchInvoiceWithDocument,
  extractDocumentId,
  extractInvoiceNumber,
  SevDeskError,
  isSevDeskSyncEnabled,
  resolveDefaultContactPerson,
  findDocumentForInvoice,
} from '../../../services/sevdesk';

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

const toSevDeskDate = (input?: string | Date): string => {
  const iso = toISODate(input);
  const [year, month, day] = iso.split('-');
  return `${day}.${month}.${year}`;
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

export interface SevDeskSyncInput {
  bestellungId: number;
  bestellung: any;
  kundeId?: string | number;
  kunde?: any;
  positions: any[];
  dueTotals: { brutto: number; netto: number; steuer: number };
  gutscheinBetrag: number;
}

export async function syncSevDeskOrder(strapi: any, input: SevDeskSyncInput): Promise<void> {
  if (!isSevDeskSyncEnabled()) {
    if (strapi?.log?.debug) {
      strapi.log.debug('SevDesk-Synchronisation deaktiviert (SEVDESK_SYNC_ENABLED=false).');
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
  const existingContactId = bestellung.sevdeskContactId || input.kunde?.sevdeskContactId;
  const rechnungstyp = bestellung.rechnungstyp === 'firma' ? 'firma' : 'privat';
  const isCompany = rechnungstyp === 'firma';
  const companyName = isCompany ? String(bestellung.firmenname || '').trim() : undefined;
  const fallbackName = `${bestellung.vorname || ''} ${bestellung.nachname || ''}`.trim() || companyName || 'Kontakt';
  const paymentMethod = String(bestellung.zahlungsmethode || '').toLowerCase();

  const normaliseIsoDate = (value: unknown): string | undefined => {
    if (!value) return undefined;
    const date = value instanceof Date ? value : new Date(value as string);
    if (Number.isNaN(date.getTime())) {
      return undefined;
    }
    return date.toISOString();
  };

  const newsletterOptIn = Boolean(bestellung.newsletterOptIn);
  const newsletterOptInAt = newsletterOptIn
    ? normaliseIsoDate(bestellung.newsletterOptInAt) ?? new Date().toISOString()
    : undefined;

  const contactPayload: Record<string, unknown> = {
    categoryId: resolveSevDeskCategoryId(rechnungstyp),
    name: isCompany ? companyName || fallbackName : fallbackName,
    customerType: isCompany ? 'COMPANY' : 'PERSON',
    status: 100,
  };

  if (existingContactId) {
    contactPayload.id = existingContactId;
  }

  contactPayload.description = bestellung.bestellnummer
    ? `Bestellung ${bestellung.bestellnummer}`
    : `Bestellung #${input.bestellungId}`;

  if (isCompany) {
    const name2 = `${bestellung.vorname || ''} ${bestellung.nachname || ''}`.trim();
    if (name2) {
      contactPayload.name2 = name2;
    }
    if (bestellung.ustId) {
      contactPayload.vatNumber = String(bestellung.ustId).trim();
    }
  } else {
    contactPayload.name2 = undefined;
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

  let kundeId: string | number | undefined = input.kundeId;
  try {
    const email: string | undefined =
      rechnungstyp === 'firma'
        ? (bestellung.rechnungsEmail || bestellung.email)
        : bestellung.email;
    if (email) {
      const existingCustomer = await strapi.db.query('api::kunde.kunde').findOne({
        where: { email },
        select: ['id', 'newsletterOptIn', 'newsletterOptInAt'],
      });
      if (existingCustomer?.id) {
        kundeId = existingCustomer.id;
        if (
          newsletterOptIn &&
          (!existingCustomer.newsletterOptIn || !existingCustomer.newsletterOptInAt)
        ) {
          await strapi.entityService.update('api::kunde.kunde', existingCustomer.id, {
            data: {
              newsletterOptIn: true,
              newsletterOptInAt: existingCustomer.newsletterOptInAt || newsletterOptInAt || new Date().toISOString(),
            },
          });
        }
      } else {
        const createdCustomer = await strapi.entityService.create('api::kunde.kunde', {
          data: {
            vorname: bestellung.vorname || '—',
            nachname: bestellung.nachname || (rechnungstyp === 'firma' ? bestellung.firmenname || '—' : '—'),
            email,
            telefon: bestellung.telefon,
            strasse: bestellung.strasse,
            plz: bestellung.plz,
            stadt: bestellung.stadt,
            land: bestellung.land,
            ...(newsletterOptIn
              ? {
                  newsletterOptIn: true,
                  newsletterOptInAt: newsletterOptInAt || new Date().toISOString(),
                }
              : {}),
          },
        });
        kundeId = createdCustomer.id;
      }

      if (kundeId) {
        await strapi.entityService.update('api::bestellung.bestellung', input.bestellungId, {
          data: { kunde: kundeId },
        });
      }
    }
  } catch (linkErr) {
    strapi.log.warn(
      `[publicCreate Bestellung] Kunde-Verknüpfung übersprungen: ${(linkErr as any)?.message || linkErr}`
    );
  }

  const contactResponse = await saveContact(strapi, contactPayload as any);
  const contactId = parseSevDeskId(contactResponse) ?? (existingContactId ? String(existingContactId) : null);
  if (!contactId) {
    throw new Error('SevDesk: Kontakt-ID konnte nicht ermittelt werden.');
  }

  await strapi.entityService.update('api::bestellung.bestellung', input.bestellungId, {
    data: { sevdeskContactId: contactId },
  });

  if (kundeId && (!input.kunde?.sevdeskContactId || String(input.kunde.sevdeskContactId) !== contactId)) {
    await strapi.entityService.update('api::kunde.kunde', kundeId, {
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

  const defaultTimeToPay = resolveSevDeskTimeToPay();
  const timeToPay = paymentMethod === 'rechnung' ? 15 : defaultTimeToPay;
  const contactPersonRef = await resolveDefaultContactPerson(strapi);
  if (!contactPersonRef) {
    throw new Error(
      'SevDesk: Keine Kontaktperson konfiguriert (SEVDESK_CONTACT_PERSON_ID setzen oder SevUser abrufbar machen).'
    );
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

  const taxRuleIdEnv = process.env.SEVDESK_TAX_RULE_ID;
  const parsedTaxRuleId = taxRuleIdEnv ? Number(taxRuleIdEnv) : 1;
  const defaultCountryRaw = process.env.SEVDESK_DEFAULT_COUNTRY_ID;
  const parsedCountryId = defaultCountryRaw ? Number(defaultCountryRaw) : NaN;
  const resolvedCountryId = Number.isFinite(parsedCountryId) && parsedCountryId > 0 ? parsedCountryId : 1;
  const invoiceFactoryPayload = {
    invoice: {
      objectName: 'Invoice',
      contact: { id: contactId, objectName: 'Contact' },
      contactPerson: contactPersonRef,
      invoiceDate: toSevDeskDate(bestellung.createdAt),
      deliveryDate: toSevDeskDate(bestellung.createdAt),
      status: 100,
      invoiceType: 'RE',
      currency: bestellung.waehrung || 'EUR',
      timeToPay: timeToPay !== undefined ? timeToPay : undefined,
      customerInternalNote: bestellung.bestellnummer
        ? `Bestellung ${bestellung.bestellnummer}`
        : `Bestellung #${input.bestellungId}`,
      taxRule: {
        id: Number.isFinite(parsedTaxRuleId) ? parsedTaxRuleId : 1,
        objectName: 'TaxRule',
      },
      discount: 0,
      taxRate: 0,
      taxText: `Umsatzsteuer ${round2(Number(process.env.VAT_RATE ?? 19))}%`,
      taxType: 'default',
      mapAll: true,
      showNet: false,
      addressCountry: { id: resolvedCountryId, objectName: 'StaticCountry' },
      addressStreet: bestellung.strasse || undefined,
      addressZip: bestellung.plz || undefined,
      addressCity: bestellung.stadt || undefined,
      addressName: rechnungstyp === 'firma' ? companyName : fallbackName,
    },
    invoicePosSave: invoicePositions.map((position) => {
      const gross = round2(position.price);
      const taxRate = Number.isFinite(position.taxRate) ? position.taxRate : 0;
      const net = taxRate > 0 ? round2(gross / (1 + taxRate / 100)) : gross;
      const taxAmount = round2(gross - net);
      return {
        objectName: 'InvoicePos',
        mapAll: true,
        quantity: position.quantity,
        price: net,
        priceGross: gross,
        taxRate,
        priceTax: taxAmount,
        name: position.name,
        text: position.text,
        unity: { id: 1, objectName: 'Unity' },
      };
    }),
    invoicePosDelete: null,
    discountSave: null,
    discountDelete: null,
    takeDefaultAddress: true,
  };

  const invoiceResponse = await createInvoiceByFactory(strapi, invoiceFactoryPayload as any);
  const invoiceNumberFromCreate = extractInvoiceNumber(invoiceResponse);
  const invoiceId = parseSevDeskId(invoiceResponse);
  if (!invoiceId) {
    throw new Error('SevDesk: Rechnungs-ID konnte nicht ermittelt werden.');
  }

  try {
    await markInvoiceSent(strapi, invoiceId, process.env.SEVDESK_SEND_TYPE);
  } catch (sendErr) {
    strapi.log.error('[SevDesk] Rechnung konnte nicht als versendet markiert werden', {
      bestellungId: input.bestellungId,
      invoiceId,
      error: sendErr instanceof Error ? sendErr.message : sendErr,
    });
  }

  const orderStatus = String(bestellung.bestellstatus || '').toLowerCase();
  const shouldBookPayment =
    orderStatus === 'bezahlt' || (paymentMethod === 'paypal' && Boolean(bestellung.zahlungsreferenz));
  if (shouldBookPayment) {
    try {
      await markInvoicePaid(strapi, invoiceId, Number(input.dueTotals?.brutto ?? 0), bestellung.updatedAt);
    } catch (bookErr) {
      strapi.log.error('[SevDesk] Zahlung konnte nicht gebucht werden', {
        bestellungId: input.bestellungId,
        invoiceId,
        error: bookErr instanceof Error ? bookErr.message : bookErr,
      });
    }
  }

  const invoiceWithDocument = await fetchInvoiceWithDocument(strapi, invoiceId);
  const invoiceNumberFromFetch = extractInvoiceNumber(invoiceWithDocument);
  const documentRef = extractDocumentId(invoiceWithDocument);
  let resolvedDocumentId: string | number | null | undefined = documentRef?.id;
  if (!resolvedDocumentId) {
    try {
      const documentEntry = await findDocumentForInvoice(strapi, invoiceId);
      if (documentEntry?.id) {
        resolvedDocumentId = documentEntry.id;
      }
    } catch (docError) {
      strapi.log?.warn?.('[SevDesk] Dokument konnte nicht ermittelt werden.', {
        bestellungId: input.bestellungId,
        invoiceId,
        error: docError instanceof Error ? docError.message : docError,
      });
    }
  }

  const updateData: Record<string, unknown> = {
    sevdeskContactId: contactId,
    sevdeskInvoiceId: invoiceId,
  };
  const resolvedInvoiceNumber = invoiceNumberFromCreate || invoiceNumberFromFetch;
  if (resolvedInvoiceNumber) {
    updateData.bestellnummer = resolvedInvoiceNumber;
  }
  if (resolvedDocumentId) {
    updateData.sevdeskDocumentId = String(resolvedDocumentId);
  }
  await strapi.entityService.update('api::bestellung.bestellung', input.bestellungId, { data: updateData });
}
