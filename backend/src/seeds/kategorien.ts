import { promises as fs } from 'fs';
import path from 'path';
import { nowIso, slugify } from './helpers';

type CategorySeed = {
  name: string;
  slug?: string;
  beschreibung?: string | null;
  kurzbeschreibung?: string | null;
  heroDarkMode?: boolean;
  seo?: Record<string, unknown> | null;
};

async function upsertCategory(strapi: any, values: CategorySeed) {
  const slug = values.slug ? slugify(values.slug) : slugify(values.name);
  const documentService = strapi.documents('api::kategorie.kategorie');
  const baseParams = { filters: { slug }, fields: ['documentId', 'id'] } as const;

  const existingDraft = await documentService.findFirst({ ...baseParams, status: 'draft' });
  const existingPublished = existingDraft
    ? null
    : await documentService.findFirst({ ...baseParams, status: 'published' });
  const existing = existingDraft ?? existingPublished ?? null;

  const data = {
    name: values.name,
    slug,
    beschreibung: values.beschreibung ?? null,
    kurzbeschreibung: values.kurzbeschreibung ?? null,
    heroDarkMode: values.heroDarkMode ?? false,
    seo: values.seo ?? null,
    publishedAt: nowIso(),
  };

  if (existing) {
    const updated = await documentService.update({
      documentId: existing.documentId,
      data,
      status: 'published',
    });
    return updated.id as number;
  }

  const created = await documentService.create({
    data,
    status: 'published',
  });
  return created.id as number;
}

export async function seedCategories(strapi: any, log: (msg: string) => void) {
  const categoriesDir = path.join(__dirname, 'kategorien');
  let files: string[] = [];

  try {
    files = await fs.readdir(categoriesDir);
  } catch (err) {
    log('Keine Kategorien-Dateien gefunden – überspringe Kategorien-Seeding.');
    strapi.log.warn('[seed] Kategorien konnten nicht gelesen werden.', err);
    return;
  }

  const jsonFiles = files.filter((file) => file.endsWith('.json')).sort();

  for (const file of jsonFiles) {
    const filePath = path.join(categoriesDir, file);
    try {
      const raw = await fs.readFile(filePath, 'utf-8');
      const parsed = JSON.parse(raw) as CategorySeed;
      if (!parsed?.name) {
        log(`Kategorie-Datei ${file} ohne Namen – übersprungen.`);
        continue;
      }
      const id = await upsertCategory(strapi, parsed);
      log(`Kategorie '${parsed.name}' aktualisiert (ID ${id})`);
    } catch (err) {
      strapi.log.error(`[seed] Fehler beim Verarbeiten von ${filePath}`, err);
    }
  }
}
