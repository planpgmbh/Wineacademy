// import type { Core } from '@strapi/strapi';

type UID =
  | 'api::kategorie.kategorie'
  | 'api::standort.standort'
  | 'api::seminar.seminar'
  | 'api::gutschein.gutschein'
  | 'api::produkt.produkt'
  | 'api::benachrichtigung.benachrichtigung'
  | 'api::einstellung.einstellung'
  | 'api::navigation.navigation'
  | 'api::footer.footer'
  | 'api::landingpage.landingpage';

function toBool(v: any): boolean {
  if (v == null) return false;
  const s = String(v).trim().toLowerCase();
  return s === '1' || s === 'true' || s === 'yes' || s === 'on';
}

function nowIso() {
  return new Date().toISOString();
}

function slugify(input: string): string {
  return input
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
}

async function upsertCategory(strapi: any, name: string, beschreibung?: string) {
  const existing = await strapi.db
    .query('api::kategorie.kategorie')
    .findOne({ where: { name }, select: ['id', 'slug'] });
  const defaultSlug = slugify(name);
  if (existing) {
    const data: Record<string, unknown> = {
      beschreibung: beschreibung ?? undefined,
      publishedAt: nowIso(),
    };
    if (!existing.slug) {
      data.slug = defaultSlug;
    }
    await strapi.entityService.update('api::kategorie.kategorie', existing.id, {
      data,
    });
    return existing.id as number;
  }
  const created = await strapi.entityService.create('api::kategorie.kategorie', {
    data: {
      name,
      slug: defaultSlug,
      beschreibung: beschreibung ?? undefined,
      publishedAt: nowIso(),
    },
  });
  return created.id as number;
}

async function upsertStandort(
  strapi: any,
  values: { name: string; typ: 'vorort' | 'online'; veranstaltungsort?: string; strasse?: string; plz?: string; stadt?: string; land?: 'Deutschland' }
) {
  const existing = await strapi.db.query('api::standort.standort').findOne({ where: { name: values.name }, select: ['id'] });
  const data = { ...values, publishedAt: nowIso() } as any;
  if (existing) {
    await strapi.entityService.update('api::standort.standort', existing.id, { data });
    return existing.id as number;
  }
  const created = await strapi.entityService.create('api::standort.standort', { data });
  return created.id as number;
}

async function upsertSeminar(
  strapi: any,
  values: {
    name: string;
    slug?: string;
    kurzbeschreibung?: string;
    beschreibung?: string;
    infos?: string;
    preis?: number;
    mwst?: boolean;
    kapazitaet?: number;
    aktiv?: boolean;
    kategorien?: number[];
  }
) {
  const existing = await strapi.db.query('api::seminar.seminar').findOne({ where: { name: values.name }, select: ['id', 'slug'] });
  const data: any = {
    ...values,
    slug: values.slug ? slugify(values.slug) : slugify(values.name),
    publishedAt: nowIso(),
  };
  if (values.kategorien && values.kategorien.length > 0) {
    data.kategorien = { set: values.kategorien.map((id) => id) };
  }
  if (existing) {
    await strapi.entityService.update('api::seminar.seminar', existing.id, { data });
    return existing.id as number;
  }
  const created = await strapi.entityService.create('api::seminar.seminar', { data });
  return created.id as number;
}

async function upsertBenachrichtigung(
  strapi: any,
  values: {
    name: string;
    anwendungsfall:
      | 'bestellbestaetigung'
      | 'zahlungsbestaetigung'
      | 'rechnung_gutschein'
      | 'backoffice_benachrichtigung'
      | 'storno_bestaetigung'
      | 'storno_backoffice';
    layout?: 'default' | 'rechnung' | 'backoffice';
    beschreibung?: string;
    betreff: string;
    vorschauzeile?: string;
    bodyHtml?: string;
    bodyText?: string;
    platzhalter?: Array<{ schluessel: string; beschreibung?: string; beispiel?: string }>;
    testPayload?: Record<string, unknown>;
  }
) {
  const existing = await strapi.db
    .query('api::benachrichtigung.benachrichtigung')
    .findOne({ where: { anwendungsfall: values.anwendungsfall }, select: ['id'] });

  const data: any = {
    name: values.name,
    anwendungsfall: values.anwendungsfall,
    layout: values.layout ?? 'default',
    beschreibung: values.beschreibung ?? undefined,
    betreff: values.betreff,
    vorschauzeile: values.vorschauzeile ?? undefined,
    bodyHtml: values.bodyHtml ?? undefined,
    bodyText: values.bodyText ?? undefined,
    aktiv: true,
    publishedAt: nowIso(),
  };

  if (Array.isArray(values.platzhalter) && values.platzhalter.length > 0) {
    data.platzhalter = values.platzhalter.map((entry) => ({
      schluessel: entry.schluessel,
      beschreibung: entry.beschreibung ?? undefined,
      beispiel: entry.beispiel ?? undefined,
    }));
  } else {
    data.platzhalter = [];
  }

  if (values.testPayload) {
    data.testPayload = values.testPayload;
  }

  if (existing) {
    await strapi.entityService.update('api::benachrichtigung.benachrichtigung', existing.id, { data });
    return existing.id as number;
  }

  const created = await strapi.entityService.create('api::benachrichtigung.benachrichtigung', { data });
  return created.id as number;
}

type BenachrichtigungSeedInput = Parameters<typeof upsertBenachrichtigung>[1];

async function upsertEinstellungen(
  strapi: any,
  values: {
    absenderName?: string;
    absenderEmail: string;
    antwortEmail?: string;
    benachrichtigungen?: Array<{
      bezeichnung: string;
      email: string;
      typ: 'bestellung' | 'storno' | 'sonstiges';
    }>;
  }
) {
  const existing = await strapi.db
    .query('api::einstellung.einstellung')
    .findOne({ select: ['id'] });

  const data: any = {
    absenderName: values.absenderName ?? undefined,
    absenderEmail: values.absenderEmail,
    antwortEmail: values.antwortEmail ?? undefined,
    benachrichtigungen: Array.isArray(values.benachrichtigungen)
      ? values.benachrichtigungen.map((eintrag) => ({
          bezeichnung: eintrag.bezeichnung,
          email: eintrag.email,
          typ: eintrag.typ,
          aktiv: true,
        }))
      : [],
  };

  if (existing) {
    await strapi.entityService.update('api::einstellung.einstellung', existing.id, { data });
    return existing.id as number;
  }

  const created = await strapi.entityService.create('api::einstellung.einstellung', { data });
  return created.id as number;
}

async function upsertSingleType(strapi: any, uid: UID, data: Record<string, unknown>) {
  const existing = await strapi.db.query(uid).findOne({ select: ['id'] });
  if (existing?.id) {
    const updated = await strapi.entityService.update(uid, existing.id, { data });
    return updated.id as number;
  }
  const created = await strapi.entityService.create(uid, { data });
  return created.id as number;
}

async function upsertLandingPage(
  strapi: any,
  values: {
    titel: string;
    slug: string;
    abschnitte: Array<Record<string, unknown>>;
  }
) {
  const slug = slugify(values.slug);
  const existing = await strapi.db
    .query('api::landingpage.landingpage')
    .findOne({ where: { slug }, select: ['id'] });

  const data = {
    titel: values.titel,
    slug,
    abschnitte: values.abschnitte,
    publishedAt: nowIso(),
  };

  if (existing) {
    await strapi.entityService.update('api::landingpage.landingpage', existing.id, { data });
    return existing.id as number;
  }

  const created = await strapi.entityService.create('api::landingpage.landingpage', { data });
  return created.id as number;
}

async function upsertProduct(strapi: any, values: {
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
  bookingbox_topline?: string;
  bookingbox_headline?: string;
  bookingbox_body?: string;
  produktinhalte?: Array<Record<string, unknown>>;
}) {
  const slug = values.slug ? slugify(values.slug) : slugify(values.name);
  const existing = await strapi.db.query('api::produkt.produkt').findOne({ where: { slug }, select: ['id'] });
  const data: any = {
    ...values,
    slug,
    mwst: values.mwst ?? true,
    aktiv: values.aktiv ?? true,
    publishedAt: nowIso(),
  };
  if (existing) {
    await strapi.entityService.update('api::produkt.produkt', existing.id, { data });
    return existing.id as number;
  }
  const created = await strapi.entityService.create('api::produkt.produkt', { data });
  return created.id as number;
}

