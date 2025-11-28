import { nowIso, slugify } from './helpers';

type BookingboxInput = {
  topline?: string;
  überschrift?: string;
  beschreibung?: string;
};

type ProductSeed = {
  name: string;
  slug?: string;
  kurzbeschreibung?: string;
  beschreibung?: string;
  preisNetto?: number;
  preisBrutto?: number;
  steuerSatz?: number;
  mwst?: boolean;
  gutschein?: boolean;
  aktiv?: boolean;
  hintergrundbild?: unknown;
  bookingbox?: BookingboxInput;
  produktinhalte?: Array<Record<string, unknown>>;
};

function buildAbschnitteFromTabs(tabs: Array<Record<string, unknown>> | null | undefined) {
  if (!Array.isArray(tabs) || tabs.length === 0) {
    return undefined;
  }

  return [
    {
      __component: 'landing.tabs',
      überschrift: null,
      überschriftStufe: 'h2',
      hintergrundfarbe: null,
      reiter: tabs.map((tab, index) => ({
        überschrift: typeof tab?.titel === 'string' ? tab.titel : `Abschnitt ${index + 1}`,
        inhalt: typeof tab?.inhalt === 'string' ? tab.inhalt : '',
      })),
    },
  ];
}

async function upsertProduct(strapi: any, values: ProductSeed) {
  const slug = values.slug ? slugify(values.slug) : slugify(values.name);
  const existing = await strapi.db
    .query('api::produkt.produkt')
    .findOne({ where: { slug }, select: ['id'] });

  const { bookingbox, produktinhalte, ...rest } = values;
  const abschnitte = buildAbschnitteFromTabs(produktinhalte ?? null);
  const data: Record<string, unknown> = {
    ...rest,
    slug,
    mwst: rest.mwst ?? true,
    aktiv: rest.aktiv ?? true,
    publishedAt: nowIso(),
    bookingbox: bookingbox ? { ...bookingbox } : undefined,
    abschnitte: abschnitte ?? undefined,
  };

  if (typeof rest.preisNetto !== 'undefined' && rest.preisNetto !== null) {
    data.preisNetto = String(rest.preisNetto);
  }
  if (typeof rest.preisBrutto !== 'undefined' && rest.preisBrutto !== null) {
    data.preisBrutto = String(rest.preisBrutto);
  }
  if (typeof rest.steuerSatz !== 'undefined' && rest.steuerSatz !== null) {
    data.steuerSatz = String(rest.steuerSatz);
  }

  if (!bookingbox) {
    delete data.bookingbox;
  }
  if (!abschnitte) {
    delete data.abschnitte;
  }

  if (existing) {
    await strapi.entityService.update('api::produkt.produkt', existing.id, { data });
    return existing.id as number;
  }
  const created = await strapi.entityService.create('api::produkt.produkt', { data });
  return created.id as number;
}

export async function seedProducts(strapi: any, log: (msg: string) => void) {
  const products: ProductSeed[] = [
    {
      name: 'Weinbuch Klassiker',
      slug: 'weinbuch-klassiker',
      kurzbeschreibung: 'Fundiertes Wissen in Buchform.',
      beschreibung: '<p>Ein Standardwerk für alle Weinfreunde.</p>',
      preisNetto: 50,
      preisBrutto: 59.5,
      steuerSatz: 19,
      mwst: true,
      gutschein: false,
      aktiv: true,
    },
    {
      name: 'Verkostungsset Sensorik',
      slug: 'verkostungsset-sensorik',
      kurzbeschreibung: '6er-Set Musterproben für Sensorik-Trainings.',
      beschreibung: '<p>Ideal als Ergänzung zu unseren Online-Kursen.</p>',
      preisNetto: 79,
      preisBrutto: 94.01,
      steuerSatz: 19,
      mwst: true,
      gutschein: false,
      aktiv: true,
    },
    {
      name: 'WSET® Level 1 Weine Tasting Set (klein, 2cl)',
      slug: 'wset-level-1-tasting-set',
      kurzbeschreibung:
        'Ergänzendes Tasting-Set zum WSET Level 1 mit ausgewählten Weinen in Vinottes.',
      beschreibung:
        '<p>Vermittelt Grundlagen zu Aromen, Rebsorten und Stilrichtungen; ideal als Begleitung zum Kurs oder zum Eigenstudium.</p>',
      preisNetto: 60,
      preisBrutto: 71.4,
      steuerSatz: 19,
      mwst: true,
      gutschein: false,
      aktiv: true,
    },
    {
      name: 'WSET® Level 3 Weine Tasting Set (groß, 5cl)',
      slug: 'wset-level-3-weine-tasting-set-gross-5cl',
      kurzbeschreibung: 'Umfangreiches Tasting-Set mit hochwertigen Weinen verschiedener Stile und Regionen.',
      beschreibung:
        '<p>Enthält detaillierte WSET SAT Verkostungsnotizen; ideal zur Vorbereitung oder Vertiefung für Level 3.</p>',
      preisNetto: 150,
      preisBrutto: 178.5,
      steuerSatz: 19,
      mwst: true,
      gutschein: false,
      aktiv: true,
    },
  ];

  for (const product of products) {
    const id = await upsertProduct(strapi, product);
    log(`Produkt angelegt/aktualisiert: ${product.name} (ID ${id})`);
  }
}
