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
        abschnitte: {
          on: {
            'landing.bildergalerie': { populate: { bilder: true } },
            'landing.card-grid': {
              populate: {
                karten: {
                  populate: {
                    backgroundImage: true,
                  },
                },
              },
            },
            'landing.columns': {
              populate: {
                spalten: true,
              },
            },
            'landing.trennlinie': true,
            'landing.text-block': true,
            'landing.seminar-liste': {
              populate: {
                seminarkategorie: {
                  fields: ['id', 'name', 'slug', 'kurzbeschreibung'],
                },
              },
            },
            'landing.tabs': {
              populate: {
                reiter: true,
              },
            },
            'landing.seminar-finder': {
              populate: {
                standardKategorie: {
                  fields: ['id', 'name', 'slug'],
                },
                sichtbareFilter: {
                  fields: ['id', 'name', 'slug'],
                },
              },
            },
            'landing.seminar-produkt-karten': {
              populate: {
                seminarkategorie: {
                  fields: ['id', 'name', 'slug', 'kurzbeschreibung'],
                },
                produkte: {
                  fields: ['id', 'name', 'slug', 'kurzbeschreibung'],
                  populate: {
                    bild: true,
                  },
                },
              },
            },
          },
        },
        seo: true,
        bookingbox: { select: ['topline', 'überschrift', 'beschreibung'] },
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
      bookingbox_überschrift:
        typeof bookingboxRaw?.überschrift === 'string' && bookingboxRaw.überschrift.trim().length > 0
          ? bookingboxRaw.überschrift.trim()
          : null,
      bookingbox_beschreibung:
        typeof bookingboxRaw?.beschreibung === 'string' && bookingboxRaw.beschreibung.trim().length > 0
          ? bookingboxRaw.beschreibung.trim()
          : null,
    };

    const payload = {
      ...(product as any),
      ...bookingboxPayload,
      versandkosten: normaliseShippingValue((product as any).versandkosten),
      bild: product.bild ?? fallbackBild,
      hintergrundbild: product.hintergrundbild ?? fallbackBild,
      abschnitte: Array.isArray((product as any).abschnitte) ? (product as any).abschnitte : [],
    };
    delete (payload as any).bookingbox;

    ctx.body = payload;
  },
}));
