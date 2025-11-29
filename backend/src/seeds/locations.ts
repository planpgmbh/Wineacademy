import { nowIso } from './helpers';

export type StandortSeed = {
  name: string;
  typ: 'vorort' | 'online';
  veranstaltungsort?: string;
  strasse?: string;
  plz?: string;
  stadt?: string;
  land?: 'Deutschland';
};

async function upsertStandort(strapi: any, values: StandortSeed) {
  const existing = await strapi.db
    .query('api::standort.standort')
    .findOne({ where: { name: values.name }, select: ['id'] });
  const data = { ...values, publishedAt: nowIso() } as Record<string, unknown>;
  if (existing) {
    await strapi.entityService.update('api::standort.standort', existing.id, { data });
    return existing.id as number;
  }
  const created = await strapi.entityService.create('api::standort.standort', { data });
  return created.id as number;
}

export async function seedLocations(strapi: any, log: (msg: string) => void) {
  const seeds: StandortSeed[] = [
    {
      name: 'Hamburg',
      typ: 'vorort',
      veranstaltungsort: 'Wine Academy Hamburg',
      strasse: 'Eimsbütteler Chaussee 37',
      plz: '20259',
      stadt: 'Hamburg',
      land: 'Deutschland',
    },
    {
      name: 'Mannheim',
      typ: 'vorort',
      veranstaltungsort: 'Weinrefugium Mannheim',
      strasse: 'Seckenheimer Straße 19',
      plz: '68165',
      stadt: 'Mannheim',
      land: 'Deutschland',
    },
    {
      name: 'Digital',
      typ: 'online',
      veranstaltungsort: 'Digital',
      stadt: 'Online',
      land: 'Deutschland',
    },
  ];

  for (const seed of seeds) {
    const id = await upsertStandort(strapi, seed);
    log(`Standort aktualisiert: ${seed.name} (ID ${id})`);
  }
}