async function upsertGutschein(
  strapi: any,
  values: {
    name: string;
    code: string;
    beschreibung?: string;
    typ?: 'betrag' | 'prozent';
    wert?: number;
    betrag?: number;
    restwert?: number;
    maxRabatt?: number;
    mindesteinkauf?: number;
    maxEinloesungen?: number;
    gueltigBis?: string | Date;
    aktiv?: boolean;
    hintergrundbild?: unknown;
    bookingbox_topline?: string;
    bookingbox_headline?: string;
    bookingbox_body?: string;
    gutscheininhalte?: Array<Record<string, unknown>>;
  }
) {
  const canonicalCode = values.code.replace(/\s+/g, '').toUpperCase();
  const existing = await strapi.db.query('api::gutschein.gutschein').findOne({ where: { code: canonicalCode }, select: ['id'] });
  const data: any = {
    name: values.name,
    beschreibung: values.beschreibung ?? undefined,
    code: canonicalCode,
    istTemplate: false,
    aktiv: values.aktiv ?? true,
  };
  if (values.typ) {
    data.typ = values.typ;
  }
  if (typeof values.wert === 'number') {
    data.wert = values.wert;
  }
  if (typeof values.betrag === 'number') {
    data.betrag = values.betrag;
  }
  if (typeof values.restwert === 'number') {
    data.restwert = values.restwert;
  } else if (typeof values.betrag === 'number' && values.typ !== 'prozent') {
    data.restwert = values.betrag;
  }
  if (typeof values.maxRabatt === 'number') {
    data.maxRabatt = values.maxRabatt;
  }
  if (typeof values.mindesteinkauf === 'number') {
    data.mindesteinkauf = values.mindesteinkauf;
  }
  if (typeof values.maxEinloesungen === 'number') {
    data.maxEinloesungen = values.maxEinloesungen;
  }
  if (values.gueltigBis) {
    data.gueltigBis = values.gueltigBis instanceof Date ? values.gueltigBis.toISOString().slice(0, 10) : values.gueltigBis;
  }
  if ('hintergrundbild' in values) {
    data.hintergrundbild = values.hintergrundbild ?? undefined;
  }
  if ('bookingbox_topline' in values) {
    data.bookingbox_topline = values.bookingbox_topline ?? undefined;
  }
  if ('bookingbox_headline' in values) {
    data.bookingbox_headline = values.bookingbox_headline ?? undefined;
  }
  if ('bookingbox_body' in values) {
    data.bookingbox_body = values.bookingbox_body ?? undefined;
  }
  if (Array.isArray(values.gutscheininhalte)) {
    data.gutscheininhalte = values.gutscheininhalte;
  }
  if (existing) {
    await strapi.entityService.update('api::gutschein.gutschein', existing.id, { data });
    return existing.id as number;
  }
  const created = await strapi.entityService.create('api::gutschein.gutschein', { data });
  return created.id as number;
}

async function upsertGutscheinTemplate(
  strapi: any,
  values: {
    name: string;
    beschreibung?: string;
    minBetrag?: number;
    maxBetrag?: number;
    aktiv?: boolean;
    hintergrundbild?: unknown;
    bookingbox_topline?: string;
    bookingbox_headline?: string;
    bookingbox_body?: string;
    gutscheininhalte?: Array<Record<string, unknown>>;
  }
) {
  const existing = await strapi.db.query('api::gutschein.gutschein').findOne({ where: { istTemplate: true }, select: ['id'] });
  const data: any = {
    ...values,
    istTemplate: true,
    aktiv: values.aktiv ?? true,
    publishedAt: nowIso(),
  };
  if ('hintergrundbild' in values) {
    data.hintergrundbild = values.hintergrundbild ?? undefined;
  }
  if ('bookingbox_topline' in values) {
    data.bookingbox_topline = values.bookingbox_topline ?? undefined;
  }
  if ('bookingbox_headline' in values) {
    data.bookingbox_headline = values.bookingbox_headline ?? undefined;
  }
  if ('bookingbox_body' in values) {
    data.bookingbox_body = values.bookingbox_body ?? undefined;
  }
  if (Array.isArray(values.gutscheininhalte)) {
    data.gutscheininhalte = values.gutscheininhalte;
  }
  if (existing) {
    await strapi.entityService.update('api::gutschein.gutschein', existing.id, { data });
    return existing.id as number;
  }
  const created = await strapi.entityService.create('api::gutschein.gutschein', { data });
  return created.id as number;
}

