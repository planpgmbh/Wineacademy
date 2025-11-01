import { promises as fs } from 'fs';
import path from 'path';
import { slugify } from './helpers';

type LandingPageSeed = {
  titel: string;
  slug?: string;
  abschnitte: Array<Record<string, unknown>>;
  seo?: Record<string, unknown> | null;
};

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => {
    switch (char) {
      case '&':
        return '&amp;';
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      case '"':
        return '&quot;';
      case "'":
        return '&#39;';
      default:
        return char;
    }
  });
}

function transformTextBlock(section: Record<string, unknown>): Record<string, unknown> {
  const next = { ...section } as Record<string, unknown>;
  const headlineRaw = typeof next.headline === 'string' ? next.headline.trim() : '';
  const headline = headlineRaw.toLowerCase() === 'textblock' ? '' : headlineRaw;
  const level = typeof next.headlineLevel === 'string' ? next.headlineLevel : 'h2';
  const existing = typeof next.einleitung === 'string' ? next.einleitung.trim() : '';

  delete next.headline;
  delete next.headlineLevel;

  if (headline.length === 0) {
    next.einleitung = existing.length > 0 ? existing : null;
    return next;
  }

  const safeHeadline = `<${level}>${escapeHtml(headline)}</${level}>`;
  next.einleitung = existing.length > 0 ? `${safeHeadline}\n${existing}` : safeHeadline;
  return next;
}

function transformSection(section: Record<string, unknown>): Record<string, unknown> {
  if (!section || typeof section !== 'object') {
    return section;
  }

  const component = (section as any).__component;
  if (component === 'landing.text-block') {
    return transformTextBlock(section);
  }

  const next: Record<string, unknown> = { ...section };
  for (const key of Object.keys(next)) {
    const value = next[key];
    if (Array.isArray(value)) {
      next[key] = value.map((item) => (item && typeof item === 'object' ? transformSection(item as any) : item));
    } else if (value && typeof value === 'object' && '__component' in (value as any)) {
      next[key] = transformSection(value as Record<string, unknown>);
    }
  }

  return next;
}

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
      const transformed: LandingPageSeed = {
        ...parsed,
        abschnitte: parsed.abschnitte.map((section) => transformSection(section))
      };
      const id = await upsertLandingPage(strapi, transformed);
      log(`Landingpage '${parsed.titel}' aktualisiert (ID ${id})`);
    } catch (err) {
      strapi.log.error(`[seed] Fehler beim Verarbeiten von ${filePath}`, err);
    }
  }
}
