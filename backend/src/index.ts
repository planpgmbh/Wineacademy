// import type { Core } from '@strapi/strapi';

type UID =
  | 'api::kategorie.kategorie'
  | 'api::ort.ort'
  | 'api::seminar.seminar'
  | 'api::gutschein.gutschein'
  | 'api::produkt.produkt';

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

async function upsertCategory(strapi: any, titel: string, beschreibung?: string) {
  const existing = await strapi.db.query('api::kategorie.kategorie').findOne({ where: { titel }, select: ['id'] });
  if (existing) {
    await strapi.entityService.update('api::kategorie.kategorie', existing.id, {
      data: { beschreibung: beschreibung ?? undefined, publishedAt: nowIso() },
    });
    return existing.id as number;
  }
  const created = await strapi.entityService.create('api::kategorie.kategorie', {
    data: { titel, beschreibung: beschreibung ?? undefined, publishedAt: nowIso() },
  });
  return created.id as number;
}

async function upsertOrt(
  strapi: any,
  values: { standort: string; typ: 'vorort' | 'online'; veranstaltungsort?: string; strasse?: string; plz?: string; stadt?: string; land?: 'Deutschland' }
) {
  const existing = await strapi.db.query('api::ort.ort').findOne({ where: { standort: values.standort }, select: ['id'] });
  const data = { ...values, publishedAt: nowIso() } as any;
  if (existing) {
    await strapi.entityService.update('api::ort.ort', existing.id, { data });
    return existing.id as number;
  }
  const created = await strapi.entityService.create('api::ort.ort', { data });
  return created.id as number;
}

