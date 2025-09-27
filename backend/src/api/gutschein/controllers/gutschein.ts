import { factories } from '@strapi/strapi';

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export default factories.createCoreController('api::gutschein.gutschein', ({ strapi }) => ({
  async template(ctx) {
    const template = await strapi.db.query('api::gutschein.gutschein').findOne({
      where: { istTemplate: true },
      select: ['id', 'titel', 'beschreibung', 'minBetrag', 'maxBetrag'],
      populate: { bild: { select: ['url', 'alternativeText'] } },
    });
    if (!template) return ctx.notFound('Kein Gutschein-Template konfiguriert');
    ctx.body = {
      titel: template.titel,
      beschreibung: template.beschreibung,
      minBetrag: template.minBetrag != null ? Number(template.minBetrag) : null,
      maxBetrag: template.maxBetrag != null ? Number(template.maxBetrag) : null,
      bild: template.bild,
    };
  },

  async pricing(ctx) {
    const body = ctx.request.body as any;
    const betragRaw = body?.betrag;
    const betragNum = Number(betragRaw);
    if (!Number.isFinite(betragNum) || betragNum <= 0) return ctx.badRequest('Betrag ungültig');
    const template = await strapi.db.query('api::gutschein.gutschein').findOne({
      where: { istTemplate: true },
      select: ['minBetrag', 'maxBetrag'],
    });
    if (!template) return ctx.badRequest('Kein Gutschein-Template konfiguriert');
    const min = template.minBetrag != null ? Number(template.minBetrag) : null;
    const max = template.maxBetrag != null ? Number(template.maxBetrag) : null;
    if (min != null && betragNum < min) return ctx.badRequest(`Betrag muss mindestens ${min} sein`);
    if (max != null && betragNum > max) return ctx.badRequest(`Betrag darf höchstens ${max} sein`);
    const betrag = round2(betragNum);
    ctx.body = {
      betrag,
      minBetrag: min,
      maxBetrag: max,
    };
  },
}));
