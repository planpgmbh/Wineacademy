import { factories } from '@strapi/strapi';

export default factories.createCoreController('api::buchung.buchung', ({ strapi }) => ({
  async publicCreate(ctx) {
    const body = ctx.request.body as any;
    if (!body || typeof body !== 'object') return ctx.badRequest('Ungültiger Payload');

    try {
      // Minimal-Validierung hier; Detailvalidierung in Lifecycles
      if (!body.terminId && !body.termin) return ctx.badRequest('terminId fehlt');
      const terminId = body.terminId || body.termin;
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

      const payload = {
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
        teilnehmer: body.teilnehmer,
        termin: termin.id,
        // MwSt/Preiseingaben
        mitMwst: body.mitMwst,
        steuerSatz: body.steuerSatz,
        preisBrutto: body.preisBrutto,
        preisNetto: body.preisNetto,
        // legacy-Kompatibilität, falls Frontend noch preisProPlatz sendet
        preisProPlatz: body.preisProPlatz,
        gutscheincode: body.gutscheincode,
        agbAkzeptiert: !!body.agbAkzeptiert,
        notizen: body.notizen,
      } as any;

      // Zahlungsinformationen (optional)
      if (body.paypalCaptureId) {
        payload.zahlungsreferenz = String(body.paypalCaptureId);
        payload.zahlungsmethode = 'paypal';
      } else if (body.zahlungsreferenz) {
        payload.zahlungsreferenz = String(body.zahlungsreferenz);
      }
      if (body.zahlungsmethode) payload.zahlungsmethode = body.zahlungsmethode;
      // Status: wenn vom Client 'bezahlt' gemeldet (z. B. nach PayPal), auf 'bezahlt' setzen; sonst offen
      if (body.status === 'bezahlt' || body.paid === true || body.paymentApproved === true) {
        payload.status = 'bezahlt';
      }

      const created = await strapi.entityService.create('api::buchung.buchung', {
        data: payload,
      });

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
