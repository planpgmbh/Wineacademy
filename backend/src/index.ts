import { runSeed } from './seeds';

function toBool(value: unknown): boolean {
  if (value == null) return false;
  const s = String(value).trim().toLowerCase();
  return s === '1' || s === 'true' || s === 'yes' || s === 'on';
}

export default {
  register() {},
  async bootstrap({ strapi }: any) {
    const shouldSeed = toBool(process.env.SEED_ON_BOOT);
    if (!shouldSeed) return;
    try {
      await runSeed(strapi);
    } catch (err) {
      if (err && typeof err === 'object' && 'errors' in (err as any) && Array.isArray((err as any).errors)) {
        for (const singleErr of (err as any).errors as any[]) {
          let detail = '';
          try {
            detail = JSON.stringify(singleErr, Object.getOwnPropertyNames(singleErr));
          } catch {
            detail = String(singleErr);
          }
          strapi.log.error(`[seed] Detailfehler: ${detail}`);
        }
      }
      let serialised = '';
      try {
        if (err && typeof err === 'object') {
          serialised = JSON.stringify(err, Object.getOwnPropertyNames(err));
        } else {
          serialised = String(err);
        }
      } catch {
        serialised = '[unserialisierbar]';
      }
      strapi.log.error(`[seed] Fehler-Details: ${serialised}`);
      if (err instanceof Error) {
        strapi.log.error(`[seed] Fehler: ${err.message}`);
        if (err.stack) {
          strapi.log.error(`[seed] Stacktrace: ${err.stack}`);
        }
      } else {
        strapi.log.error(`[seed] Fehler: ${String(err)}`);
      }
    }
  },
};
