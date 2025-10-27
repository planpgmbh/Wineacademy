import { factories } from '@strapi/strapi';
import { slugify } from '../../../utils/slugify';

const FALLBACK_IMAGE = { url: '/favicon.png', alternativeText: 'Kategorie – Platzhalterbild' } as const;

export default factories.createCoreController('api::kategorie.kategorie', ({ strapi }) => ({
  async publicList(ctx) {
    const kategorien = await strapi.db.query('api::kategorie.kategorie').findMany({
      where: { publishedAt: { $not: null } },
      select: ['id', 'name', 'slug', 'kurzbeschreibung', 'heroDarkMode'],
      populate: {
        hintergrundbild: { select: ['url', 'alternativeText'] },
        seo: true,
      },
      orderBy: { name: 'asc' },
    });

    ctx.body = kategorien.map((kategorie: any) => {
      const name = typeof kategorie.name === 'string' ? kategorie.name : '';
      const resolvedSlug = typeof kategorie.slug === 'string' && kategorie.slug.trim().length > 0 ? kategorie.slug : slugify(name);
      const seo = (kategorie as any).seo ?? {};
      return {
        id: kategorie.id,
        name,
        slug: resolvedSlug,
        kurzbeschreibung: typeof kategorie.kurzbeschreibung === 'string' ? kategorie.kurzbeschreibung : null,
        heroDarkMode: Boolean(kategorie.heroDarkMode),
        seoTitle: typeof seo === 'object' ? seo.title ?? null : null,
        seoDescription: typeof seo === 'object' ? seo.description ?? null : null,
        seo,
        hintergrundbild: kategorie.hintergrundbild ?? null,
      };
    });
  },

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
      select: ['id', 'name', 'slug', 'kurzbeschreibung', 'beschreibung', 'heroDarkMode'],
      populate: {
        hintergrundbild: { select: ['url', 'alternativeText'] },
        seo: true,
        seminare: {
          select: ['id', 'name', 'slug', 'kurzbeschreibung', 'preis', 'mwst'],
          populate: {
            bild: { select: ['url', 'alternativeText'] },
            hintergrundbild: { select: ['url', 'alternativeText'] },
          },
          orderBy: { name: 'asc' },
        },
      },
    });

    if (!category) {
      return ctx.notFound('Kategorie nicht gefunden');
    }

    const hintergrundbild = (category as any).hintergrundbild ?? FALLBACK_IMAGE;
    const beschreibung = typeof category.beschreibung === 'string' ? category.beschreibung : '';
    const kurzbeschreibung = typeof category.kurzbeschreibung === 'string' ? category.kurzbeschreibung : null;
    const seo = (category as any).seo ?? {};

    const seminare = Array.isArray((category as any).seminare)
      ? ((category as any).seminare as any[]).map((seminar) => ({
          id: seminar.id,
          name: seminar.name,
          slug: seminar.slug,
          kurzbeschreibung: seminar.kurzbeschreibung ?? null,
          preis: seminar.preis ?? null,
          mwst: typeof seminar.mwst === 'boolean' ? seminar.mwst : null,
          bild: seminar.bild ?? FALLBACK_IMAGE,
          hintergrundbild: seminar.hintergrundbild ?? FALLBACK_IMAGE,
        }))
      : [];

    ctx.body = {
      id: category.id,
      name: category.name,
      slug: category.slug ?? requestedSlug,
      kurzbeschreibung,
      beschreibung,
      heroDarkMode: Boolean((category as any).heroDarkMode),
      seoTitle: typeof seo === 'object' ? seo.title ?? null : null,
      seoDescription: typeof seo === 'object' ? seo.description ?? null : null,
      seo,
      hintergrundbild,
      seminare,
    };
  },
}));
