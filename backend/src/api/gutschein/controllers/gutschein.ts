import { factories } from '@strapi/strapi';

function round2(n: number) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export default factories.createCoreController('api::gutschein.gutschein', ({ strapi }) => ({
  // POST /api/public/gutscheine/validate
  async validate(ctx) {
    try {
      const body = ctx.request.body as any;
      const terminId = Number(body?.terminId);
      const anzahl = Math.max(1, Number(body?.anzahl || 1));
      const code = String(body?.gutscheincode || '').trim();
      if (!Number.isFinite(terminId)) return ctx.badRequest('Ungültiger Termin');

      const termin = await strapi.db.query('api::termin.termin').findOne({ where: { id: terminId }, select: ['preis'] });
      if (!termin || !Number.isFinite(Number(termin.preis))) return ctx.badRequest('Ungültiger Termin');

      const stueck = Number(termin.preis);
      const origTotal = round2(stueck * anzahl);

      let rabatt = 0;
      let typ: 'betrag' | 'prozent' | null = null;
      let wert: number | null = null;
      let valid = false;
      let reason: string | undefined = undefined;

      if (!code) {
        // Kein Code: einfach Originalwerte zurück
        return (ctx.body = {
          valid: false,
          reason: 'Kein Code',
          original: {
            preisProPlatzBrutto: stueck,
            gesamtpreisBrutto: origTotal,
          },
          rabatt: { betragBrutto: 0 },
          total: { gesamtpreisBrutto: origTotal },
        });
      }

      const v = await strapi.db.query('api::gutschein.gutschein').findOne({ where: { code }, select: ['typ', 'wert', 'aktiv', 'gueltigAb', 'gueltigBis'] });
      const today = new Date().toISOString().slice(0, 10);
      const isActive = !!v?.aktiv && (!v.gueltigAb || v.gueltigAb <= today) && (!v.gueltigBis || v.gueltigBis >= today);
      if (!v || !isActive) {
        valid = false;
        reason = 'Ungültig oder nicht aktiv';
      } else {
        typ = v.typ as any;
        wert = Number(v.wert) || 0;
        if (typ === 'betrag') rabatt = Math.min(wert, origTotal);
        else rabatt = round2(origTotal * (wert / 100));
        valid = rabatt > 0;
      }

      const totalBrutto = round2(Math.max(0, origTotal - rabatt));
      const preisProPlatzNeu = round2(totalBrutto / anzahl);

      ctx.body = {
        valid,
        reason,
        original: { preisProPlatzBrutto: stueck, gesamtpreisBrutto: origTotal },
        rabatt: { typ, wert, betragBrutto: rabatt },
        total: {
          gesamtpreisBrutto: totalBrutto,
          preisProPlatzBrutto: preisProPlatzNeu,
        },
      };
    } catch (err) {
      strapi.log.error('[gutschein.validate] Fehler', err);
      ctx.status = 200;
      ctx.body = { valid: false, reason: 'Fehler' };
    }
  },
}));

