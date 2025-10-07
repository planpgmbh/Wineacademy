import { factories } from '@strapi/strapi';
import type { UID } from '@strapi/types';
import { sendEmail } from '../../../services/notification-email';

interface PlatzhalterDefinition {
  id?: number;
  schluessel?: string;
  beschreibung?: string;
  beispiel?: string;
}

interface TemplateEntity {
  id: number;
  name?: string;
  anwendungsfall?: string;
  layout?: 'default' | 'rechnung' | 'backoffice';
  beschreibung?: string | null;
  betreff?: string | null;
  vorschauzeile?: string | null;
  bodyHtml?: string | null;
  bodyText?: string | null;
  platzhalter?: PlatzhalterDefinition[] | null;
  testPayload?: Record<string, unknown> | null;
  sendgridVorlagenId?: string | null;
  aktiv?: boolean | null;
}

interface SendOptions {
  anwendungsfall: string;
  recipients: string[];
  platzhalter?: Record<string, unknown>;
  categories?: string[];
}

const PLATZHALTER_REGEX = /{{\s*([\w.-]+)\s*}}/g;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object') {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function flattenPayload(
  source: Record<string, unknown> | unknown[],
  prefix = '',
  target: Record<string, unknown> = {}
): Record<string, unknown> {
  if (Array.isArray(source)) {
    if (prefix) {
      target[prefix] = source;
    }
    source.forEach((entry, index) => {
      const path = prefix ? `${prefix}.${index}` : `${index}`;
      if (isPlainObject(entry) || Array.isArray(entry)) {
        flattenPayload(entry as any, path, target);
      } else {
        target[path] = entry;
      }
    });
    return target;
  }

  if (!isPlainObject(source)) {
    return target;
  }

  if (prefix) {
    target[prefix] = source;
  }

  Object.entries(source).forEach(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    if (isPlainObject(value) || Array.isArray(value)) {
      flattenPayload(value as any, path, target);
    } else {
      target[path] = value;
    }
  });

  return target;
}

function mergePlatzhalterPayload(
  base: Record<string, unknown>,
  additions: Record<string, unknown> | null | undefined,
  { overwrite = true }: { overwrite?: boolean } = {}
) {
  if (!additions || typeof additions !== 'object') {
    return;
  }
  Object.entries(additions).forEach(([key, value]) => {
    const existing = (base as any)[key];
    if (overwrite || typeof existing === 'undefined') {
      (base as any)[key] = value;
    } else if (isPlainObject(existing) && isPlainObject(value)) {
      mergePlatzhalterPayload(existing as Record<string, unknown>, value as Record<string, unknown>, {
        overwrite,
      });
    }
  });
  const flattened = flattenPayload(additions as Record<string, unknown>);
  Object.entries(flattened).forEach(([key, value]) => {
    if (overwrite || typeof base[key] === 'undefined') {
      base[key] = value;
    }
  });
}

function resolvePlatzhalterValue(platzhalter: Record<string, unknown>, key: string) {
  if (Object.prototype.hasOwnProperty.call(platzhalter, key)) {
    return platzhalter[key];
  }
  if (!key.includes('.')) {
    return undefined;
  }
  const segments = key.split('.');
  let current: any = platzhalter;
  for (const segment of segments) {
    if (current && typeof current === 'object' && segment in current) {
      current = (current as any)[segment];
    } else {
      return undefined;
    }
  }
  return current;
}

interface CompilePlatzhalterOptions {
  enableFallbacks?: boolean;
}

function compilePlatzhalterPayload(
  template: TemplateEntity,
  overridePlatzhalter?: Record<string, unknown>,
  options: CompilePlatzhalterOptions = {}
) {
  const base: Record<string, unknown> = {};

  if (overridePlatzhalter && typeof overridePlatzhalter === 'object') {
    mergePlatzhalterPayload(base, overridePlatzhalter, { overwrite: true });
  }

  if (options.enableFallbacks) {
    const fallbackData: Record<string, unknown> = {};

    if (template.testPayload && typeof template.testPayload === 'object') {
      mergePlatzhalterPayload(fallbackData, template.testPayload, { overwrite: true });
    }

    if (template.platzhalter) {
      for (const eintrag of template.platzhalter) {
        if (!eintrag?.schluessel) continue;
        if (typeof eintrag.beispiel !== 'undefined') {
          fallbackData[eintrag.schluessel] = eintrag.beispiel;
        }
      }
    }

    mergePlatzhalterPayload(base, fallbackData, { overwrite: false });
  }

  return base;
}

function renderTemplateString(value: string | null | undefined, platzhalter: Record<string, unknown>) {
  if (!value) {
    return '';
  }
  return value.replace(PLATZHALTER_REGEX, (_match, key) => {
    const raw = resolvePlatzhalterValue(platzhalter, key);
    if (raw === null || typeof raw === 'undefined') {
      return '';
    }
    if (typeof raw === 'object') {
      try {
        return JSON.stringify(raw);
      } catch (error) {
        return '';
      }
    }
    return String(raw);
  });
}

