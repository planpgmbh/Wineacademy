import { factories } from '@strapi/strapi';
import { slugify } from '../../../utils/slugify';

export default factories.createCoreController('api::kategorie.kategorie', ({ strapi }) => ({
  async publicDetail(ctx) {
    const { slug } = ctx.params;

    if (typeof slug !== 'string' || slug.trim().length === 0) {
      return ctx.badRequest('Slug erforderlich');
    }

    const requestedSlug = slugify(slug.trim());

    const category = await strapi.db.query('api::kategorie.kategorie').findOne({
      where: {
        publishedAt: { $not: null },
        slug: requestedSlug,
      },
      select: ['id', 'name', 'slug', 'beschreibung', 'seoTitle', 'seoDescription', 'heroDarkMode'],
      populate: {
        hintergrundbild: { select: ['url', 'alternativeText'] },
      },
    });

    if (!category) {
      return ctx.notFound('Kategorie nicht gefunden');
    }

    const fallbackBild = { url: '/favicon.png', alternativeText: 'Kategorie – Platzhalterbild' } as const;
    const hintergrundbild = (category as any).hintergrundbild ?? fallbackBild;
    const beschreibung = typeof category.beschreibung === 'string' ? category.beschreibung : '';

    ctx.body = {
      id: category.id,
      name: category.name,
      slug: category.slug ?? requestedSlug,
      beschreibung,
      heroDarkMode: Boolean((category as any).heroDarkMode),
      seoTitle: category.seoTitle ?? null,
      seoDescription: category.seoDescription ?? null,
      hintergrundbild,
    };
  },
}));

