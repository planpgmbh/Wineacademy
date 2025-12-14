export type UID =
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

export const nowIso = () => new Date().toISOString();

export function slugify(input: string): string {
  return input
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
}

export async function upsertSingleType(strapi: any, uid: UID, data: Record<string, unknown>) {
  const existing = await strapi.db.query(uid).findOne({ select: ['id'] });
  if (existing?.id) {
    const updated = await strapi.entityService.update(uid, existing.id, { data });
    return updated.id as number;
  }
  const created = await strapi.entityService.create(uid, { data });
  return created.id as number;
}

export async function ensureAuditFields(strapi: any, tables: string[]) {
  if (!Array.isArray(tables) || tables.length === 0) return;

  const adminUser = await strapi.db
    .query('admin::user')
    .findOne({ select: ['id'], orderBy: { id: 'asc' } });

  if (!adminUser?.id) {
    strapi.log.warn('[seed] Kein Admin-Benutzer gefunden – createdBy/updatedBy bleiben leer.');
    return;
  }

  const knex = strapi.db.connection;
  for (const table of tables) {
    try {
      await knex(table)
        .whereNull('created_by_id')
        .update({ created_by_id: adminUser.id, updated_by_id: adminUser.id });
    } catch (err) {
      strapi.log.warn(`[seed] Konnte Audit-Felder für Tabelle "${table}" nicht setzen.`, {
        error: err instanceof Error ? err.message : err,
      });
    }
  }
}
