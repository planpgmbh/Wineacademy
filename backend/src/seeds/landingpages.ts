import { promises as fs } from 'fs';
import path from 'path';
import { slugify } from './helpers';

type LandingPageSeed = {
  titel: string;
  slug?: string;
  abschnitte: Array<Record<string, unknown>>;
  seo?: Record<string, unknown> | null;
};

async function upsertLandingPage(strapi: any, values: LandingPageSeed) {
  const slug = values.slug ? slugify(values.slug) : slugify(values.titel);
  const documentService = strapi.documents('api::landingpage.landingpage');
  const baseParams = { filters: { slug }, fields: ['documentId', 'id'] } as const;
  const existingDraft = await documentService.findFirst({ ...baseParams, status: 'draft' });
  const existingPublished = existingDraft
    ? null
    : await documentService.findFirst({ ...baseParams, status: 'published' });
  const existing = existingDraft ?? existingPublished ?? null;

  const data = {
    titel: values.titel,
    slug,
    abschnitte: values.abschnitte,
    seo: values.seo ?? null,
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

export async function seedLandingPages(strapi: any, log: (msg: string) => void) {
  const landingpagesDir = path.join(__dirname, 'landingpages');
  let files: string[] = [];
  try {
    files = await fs.readdir(landingpagesDir);
  } catch (err) {
    log('Keine Landingpage-Dateien gefunden – überspringe Landingpage-Seeding.');
    strapi.log.warn('[seed] Landingpages konnten nicht gelesen werden.', err);
    return;
  }

  const jsonFiles = files.filter((file) => file.endsWith('.json')).sort();

  for (const file of jsonFiles) {
    const filePath = path.join(landingpagesDir, file);
    try {
      const raw = await fs.readFile(filePath, 'utf-8');
      const parsed = JSON.parse(raw) as LandingPageSeed;
      if (!parsed?.titel || !Array.isArray(parsed.abschnitte)) {
        log(`Landingpage-Datei ${file} hat kein gültiges Format und wird übersprungen.`);
        continue;
      }
      const id = await upsertLandingPage(strapi, parsed);
      log(`Landingpage '${parsed.titel}' aktualisiert (ID ${id})`);
    } catch (err) {
      strapi.log.error(`[seed] Fehler beim Verarbeiten von ${filePath}`, err);
    }
  }
}
