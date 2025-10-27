import { factories } from '@strapi/strapi';
import { GutscheinHelper } from '../../bestellung/utils/gutschein';
import { normaliseShippingValue, roundCurrency } from '../../../utils/shipping';

const round2 = roundCurrency;

export default factories.createCoreController('api::gutschein.gutschein', ({ strapi }) => ({
  async template(ctx) {
    const entityService: any = strapi.entityService;
    const response = await entityService.findMany('api::gutscheineinstellung.gutscheineinstellung', {
      fields: [
        'id',
        'name',
        'minBetrag',
        'maxBetrag',
        'versandkosten',
        'aktiv',
        'heroDarkMode',
      ],
      populate: {
        bild: { fields: ['url', 'alternativeText'] },
        hintergrundbild: { fields: ['url', 'alternativeText'] },
        gutscheininhalte: true,
        bookingbox: { fields: ['topline', 'headline', 'body'] },
      },
      pagination: { limit: 1 },
    });
    const template = (Array.isArray(response) ? response[0] : response) as any;
    if (!template || template.aktiv === false) return ctx.notFound('Kein Gutschein-Template konfiguriert');
    const fallbackBild = { url: '/favicon.png', alternativeText: 'Gutscheinbild Platzhalter' } as any;
    const gutscheininhalte = Array.isArray((template as any).gutscheininhalte) ? (template as any).gutscheininhalte : [];
    const shippingCost = normaliseShippingValue(template.versandkosten);
    const bookingbox = ((template as any).bookingbox ?? {}) as any;
    ctx.body = {
      name: template.name,
      minBetrag: template.minBetrag != null ? Number(template.minBetrag) : null,
      maxBetrag: template.maxBetrag != null ? Number(template.maxBetrag) : null,
      versandkosten: shippingCost,
      bild: template.bild ?? fallbackBild,
      hintergrundbild: template.hintergrundbild ?? fallbackBild,
      bookingbox_topline:
        typeof bookingbox?.topline === 'string' && bookingbox.topline.trim().length > 0
          ? bookingbox.topline.trim()
          : null,
      bookingbox_headline:
        typeof bookingbox?.headline === 'string' && bookingbox.headline.trim().length > 0
          ? bookingbox.headline.trim()
          : null,
      bookingbox_body:
        typeof bookingbox?.body === 'string' && bookingbox.body.trim().length > 0 ? bookingbox.body.trim() : null,
      gutscheininhalte,
      heroDarkMode: Boolean(template.heroDarkMode),
    };
  },

  async pricing(ctx) {
    const body = ctx.request.body as any;
    const betragRaw = body?.betrag;
    const betragNum = Number(betragRaw);
    if (!Number.isFinite(betragNum) || betragNum <= 0) return ctx.badRequest('Betrag ungültig');
    const entityService: any = strapi.entityService;
    const response = await entityService.findMany('api::gutscheineinstellung.gutscheineinstellung', {
      fields: ['minBetrag', 'maxBetrag', 'aktiv', 'heroDarkMode', 'versandkosten'],
      pagination: { limit: 1 },
    });
    const template = (Array.isArray(response) ? response[0] : response) as any;
    if (!template || template.aktiv === false) return ctx.badRequest('Kein Gutschein-Template konfiguriert');
    const min = template.minBetrag != null ? Number(template.minBetrag) : null;
    const max = template.maxBetrag != null ? Number(template.maxBetrag) : null;
    if (min != null && betragNum < min) return ctx.badRequest(`Betrag muss mindestens ${min} sein`);
    if (max != null && betragNum > max) return ctx.badRequest(`Betrag darf höchstens ${max} sein`);
    const betrag = round2(betragNum);
    const shippingCost = normaliseShippingValue(template.versandkosten);
    ctx.body = {
      betrag,
      minBetrag: min,
      maxBetrag: max,
      versandkosten: shippingCost,
    };
  },

  async validate(ctx) {
    const body = ctx.request.body as any;
    const codeInput = typeof body?.code === 'string' ? body.code : typeof body?.gutscheinCode === 'string' ? body.gutscheinCode : null;
    if (!codeInput) {
      return ctx.badRequest('Gutscheincode erforderlich');
    }

    const extractNumber = (...values: unknown[]): number | null => {
      for (const value of values) {
        if (value == null) continue;
        const num = Number(value);
        if (Number.isFinite(num)) {
          return num;
        }
      }
      return null;
    };

    const totalsSource = body?.totals ?? body?.warenkorb ?? body?.cart ?? {};
    const bruttoCandidate = extractNumber(
      body?.brutto,
      body?.total,
      body?.subtotal,
      body?.cartTotal,
      totalsSource?.brutto,
      totalsSource?.total,
      totalsSource?.subtotal
    );
    const brutto = bruttoCandidate != null ? Number(bruttoCandidate) : 0;
    if (!Number.isFinite(brutto) || brutto <= 0) {
      return ctx.badRequest('Warenkorb-Betrag erforderlich.');
    }

    const nettoCandidate = extractNumber(body?.netto, totalsSource?.netto);
    const steuerCandidate = extractNumber(body?.steuer, totalsSource?.steuer);

    const helper = new GutscheinHelper(strapi);
    try {
      const result = await helper.validateVoucher(codeInput, {
        brutto,
        netto: nettoCandidate != null ? Number(nettoCandidate) : undefined,
        steuer: steuerCandidate != null ? Number(steuerCandidate) : undefined,
      });
      ctx.body = {
        code: result.code,
        typ: result.typ,
        amount: result.betrag,
        remaining: result.restbetrag,
        name: result.name ?? null,
        description: null,
      };
    } catch (error: any) {
      ctx.badRequest(error?.message ?? 'Gutscheincode ungültig.');
    }
  },
}));