async function upsertSeminar(
  strapi: any,
  values: {
    seminarname: string;
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
  const existing = await strapi.db.query('api::seminar.seminar').findOne({ where: { seminarname: values.seminarname }, select: ['id', 'slug'] });
  const data: any = {
    ...values,
    slug: values.slug ? slugify(values.slug) : slugify(values.seminarname),
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

async function upsertProduct(strapi: any, values: {
  titel: string;
  slug?: string;
  kurzbeschreibung?: string;
  beschreibung?: string;
  preisNetto?: number;
  preisBrutto?: number;
  steuerSatz?: number;
  mwst?: boolean;
  gutschein?: boolean;
  aktiv?: boolean;
}) {
  const slug = values.slug ? slugify(values.slug) : slugify(values.titel);
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
  values: { titel: string; code: string; beschreibung?: string; betrag?: number; aktiv?: boolean }
) {
  const existing = await strapi.db.query('api::gutschein.gutschein').findOne({ where: { code: values.code }, select: ['id'] });
  const data: any = {
    titel: values.titel,
    beschreibung: values.beschreibung ?? undefined,
    code: values.code,
    istTemplate: false,
    aktiv: values.aktiv ?? true,
  };
  if (typeof values.betrag === 'number') {
    data.betrag = values.betrag;
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
  values: { titel: string; beschreibung?: string; minBetrag?: number; maxBetrag?: number; aktiv?: boolean }
) {
  const existing = await strapi.db.query('api::gutschein.gutschein').findOne({ where: { istTemplate: true }, select: ['id'] });
  const data: any = {
    ...values,
    istTemplate: true,
    aktiv: values.aktiv ?? true,
    publishedAt: nowIso(),
  };
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

  const categorySeeds = [
    {
      titel: 'Bourgogne',
      kurzbeschreibung: 'Über 2000 Jahre Weinbaugeschichte, einzigartiges Terroir und Savoir-Faire der Winzer.',
      beschreibung:
        'Mit 84 Appellationen, zahlreichen kleinen Erzeugern, kleinteiligen Parzellen und dem Zusammenspiel zwischen Terroir und Rebsorten bietet die Bourgogne ein unvergleichliches Entdeckungspotential. Exklusive Kursreihe bei der Wine Academy Hamburg mit Fokus auf Chardonnay, Pinot Noir und Crus.',
    },
    {
      titel: 'Masterclass',
      kurzbeschreibung: 'Vertiefende Einblicke in Regionen, Weine und Sake für Sommeliers, WSET-Studierende und Weinliebhaber.',
      beschreibung:
        'Masterclasses und Tageskurse am Vormittag oder Abend, unter der Woche und am Wochenende. Dauer von einigen Stunden bis zu einem Tag. Zusätzlich Prüfungsvorbereitungskurse für WSET und IHK Sommelier.',
    },
    {
      titel: 'Sensorik',
      kurzbeschreibung: 'Entdecke die verborgenen Nuancen des Weins und werde zum Sensorik-Profi.',
      beschreibung:
        'Kurse von Einsteiger bis Profi: Sensorik Essentials, Fortgeschrittene, Weinfehler und Blindverkostungen. Ziel ist es, Sinneswahrnehmung zu schärfen, Aromen zu erkennen und strukturierte Verkostungen durchzuführen.',
    },
    {
      titel: 'Sommelier Ausbildung',
      kurzbeschreibung: 'IHK-geprüfte Sommelier-Ausbildung mit Theorie, Praxis und Exkursionen.',
      beschreibung:
        'Fundiertes Wissen zu Weinbau, Herstellung, Geschichte und Food-Pairing sowie professionelle Verkostungs- und Servicekompetenz. Vorbereitung auf Spitzenleistungen in Gastronomie, Handel und Weingütern.',
    },
    {
      titel: 'WSET',
      kurzbeschreibung: 'International anerkannte Wein-Qualifikationen des Wine & Spirit Education Trust.',
      beschreibung:
        'Seit 1969 weltweit führender Anbieter von Abschlüssen in Wein, Spirituosen und Sake. Bei der Wine Academy Hamburg können WSET Level 1–3 in Weinen absolviert werden.',
    },
    {
      titel: 'Tastings',
      kurzbeschreibung: 'Theorie & Praxis kombiniert mit sorgfältig ausgewählten Weinen.',
      beschreibung:
        'Weintastings & Seminare in Hamburg mit Fokus auf sensorische Fähigkeiten, Wissensvertiefung und aktuelle Themen wie Blindverkostungen oder Prüfungsvorbereitung.',
    },
  ];

  const catIds: Record<string, number> = {};
  for (const category of categorySeeds) {
    const combinedBeschreibung = [category.kurzbeschreibung, category.beschreibung].filter(Boolean).join('\n\n');
    catIds[category.titel] = await upsertCategory(strapi, category.titel, combinedBeschreibung);
  }
  log(`Kategorien: ${Object.keys(catIds).join(', ')}`);

  const ortSeeds = [
    {
      standort: 'Hamburg',
      typ: 'vorort' as const,
      veranstaltungsort: 'Wine Academy Hamburg',
      strasse: 'Testweg 1',
      plz: '20000',
      stadt: 'Hamburg',
      land: 'Deutschland' as const,
    },
    {
      standort: 'Mannheim',
      typ: 'vorort' as const,
      veranstaltungsort: 'Wine Academy Mannheim',
      strasse: 'Testweg 1',
      plz: '60000',
      stadt: 'Mannheim',
      land: 'Deutschland' as const,
    },
    {
      standort: 'Online',
      typ: 'online' as const,
      veranstaltungsort: 'Online via Zoom',
      strasse: 'Testweg 1',
      plz: '99999',
      stadt: 'Remote',
      land: 'Deutschland' as const,
    },
  ];
  const ortIdByName: Record<string, number> = {};
  for (const ort of ortSeeds) {
    const id = await upsertOrt(strapi, ort);
    ortIdByName[ort.standort] = id;
  }
  log(`Orte aktualisiert: ${Object.entries(ortIdByName)
    .map(([name, id]) => `${name}=${id}`)
    .join(', ')}`);

  type TerminSeed = {
    titel: string;
    planungsstatus: 'geplant' | 'ausgebucht' | 'abgesagt';
    kapazitaet: number;
    ort: string;
    tageVersatz: number;
  };

  type SeminarSeed = {
    seminarname: string;
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
      seminarname: 'Sensorik: Essentials',
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
          titel: 'Sensorik Essentials – Hamburg',
          planungsstatus: 'geplant',
          kapazitaet: 14,
          ort: 'Hamburg',
          tageVersatz: 21,
        },
        {
          titel: 'Sensorik Essentials – Online',
          planungsstatus: 'geplant',
          kapazitaet: 40,
          ort: 'Online',
          tageVersatz: 60,
        },
      ],
    },
    {
      seminarname: 'Weinfehler – Finde den Fehler!',
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
          titel: 'Weinfehler Workshop – Hamburg',
          planungsstatus: 'geplant',
          kapazitaet: 18,
          ort: 'Hamburg',
          tageVersatz: 35,
        },
      ],
    },
    {
      seminarname: 'Wein: der Weg zum Kenner',
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
          titel: 'Der Weg zum Kenner – Hamburg',
          planungsstatus: 'geplant',
          kapazitaet: 20,
          ort: 'Hamburg',
          tageVersatz: 28,
        },
      ],
    },
    {
      seminarname: 'WSET® Level 2 Weine',
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
          titel: 'WSET Level 2 – Hamburg',
          planungsstatus: 'geplant',
          kapazitaet: 16,
          ort: 'Hamburg',
          tageVersatz: 45,
        },
        {
          titel: 'WSET Level 2 – Mannheim',
          planungsstatus: 'geplant',
          kapazitaet: 16,
          ort: 'Mannheim',
          tageVersatz: 75,
        },
      ],
    },
    {
      seminarname: 'WSET® Level 1 Weine ONLINEKURS',
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
          titel: 'WSET Level 1 – Online-Blöcke',
          planungsstatus: 'geplant',
          kapazitaet: 50,
          ort: 'Online',
          tageVersatz: 30,
        },
      ],
    },
    {
      seminarname: 'Masterclass Champagne: Essentials',
      slug: 'masterclass-champagner',
      kurzbeschreibung: 'Masterclass über Champagne: Herstellung, Terroir & Stilistik; Blindverkostung mit mind. 12 Weinen.',
      beschreibung:
        '<p>Intensiver Tageskurs über die Region Champagne: Trauben, Kellerarbeit, Assemblage, Stilistik, Einfluss von Jahrgängen & Lagen sowie Vergleich großer und kleiner Produzenten. Verkostung inkl. Blindverkostung. Für Weininteressierte und Profis, die ihre Kenntnisse über Schaumweine vertiefen möchten.</p>',
      preis: 320,
      mwst: true,
      aktiv: true,
      kategorien: ['Masterclass'],
      termine: [],
    },
    {
      seminarname: 'WSET® Level 3 Weine',
      slug: 'wset-level-3-weine',
      kurzbeschreibung: 'Aufbaukurs mit tiefem Fokus auf die wichtigsten Weine der Welt und deren wirtschaftliche Bedeutung.',
      beschreibung:
        '<p>Vertiefung der Kenntnisse aus Level 2; detaillierte Auseinandersetzung mit Regionen, Rebsorten und Produktionsmethoden. Professionelles Analysieren und Beschreiben von Weinen nach WSET SAT, Vorbereitung auf Beratung und Service.</p>',
      preis: 1850,
      mwst: true,
      aktiv: true,
      kategorien: ['WSET'],
      termine: [],
    },
    {
      seminarname: 'Assistant Sommelier (inkl. WSET® Level 2 Weine)',
      slug: 'assistant-sommelier',
      kurzbeschreibung: 'Berufsbegleitender Lehrgang für Gastronomie, Handel und Weinliebhaber inkl. WSET Level 2.',
      beschreibung:
        '<p>Fünf Kurstage mit Fokus auf Weinwissen, Service und Sensorik; Kombination mit WSET Level 2 Weine zur internationalen Qualifizierung.</p>',
      preis: 1650,
      mwst: true,
      aktiv: true,
      kategorien: ['Sommelier Ausbildung', 'WSET'],
      termine: [],
    },
    {
      seminarname: 'Sensorik Advanced',
      slug: 'sensorik-advanced',
      kurzbeschreibung: 'Aufbaukurs zur Vertiefung der Verkostungs- und Sensorikkompetenz.',
      beschreibung:
        '<p>Erweiterung der Sensorik-Skills, anspruchsvollere Weinstile und differenzierte Analysen; ideal nach „Sensorik: Essentials“.</p>',
      preis: 285,
      mwst: true,
      aktiv: true,
      kategorien: ['Sensorik'],
      termine: [],
    },
    {
      seminarname: 'Masterclass Sake',
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
          titel: 'Masterclass Sake – Hamburg',
          planungsstatus: 'geplant',
          kapazitaet: 22,
          ort: 'Hamburg',
          tageVersatz: 52,
        },
      ],
    },
  ];

  const ensureTermine = async (seminarId: number, termine: typeof seminarSeeds[number]['termine']) => {
    await strapi.db.query('api::termin.termin').deleteMany({ where: { seminar: seminarId } });
    for (const termin of termine) {
      const baseDate = new Date();
      baseDate.setDate(baseDate.getDate() + termin.tageVersatz);
      const datum = baseDate.toISOString().slice(0, 10);
      await strapi.entityService.create('api::termin.termin', {
        data: {
          titel: termin.titel,
          planungsstatus: termin.planungsstatus,
          kapazitaet: termin.kapazitaet,
          tage: [
            {
              datum,
              startzeit: '10:00:00',
              endzeit: '17:00:00',
            },
          ],
          seminar: seminarId,
          ort: ortIdByName[termin.ort],
          publishedAt: nowIso(),
        },
      });
    }
  };

  for (const seminardata of seminarSeeds) {
    const catIdsForSeminar = (seminardata.kategorien || [])
      .map((name) => catIds[name])
      .filter((id): id is number => typeof id === 'number');

    const seminarId = await upsertSeminar(strapi, {
      seminarname: seminardata.seminarname,
      slug: seminardata.slug,
      kurzbeschreibung: seminardata.kurzbeschreibung,
      beschreibung: seminardata.beschreibung,
      infos: seminardata.infos,
      preis: seminardata.preis,
      mwst: seminardata.mwst,
      aktiv: seminardata.aktiv,
      kategorien: catIdsForSeminar,
    });

    await ensureTermine(seminarId, seminardata.termine);
    log(`Seminar angelegt/aktualisiert: ${seminardata.seminarname} (ID ${seminarId})`);
  }

  const productSeeds = [
    {
      titel: 'Weinbuch Klassiker',
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
      titel: 'Verkostungsset Sensorik',
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
      titel: 'WSET® Level 1 Weine Tasting Set (klein, 2cl)',
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
      titel: 'WSET® Level 3 Weine Tasting Set (groß, 5cl)',
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
    log(`Produkt angelegt/aktualisiert: ${product.titel} (ID ${productId})`);
  }

  const voucherSeeds = [
    {
      titel: 'WELCOME10',
      code: 'WELCOME10',
      beschreibung: '10% Willkommensrabatt',
    },
    {
      titel: 'TEST-25',
      code: 'TEST-25',
      beschreibung: '25 EUR Testgutschein',
      betrag: 25,
    },
    {
      titel: 'WSET50',
      code: 'WSET50',
      beschreibung: '50 EUR auf WSET Seminare',
      betrag: 50,
    },
  ];

  for (const voucher of voucherSeeds) {
    const voucherId = await upsertGutschein(strapi, voucher);
    log(`Gutschein angelegt/aktualisiert: ${voucher.code} (ID ${voucherId})`);
  }

  await upsertGutscheinTemplate(strapi, {
    titel: 'Geschenkgutschein',
    beschreibung: 'Verschenke frei wählbare Beträge für Seminare und Produkte.',
    minBetrag: 50,
    maxBetrag: 500,
    aktiv: true,
  });
  log('Gutschein-Template aktualisiert');

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
