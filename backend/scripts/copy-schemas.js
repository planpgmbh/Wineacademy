#!/usr/bin/env node

/**
 * Kopiert Build-Artefakte, die von Strapi im TS-Build nicht automatisch übernommen werden.
 * Aktuell wird der Inhalt von `src/plugins` nach `dist/src/plugins` gespiegelt,
 * damit lokale Plugins (z. B. Custom Fields) auch in der Production-Umgebung vorliegen.
 */

const fs = require('fs');
const path = require('path');

const projectRoot = path.join(__dirname, '..');
const sourcePluginsDir = path.join(projectRoot, 'src', 'plugins');
const targetPluginsDir = path.join(projectRoot, 'dist', 'src', 'plugins');

function copyDirRecursive(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  fs.cpSync(src, dest, { recursive: true, force: true });
}

if (fs.existsSync(sourcePluginsDir)) {
  try {
    copyDirRecursive(sourcePluginsDir, targetPluginsDir);
    console.log('copy-schemas: plugins kopiert');
  } catch (error) {
    console.error('copy-schemas: Fehler beim Kopieren der Plugins', error);
    process.exitCode = 1;
  }
} else {
  console.log('copy-schemas: keine Plugins gefunden');
}
