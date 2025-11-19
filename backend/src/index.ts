import { runSevDeskPaymentStatusSync } from './api/bestellung/services/sevdesk-payment-sync';
import { runSeed } from './seeds';

const DISABLED_FLAGS = new Set(['0', 'false', 'no', 'off', 'disabled']);
const DEFAULT_PAYMENT_SYNC_INTERVAL_MS = 15 * 60 * 1000;

function toBool(value: unknown): boolean {
  if (value == null) return false;
  const s = String(value).trim().toLowerCase();
  return s === '1' || s === 'true' || s === 'yes' || s === 'on';
}

function parsePositiveNumber(value: unknown): number | null {
  if (value == null) {
    return null;
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }
  return parsed;
}

function shouldStartPaymentSyncInterval(): boolean {
  const flag = process.env.SEVDESK_PAYMENT_SYNC_FORCE_INTERVAL;
  if (!flag) {
    return false;
  }
  return !DISABLED_FLAGS.has(flag.trim().toLowerCase());
}

function resolvePaymentSyncIntervalMs(): number {
  const explicitMs = parsePositiveNumber(process.env.SEVDESK_PAYMENT_SYNC_INTERVAL_MS);
  if (explicitMs) {
    return Math.max(5_000, Math.floor(explicitMs));
  }
  const minutes = parsePositiveNumber(process.env.SEVDESK_PAYMENT_SYNC_INTERVAL_MINUTES);
  if (minutes) {
    return Math.max(5_000, Math.floor(minutes * 60 * 1000));
  }
  return DEFAULT_PAYMENT_SYNC_INTERVAL_MS;
}

async function runSeedIfNeeded(strapi: any) {
  if (!toBool(process.env.SEED_ON_BOOT)) {
    return;
  }

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
}

function startPaymentSyncInterval(strapi: any) {
  const intervalMs = resolvePaymentSyncIntervalMs();

  const triggerSync = async () => {
    try {
      await runSevDeskPaymentStatusSync(strapi);
    } catch (syncErr) {
      strapi.log.error('[bootstrap] SevDesk-Payment-Sync (Intervall) fehlgeschlagen.', {
        error: syncErr instanceof Error ? syncErr.message : syncErr,
      });
    }
  };

  setTimeout(triggerSync, 5_000);
  setInterval(triggerSync, intervalMs);
  strapi.log.info('[bootstrap] SevDesk-Payment-Sync Intervall gestartet.', {
    intervalMs,
  });
}

export default {
  register() {},
  async bootstrap({ strapi }: any) {
    await runSeedIfNeeded(strapi);
    if (shouldStartPaymentSyncInterval()) {
      startPaymentSyncInterval(strapi);
    }
  },
};
