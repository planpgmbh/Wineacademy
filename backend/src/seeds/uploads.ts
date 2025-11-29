import { promises as fs } from 'fs';
import path from 'path';

function resolveMimeType(fileName: string): string {
  const ext = path.extname(fileName).toLowerCase();
  switch (ext) {
    case '.mp4':
      return 'video/mp4';
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg';
    case '.png':
      return 'image/png';
    case '.webp':
      return 'image/webp';
    default:
      return 'application/octet-stream';
  }
}

function resolveUploadsDir(): string | null {
  const candidates = [
    path.join(__dirname, 'uploads'), // dist-Pfad
    path.join(process.cwd(), 'src', 'seeds', 'uploads'), // Quellcode-Pfad (falls Uploads nicht in dist kopiert wurden)
  ];
  for (const dir of candidates) {
    try {
      const stat = require('fs').statSync(dir);
      if (stat.isDirectory()) {
        return dir;
      }
    } catch {
      continue;
    }
  }
  return null;
}

export async function seedUploads(strapi: any, log: (msg: string) => void) {
  const uploadsDir = resolveUploadsDir();
  if (!uploadsDir) {
    log('Keine Upload-Dateien gefunden – überspringe Upload-Seeding.');
    return;
  }

  let files: string[] = [];

  try {
    files = await fs.readdir(uploadsDir);
  } catch (err) {
    log('Keine Upload-Dateien gefunden – überspringe Upload-Seeding.');
    return;
  }

  const publicUploadsDir = path.join(process.cwd(), 'public', 'uploads');
  await fs.mkdir(publicUploadsDir, { recursive: true });

  for (const file of files) {
    const filePath = path.join(uploadsDir, file);
    const stat = await fs.stat(filePath);
    if (!stat.isFile()) continue;

    const existing = await strapi.db.query('plugin::upload.file').findOne({
      where: { name: file },
      select: ['id'],
    });

    if (existing?.id) {
      log(`Upload bereits vorhanden: ${file} (ID ${existing.id})`);
      continue;
    }

    const mime = resolveMimeType(file);
    const ext = path.extname(file);
    const hash = path.basename(file, ext).replace(/[^a-zA-Z0-9_-]+/g, '_');
    const destPath = path.join(publicUploadsDir, file);

    try {
      await fs.copyFile(filePath, destPath);
    } catch {
      log(`Upload fehlgeschlagen (Copy): ${file}`);
      continue;
    }

    const created = await strapi.db.query('plugin::upload.file').create({
      data: {
        name: file,
        alternativeText: null,
        caption: null,
        width: null,
        height: null,
        formats: null,
        hash,
        ext,
        mime,
        size: Math.round((stat.size / 1024) * 100) / 100,
        sizeInBytes: stat.size,
        url: `/uploads/${file}`,
        previewUrl: null,
        provider: 'local',
        provider_metadata: null,
        folderPath: '/',
      },
    });

    if (created?.id) {
      log(`Upload angelegt: ${file} (ID ${created.id})`);
    } else {
      log(`Upload fehlgeschlagen: ${file}`);
    }
  }
}
