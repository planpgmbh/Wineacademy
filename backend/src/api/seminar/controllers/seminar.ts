import { factories } from '@strapi/strapi';
import { slugify } from '../../../utils/slugify';

export default factories.createCoreController('api::seminar.seminar', ({ strapi }) => ({
  async publicList(ctx) {
    const { category, limit, offset } = ctx.query ?? {};
    const categorySlug =
      typeof category === 'string' && category.trim().length > 0 ? category.trim() : null;

    const parseInteger = (value: unknown): number | null => {
      if (typeof value === 'number' && Number.isFinite(value)) {
        return Math.trunc(value);
      }
      if (typeof value === 'string' && value.trim().length > 0) {
        const parsed = Number.parseInt(value.trim(), 10);
        return Number.isFinite(parsed) ? parsed : null;
      }
      return null;
    };

    const parsedLimit = parseInteger(limit);
    const parsedOffsetRaw = parseInteger(offset);
    const parsedOffset = parsedOffsetRaw != null && parsedOffsetRaw > 0 ? parsedOffsetRaw : 0;

    const where: any = { aktiv: true, publishedAt: { $not: null } };
    if (categorySlug) {
      where.kategorien = { slug: categorySlug };
    }

    const seminars = await strapi.db.query('api::seminar.seminar').findMany({
      where,
      select: ['id', 'name', 'slug', 'kurzbeschreibung', 'preis', 'mwst'],
      populate: {
        bild: { select: ['url', 'alternativeText'] },
        kategorien: { select: ['id', 'name', 'slug', 'kurzbeschreibung'] },
      },
    });

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayTime = today.getTime();

    const result = [] as any[];

    const toDate = (value: unknown): Date | null => {
      if (typeof value !== 'string' || value.trim().length === 0) {
        return null;
      }
      const parsed = new Date(value);
      if (Number.isNaN(parsed.getTime())) {
        return null;
      }
      parsed.setHours(0, 0, 0, 0);
      return parsed;
    };

    for (const s of seminars) {
      const termineRaw = await strapi.db.query('api::termin.termin').findMany({
        where: { planungsstatus: 'geplant', publishedAt: { $not: null }, seminar: s.id },
        select: ['kapazitaet', 'planungsstatus', 'id', 'starttag'],
        populate: {
          tageMitUhrzeit: { select: ['datum', 'startzeit', 'endzeit'] },
          standort: { select: ['id', 'name', 'typ', 'veranstaltungsort', 'stadt'] },
        },
        orderBy: { starttag: 'asc' },
      });

      const termine = termineRaw.map((termin) => {
        const standortRaw = (termin as any).standort ?? null;
        const standort = standortRaw
          ? {
              id: standortRaw.id ?? null,
              name: typeof standortRaw.name === 'string' ? standortRaw.name : null,
              typ: typeof standortRaw.typ === 'string' ? standortRaw.typ : null,
              veranstaltungsort:
                typeof standortRaw.veranstaltungsort === 'string' ? standortRaw.veranstaltungsort : null,
              stadt: typeof standortRaw.stadt === 'string' ? standortRaw.stadt : null,
            }
          : null;

        return {
          id: termin.id,
          starttag: termin.starttag ?? null,
          kapazitaet: termin.kapazitaet ?? null,
          planungsstatus: termin.planungsstatus ?? null,
          preis: (s as any).preis ?? null,
          standort,
          tageMitUhrzeit: Array.isArray((termin as any).tageMitUhrzeit) ? (termin as any).tageMitUhrzeit : [],
        };
      });

      const kategorienRaw = Array.isArray((s as any).kategorien) ? (s as any).kategorien : [];
      const kategorien = kategorienRaw
        .filter((cat) => typeof cat?.name === 'string' && cat.name.trim().length > 0)
        .map((cat) => {
          const name = cat.name.trim();
          const slug =
            typeof cat?.slug === 'string' && cat.slug.trim().length > 0
              ? cat.slug.trim()
              : slugify(name);

          return {
            id: cat.id,
            name,
            slug,
            kurzbeschreibung: typeof cat.kurzbeschreibung === 'string' ? cat.kurzbeschreibung : null,
          };
        });

      const fallbackBild = { url: '/favicon.png', alternativeText: 'Weinseminar – Testbild' } as any;
      const sWithBild = { ...(s as any), bild: (s as any).bild ?? fallbackBild };

      const termineMitDatum = termine.map((termin: any) => {
        const parsedDate = toDate(termin.starttag ?? null);
        return {
          ...termin,
          starttagParsed: parsedDate,
        };
      });

      const kommendeTermine = termineMitDatum
        .filter((termin) => termin.starttagParsed && termin.starttagParsed.getTime() >= todayTime)
        .sort((a, b) => {
          const aTime = a.starttagParsed?.getTime() ?? Number.POSITIVE_INFINITY;
          const bTime = b.starttagParsed?.getTime() ?? Number.POSITIVE_INFINITY;
          return aTime - bTime;
        });

      const alleTermineSortiert = termineMitDatum
        .slice()
        .sort((a, b) => {
          const aTime = a.starttagParsed?.getTime() ?? Number.POSITIVE_INFINITY;
          const bTime = b.starttagParsed?.getTime() ?? Number.POSITIVE_INFINITY;
          return aTime - bTime;
        });

      const naechsterTermin = kommendeTermine[0] ?? alleTermineSortiert[0] ?? null;

      result.push({
        ...sWithBild,
        kategorien,
        termine: termineMitDatum.map((termin) => {
          const { starttagParsed, ...rest } = termin;
          return rest;
        }),
        naechsterTermin: naechsterTermin
          ? {
              id: naechsterTermin.id,
              starttag: naechsterTermin.starttag,
              timestamp: naechsterTermin.starttagParsed?.getTime() ?? null,
              standort: naechsterTermin.standort ?? null,
            }
          : null,
      });
    }

    const ordered = result
      .filter((seminar) => seminar.naechsterTermin?.timestamp != null)
      .sort((a, b) => {
        const aTime = a.naechsterTermin?.timestamp ?? Number.POSITIVE_INFINITY;
        const bTime = b.naechsterTermin?.timestamp ?? Number.POSITIVE_INFINITY;
        return aTime - bTime;
      });

    let paginated = ordered;
    if (parsedLimit && parsedLimit > 0) {
      paginated = ordered.slice(parsedOffset, parsedOffset + parsedLimit);
    }

    ctx.body = paginated;
  },

  async publicDetail(ctx) {
    const { slug } = ctx.params;
    const items = await strapi.db.query('api::seminar.seminar').findMany({
      where: { aktiv: true, publishedAt: { $not: null }, slug },
      select: [
        'id',
        'name',
        'slug',
        'kurzbeschreibung',
        'beschreibung',
        'preis',
        'mwst',
      ],
      populate: {
        bild: { select: ['url', 'alternativeText'] },
        hintergrundbild: { select: ['url', 'alternativeText'] },
        abschnitte: {
          on: {
            'landing.hero': {
              populate: {
                button: true,
                bildergalerie: { populate: { bilder: true } },
                video: { populate: { video: true, hintergrundbild: true } },
              },
            },
            'landing.bildergalerie': { populate: { bilder: true } },
            'landing.card-grid': {
              populate: {
                karten: {
                  populate: {
                    backgroundImage: true,
                    button: true,
                    seminarfinderKategorie: { fields: ['id', 'name', 'slug'] },
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
        kategorien: {
          select: ['id', 'name', 'slug'],
        },
        seo: true,
        bookingbox: { select: ['topline', 'überschrift', 'beschreibung'] },
      },
      limit: 1,
    });

    const seminar = Array.isArray(items) ? items[0] : items;
    if (!seminar) return ctx.notFound('Seminar nicht gefunden');
    const termineRaw = await strapi.db.query('api::termin.termin').findMany({
      where: { planungsstatus: 'geplant', publishedAt: { $not: null }, seminar: seminar.id },
      select: ['kapazitaet', 'planungsstatus', 'id', 'starttag'],
      populate: {
        tageMitUhrzeit: { select: ['datum', 'startzeit', 'endzeit'] },
        standort: { select: ['name', 'typ', 'veranstaltungsort', 'stadt'] },
      },
      orderBy: { id: 'asc' },
    });
    const termine = termineRaw.map((t) => ({ ...t, preis: (seminar as any).preis }));
    const fallbackBild = { url: '/favicon.png', alternativeText: 'Weinseminar – Testbild' } as any;
    const fallbackHeroBild = fallbackBild;
    const rawCategories = Array.isArray((seminar as any).kategorien) ? (seminar as any).kategorien : [];
    const kategorien = rawCategories
      .filter((cat) => typeof cat?.name === 'string' && cat.name.trim().length > 0)
      .map((cat) => {
        const name = cat.name.trim();
        const slug =
          typeof cat?.slug === 'string' && cat.slug.trim().length > 0
            ? cat.slug.trim()
            : slugify(name);
        return {
          id: cat.id,
          name,
          slug,
        };
      });

    const bookingboxRaw = ((seminar as any).bookingbox ?? {}) as any;
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

    const withBildern = {
      ...(seminar as any),
      ...bookingboxPayload,
      bild: (seminar as any).bild ?? fallbackBild,
      hintergrundbild: (seminar as any).hintergrundbild ?? fallbackHeroBild,
      abschnitte: (seminar as any).abschnitte ?? [],
      kategorien,
    };
    delete (withBildern as any).bookingbox;
    ctx.body = { ...withBildern, termine };
  },
}));
