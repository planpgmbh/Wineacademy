import { factories } from '@strapi/strapi';

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
    const voucherRequests: Array<{ betrag: number; titel: string; beschreibung?: string; produktId?: number; menge: number }> = [];

    const loadProdukt = async (id: number) => {
      return strapi.db.query('api::produkt.produkt').findOne({
        where: { id, aktiv: true },
        select: ['id', 'titel', 'preisNetto', 'preisBrutto', 'steuerSatz', 'mwst', 'gutschein'],
      });
    };

    const loadTermin = async (id: number) => {
      return strapi.db.query('api::termin.termin').findOne({
        where: { id },
        select: ['id', 'planungsstatus', 'publishedAt'],
        populate: {
          seminar: { select: ['id', 'seminarname', 'mwst', 'preis'] },
          tage: { select: ['datum', 'startzeit', 'endzeit'] },
        },
      });
    };

    const loadGutscheinTemplate = async () => {
      return strapi.db.query('api::gutschein.gutschein').findOne({
        where: { istTemplate: true },
        select: ['id', 'minBetrag', 'maxBetrag', 'titel'],
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

        const titel = raw.titel?.trim() || `${seminar?.seminarname || 'Seminar'} · Termin #${termin.id}`;
        const summeBrutto = round2(brutto * menge);
        const summeNetto = round2(netto * menge);
        const summeSteuer = round2(summeBrutto - summeNetto);
        const position = {
          typ: 'seminar',
          titel,
          beschreibung: raw.beschreibung || termin?.ort?.standort,
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
            titel: raw.titel?.trim() || produkt.titel,
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
          titel: raw.titel?.trim() || produkt.titel,
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
        titel: body.titel,
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

      try {
        const email: string | undefined = rechnungstyp === 'firma' ? (bestellungData.rechnungsEmail || bestellungData.email) : bestellungData.email;
        if (email) {
          const existingCustomer = await strapi.db.query('api::kunde.kunde').findOne({
            where: { email },
            select: ['id', 'newsletterOptIn', 'newsletterOptInAt'],
          });
          let kundeId = existingCustomer?.id;
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
        }
        const hasTitel = bestellungData.titel && String(bestellungData.titel).trim() !== '';
        const titel = hasTitel ? bestellungData.titel : bestellnummer;
        await strapi.entityService.update('api::bestellung.bestellung', bestellungId, {
          data: {
            bestellnummer,
            ...(hasTitel ? {} : { titel }),
          },
        });
      } catch (titleErr) {
        strapi.log.warn(`[publicCreate Bestellung] Nummer-/Titel-Setzung übersprungen: ${(titleErr as any)?.message || titleErr}`);
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
                titel: req.titel,
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
    } catch (err: any) {
      strapi.log.error('[publicCreate Bestellung] Fehler', err);
      return ctx.badRequest(err?.message || 'Bestellung fehlgeschlagen');
    }
  },
}));
