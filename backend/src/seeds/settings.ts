type EinstellungSeed = {
  absenderName?: string;
  absenderEmail: string;
  antwortEmail?: string;
  benachrichtigungen?: Array<{
    bezeichnung: string;
    email: string;
    typ: 'bestellung' | 'storno' | 'sonstiges';
  }>;
};

async function upsertEinstellungen(strapi: any, values: EinstellungSeed) {
  const existing = await strapi.db.query('api::einstellung.einstellung').findOne({ select: ['id'] });

  const data: Record<string, unknown> = {
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

export async function seedSettings(strapi: any, log: (msg: string) => void) {
  const einstellungenId = await upsertEinstellungen(strapi, {
    absenderName: 'Wine Academy Hamburg',
    absenderEmail: 'philipp@plan-p.com',
    antwortEmail: 'support@wineacademy.de',
    benachrichtigungen: [
      { bezeichnung: 'Backoffice Bestellungen', email: 'philipp@plan-p.com', typ: 'bestellung' },
      { bezeichnung: 'Storno-Team', email: 'philipp@plan-p.com', typ: 'storno' },
      { bezeichnung: 'Operations', email: 'philipp@plan-p.com', typ: 'sonstiges' },
    ],
  });
  log(`Einstellungen aktualisiert (ID ${einstellungenId})`);
}
