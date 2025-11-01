import { promises as fs } from 'fs';
import path from 'path';
import { nowIso, slugify } from './helpers';

type SeminarTab = {
  titel: string;
  inhalt?: string | null;
};

type SeminarSeed = {
  name: string;
  slug?: string;
  kurzbeschreibung?: string | null;
  beschreibung?: string | null;
  preis?: string | null;
  mwst?: boolean | null;
  kapazitaet?: number | null;
  heroDarkMode?: boolean;
  aktiv?: boolean;
  bookingbox?: {
    topline?: string | null;
    headline?: string | null;
    body?: string | null;
  } | null;
  seminarinhalte?: SeminarTab[] | null;
  seo?: Record<string, unknown> | null;
  kategorien?: string[];
};

async function resolveCategoryConnections(strapi: any, categorySlugs: string[]) {
  if (!Array.isArray(categorySlugs) || categorySlugs.length === 0) {
    return { connections: [], missing: [] as string[] };
  }

  const uniqueSlugs = Array.from(new Set(categorySlugs.map((slug) => slugify(slug))));
  const categoryDocuments = await strapi.documents('api::kategorie.kategorie').findMany({
    filters: { slug: { $in: uniqueSlugs } },
    status: 'published',
    fields: ['documentId', 'slug'],
  });

  const connections = [];
  const seen = new Set<string>();
  for (const category of categoryDocuments ?? []) {
    if (!category?.documentId) continue;
    const normalised = slugify(category.slug);
    seen.add(normalised);
    connections.push({ documentId: category.documentId });
  }

  const missing = uniqueSlugs.filter((slug) => !seen.has(slug));
  return { connections, missing };
}

async function upsertSeminar(strapi: any, values: SeminarSeed, log: (msg: string) => void) {
  const slug = values.slug ? slugify(values.slug) : slugify(values.name);
  const documentService = strapi.documents('api::seminar.seminar');
  const baseParams = { filters: { slug }, fields: ['documentId', 'id'] } as const;

  const existingDraft = await documentService.findFirst({ ...baseParams, status: 'draft' });
  const existingPublished = existingDraft
    ? null
    : await documentService.findFirst({ ...baseParams, status: 'published' });
  const existing = existingDraft ?? existingPublished ?? null;

  const seminarTabs =
    Array.isArray(values.seminarinhalte) && values.seminarinhalte.length > 0
      ? values.seminarinhalte.map((tab) => ({
          titel: tab.titel,
          inhalt: tab.inhalt ?? '',
        }))
      : undefined;

  const bookingbox =
    values.bookingbox && Object.values(values.bookingbox).some((entry) => entry != null && entry !== '')
      ? {
          topline: values.bookingbox.topline ?? null,
          headline: values.bookingbox.headline ?? null,
          body: values.bookingbox.body ?? null,
        }
      : null;

  const { connections: categoryConnections, missing } = await resolveCategoryConnections(
    strapi,
    values.kategorien ?? []
  );

  if (missing.length > 0) {
    log(
      `Seminar '${values.name}' – Kategorien nicht gefunden: ${missing
        .map((slugItem) => `'${slugItem}'`)
        .join(', ')}`
    );
  }

  const data: Record<string, unknown> = {
    name: values.name,
    slug,
    kurzbeschreibung: values.kurzbeschreibung ?? null,
    beschreibung: values.beschreibung ?? null,
    preis: values.preis ?? null,
    mwst: typeof values.mwst === 'boolean' ? values.mwst : values.mwst == null ? null : Boolean(values.mwst),
    kapazitaet: typeof values.kapazitaet === 'number' ? values.kapazitaet : null,
    heroDarkMode: values.heroDarkMode ?? false,
    aktiv: values.aktiv ?? true,
    bookingbox: bookingbox ?? undefined,
    seminarinhalte: seminarTabs ?? undefined,
    seo: values.seo ?? null,
    kategorien: { set: categoryConnections },
    publishedAt: nowIso(),
  };

  if (!bookingbox) {
    delete data.bookingbox;
  }
  if (!seminarTabs) {
    delete data.seminarinhalte;
  }

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

export async function seedSeminars(strapi: any, log: (msg: string) => void) {
  const seminarsDir = path.join(__dirname, 'seminare');
  let files: string[] = [];

  try {
    files = await fs.readdir(seminarsDir);
  } catch (err) {
    log('Keine Seminar-Dateien gefunden – überspringe Seminar-Seeding.');
    strapi.log.warn('[seed] Seminare konnten nicht gelesen werden.', err);
    return;
  }

  const jsonFiles = files.filter((file) => file.endsWith('.json')).sort();

  for (const file of jsonFiles) {
    const filePath = path.join(seminarsDir, file);
    try {
      const raw = await fs.readFile(filePath, 'utf-8');
      const parsed = JSON.parse(raw) as SeminarSeed;
      if (!parsed?.name) {
        log(`Seminar-Datei ${file} ohne Namen – übersprungen.`);
        continue;
      }
      const id = await upsertSeminar(strapi, parsed, log);
      log(`Seminar '${parsed.name}' aktualisiert (ID ${id})`);
    } catch (err) {
      strapi.log.error(`[seed] Fehler beim Verarbeiten von ${filePath}`, err);
    }
  }
}