async function runSeed(strapi: any) {
  const log = (msg: string) => strapi.log.info(`[seed] ${msg}`);
  log('Starte Seeding');

  const seedTermineEnabled =
    typeof process.env.SEED_SEMINAR_TERMINE === 'undefined'
      ? true
      : toBool(process.env.SEED_SEMINAR_TERMINE);

  const categorySeeds = [
    {
      name: 'Bourgogne',
      kurzbeschreibung: 'Über 2000 Jahre Weinbaugeschichte, einzigartiges Terroir und Savoir-Faire der Winzer.',
      beschreibung:
        'Mit 84 Appellationen, zahlreichen kleinen Erzeugern, kleinteiligen Parzellen und dem Zusammenspiel zwischen Terroir und Rebsorten bietet die Bourgogne ein unvergleichliches Entdeckungspotential. Exklusive Kursreihe bei der Wine Academy Hamburg mit Fokus auf Chardonnay, Pinot Noir und Crus.',
    },
    {
      name: 'Masterclass',
      kurzbeschreibung: 'Vertiefende Einblicke in Regionen, Weine und Sake für Sommeliers, WSET-Studierende und Weinliebhaber.',
      beschreibung:
        'Masterclasses und Tageskurse am Vormittag oder Abend, unter der Woche und am Wochenende. Dauer von einigen Stunden bis zu einem Tag. Zusätzlich Prüfungsvorbereitungskurse für WSET und IHK Sommelier.',
    },
    {
      name: 'Sensorik',
      kurzbeschreibung: 'Entdecke die verborgenen Nuancen des Weins und werde zum Sensorik-Profi.',
      beschreibung:
        'Kurse von Einsteiger bis Profi: Sensorik Essentials, Fortgeschrittene, Weinfehler und Blindverkostungen. Ziel ist es, Sinneswahrnehmung zu schärfen, Aromen zu erkennen und strukturierte Verkostungen durchzuführen.',
    },
    {
      name: 'Sommelier Ausbildung',
      kurzbeschreibung: 'IHK-geprüfte Sommelier-Ausbildung mit Theorie, Praxis und Exkursionen.',
      beschreibung:
        'Fundiertes Wissen zu Weinbau, Herstellung, Geschichte und Food-Pairing sowie professionelle Verkostungs- und Servicekompetenz. Vorbereitung auf Spitzenleistungen in Gastronomie, Handel und Weingütern.',
    },
    {
      name: 'WSET',
      kurzbeschreibung: 'International anerkannte Wein-Qualifikationen des Wine & Spirit Education Trust.',
      beschreibung:
        'Seit 1969 weltweit führender Anbieter von Abschlüssen in Wein, Spirituosen und Sake. Bei der Wine Academy Hamburg können WSET Level 1–3 in Weinen absolviert werden.',
    },
    {
      name: 'Tastings',
      kurzbeschreibung: 'Theorie & Praxis kombiniert mit sorgfältig ausgewählten Weinen.',
      beschreibung:
        'Weintastings & Seminare in Hamburg mit Fokus auf sensorische Fähigkeiten, Wissensvertiefung und aktuelle Themen wie Blindverkostungen oder Prüfungsvorbereitung.',
    },
  ];

  const catIds: Record<string, number> = {};
  for (const category of categorySeeds) {
    const combinedBeschreibung = [category.kurzbeschreibung, category.beschreibung].filter(Boolean).join('\n\n');
    catIds[category.name] = await upsertCategory(strapi, category.name, combinedBeschreibung);
  }
  log(`Kategorien: ${Object.keys(catIds).join(', ')}`);

  const standortSeeds = [
    {
      name: 'Hamburg',
      typ: 'vorort' as const,
      veranstaltungsort: 'Wine Academy Hamburg',
      strasse: 'Testweg 1',
      plz: '20000',
      stadt: 'Hamburg',
      land: 'Deutschland' as const,
    },
    {
      name: 'Mannheim',
      typ: 'vorort' as const,
      veranstaltungsort: 'Wine Academy Mannheim',
      strasse: 'Testweg 1',
      plz: '60000',
      stadt: 'Mannheim',
      land: 'Deutschland' as const,
    },
    {
      name: 'Online',
      typ: 'online' as const,
      veranstaltungsort: 'Online via Zoom',
      strasse: 'Testweg 1',
      plz: '99999',
      stadt: 'Remote',
      land: 'Deutschland' as const,
    },
  ];
  const standortIdByName: Record<string, number> = {};
  for (const standort of standortSeeds) {
    const id = await upsertStandort(strapi, standort);
    standortIdByName[standort.name] = id;
  }
  log(`Standorte aktualisiert: ${Object.entries(standortIdByName)
    .map(([name, id]) => `${name}=${id}`)
    .join(', ')}`);

  type TerminTagSeed = {
    offset?: number;
    startzeit?: string;
    endzeit?: string;
  };

  type TerminSeed = {
    planungsstatus: 'geplant' | 'ausgebucht' | 'abgesagt';
    kapazitaet: number;
    standort: string;
    tageVersatz: number;
    startzeit?: string;
    endzeit?: string;
    tage?: TerminTagSeed[];
  };

  type SeminarSeed = {
    name: string;
    slug: string;
    kurzbeschreibung: string;
    beschreibung: string;
    infos?: string;
    preis?: number;
    mwst?: boolean;
    aktiv: boolean;
    kategorien: string[];
    termine: TerminSeed[];
  };


const seminarSeeds: SeminarSeed[] = [
  {
    name: 'Sensorik: Essentials',
    slug: 'sensorik-essentials',
    kurzbeschreibung:
      'Einstieg in die Weinsensorik: Weinaromen, Weinbeschreibung, strukturierte Verkostung und Weinqualität.',
    beschreibung:
      '<p>Ein eintägiger Kurs, der Sinne schärft und subtile Wein-Aromen besser wahrnehmen lässt. Mit Sensibilisierungs-Training, strukturierter Weinverkostung, Fachvokabular, Blindverkostung am Ende. Zielgruppe sind Weinliebhaber sowie Fachleute, die ihr Sensorikverständnis vertiefen möchten.</p>',
    preis: 265,
    mwst: true,
    aktiv: true,
    kategorien: ['Sensorik'],
    termine: [
      {
        planungsstatus: 'geplant',
        kapazitaet: 16,
        standort: 'Hamburg',
        tageVersatz: 7,
        startzeit: '10:00:00',
        endzeit: '16:00:00',
      },
      {
        planungsstatus: 'ausgebucht',
        kapazitaet: 14,
        standort: 'Hamburg',
        tageVersatz: 21,
        startzeit: '09:30:00',
        endzeit: '17:30:00',
      },
      {
        planungsstatus: 'geplant',
        kapazitaet: 40,
        standort: 'Online',
        tageVersatz: 35,
        startzeit: '18:00:00',
        endzeit: '20:30:00',
        tage: [
          { offset: 0, startzeit: '18:00:00', endzeit: '20:30:00' },
          { offset: 7, startzeit: '18:00:00', endzeit: '20:30:00' },
        ],
      },
    ],
  },
  {
    name: 'Weinfehler – Finde den Fehler!',
    slug: 'weinfehler-basic',
    kurzbeschreibung: 'Workshop: Weinfehler erkennen und verstehen inkl. Blindverkostung.',
    beschreibung:
      '<p>Teilnehmer lernen die wichtigsten Weinfehler kennen – Ursachen, wie sie entstehen, wie man sie erkennt. Mit Blindverkostung (10 Gläser, 10 verschiedene Fehler). Schulungsunterlagen & Zertifikat inklusive.</p>',
    preis: 79,
    mwst: true,
    aktiv: true,
    kategorien: ['Sensorik'],
    termine: [
      {
        planungsstatus: 'geplant',
        kapazitaet: 18,
        standort: 'Hamburg',
        tageVersatz: 14,
        startzeit: '17:00:00',
        endzeit: '20:30:00',
      },
      {
        planungsstatus: 'abgesagt',
        kapazitaet: 18,
        standort: 'Hamburg',
        tageVersatz: 60,
        startzeit: '18:00:00',
        endzeit: '21:00:00',
      },
    ],
  },
  {
    name: 'Wein: der Weg zum Kenner',
    slug: 'wein-der-weg-zum-kenner',
    kurzbeschreibung: 'Kurs für Weinliebhaber mit ersten Kenntnissen, Überblick über Anbau & Weinqualität.',
    beschreibung:
      '<p>Vermittelt Wissen zu Etiketten, Herkunftsbezeichnungen und Weinanbau; Vergleich verschiedener Weine, Gläser, Regionen; Sensorische und theoretische Aspekte; Blindverkostung am Ende. Für alle mit ersten Vorkenntnissen, die fundierter in die Weinwelt eintauchen möchten.</p>',
    preis: 245,
    mwst: true,
    aktiv: true,
    kategorien: ['Tastings'],
    termine: [
      {
        planungsstatus: 'geplant',
        kapazitaet: 20,
        standort: 'Hamburg',
        tageVersatz: 10,
        startzeit: '10:00:00',
        endzeit: '17:00:00',
      },
      {
        planungsstatus: 'ausgebucht',
        kapazitaet: 24,
        standort: 'Mannheim',
        tageVersatz: 55,
        startzeit: '10:00:00',
        endzeit: '16:00:00',
      },
    ],
  },
  {
    name: 'WSET® Level 2 Weine',
    slug: 'wset-level-2-weine',
    kurzbeschreibung: 'WSET Level 2: über 20 Rebsorten & 70 Anbaugebiete; Etiketten- und Weinverständnis im Fokus.',
    beschreibung:
      '<p>Theorie & Praxis über die wichtigsten Rebsorten und Regionen weltweit. Verkostungen nach dem WSET-System (SAT). Prüfung & Zertifikat inklusive. Geeignet für Einsteiger mit etwas Vorkenntnissen oder zur Vertiefung nach Level 1.</p>',
    preis: 950,
    mwst: true,
    aktiv: true,
    kategorien: ['WSET'],
    termine: [
      {
        planungsstatus: 'geplant',
        kapazitaet: 16,
        standort: 'Hamburg',
        tageVersatz: 28,
        tage: [
          { offset: 0, startzeit: '09:00:00', endzeit: '17:30:00' },
          { offset: 1, startzeit: '09:00:00', endzeit: '17:30:00' },
          { offset: 30, startzeit: '10:00:00', endzeit: '13:00:00' },
        ],
      },
      {
        planungsstatus: 'ausgebucht',
        kapazitaet: 18,
        standort: 'Mannheim',
        tageVersatz: 70,
        tage: [
          { offset: 0, startzeit: '09:30:00', endzeit: '17:30:00' },
          { offset: 1, startzeit: '09:30:00', endzeit: '17:30:00' },
          { offset: 28, startzeit: '09:00:00', endzeit: '12:30:00' },
        ],
      },
    ],
  },
  {
    name: 'WSET® Level 1 Weine ONLINEKURS',
    slug: 'wset-level-1-weine-onlinekurs',
    kurzbeschreibung: 'Onlinekurs über 3 Blöcke, ideal für Einsteiger ohne Vorkenntnisse.',
    beschreibung:
      '<p>Kurs via Microsoft Teams, mit 6 Unterrichtsstunden in 3 Sessions (je 2 Stunden). Themen: Grundlagen zum Weinbau, Weinservierung, unterschiedliche Weintypen & Stile. Verkostung von Qualitätsweinen, Prüfung vor Ort in Hamburg. Abschluss mit WSET Level 1 Zertifikat.</p>',
    preis: 340,
    mwst: true,
    aktiv: true,
    kategorien: ['WSET'],
    termine: [
      {
        planungsstatus: 'geplant',
        kapazitaet: 50,
        standort: 'Online',
        tageVersatz: 20,
        tage: [
          { offset: 0, startzeit: '18:00:00', endzeit: '20:00:00' },
          { offset: 2, startzeit: '18:00:00', endzeit: '20:00:00' },
          { offset: 4, startzeit: '18:00:00', endzeit: '20:00:00' },
        ],
      },
      {
        planungsstatus: 'geplant',
        kapazitaet: 45,
        standort: 'Online',
        tageVersatz: 55,
        tage: [
          { offset: 0, startzeit: '10:00:00', endzeit: '12:00:00' },
          { offset: 7, startzeit: '10:00:00', endzeit: '12:00:00' },
          { offset: 14, startzeit: '10:00:00', endzeit: '12:00:00' },
        ],
      },
    ],
  },
  {
    name: 'Masterclass Champagne: Essentials',
    slug: 'masterclass-champagner',
    kurzbeschreibung: 'Masterclass über Champagne: Herstellung, Terroir & Stilistik; Blindverkostung mit mind. 12 Weinen.',
    beschreibung:
      '<p>Intensiver Tageskurs über die Region Champagne: Trauben, Kellerarbeit, Assemblage, Stilistik, Einfluss von Jahrgängen & Lagen sowie Vergleich großer und kleiner Produzenten. Verkostung inkl. Blindverkostung. Für Weininteressierte und Profis, die ihre Kenntnisse über Schaumweine vertiefen möchten.</p>',
    preis: 320,
    mwst: true,
    aktiv: true,
    kategorien: ['Masterclass'],
    termine: [
      {
        planungsstatus: 'geplant',
        kapazitaet: 25,
        standort: 'Hamburg',
        tageVersatz: 40,
        tage: [
          { offset: 0, startzeit: '11:00:00', endzeit: '18:00:00' },
        ],
      },
      {
        planungsstatus: 'ausgebucht',
        kapazitaet: 22,
        standort: 'Mannheim',
        tageVersatz: 90,
        tage: [
          { offset: 0, startzeit: '11:00:00', endzeit: '18:30:00' },
        ],
      },
    ],
  },
  {
    name: 'WSET® Level 3 Weine',
    slug: 'wset-level-3-weine',
    kurzbeschreibung: 'Aufbaukurs mit tiefem Fokus auf die wichtigsten Weine der Welt und deren wirtschaftliche Bedeutung.',
    beschreibung:
      '<p>Vertiefung der Kenntnisse aus Level 2; detaillierte Auseinandersetzung mit Regionen, Rebsorten und Produktionsmethoden. Professionelles Analysieren und Beschreiben von Weinen nach WSET SAT, Vorbereitung auf Beratung und Service.</p>',
    preis: 1850,
    mwst: true,
    aktiv: true,
    kategorien: ['WSET'],
    termine: [
      {
        planungsstatus: 'geplant',
        kapazitaet: 14,
        standort: 'Hamburg',
        tageVersatz: 90,
        tage: [
          { offset: 0, startzeit: '09:00:00', endzeit: '18:00:00' },
          { offset: 1, startzeit: '09:00:00', endzeit: '18:00:00' },
          { offset: 2, startzeit: '09:00:00', endzeit: '17:00:00' },
        ],
      },
      {
        planungsstatus: 'abgesagt',
        kapazitaet: 14,
        standort: 'Hamburg',
        tageVersatz: 150,
        tage: [
          { offset: 0, startzeit: '09:00:00', endzeit: '18:00:00' },
          { offset: 1, startzeit: '09:00:00', endzeit: '18:00:00' },
          { offset: 2, startzeit: '09:00:00', endzeit: '17:00:00' },
        ],
      },
    ],
  },
  {
    name: 'Assistant Sommelier (inkl. WSET® Level 2 Weine)',
    slug: 'assistant-sommelier',
    kurzbeschreibung: 'Berufsbegleitender Lehrgang für Gastronomie, Handel und Weinliebhaber inkl. WSET Level 2.',
    beschreibung:
      '<p>Fünf Kurstage mit Fokus auf Weinwissen, Service und Sensorik; Kombination mit WSET Level 2 Weine zur internationalen Qualifizierung.</p>',
    preis: 1650,
    mwst: true,
    aktiv: true,
    kategorien: ['Sommelier Ausbildung', 'WSET'],
    termine: [
      {
        planungsstatus: 'geplant',
        kapazitaet: 18,
        standort: 'Hamburg',
        tageVersatz: 32,
        tage: [
          { offset: 0, startzeit: '10:00:00', endzeit: '18:00:00' },
          { offset: 1, startzeit: '10:00:00', endzeit: '18:00:00' },
          { offset: 2, startzeit: '10:00:00', endzeit: '18:00:00' },
          { offset: 30, startzeit: '10:00:00', endzeit: '17:00:00' },
        ],
      },
    ],
  },
  {
    name: 'Sensorik Advanced',
    slug: 'sensorik-advanced',
    kurzbeschreibung: 'Aufbaukurs zur Vertiefung der Verkostungs- und Sensorikkompetenz.',
    beschreibung:
      '<p>Erweiterung der Sensorik-Skills, anspruchsvollere Weinstile und differenzierte Analysen; ideal nach „Sensorik: Essentials“.</p>',
    preis: 285,
    mwst: true,
    aktiv: true,
    kategorien: ['Sensorik'],
    termine: [
      {
        planungsstatus: 'geplant',
        kapazitaet: 18,
        standort: 'Hamburg',
        tageVersatz: 48,
        startzeit: '10:00:00',
        endzeit: '18:00:00',
      },
      {
        planungsstatus: 'geplant',
        kapazitaet: 18,
        standort: 'Online',
        tageVersatz: 120,
        startzeit: '17:00:00',
        endzeit: '20:00:00',
      },
    ],
  },
  {
    name: 'Masterclass Sake',
    slug: 'masterclass-sake',
    kurzbeschreibung: 'Kompakter Einstieg in Geschichte, Herstellung, Reis-Kategorien, Verkostung & Foodpairing.',
    beschreibung:
      '<p>Tageskurs inkl. Kurzprüfung und Zertifikat der Wine Academy Hamburg; ideal für Gastronomie-Profis und Enthusiasten.</p>',
    preis: 249,
    mwst: true,
    aktiv: true,
    kategorien: ['Masterclass'],
    termine: [
      {
        planungsstatus: 'geplant',
        kapazitaet: 22,
        standort: 'Hamburg',
        tageVersatz: 52,
        startzeit: '10:00:00',
        endzeit: '17:00:00',
      },
      {
        planungsstatus: 'ausgebucht',
        kapazitaet: 20,
        standort: 'Hamburg',
        tageVersatz: 95,
        startzeit: '10:30:00',
        endzeit: '17:30:00',
      },
    ],
  },
];

  const ensureTermine = async (seminarId: number, termine: typeof seminarSeeds[number]['termine']) => {
    const existingTermine = await strapi.documents('api::termin.termin').findMany({
      filters: { seminar: seminarId },
      pageSize: 200,
    });

    if (Array.isArray(existingTermine) && existingTermine.length > 0) {
      for (const existing of existingTermine) {
        if (existing?.documentId) {
          await strapi.documents('api::termin.termin').delete({ documentId: existing.documentId });
        }
      }
    }

    for (const termin of termine) {
      const baseDate = new Date();
      baseDate.setHours(12, 0, 0, 0);
      baseDate.setDate(baseDate.getDate() + termin.tageVersatz);

      const defaultStart = termin.startzeit ?? '10:00:00';
      const defaultEnd = termin.endzeit ?? '17:00:00';
      const tageSeeds = Array.isArray(termin.tage) && termin.tage.length > 0
        ? termin.tage
        : [{ offset: 0, startzeit: defaultStart, endzeit: defaultEnd }];

      const tageMitUhrzeit = tageSeeds.map((tag) => {
        const dayDate = new Date(baseDate);
        dayDate.setDate(baseDate.getDate() + Number(tag.offset ?? 0));
        return {
          datum: dayDate.toISOString().slice(0, 10),
          startzeit: tag.startzeit ?? defaultStart,
          endzeit: tag.endzeit ?? defaultEnd,
        };
      });

      const createdTermin = await strapi.documents('api::termin.termin').create({
        data: {
          planungsstatus: termin.planungsstatus,
          kapazitaet: termin.kapazitaet,
          starttag: tageMitUhrzeit[0]?.datum ?? baseDate.toISOString().slice(0, 10),
          tageMitUhrzeit,
          seminar: seminarId,
          standort: standortIdByName[termin.standort],
        },
        status: 'draft',
      });

      if (createdTermin?.documentId) {
        await strapi.documents('api::termin.termin').publish({ documentId: createdTermin.documentId });
      }
    }
  };
  for (const seminardata of seminarSeeds) {
    const catIdsForSeminar = (seminardata.kategorien || [])
      .map((name) => catIds[name])
      .filter((id): id is number => typeof id === 'number');

    const seminarId = await upsertSeminar(strapi, {
      name: seminardata.name,
      slug: seminardata.slug,
      kurzbeschreibung: seminardata.kurzbeschreibung,
      beschreibung: seminardata.beschreibung,
      infos: seminardata.infos,
      preis: seminardata.preis,
      mwst: seminardata.mwst,
      aktiv: seminardata.aktiv,
      kategorien: catIdsForSeminar,
    });

    if (seedTermineEnabled && seminardata.termine.length > 0) {
      await ensureTermine(seminarId, seminardata.termine);
    }
    log(`Seminar angelegt/aktualisiert: ${seminardata.name} (ID ${seminarId})`);
  }

  const productSeeds = [
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
      kurzbeschreibung: 'Ergänzendes Tasting-Set zum WSET Level 1 mit ausgewählten Weinen in Vinottes.',
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

  for (const product of productSeeds) {
    const productId = await upsertProduct(strapi, product);
    log(`Produkt angelegt/aktualisiert: ${product.name} (ID ${productId})`);
  }

  const voucherSeeds = [
    {
      name: 'WELCOME10',
      code: 'WELCOME10',
      beschreibung: '10% Willkommensrabatt',
      typ: 'prozent' as const,
      wert: 10,
      mindesteinkauf: 100,
      maxRabatt: 100,
      maxEinloesungen: 500,
    },
    {
      name: 'TEST-25',
      code: 'TEST-25',
      beschreibung: '25 EUR Testgutschein',
      betrag: 25,
      typ: 'betrag' as const,
      wert: 25,
      maxEinloesungen: 1,
    },
    {
      name: 'WSET50',
      code: 'WSET50',
      beschreibung: '50 EUR auf WSET Seminare',
      betrag: 50,
      typ: 'betrag' as const,
      wert: 50,
      maxEinloesungen: 1,
    },
  ];

  for (const voucher of voucherSeeds) {
    const voucherId = await upsertGutschein(strapi, voucher);
    log(`Gutschein angelegt/aktualisiert: ${voucher.code} (ID ${voucherId})`);
  }

  await upsertGutscheinTemplate(strapi, {
    name: 'Geschenkgutschein',
    beschreibung: 'Verschenke frei wählbare Beträge für Seminare und Produkte.',
    minBetrag: 50,
    maxBetrag: 500,
    aktiv: true,
  });
  log('Gutschein-Template aktualisiert');

  const navigationItems = [
    {
      titel: 'Wine Academy',
      link: '/wine-academy',
      ziel: '_self',
      unterpunkte: [
        { titel: 'Wine Academy', link: '/wine-academy', ziel: '_self' },
        { titel: 'Studio', link: '/wine-academy/studio', ziel: '_self' },
        { titel: 'Team', link: '/wine-academy/team', ziel: '_self' },
        { titel: 'Unsere Philosophie', link: '/wine-academy/philosophie', ziel: '_self' },
      ],
    },
    {
      titel: 'Ausbildung',
      link: '/ausbildung',
      ziel: '_self',
      unterpunkte: [
        { titel: 'Sommeliere', link: '/ausbildung/sommeliere', ziel: '_self' },
        { titel: 'WSET', link: '/ausbildung/wset', ziel: '_self' },
      ],
    },
    {
      titel: 'Kurse',
      link: '/kurse',
      ziel: '_self',
      unterpunkte: [
        { titel: 'Masterclasses', link: '/kurse/masterclasses', ziel: '_self' },
        { titel: 'Weinkurse', link: '/kurse/weinkurse', ziel: '_self' },
      ],
    },
    { titel: 'Events', link: '/events', ziel: '_self', unterpunkte: [] },
    { titel: 'Gutscheine', link: '/gutscheine', ziel: '_self', unterpunkte: [] },
    { titel: 'Kontakt', link: '/kontakt', ziel: '_self', unterpunkte: [] },
  ];

  const navigationId = await upsertSingleType(strapi, 'api::navigation.navigation', {
    items: navigationItems,
    publishedAt: nowIso(),
  });
  log(`Navigation aktualisiert (ID ${navigationId})`);

  const footerSections = [
    {
      titel: 'Post an uns',
      typ: 'kontakt',
      text: ['Eimsbütteler Chaussee 37', '20259 Hamburg', 'Tel.: 040-88 12 80 27', 'post@wineacademy.de'].join('\n'),
      links: [],
      logos: [],
    },
    {
      titel: 'Rechtliches',
      typ: 'links',
      links: [
        { label: 'AGB', href: '/agb', ziel: '_self' },
        { label: 'Widerruf', href: '/widerruf', ziel: '_self' },
        { label: 'Zahlungsarten', href: '/zahlungsarten', ziel: '_self' },
        { label: 'Bildnachweise', href: '/bildnachweise', ziel: '_self' },
        { label: 'Impressum', href: '/impressum', ziel: '_self' },
        { label: 'Datenschutz', href: '/datenschutz', ziel: '_self' },
      ],
      logos: [],
    },
    {
      titel: 'Wine Academy',
      typ: 'links',
      links: [
        { label: 'Weinkurse', href: '/kurse/weinkurse', ziel: '_self' },
        { label: 'WSET', href: '/ausbildung/wset', ziel: '_self' },
        { label: 'Sommelier', href: '/ausbildung/sommeliere', ziel: '_self' },
        { label: 'Tastings & Events', href: '/events', ziel: '_self' },
      ],
      logos: [],
    },
    {
      titel: 'Zertifikate',
      typ: 'logos',
      links: [],
      logos: [
        { name: 'WSET', href: 'https://www.wsetglobal.com/' },
        { name: 'Certuria', href: 'https://www.certuria.de/' },
      ],
    },
  ];

  const footerId = await upsertSingleType(strapi, 'api::footer.footer', {
    sections: footerSections,
    publishedAt: nowIso(),
  });
  log(`Footer aktualisiert (ID ${footerId})`);


  const notificationSeeds: BenachrichtigungSeedInput[] = [
    {
      name: 'Bestellbestätigung',
      anwendungsfall: 'bestellbestaetigung',
      layout: 'default',
      beschreibung: 'Kundenmail direkt nach Checkout.',
      betreff: 'Wir haben deine Bestellung {{bestellung.bestellnummer}} erhalten',
      vorschauzeile: 'Danke für deine Buchung bei der Wine Academy.',
      bodyHtml: `<h1>Hallo {{kunde.vorname}},</h1>
<p>wir haben deine Bestellung {{bestellung.bestellnummer}} erhalten. Danke für dein Vertrauen in die Wine Academy Hamburg.</p>
<p><strong>Bestellübersicht</strong></p>
{{bestellung.positionenTableHtml}}
<p><strong>Summe brutto:</strong> {{bestellung.summeBrutto}}</p>
<p>Deine Rechnung kannst du hier herunterladen: <a href="{{links.rechnung}}">Rechnung herunterladen</a>.</p>
<p>Viele Grüße<br/>Wine Academy Hamburg</p>`,
      bodyText: `Hallo {{kunde.vorname}},

wir haben deine Bestellung {{bestellung.bestellnummer}} erhalten.

Summe brutto: {{bestellung.summeBrutto}}

Rechnung: {{links.rechnung}}

Viele Grüße
Wine Academy Hamburg`,
      platzhalter: [
        { schluessel: 'kunde.vorname', beispiel: 'Max' },
        { schluessel: 'bestellung.bestellnummer', beispiel: 'WA-20251001' },
        { schluessel: 'bestellung.summeBrutto', beispiel: '1.270,00 €' },
        {
          schluessel: 'bestellung.positionenTableHtml',
          beschreibung: 'HTML-Tabelle mit allen Positionen inklusive Mengen und Summen.',
          beispiel:
            '<table><tr><td>Sensorik Essentials</td><td>2</td><td>530,00 €</td></tr><tr><td>WSET Level 2</td><td>1</td><td>950,00 €</td></tr></table>',
        },
        {
          schluessel: 'links.rechnung',
          beschreibung: 'Direktlink zum PDF der Rechnung.',
          beispiel: 'https://wineacademy.plan-p.de/api/public/bestellungen/WA-20251001/rechnung',
        },
      ],
      testPayload: {
        kunde: { vorname: 'Max', nachname: 'Beispiel' },
        bestellung: {
          bestellnummer: 'WA-20251001',
          summeBrutto: '1.270,00 €',
          zahlungsmethode: 'Rechnung',
          zahlungsstatus: 'offen',
          positionenTableHtml:
            '<table><thead><tr><th>Position</th><th>Menge</th><th>Summe</th></tr></thead><tbody><tr><td>Sensorik Essentials</td><td>2</td><td>530,00 €</td></tr><tr><td>WSET Level 2</td><td>1</td><td>950,00 €</td></tr></tbody></table>',
        },
        links: {
          rechnung: 'https://wineacademy.plan-p.de/api/public/bestellungen/WA-20251001/rechnung',
        },
      },
    },
    {
      name: 'Zahlungsbestätigung',
      anwendungsfall: 'zahlungsbestaetigung',
      layout: 'default',
      beschreibung: 'Automatische Bestätigung nach Zahlungseingang.',
      betreff: 'Zahlung für {{bestellung.bestellnummer}} ist eingegangen',
      vorschauzeile: 'Wir haben deine Zahlung erhalten und schalten alle Leistungen frei.',
      bodyHtml: `<h1>Hallo {{kunde.vorname}},</h1>
<p>deine Zahlung über {{bestellung.zahlungsbetrag}} zu Bestellung {{bestellung.bestellnummer}} ist am {{bestellung.zahlungsdatum}} eingegangen.</p>
{{gutscheineHtml}}
<p>Deine Rechnung kannst du jederzeit hier herunterladen: <a href="{{links.rechnung}}">Rechnung herunterladen</a>.</p>
<p>Vielen Dank und bis bald!<br/>Wine Academy Hamburg</p>`,
      bodyText: `Hallo {{kunde.vorname}},

wir haben deine Zahlung für Bestellung {{bestellung.bestellnummer}} am {{bestellung.zahlungsdatum}} erhalten. Betrag: {{bestellung.zahlungsbetrag}}.

Rechnung: {{links.rechnung}}

Viele Grüße
Wine Academy Hamburg`,
      platzhalter: [
        { schluessel: 'kunde.vorname', beispiel: 'Anna' },
        { schluessel: 'bestellung.bestellnummer', beispiel: 'WA-20251001' },
        { schluessel: 'bestellung.zahlungsdatum', beispiel: '03.10.2025' },
        { schluessel: 'bestellung.zahlungsbetrag', beispiel: '1.270,00 €' },
        {
          schluessel: 'gutscheineHtml',
          beschreibung: 'HTML-Liste mit generierten Gutscheincodes (falls vorhanden).',
          beispiel: '<ul><li>Gutschein: CODE-1234 (50 €)</li></ul>',
        },
        {
          schluessel: 'links.rechnung',
          beschreibung: 'Direktlink zur Rechnung.',
          beispiel: 'https://wineacademy.plan-p.de/api/public/bestellungen/WA-20251001/rechnung',
        },
      ],
      testPayload: {
        kunde: { vorname: 'Anna' },
        bestellung: {
          bestellnummer: 'WA-20251001',
          zahlungsdatum: '03.10.2025',
          zahlungsbetrag: '1.270,00 €',
        },
        gutscheineHtml: '<ul><li>Gutschein: WA3K-9XYZ (50 €)</li></ul>',
        links: {
          rechnung: 'https://wineacademy.plan-p.de/api/public/bestellungen/WA-20251001/rechnung',
        },
      },
    },
    {
      name: 'Rechnung & Gutscheinversand',
      anwendungsfall: 'rechnung_gutschein',
      layout: 'rechnung',
      beschreibung: 'Mail mit Links zu Rechnung und ggf. Gutschein-PDFs.',
      betreff: 'Deine Unterlagen zu {{bestellung.bestellnummer}}',
      vorschauzeile: 'Hier findest du Rechnung und Gutscheincodes zur Bestellung.',
      bodyHtml: `<h1>Hallo {{kunde.vorname}},</h1>
<p>anbei erhältst du die Rechnung zu deiner Bestellung {{bestellung.bestellnummer}}.</p>
<p><a href="{{anhang.rechnungUrl}}">Rechnung herunterladen</a></p>
{{anhang.gutscheineHtml}}
<p>Viel Freude mit unseren Seminaren!<br/>Wine Academy Hamburg</p>`,
      bodyText: `Hallo {{kunde.vorname}},

die Rechnung zu deiner Bestellung {{bestellung.bestellnummer}} findest du hier: {{anhang.rechnungUrl}}.
{{anhang.gutscheineText}}

Viele Grüße
Wine Academy Hamburg`,
      platzhalter: [
        { schluessel: 'kunde.vorname', beispiel: 'Anna' },
        { schluessel: 'bestellung.bestellnummer', beispiel: 'WA-20251001' },
        {
          schluessel: 'anhang.rechnungUrl',
          beschreibung: 'Direkter Link zum Rechnungs-PDF.',
          beispiel: 'https://wineacademy.plan-p.de/uploads/WA-20251001.pdf',
        },
        {
          schluessel: 'anhang.gutscheineHtml',
          beschreibung: 'HTML-Liste aller Gutschein-PDFs.',
          beispiel: '<ul><li><a href="https://.../GUT-123.pdf">GUT-123.pdf</a></li></ul>',
        },
        {
          schluessel: 'anhang.gutscheineText',
          beschreibung: 'Textuelle Auflistung der Gutscheine für Plain-Text-Version.',
          beispiel: 'Gutschein WA3K-9XYZ (50 €)',
        },
      ],
      testPayload: {
        kunde: { vorname: 'Anna' },
        bestellung: { bestellnummer: 'WA-20251001' },
        anhang: {
          rechnungUrl: 'https://wineacademy.plan-p.de/uploads/WA-20251001.pdf',
          gutscheineHtml:
            '<ul><li><a href="https://wineacademy.plan-p.de/uploads/GUT-123.pdf">GUT-123.pdf</a></li></ul>',
          gutscheineText: 'Gutschein WA3K-9XYZ (50 €)',
        },
      },
    },
    {
      name: 'Backoffice Benachrichtigung',
      anwendungsfall: 'backoffice_benachrichtigung',
      layout: 'backoffice',
      beschreibung: 'Interne Info bei neuen Bestellungen.',
      betreff: 'Neue Bestellung {{bestellung.bestellnummer}}',
      vorschauzeile: 'Neue Bestellung wartet auf Prüfung.',
      bodyHtml: `<h1>Neue Bestellung {{bestellung.bestellnummer}}</h1>
<p><strong>Status:</strong> {{bestellung.status}}</p>
<p><strong>Zahlungsmethode:</strong> {{bestellung.zahlungsmethode}}</p>
<p><strong>Rechnungstyp:</strong> {{bestellung.rechnungstyp}}</p>
<p><strong>Summen</strong><br/>
Brutto: {{bestellung.summeBrutto}}<br/>
Netto: {{bestellung.summeNetto}}<br/>
Steuer: {{bestellung.summeSteuer}}<br/>
Gutschein: {{bestellung.gutscheinBetrag}}</p>
<p><strong>Kunde</strong><br/>
{{bestellung.kunde.vorname}} {{bestellung.kunde.nachname}}<br/>
E-Mail: {{bestellung.kunde.email}}<br/>
Telefon: {{bestellung.kunde.telefon}}</p>
<p><strong>Rechnungsadresse</strong><br/>
{{bestellung.adresse.firmenname}}<br/>
{{bestellung.adresse.strasse}}<br/>
{{bestellung.adresse.plz}} {{bestellung.adresse.stadt}} ({{bestellung.adresse.land}})<br/>
Rechnungs-E-Mail: {{bestellung.adresse.rechnungsEmail}}<br/>
USt-ID: {{bestellung.adresse.ustId}}</p>
<p><strong>Positionen</strong></p>
{{bestellung.positionenTableHtml}}
<p><strong>Rechnung:</strong> {{links.rechnung}}</p>
<p><strong>Notizen:</strong> {{bestellung.notizen}}</p>`,
      bodyText: `Neue Bestellung {{bestellung.bestellnummer}}
Status: {{bestellung.status}}
Zahlungsmethode: {{bestellung.zahlungsmethode}}
Rechnungstyp: {{bestellung.rechnungstyp}}
Summen:
  Brutto: {{bestellung.summeBrutto}}
  Netto: {{bestellung.summeNetto}}
  Steuer: {{bestellung.summeSteuer}}
  Gutschein: {{bestellung.gutscheinBetrag}}
Kunde:
  {{bestellung.kunde.vorname}} {{bestellung.kunde.nachname}}
  E-Mail: {{bestellung.kunde.email}}
  Telefon: {{bestellung.kunde.telefon}}
Adresse:
  {{bestellung.adresse.firmenname}}
  {{bestellung.adresse.strasse}}
  {{bestellung.adresse.plz}} {{bestellung.adresse.stadt}} ({{bestellung.adresse.land}})
  Rechnungs-E-Mail: {{bestellung.adresse.rechnungsEmail}}
  USt-ID: {{bestellung.adresse.ustId}}
Positionen:
{{bestellung.positionenText}}

Rechnung: {{links.rechnung}}
Notizen: {{bestellung.notizen}}`,
      platzhalter: [
        { schluessel: 'bestellung.bestellnummer', beispiel: 'WA-20251001' },
        { schluessel: 'bestellung.status', beispiel: 'offen' },
        { schluessel: 'bestellung.zahlungsmethode', beispiel: 'rechnung' },
        { schluessel: 'bestellung.summeBrutto', beispiel: '1.270,00 €' },
        { schluessel: 'bestellung.summeNetto', beispiel: '1.067,23 €' },
        { schluessel: 'bestellung.summeSteuer', beispiel: '202,77 €' },
        { schluessel: 'bestellung.gutscheinBetrag', beispiel: '0,00 €' },
        { schluessel: 'bestellung.rechnungstyp', beispiel: 'firma' },
        { schluessel: 'bestellung.kunde.vorname', beispiel: 'Anna' },
        { schluessel: 'bestellung.kunde.nachname', beispiel: 'Beispiel' },
        { schluessel: 'bestellung.kunde.email', beispiel: 'anna@example.com' },
        { schluessel: 'bestellung.kunde.telefon', beispiel: '+49 40 123456' },
        { schluessel: 'bestellung.adresse.firmenname', beispiel: 'Weinliebhaber GmbH' },
        { schluessel: 'bestellung.adresse.strasse', beispiel: 'Weinplatz 1' },
        { schluessel: 'bestellung.adresse.plz', beispiel: '20095' },
        { schluessel: 'bestellung.adresse.stadt', beispiel: 'Hamburg' },
        { schluessel: 'bestellung.adresse.land', beispiel: 'Deutschland' },
        { schluessel: 'bestellung.adresse.rechnungsEmail', beispiel: 'billing@example.com' },
        { schluessel: 'bestellung.adresse.ustId', beispiel: 'DE123456789' },
        { schluessel: 'bestellung.positionenTableHtml', beschreibung: 'HTML-Tabelle der Positionen.' },
        { schluessel: 'bestellung.positionenText', beschreibung: 'Textuelle Auflistung der Positionen.' },
        { schluessel: 'bestellung.notizen', beispiel: 'Bitte veganen Wein berücksichtigen.' },
        {
          schluessel: 'links.rechnung',
          beschreibung: 'Direktlink zum Rechnungs-PDF.',
          beispiel: 'https://wineacademy.plan-p.de/api/public/bestellungen/WA-20251001/rechnung',
        },
      ],
      testPayload: {
        bestellung: {
          bestellnummer: 'WA-20251001',
          status: 'offen',
          zahlungsmethode: 'rechnung',
          summeBrutto: '1.270,00 €',
          summeNetto: '1.067,23 €',
          summeSteuer: '202,77 €',
          gutscheinBetrag: '0,00 €',
          rechnungstyp: 'firma',
          kunde: {
            vorname: 'Anna',
            nachname: 'Beispiel',
            email: 'anna@example.com',
            telefon: '+49 40 123456',
          },
          adresse: {
            firmenname: 'Weinliebhaber GmbH',
            strasse: 'Weinplatz 1',
            plz: '20095',
            stadt: 'Hamburg',
            land: 'Deutschland',
            rechnungsEmail: 'billing@example.com',
            ustId: 'DE123456789',
          },
          positionenTableHtml:
            '<table><tr><td>Sensorik Essentials</td><td>2</td><td>530,00 €</td></tr><tr><td>WSET Level 2</td><td>1</td><td>950,00 €</td></tr></table>',
          positionenText: 'Sensorik Essentials · Menge: 2 · Summe: 530,00 €',
          notizen: 'Bitte veganen Wein berücksichtigen.',
        },
        links: {
          rechnung: 'https://wineacademy.plan-p.de/api/public/bestellungen/WA-20251001/rechnung',
        },
      },
    },
    {
      name: 'Storno-Bestätigung',
      anwendungsfall: 'storno_bestaetigung',
      layout: 'default',
      beschreibung: 'Kundenbenachrichtigung nach Stornierungen.',
      betreff: 'Bestellung {{bestellung.bestellnummer}} wurde storniert',
      vorschauzeile: 'Wir haben deine Stornierung bestätigt.',
      bodyHtml: `<h1>Hallo {{kunde.vorname}},</h1>
<p>wir bestätigen die Stornierung deiner Bestellung {{bestellung.bestellnummer}} am {{stornierung.datum}}.</p>
<p><strong>Bestellübersicht</strong></p>
{{bestellung.positionenTableHtml}}
<p><strong>Summe brutto:</strong> {{bestellung.summeBrutto}}</p>
<p><strong>Stornorechnung:</strong> {{links.stornoRechnung}}</p>
<p>Bei Fragen melde dich gerne jederzeit.</p>
<p>Viele Grüße<br/>Wine Academy Hamburg</p>`,
      bodyText: `Hallo {{kunde.vorname}},

wir bestätigen die Stornierung deiner Bestellung {{bestellung.bestellnummer}} am {{stornierung.datum}}.

Summe brutto: {{bestellung.summeBrutto}}
Stornorechnung: {{links.stornoRechnung}}

Viele Grüße
Wine Academy Hamburg`,
      platzhalter: [
        { schluessel: 'kunde.vorname', beispiel: 'Max' },
        { schluessel: 'bestellung.bestellnummer', beispiel: 'WA-20251001' },
        { schluessel: 'bestellung.summeBrutto', beispiel: '1.270,00 €' },
        {
          schluessel: 'bestellung.positionenTableHtml',
          beschreibung: 'Übersicht der stornierten Positionen als Tabelle.',
          beispiel:
            '<table><tr><td>Sensorik Essentials</td><td>2</td><td>530,00 €</td></tr><tr><td>WSET Level 2</td><td>1</td><td>950,00 €</td></tr></table>',
        },
        {
          schluessel: 'stornierung.datum',
          beschreibung: 'Datum der Stornierung im ISO-Format.',
          beispiel: '2025-10-08',
        },
        {
          schluessel: 'links.stornoRechnung',
          beschreibung: 'Direktlink zur Stornorechnung.',
          beispiel: 'https://wineacademy.plan-p.de/api/public/bestellungen/WA-20251001/storno',
        },
      ],
      testPayload: {
        kunde: { vorname: 'Max' },
        bestellung: {
          bestellnummer: 'WA-20251001',
          summeBrutto: '1.270,00 €',
          positionenTableHtml:
            '<table><tr><td>Sensorik Essentials</td><td>2</td><td>530,00 €</td></tr><tr><td>WSET Level 2</td><td>1</td><td>950,00 €</td></tr></table>',
        },
        stornierung: {
          datum: '2025-10-08',
        },
        links: {
          stornoRechnung: 'https://wineacademy.plan-p.de/api/public/bestellungen/WA-20251001/storno',
        },
      },
    },
    {
      name: 'Storno-Backoffice',
      anwendungsfall: 'storno_backoffice',
      layout: 'backoffice',
      beschreibung: 'Interne Info bei stornierten Bestellungen.',
      betreff: 'Bestellung {{bestellung.bestellnummer}} wurde storniert',
      vorschauzeile: 'Storno ist eingegangen.',
      bodyHtml: `<h1>Bestellung {{bestellung.bestellnummer}} wurde storniert</h1>
<p><strong>Status:</strong> {{bestellung.status}}</p>
<p><strong>Stornodatum:</strong> {{stornierung.datum}}</p>
<p><strong>Zahlungsmethode:</strong> {{bestellung.zahlungsmethode}}</p>
<p><strong>Summen</strong><br/>
Brutto: {{bestellung.summeBrutto}}<br/>
Netto: {{bestellung.summeNetto}}<br/>
Steuer: {{bestellung.summeSteuer}}<br/>
Gutschein: {{bestellung.gutscheinBetrag}}</p>
<p><strong>Kunde</strong><br/>
{{bestellung.kunde.vorname}} {{bestellung.kunde.nachname}}<br/>
E-Mail: {{bestellung.kunde.email}}<br/>
Telefon: {{bestellung.kunde.telefon}}</p>
<p><strong>Rechnungsadresse</strong><br/>
{{bestellung.adresse.firmenname}}<br/>
{{bestellung.adresse.strasse}}<br/>
{{bestellung.adresse.plz}} {{bestellung.adresse.stadt}} ({{bestellung.adresse.land}})<br/>
Rechnungs-E-Mail: {{bestellung.adresse.rechnungsEmail}}<br/>
USt-ID: {{bestellung.adresse.ustId}}</p>
<p><strong>Positionen</strong></p>
{{bestellung.positionenTableHtml}}
<p><strong>Rechnung:</strong> {{links.rechnung}}</p>
<p><strong>Stornorechnung:</strong> {{links.stornoRechnung}}</p>
<p><strong>Notizen:</strong> {{bestellung.notizen}}</p>`,
      bodyText: `Storno {{bestellung.bestellnummer}}
Status: {{bestellung.status}}
Stornodatum: {{stornierung.datum}}
Zahlungsmethode: {{bestellung.zahlungsmethode}}
Summen:
  Brutto: {{bestellung.summeBrutto}}
  Netto: {{bestellung.summeNetto}}
  Steuer: {{bestellung.summeSteuer}}
  Gutschein: {{bestellung.gutscheinBetrag}}
Kunde:
  {{bestellung.kunde.vorname}} {{bestellung.kunde.nachname}}
  E-Mail: {{bestellung.kunde.email}}
  Telefon: {{bestellung.kunde.telefon}}
Adresse:
  {{bestellung.adresse.firmenname}}
  {{bestellung.adresse.strasse}}
  {{bestellung.adresse.plz}} {{bestellung.adresse.stadt}} ({{bestellung.adresse.land}})
  Rechnungs-E-Mail: {{bestellung.adresse.rechnungsEmail}}
  USt-ID: {{bestellung.adresse.ustId}}
Positionen:
{{bestellung.positionenText}}

Rechnung: {{links.rechnung}}
Stornorechnung: {{links.stornoRechnung}}
Notizen: {{bestellung.notizen}}`,
      platzhalter: [
        { schluessel: 'bestellung.bestellnummer', beispiel: 'WA-20251001' },
        { schluessel: 'bestellung.status', beispiel: 'storniert' },
        { schluessel: 'bestellung.zahlungsmethode', beispiel: 'rechnung' },
        { schluessel: 'bestellung.summeBrutto', beispiel: '1.270,00 €' },
        { schluessel: 'bestellung.summeNetto', beispiel: '1.067,23 €' },
        { schluessel: 'bestellung.summeSteuer', beispiel: '202,77 €' },
        { schluessel: 'bestellung.gutscheinBetrag', beispiel: '0,00 €' },
        { schluessel: 'stornierung.datum', beispiel: '2025-10-08' },
        { schluessel: 'bestellung.kunde.vorname', beispiel: 'Anna' },
        { schluessel: 'bestellung.kunde.nachname', beispiel: 'Beispiel' },
        { schluessel: 'bestellung.kunde.email', beispiel: 'anna@example.com' },
        { schluessel: 'bestellung.kunde.telefon', beispiel: '+49 40 123456' },
        { schluessel: 'bestellung.adresse.firmenname', beispiel: 'Weinliebhaber GmbH' },
        { schluessel: 'bestellung.adresse.strasse', beispiel: 'Weinplatz 1' },
        { schluessel: 'bestellung.adresse.plz', beispiel: '20095' },
        { schluessel: 'bestellung.adresse.stadt', beispiel: 'Hamburg' },
        { schluessel: 'bestellung.adresse.land', beispiel: 'Deutschland' },
        { schluessel: 'bestellung.adresse.rechnungsEmail', beispiel: 'billing@example.com' },
        { schluessel: 'bestellung.adresse.ustId', beispiel: 'DE123456789' },
        { schluessel: 'bestellung.positionenTableHtml', beschreibung: 'HTML-Tabelle der Positionen.' },
        { schluessel: 'bestellung.positionenText', beschreibung: 'Textuelle Auflistung der Positionen.' },
        { schluessel: 'bestellung.notizen', beispiel: 'Bitte veganen Wein berücksichtigen.' },
        {
          schluessel: 'links.rechnung',
          beschreibung: 'Direktlink zum ursprünglichen Rechnungs-PDF.',
          beispiel: 'https://wineacademy.plan-p.de/api/public/bestellungen/WA-20251001/rechnung',
        },
        {
          schluessel: 'links.stornoRechnung',
          beschreibung: 'Direktlink zur Stornorechnung.',
          beispiel: 'https://wineacademy.plan-p.de/api/public/bestellungen/WA-20251001/storno',
        },
      ],
      testPayload: {
        bestellung: {
          bestellnummer: 'WA-20251001',
          status: 'storniert',
          zahlungsmethode: 'rechnung',
          summeBrutto: '1.270,00 €',
          summeNetto: '1.067,23 €',
          summeSteuer: '202,77 €',
          gutscheinBetrag: '0,00 €',
          rechnungstyp: 'privat',
          kunde: {
            vorname: 'Anna',
            nachname: 'Beispiel',
            email: 'anna@example.com',
            telefon: '+49 40 123456',
          },
          adresse: {
            firmenname: '',
            strasse: 'Weinplatz 1',
            plz: '20095',
            stadt: 'Hamburg',
            land: 'Deutschland',
            rechnungsEmail: 'kunde@example.com',
            ustId: '',
          },
          positionenTableHtml:
            '<table><tr><td>Sensorik Essentials</td><td>2</td><td>530,00 €</td></tr><tr><td>WSET Level 2</td><td>1</td><td>950,00 €</td></tr></table>',
          positionenText: 'Sensorik Essentials · Menge: 2 · Summe: 530,00 €',
          notizen: '-',
        },
        stornierung: {
          datum: '2025-10-08',
        },
        links: {
          rechnung: 'https://wineacademy.plan-p.de/api/public/bestellungen/WA-20251001/rechnung',
          stornoRechnung: 'https://wineacademy.plan-p.de/api/public/bestellungen/WA-20251001/storno',
        },
      },
    },
  ];

  for (const notification of notificationSeeds) {
    const notificationId = await upsertBenachrichtigung(strapi, notification);
    log(`Benachrichtigung angelegt/aktualisiert: ${notification.anwendungsfall} (ID ${notificationId})`);
  }

  const einstellungenId = await upsertEinstellungen(strapi, {
    absenderName: 'Wine Academy Hamburg',
    absenderEmail: 'technik@plan-p.de',
    antwortEmail: 'support@wineacademy.de',
    benachrichtigungen: [
      { bezeichnung: 'Backoffice Bestellungen', email: 'philipp@plan-p.de', typ: 'bestellung' },
      { bezeichnung: 'Storno-Team', email: 'philipp@plan-p.de', typ: 'storno' },
      { bezeichnung: 'Operations', email: 'philipp@plan-p.de', typ: 'sonstiges' },
    ],
  });
  log(`Einstellungen aktualisiert (ID ${einstellungenId})`);

  const homepageSections = [
    {
      __component: 'landing.hero',
      titel: 'Wein neu entdecken',
      text: 'erleben – erfahren – genießen\nWeinausbildung nach Maß – individuell und zeitlich flexibel gestaltet',
      videoUrl: 'https://www.wineacademy.de/wp-content/uploads/WineAcademy-Header_final.mp4',
      buttonLabel: 'Kurse entdecken',
      buttonLink: 'https://www.wineacademy.de/kurse/',
    },
    {
      __component: 'landing.card-grid',
      karten: [
        { titel: 'Weinkurse', link: 'https://www.wineacademy.de/kurse/weinkurse/' },
        { titel: 'Tastings & Events', link: 'https://www.wineacademy.de/tastings-events/' },
        { titel: 'WSET® Ausbildung', link: 'https://www.wineacademy.de/kurse/wset/' },
      ],
    },
    {
      __component: 'landing.text-block',
      titel: 'Wine Academy Hamburg – die Weinschule',
      text: `<p>Die Wine Academy Hamburg ist die Adresse für erstklassige Weinausbildung. „Weinausbildung nach Maß – individuell und zeitlich flexibel gestaltet“ bedeutet ein umfangreiches Kursangebot, das sowohl Fachleuten aus der Weinbranche als auch leidenschaftlichen Endverbraucher*innen den Schlüssel zu tiefgreifendem Weinwissen bietet.</p>
<p>Unsere Weinschule in Hamburg zeichnet sich durch ein vielfältiges Lehrangebot aus, einschließlich akkreditierter Kurse des renommierten Wine and Spirit Education Trust (WSET®), spezialisierter Masterclasses und gezielter Prüfungsvorbereitung – nicht nur für WSET®-Zertifizierungen. Ob eine Karriere mit der Ausbildung zur Sommelière bzw. zum Sommelier vorangetrieben oder einfach das Weinwissen erweitert werden soll, unsere maßgeschneiderten Kurse bieten für alle etwas.</p>
<p>Neben formalen Ausbildungen lädt die Wine Academy Hamburg zu inspirierenden Weinseminaren, Weintastings und Events ein, bei denen in entspannter Atmosphäre neue Weine entdeckt und der Austausch mit Gleichgesinnten gepflegt wird. Unsere erfahrenen Dozent*innen und Weinexpert*innen teilen ihr umfassendes Wissen und ihre Leidenschaft für Wein in einer unvergesslichen Ausbildungserfahrung auf höchstem Niveau.</p>
<p>Starte deine Weinausbildung in Hamburg und werde Teil einer lebendigen Community, die deine Liebe zum Wein teilt – flexibel, individuell und auf höchstem Niveau.</p>`,
      buttonLabel: 'Unsere Kurse →',
      buttonLink: 'https://www.wineacademy.de/kurse/',
    },
    {
      __component: 'landing.icon-grid',
      titel: 'Warum Wine Academy?',
      items: [
        {
          icon: 'globe',
          titel: 'Flexible Formate',
          text: 'Online oder Präsenz – die Teilnehmerinnen und Teilnehmer gestalten ihre Kursformate frei.',
        },
        {
          icon: 'certificate',
          titel: 'Weltweit anerkannt',
          text: 'Der WSET® ist der führende Anbieter internationaler Getränkequalifikationen und inspiriert Profis wie Enthusiasten.',
        },
        {
          icon: 'fingerprint',
          titel: 'Individuell anpassbar',
          text: 'Alle Kurse lassen sich auf persönliche Voraussetzungen und Ziele zuschneiden.',
        },
      ],
    },
  ];

  const landingpageId = await upsertLandingPage(strapi, {
    titel: 'Homepage',
    slug: 'homepage',
    abschnitte: homepageSections,
  });
  log(`Landingpage 'homepage' aktualisiert (ID ${landingpageId})`);

  log('Seeding abgeschlossen');
}

export default {
  register() {},
  async bootstrap({ strapi }: any) {
    const shouldSeed = toBool(process.env.SEED_ON_BOOT);
    if (!shouldSeed) return;
    try {
      await runSeed(strapi);
    } catch (err) {
      strapi.log.error('[seed] Fehler', err);
    }
  },
};
