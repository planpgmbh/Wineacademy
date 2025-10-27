import { factories } from '@strapi/strapi';
import { normaliseShippingValue } from '../../../utils/shipping';

export default factories.createCoreController('api::produkt.produkt', ({ strapi }) => ({
  async publicList(ctx) {
    const products = await strapi.db.query('api::produkt.produkt').findMany({
      where: { aktiv: true, publishedAt: { $not: null } },
      select: [
        'id',
        'name',
        'slug',
        'kurzbeschreibung',
        'preisBrutto',
        'preisNetto',
        'steuerSatz',
        'mwst',
        'gutschein',
        'versandkosten',
      ],
      populate: {
        bild: { select: ['url', 'alternativeText'] },
        hintergrundbild: { select: ['url', 'alternativeText'] },
      },
      orderBy: { name: 'asc' },
    });

    const fallbackBild = { url: '/favicon.png', alternativeText: 'Produktbild Platzhalter' } as any;

    ctx.body = products.map((product) => {
      const shippingCost = normaliseShippingValue((product as any).versandkosten);
      return {
        ...(product as any),
        versandkosten: shippingCost,
        bild: product.bild ?? fallbackBild,
        hintergrundbild: product.hintergrundbild ?? fallbackBild,
      };
    });
  },

  async publicDetail(ctx) {
    const { slug } = ctx.params;
    if (!slug || typeof slug !== 'string') return ctx.badRequest('Slug erforderlich');

    const product = await strapi.db.query('api::produkt.produkt').findOne({
      where: { aktiv: true, publishedAt: { $not: null }, slug },
      select: [
        'id',
        'name',
        'slug',
        'kurzbeschreibung',
        'beschreibung',
        'preisNetto',
        'preisBrutto',
        'steuerSatz',
        'mwst',
        'gutschein',
        'versandkosten',
      ],
      populate: {
        bild: { select: ['url', 'alternativeText'] },
        hintergrundbild: { select: ['url', 'alternativeText'] },
        produktinhalte: true,
        seo: true,
        bookingbox: { select: ['topline', 'headline', 'body'] },
      },
    });

    if (!product) return ctx.notFound('Produkt nicht gefunden');

    const fallbackBild = { url: '/favicon.png', alternativeText: 'Produktbild Platzhalter' } as any;

    const bookingboxRaw = ((product as any).bookingbox ?? {}) as any;
    const bookingboxPayload = {
      bookingbox_topline:
        typeof bookingboxRaw?.topline === 'string' && bookingboxRaw.topline.trim().length > 0
          ? bookingboxRaw.topline.trim()
          : null,
      bookingbox_headline:
        typeof bookingboxRaw?.headline === 'string' && bookingboxRaw.headline.trim().length > 0
          ? bookingboxRaw.headline.trim()
          : null,
      bookingbox_body:
        typeof bookingboxRaw?.body === 'string' && bookingboxRaw.body.trim().length > 0
          ? bookingboxRaw.body.trim()
          : null,
    };

    const payload = {
      ...(product as any),
      ...bookingboxPayload,
      versandkosten: normaliseShippingValue((product as any).versandkosten),
      bild: product.bild ?? fallbackBild,
      hintergrundbild: product.hintergrundbild ?? fallbackBild,
      produktinhalte: Array.isArray((product as any).produktinhalte) ? (product as any).produktinhalte : [],
    };
    delete (payload as any).bookingbox;

    ctx.body = payload;
  },
}));
