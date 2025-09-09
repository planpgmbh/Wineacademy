import { factories } from '@strapi/strapi';

export default factories.createCoreController('api::buchung.buchung', ({ strapi }) => ({
  // Public: Buchungsdetails ohne personenbezogene Daten
  async publicGet(ctx) {
    const id = Number(ctx.params?.id);
    if (!Number.isFinite(id)) return ctx.badRequest('Ungültige ID');
    try {
      const knex = (strapi as any).db.connection;
      const rec = await knex('buchungen').where({ id }).first();
      if (!rec) return ctx.notFound('Nicht gefunden');
      const get = (k: string) => (rec[k] != null ? rec[k] : rec[k.replace(/[A-Z]/g, (m) => '_' + m.toLowerCase())]);
      ctx.body = {
        id: rec.id,
        status: get('status'),
        zahlungsmethode: get('zahlungsmethode'),
        anzahl: get('anzahl'),
        gesamtpreisBrutto: get('gesamtpreisBrutto'),
        gesamtpreisNetto: get('gesamtpreisNetto'),
        gesamtsteuerBetrag: get('gesamtsteuerBetrag'),
      };
    } catch (e) {
      strapi.log.error('[publicGet Buchung] Fehler', e);
      return ctx.internalServerError('Fehler');
    }
  },
  async publicCreate(ctx) {
    const body = ctx.request.body as any;
    if (!body || typeof body !== 'object') return ctx.badRequest('Ungültiger Payload');

    try {
      try {
        strapi.log.info(`[publicCreate Buchung] eingehender Payload: ` + JSON.stringify({ terminId: body?.terminId, termin: body?.termin, paypalOrderId: body?.paypalOrderId, paypalCaptureId: body?.paypalCaptureId }));
      } catch {}
      // Termin ermitteln: direkt oder über PayPal-Order (Redirect-Fall)
      let terminId: number | undefined = undefined;
      let teilnehmerAnzahl: number | undefined = undefined;

      const parseTermin = (v: unknown): number | undefined => {
        const n = Number(v);
        return Number.isFinite(n) ? n : undefined;
      };

      terminId = parseTermin(body.terminId ?? body.termin);

      if (!terminId && body.paypalOrderId) {
        try {
          const mode = String(process.env.PAYPAL_MODE || 'sandbox').toLowerCase();
          const base = mode === 'live' ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com';
          const client = process.env.PAYPAL_CLIENT_ID || '';
          const secret = process.env.PAYPAL_CLIENT_SECRET || process.env.PAYPAL_SECRET || '';
          if (!client || !secret) throw new Error('PayPal Credentials fehlen');
          // Access Token
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

          const orderId = String(body.paypalOrderId);
          // Bestelldetails lesen
          const orderRes = await fetch(`${base}/v2/checkout/orders/${encodeURIComponent(orderId)}`, {
            headers: { Authorization: `Bearer ${accessToken}` },
          });
          if (!orderRes.ok) throw new Error(`PayPal Order Fehler ${orderRes.status}`);
          const order = (await orderRes.json()) as any;
          const customId = order?.purchase_units?.[0]?.custom_id as string | undefined;
          try { strapi.log.info(`[publicCreate Buchung] PayPal Order custom_id: ${customId}`); } catch {}
          if (customId) {
            const parts = String(customId).split('|');
            const maybeTermin = Number(parts?.[1]);
            const maybeAnzahl = Number(parts?.[2]);
            if (Number.isFinite(maybeTermin)) terminId = maybeTermin;
            if (Number.isFinite(maybeAnzahl)) teilnehmerAnzahl = maybeAnzahl;
          }
        } catch (e) {
          strapi.log.warn(`[publicCreate Buchung] PayPal Order-Auswertung fehlgeschlagen: ${(e as any)?.message || e}`);
        }
      }

      if (!terminId) return ctx.badRequest('Ungültiger Termin');

      const termin = await strapi.db.query('api::termin.termin').findOne({
        where: { id: terminId },
        select: ['id', 'preis'],
      });
      if (!termin) return ctx.badRequest('Ungültiger Termin');

      // Teilnehmer-Validierung (auf Rohdatenebene, bevor Strapi Komponenten normalisiert)
      if (!Array.isArray(body.teilnehmer) || body.teilnehmer.length < 1) {
        return ctx.badRequest('Mindestens ein Teilnehmer erforderlich');
      }
      for (const [i, t] of body.teilnehmer.entries()) {
        if (!t?.vorname?.trim()) return ctx.badRequest(`Teilnehmer[${i}]: Vorname fehlt`);
        if (!t?.nachname?.trim()) return ctx.badRequest(`Teilnehmer[${i}]: Nachname fehlt`);
        // E-Mail und Geburtstag sind optional; Formatprüfungen bei Bedarf später
      }

      // Gutschein prüfen (optional) – berechne Rabatt und optionalen Preis-Override pro Platz
      const anz = teilnehmerAnzahl || (Array.isArray(body.teilnehmer) ? body.teilnehmer.length : 1);
      const voucherCode = typeof body.gutscheincode === 'string' && body.gutscheincode.trim() ? String(body.gutscheincode.trim()) : null;
      let rabattBrutto = 0;
      let preisBruttoOverride: number | undefined = undefined;
      if (voucherCode) {
        try {
          const v = await strapi.db.query('api::gutschein.gutschein').findOne({ where: { code: voucherCode }, select: ['code', 'typ', 'wert', 'aktiv', 'gueltigAb', 'gueltigBis'] });
          const today = new Date().toISOString().slice(0, 10);
          const isActive = !!v?.aktiv && (!v.gueltigAb || v.gueltigAb <= today) && (!v.gueltigBis || v.gueltigBis >= today);
          if (v && isActive) {
            const stueck = Number(termin.preis) || 0;
            const total = stueck * anz;
            if (v.typ === 'betrag') rabattBrutto = Math.min(Number(v.wert) || 0, total);
            else rabattBrutto = Math.max(0, Math.round(((total * (Number(v.wert) || 0) / 100) + Number.EPSILON) * 100) / 100);
            if (rabattBrutto > 0 && anz > 0) {
              const neuTotal = Math.max(0, total - rabattBrutto);
              preisBruttoOverride = Math.round(((neuTotal / anz) + Number.EPSILON) * 100) / 100;
            }
          }
        } catch {}
      }

      // Komponenten/Relationen gemäß Strapi v5
      // Basisdaten für die Buchung
      const baseData = {
        vorname: body.vorname,
        nachname: body.nachname,
        email: body.email,
        telefon: body.telefon,
        rechnungstyp: body.rechnungstyp || 'privat',
        firmenname: body.firmenname,
        ustId: body.ustId,
        rechnungsEmail: body.rechnungsEmail,
        strasse: body.strasse,
        plz: body.plz,
        stadt: body.stadt,
        land: body.land,
        anzahl: Array.isArray(body.teilnehmer) ? body.teilnehmer.length : undefined,
        // Preise/MwSt werden serverseitig berechnet; optionaler Override durch Gutschein
        preisBrutto: preisBruttoOverride,
        // Preise/MwSt werden serverseitig berechnet; keine Übernahme aus dem Client
        gutscheincode: body.gutscheincode,
        agbAkzeptiert: !!body.agbAkzeptiert,
        notizen: body.notizen,
      } as any;

      const teilnehmerItems = (Array.isArray(body.teilnehmer) ? body.teilnehmer : []).map((t: any) => ({
        vorname: String(t?.vorname || ''),
        nachname: String(t?.nachname || ''),
        email: t?.email ? String(t.email) : undefined,
        geburtstag: t?.geburtstag ? String(t.geburtstag) : undefined,
        wsetCandidateNumber: t?.wsetCandidateNumber ? String(t.wsetCandidateNumber) : undefined,
        besondereBeduerfnisse: t?.besondereBeduerfnisse ? String(t.besondereBeduerfnisse) : undefined,
      }));

      const payload = {
        ...baseData,
        teilnehmer: { create: teilnehmerItems },
        termin: termin.id,
      } as any;

      // Zahlungsinformationen (optional)
      if (body.paypalCaptureId) {
        payload.zahlungsreferenz = String(body.paypalCaptureId);
        payload.zahlungsmethode = 'paypal';
      } else if (body.zahlungsreferenz) {
        payload.zahlungsreferenz = String(body.zahlungsreferenz);
      }
      if (body.zahlungsmethode) payload.zahlungsmethode = body.zahlungsmethode;
      // Status nur nach serverseitiger Prüfung setzen (weiter unten)

      // PayPal-Verifikation: entweder Capture-ID aus Client oder wir erwarten PayPal-Order-Capture nach Redirect
      const captureToVerify = body.paypalCaptureId || null;
      let verifiedPaid = false;
      if (captureToVerify) {
        try {
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

          const capId = String(captureToVerify);
          const capRes = await fetch(`${base}/v2/payments/captures/${encodeURIComponent(capId)}`, {
            headers: { Authorization: `Bearer ${accessToken}` },
          });
          if (!capRes.ok) {
            const t = await capRes.text();
            throw new Error(`PayPal Capture Fehler ${capRes.status}: ${t}`);
          }
          const cap = (await capRes.json()) as { status?: string; amount?: { value?: string; currency_code?: string } };
          if ((cap.status || '').toUpperCase() !== 'COMPLETED') throw new Error('PayPal Capture nicht abgeschlossen');
          if ((cap.amount?.currency_code || '').toUpperCase() !== 'EUR') throw new Error('PayPal Währung nicht EUR');
          let expected = Number(termin.preis) * anz;
          if (rabattBrutto > 0) expected = Math.max(0, expected - rabattBrutto);
          const capValue = cap.amount?.value ? Number(cap.amount.value) : NaN;
          if (!Number.isFinite(capValue) || Math.abs(capValue - expected) > 0.01) throw new Error('PayPal Capture-Betrag weicht ab');
          verifiedPaid = true;
        } catch (e) {
          return ctx.badRequest((e as any)?.message || 'PayPal-Verifizierung fehlgeschlagen');
        }
      }

      if (verifiedPaid) payload.status = 'bezahlt';

      try { strapi.log.info('[publicCreate Buchung] payload=' + JSON.stringify(payload)); } catch {}
      let created: any;
      try {
        created = await strapi.db.query('api::buchung.buchung').create({ data: payload });
      } catch (e: any) {
        strapi.log.error('[publicCreate Buchung] db.query.create fehlgeschlagen', e);
        throw e;
      }

      ctx.body = {
        id: created.id,
        terminId: termin.id,
        anzahl: created.anzahl,
        mitMwst: created.mitMwst,
        steuerSatz: created.steuerSatz,
        preisBrutto: created.preisBrutto,
        preisNetto: created.preisNetto,
        steuerBetrag: created.steuerBetrag,
        gesamtpreisBrutto: created.gesamtpreisBrutto,
        gesamtpreisNetto: created.gesamtpreisNetto,
        gesamtsteuerBetrag: created.gesamtsteuerBetrag,
        status: created.status,
      };
    } catch (err: any) {
      strapi.log.error('[publicCreate Buchung] Fehler', err);
      return ctx.badRequest(err?.message || 'Buchung fehlgeschlagen');
    }
  },
}));