function applyLayout(layout: TemplateEntity['layout'], html: string, vorschauzeile?: string | null) {
  const normalisedHtml = html || '';
  const safeVorschauzeile = vorschauzeile ? `<span style="display:none!important;opacity:0;color:transparent;height:0;width:0;">${vorschauzeile}</span>` : '';

  switch (layout) {
    case 'rechnung':
      return `<!doctype html><html><head><meta charset="utf-8"><title>Rechnung</title></head><body style="font-family:Arial,Helvetica,sans-serif;background-color:#f6f6f6;margin:0;padding:24px;">${safeVorschauzeile}<div style="background:#ffffff;border-radius:12px;padding:32px;box-shadow:0 2px 12px rgba(0,0,0,0.08);">${normalisedHtml}</div><p style="color:#6b7280;font-size:12px;margin-top:24px;">Wine Academy Hamburg · Schlossweg 10 · 22607 Hamburg</p></body></html>`;
    case 'backoffice':
      return `<!doctype html><html><head><meta charset="utf-8"><title>Backoffice</title></head><body style="font-family:Arial,Helvetica,sans-serif;background-color:#1f2937;color:#f9fafb;margin:0;padding:32px;">${safeVorschauzeile}<div style="background:#111827;border-radius:12px;padding:24px;">${normalisedHtml}</div></body></html>`;
    case 'default':
    default:
      return `<!doctype html><html><head><meta charset="utf-8"><title>Wine Academy</title></head><body style="font-family:Arial,Helvetica,sans-serif;background-color:#f8f5f0;margin:0;padding:24px;">${safeVorschauzeile}<div style="background:#ffffff;border-radius:12px;padding:32px;box-shadow:0 1px 10px rgba(18,18,18,0.08);">${normalisedHtml}</div><p style="color:#9ca3af;font-size:12px;margin-top:24px;">Wine Academy Hamburg</p></body></html>`;
  }
}

function toPlainText(html: string) {
  return html
    .replace(/<\s*br\s*\/?\s*>/gi, '\n')
    .replace(/<\/?(p|div|tr|table|li|h[1-6])[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/\n{2,}/g, '\n\n')
    .trim();
}

const CONTENT_UID = 'api::benachrichtigung.benachrichtigung' as UID.ContentType;

async function dispatchTemplate(
  strapi: any,
  template: TemplateEntity,
  recipient: string,
  platzhalterDaten: Record<string, unknown>,
  categories?: string[]
) {
  if (template.sendgridVorlagenId) {
    const response = await sendEmail(strapi, {
      to: recipient,
      templateId: template.sendgridVorlagenId,
      dynamicTemplateData: platzhalterDaten,
      categories,
    });
    return { messageId: response.messageId ?? undefined, transport: 'sendgrid' as const };
  }

  const subject = renderTemplateString(template.betreff || template.name || 'Benachrichtigung', platzhalterDaten);
  const vorschauzeile = renderTemplateString(template.vorschauzeile ?? '', platzhalterDaten) || undefined;
  const rawHtml = renderTemplateString(template.bodyHtml ?? '', platzhalterDaten);
  const html = applyLayout(template.layout, rawHtml, vorschauzeile);
  const text = template.bodyText ? renderTemplateString(template.bodyText, platzhalterDaten) : toPlainText(rawHtml);

  const response = await sendEmail(strapi, {
    to: recipient,
    subject,
    html,
    text,
    categories,
  });

  return { messageId: response.messageId ?? undefined, transport: 'sendgrid' as const };
}

export default factories.createCoreService(CONTENT_UID, ({ strapi }) => ({
  async send(options: SendOptions) {
    const { anwendungsfall, recipients, platzhalter, categories } = options;
    const uniqueRecipients = Array.from(new Set((recipients || []).map((email) => email?.trim()).filter(Boolean)));
    if (uniqueRecipients.length === 0) {
      return [];
    }

    const templates = await strapi.entityService.findMany(CONTENT_UID, {
      filters: { anwendungsfall } as any,
      populate: { platzhalter: true } as any,
      limit: 1,
    });

    const template = (Array.isArray(templates) ? templates[0] : templates) as TemplateEntity | undefined;

    if (!template) {
      strapi.log.warn(`[benachrichtigung.send] Template nicht gefunden: ${anwendungsfall}`);
      return [];
    }

    if (template.aktiv === false) {
      strapi.log.info(`[benachrichtigung.send] Template deaktiviert, Versand übersprungen: ${anwendungsfall}`);
      return [];
    }

    const platzhalterDaten = compilePlatzhalterPayload(template, platzhalter, { enableFallbacks: false });
    const results: Array<{ recipient: string; messageId?: string; error?: string }> = [];

    for (const recipient of uniqueRecipients) {
      try {
        const response = await dispatchTemplate(strapi, template, recipient, platzhalterDaten, categories);
        results.push({ recipient, messageId: response.messageId });
      } catch (error: any) {
        const details = error?.response?.body ?? error?.message ?? String(error);
        strapi.log.error('[benachrichtigung.send] Versand fehlgeschlagen', {
          anwendungsfall,
          recipient,
          error: details,
        });
        results.push({ recipient, error: error?.message ?? String(error) });
      }
    }

    return results;
  },
}));
