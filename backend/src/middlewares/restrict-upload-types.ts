import path from 'path';
import type { Context, Next } from 'koa';

type UploadedFile = {
  mimetype?: string;
  type?: string;
  name?: string;
  originalFilename?: string;
};

const BLOCKED_EXTENSIONS = new Set([
  '.php',
  '.phtml',
  '.phar',
  '.phps',
  '.cgi',
  '.pl',
  '.py',
  '.sh',
  '.bash',
  '.zsh',
  '.exe',
  '.dll',
  '.so',
  '.bat',
  '.cmd',
  '.ps1',
  '.jar',
  '.com',
  '.scr',
  '.msi',
  '.vb',
  '.vbs',
  '.hta',
]);

const BLOCKED_MIME_FRAGMENTS = [
  'php',
  'x-httpd-php',
  'x-sh',
  'x-shellscript',
  'x-bash',
  'x-perl',
  'x-python',
  'x-msdownload',
  'x-msdos-program',
  'x-executable',
  'x-dosexec',
  'x-bat',
  'x-cmd',
  'x-powershell',
  'java-archive',
];

function collectFiles(input: unknown): UploadedFile[] {
  if (!input) {
    return [];
  }

  if (Array.isArray(input)) {
    return input.flatMap((item) => collectFiles(item));
  }

  if (typeof input === 'object') {
    const maybeFile = input as UploadedFile;
    if (
      typeof maybeFile.mimetype === 'string' ||
      typeof maybeFile.type === 'string' ||
      typeof maybeFile.originalFilename === 'string' ||
      typeof maybeFile.name === 'string'
    ) {
      return [maybeFile];
    }

    return Object.values(input as Record<string, unknown>).flatMap((item) => collectFiles(item));
  }

  return [];
}

function getFileName(file: UploadedFile): string {
  return String(file.originalFilename || file.name || '').trim();
}

function isBlockedFile(file: UploadedFile): boolean {
  const filename = getFileName(file).toLowerCase();
  const extension = path.extname(filename);

  if (extension && BLOCKED_EXTENSIONS.has(extension)) {
    return true;
  }

  const mimeType = String(file.mimetype || file.type || '').toLowerCase();
  if (!mimeType) {
    return false;
  }

  return BLOCKED_MIME_FRAGMENTS.some((fragment) => mimeType.includes(fragment));
}

export default () => {
  return async (ctx: Context, next: Next) => {
    const isUploadRoute = ctx.path.startsWith('/upload');
    const isWriteMethod = ['POST', 'PUT', 'PATCH'].includes(ctx.method.toUpperCase());

    if (isUploadRoute && isWriteMethod) {
      const files = collectFiles(ctx.request.files);
      const blockedFile = files.find((file) => isBlockedFile(file));

      if (blockedFile) {
        return ctx.badRequest(
          'Dateityp nicht erlaubt. Bitte nur sichere Medienformate wie Bilder, PDFs oder Office-Dateien hochladen.'
        );
      }
    }

    await next();
  };
};
