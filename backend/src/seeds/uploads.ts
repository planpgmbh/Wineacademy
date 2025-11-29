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

export async function seedUploads(strapi: any, log: (msg: string) => void) {
  const uploadsDir = path.join(__dirname, 'uploads');
  let files: string[] = [];

  try {
    files = await fs.readdir(uploadsDir);
  } catch (err) {
    log('Keine Upload-Dateien gefunden – überspringe Upload-Seeding.');
    return;
  }

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
    const uploaded = await strapi
      .plugin('upload')
      .service('upload')
      .upload({
        data: {},
        files: {
          path: filePath,
          name: file,
          type: mime,
          size: stat.size,
        },
      });

    if (Array.isArray(uploaded) && uploaded[0]?.id) {
      log(`Upload angelegt: ${file} (ID ${uploaded[0].id})`);
    } else {
      log(`Upload fehlgeschlagen: ${file}`);
    }
  }
}
