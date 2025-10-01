import { factories } from '@strapi/strapi';

export default factories.createCoreController('api::produkt.produkt', ({ strapi }) => ({
  async publicList(ctx) {
    const products = await strapi.db.query('api::produkt.produkt').findMany({
      where: { aktiv: true, publishedAt: { $not: null } },
      select: ['id', 'titel', 'slug', 'kurzbeschreibung', 'preisBrutto', 'preisNetto', 'steuerSatz', 'mwst', 'gutschein'],
      populate: { bild: { select: ['url', 'alternativeText'] } },
      orderBy: { titel: 'asc' },
    });
    ctx.body = products;
  },
}));
