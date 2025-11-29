import { promises as fs } from 'fs';
import path from 'path';
import { slugify } from './helpers';

type LandingPageSeed = {
  titel: string;
  slug?: string;
  abschnitte: Array<Record<string, unknown>>;
  seo?: Record<string, unknown> | null;
};

async function findUploadIdByName(strapi: any, name: string): Promise<number | null> {
  const file = await strapi.db.query('plugin::upload.file').findOne({
    where: { name },
    select: ['id'],
  });
  return file?.id ?? null;
}

function extractSlug(value: unknown): string | null {
  if (typeof value === 'string') {
    return value.trim().length > 0 ? value.trim() : null;
  }
  if (value && typeof value === 'object') {
    const slug = (value as any).slug ?? (value as any).name ?? null;
    if (typeof slug === 'string' && slug.trim().length > 0) {
      return slug.trim();
    }
  }
  return null;
}

async function findCategoryIdBySlug(strapi: any, value: string | null | undefined): Promise<number | null> {
  if (typeof value !== 'string' || value.trim().length === 0) return null;
  const slug = slugify(value);
  if (!slug || slug.length === 0) return null;
  const documentService = strapi.documents('api::kategorie.kategorie');
  const found = await documentService.findFirst({
    filters: { slug },
    status: 'published',
    fields: ['id'],
  });
  return found?.id ?? null;
}

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

function transformSection(section: Record<string, unknown>): Record<string, unknown> {
  if (!section || typeof section !== 'object') {
    return section;
  }

  const component = (section as any).__component;
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

async function transformSectionWithMedia(
  strapi: any,
  section: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const transformed = transformSection(section);

  if (transformed.__component === 'landing.hero') {
    const hero = { ...transformed } as Record<string, any>;
    // Video component: map string -> upload id
    if (hero.video) {
      const video = { ...hero.video };
      if (typeof video.video === 'string' && video.video.trim().length > 0) {
        const mediaId = await findUploadIdByName(strapi, video.video.trim());
        video.video = mediaId ?? null;
      }
      if (typeof video.hintergrundbild === 'string' && video.hintergrundbild.trim().length > 0) {
        const mediaId = await findUploadIdByName(strapi, video.hintergrundbild.trim());
        video.hintergrundbild = mediaId ?? null;
      }
      hero.video = video;
    }
    // Bildergalerie: map string names to ids
    if (hero.bildergalerie && Array.isArray(hero.bildergalerie.bilder)) {
      const bilder: any[] = [];
      for (const item of hero.bildergalerie.bilder) {
        if (typeof item === 'string') {
          const mediaId = await findUploadIdByName(strapi, item.trim());
          bilder.push(mediaId ?? null);
        } else {
          bilder.push(item);
        }
      }
      hero.bildergalerie = { ...hero.bildergalerie, bilder };
    }
    return hero;
  }

  if (transformed.__component === 'landing.card-grid') {
    const grid = { ...transformed } as Record<string, any>;
    if (Array.isArray(grid.karten)) {
      const mapped: any[] = [];
      for (const card of grid.karten) {
        if (!card || typeof card !== 'object') {
          mapped.push(card);
          continue;
        }
        const nextCard: Record<string, any> = { ...card };
        if (typeof nextCard.backgroundImage === 'string' && nextCard.backgroundImage.trim().length > 0) {
          const mediaId = await findUploadIdByName(strapi, nextCard.backgroundImage.trim());
          nextCard.backgroundImage = mediaId ?? null;
        }
        if ('seminarfinderKategorie' in nextCard) {
          const relation = nextCard.seminarfinderKategorie;
          const slug = extractSlug(relation);
          nextCard.seminarfinderKategorie = await findCategoryIdBySlug(strapi, slug);
        }
        mapped.push(nextCard);
      }
      grid.karten = mapped;
    }
    return grid;
  }

  if (transformed.__component === 'landing.seminar-liste') {
    const list = { ...transformed } as Record<string, any>;
    if ('seminarkategorie' in list) {
      const relation = list.seminarkategorie;
      const slug = extractSlug(relation);
      list.seminarkategorie = await findCategoryIdBySlug(strapi, slug);
    }
    return list;
  }

  if (transformed.__component === 'landing.seminar-finder') {
    const finder = { ...transformed } as Record<string, any>;
    if ('standardKategorie' in finder) {
      const relation = finder.standardKategorie;
      const slug = extractSlug(relation);
      finder.standardKategorie = await findCategoryIdBySlug(strapi, slug);
    }
    if (Array.isArray(finder.sichtbareFilter)) {
      const mapped: number[] = [];
      for (const entry of finder.sichtbareFilter) {
        const slug = extractSlug(entry);
        const id = await findCategoryIdBySlug(strapi, slug);
        if (id) {
          mapped.push(id);
        }
      }
      finder.sichtbareFilter = mapped;
    }
    return finder;
  }

  return transformed;
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
      const transformedSections: Array<Record<string, unknown>> = [];
      for (const section of parsed.abschnitte) {
        transformedSections.push(await transformSectionWithMedia(strapi, section));
      }
      const transformed: LandingPageSeed = {
        ...parsed,
        abschnitte: transformedSections
      };
      const id = await upsertLandingPage(strapi, transformed);
      log(`Landingpage '${parsed.titel}' aktualisiert (ID ${id})`);
    } catch (err) {
      strapi.log.error(`[seed] Fehler beim Verarbeiten von ${filePath}`, err);
    }
  }
}
