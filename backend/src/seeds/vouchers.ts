import { nowIso } from './helpers';

type GutscheinSeed = {
  name: string;
  code: string;
  typ?: 'betrag' | 'prozent';
  wert?: number;
  betrag?: number;
  restwert?: number;
  maxRabatt?: number;
  mindesteinkauf?: number;
  maxEinloesungen?: number;
  gueltigBis?: string | Date;
  aktiv?: boolean;
};

type GutscheinTemplateSeed = {
  name: string;
  slug?: string;
  beschreibung?: string;
  versandkosten?: number;
  minBetrag?: number;
  maxBetrag?: number;
  aktiv?: boolean;
  heroDarkMode?: boolean;
  bild?: unknown;
  hintergrundbild?: unknown;
  bookingbox?: Record<string, unknown>;
  abschnitte?: Array<Record<string, unknown>>;
};

async function upsertGutschein(strapi: any, values: GutscheinSeed) {
  const canonicalCode = values.code.replace(/\s+/g, '').toUpperCase();
  const existing = await strapi.db
    .query('api::gutschein.gutschein')
    .findOne({ where: { code: canonicalCode }, select: ['id'] });
  const data: Record<string, unknown> = {
    name: values.name,
    code: canonicalCode,
    aktiv: values.aktiv ?? true,
  };

  if (values.typ) data.typ = values.typ;
  if (typeof values.wert === 'number') data.wert = values.wert;
  if (typeof values.betrag === 'number') data.betrag = values.betrag;
  if (typeof values.restwert === 'number') {
    data.restwert = values.restwert;
  } else if (typeof values.betrag === 'number' && values.typ !== 'prozent') {
    data.restwert = values.betrag;
  }
  if (typeof values.maxRabatt === 'number') data.maxRabatt = values.maxRabatt;
  if (typeof values.mindesteinkauf === 'number') data.mindesteinkauf = values.mindesteinkauf;
  if (typeof values.maxEinloesungen === 'number') data.maxEinloesungen = values.maxEinloesungen;
  if (values.gueltigBis) {
    data.gueltigBis =
      values.gueltigBis instanceof Date
        ? values.gueltigBis.toISOString().slice(0, 10)
        : values.gueltigBis;
  }

  if (existing) {
    await strapi.entityService.update('api::gutschein.gutschein', existing.id, { data });
    return existing.id as number;
  }
  const created = await strapi.entityService.create('api::gutschein.gutschein', { data });
  return created.id as number;
}

async function cleanupLegacyTemplates(strapi: any) {
  try {
    const legacyTemplates = await strapi.db
      .query('api::gutschein.gutschein')
      .findMany({ where: { code: null }, select: ['id'] });
    for (const legacy of legacyTemplates) {
      if (legacy?.id) {
        await strapi.entityService.delete('api::gutschein.gutschein', legacy.id);
      }
    }
  } catch (err) {
    strapi.log.warn('[seed] Konnte Legacy-Gutschein-Template nicht bereinigen.', {
      error: err instanceof Error ? err.message : err,
    });
  }
}

async function upsertGutscheinTemplate(strapi: any, values: GutscheinTemplateSeed) {
  const { bookingbox, abschnitte, ...rest } = values;
  const data: Record<string, unknown> = {
    name: rest.name,
    slug: rest.slug ?? 'gutscheine',
    beschreibung: rest.beschreibung ?? undefined,
    versandkosten:
      typeof rest.versandkosten !== 'undefined' && rest.versandkosten !== null
        ? String(rest.versandkosten)
        : undefined,
    minBetrag:
      typeof rest.minBetrag !== 'undefined' && rest.minBetrag !== null
        ? String(rest.minBetrag)
        : undefined,
    maxBetrag:
      typeof rest.maxBetrag !== 'undefined' && rest.maxBetrag !== null
        ? String(rest.maxBetrag)
        : undefined,
    aktiv: rest.aktiv ?? true,
    heroDarkMode: rest.heroDarkMode ?? false,
    bookingbox: bookingbox ? { ...bookingbox } : undefined,
  };
  if ('hintergrundbild' in rest) data.hintergrundbild = rest.hintergrundbild ?? undefined;
  if ('bild' in rest) data.bild = rest.bild ?? undefined;
  if (Array.isArray(abschnitte) && abschnitte.length > 0) {
    data.abschnitte = abschnitte;
  }
  if (!bookingbox) {
    delete data.bookingbox;
  }
  if (!Array.isArray(abschnitte) || abschnitte.length === 0) {
    delete data.abschnitte;
  }

  const existingSettings = await strapi.entityService.findMany(
    'api::gutscheineinstellung.gutscheineinstellung',
    {
      fields: ['id'],
      pagination: { limit: 1 },
    }
  );
  const current = Array.isArray(existingSettings) ? existingSettings[0] : existingSettings;

  if (current?.id) {
    await strapi.entityService.update('api::gutscheineinstellung.gutscheineinstellung', current.id, {
      data,
    });
    await cleanupLegacyTemplates(strapi);
    return current.id as number;
  }
  const created = await strapi.entityService.create('api::gutscheineinstellung.gutscheineinstellung', {
    data,
  });
  await cleanupLegacyTemplates(strapi);
  return created.id as number;
}

export async function seedVouchers(strapi: any, log: (msg: string) => void) {
  const vouchers: GutscheinSeed[] = [
    {
      name: 'WELCOME10',
      code: 'WELCOME10',
      typ: 'prozent',
      wert: 10,
      mindesteinkauf: 100,
      maxRabatt: 100,
      maxEinloesungen: 500,
    },
    {
      name: 'TEST-25',
      code: 'TEST-25',
      betrag: 25,
      typ: 'betrag',
      wert: 25,
      maxEinloesungen: 1,
    },
    {
      name: 'WSET50',
      code: 'WSET50',
      betrag: 50,
      typ: 'betrag',
      wert: 50,
      maxEinloesungen: 1,
    },
  ];

  for (const voucher of vouchers) {
    const id = await upsertGutschein(strapi, voucher);
    log(`Gutschein angelegt/aktualisiert: ${voucher.code} (ID ${id})`);
  }

  await upsertGutscheinTemplate(strapi, {
    name: 'Geschenkgutschein',
    slug: 'gutscheine',
    beschreibung: 'Verschenke frei wählbare Beträge für Seminare und Produkte.',
    versandkosten: 4.9,
    minBetrag: 50,
    maxBetrag: 500,
    aktiv: true,
  });
  log('Gutschein-Template aktualisiert');
}
