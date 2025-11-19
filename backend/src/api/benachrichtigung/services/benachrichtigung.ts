import { factories } from '@strapi/strapi';
import type { UID } from '@strapi/types';
import { sendEmail } from '../../../services/notification-email';
import { getSystemSettings } from '../../../services/settings';

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
  const brandPrimary = '#8BB5D7';
  const brandText = '#0f172a';
  const brandMuted = '#4b5563';
  const brandBg = '#f7f7f4';
  const logoUrl = process.env.EMAIL_LOGO_URL || 'https://wineacademy.plan-p.de/icons/WineAcademy.png';

  const normalisedHtml = html || '';
  const safeVorschauzeile = vorschauzeile
    ? `<span style="display:none!important;opacity:0;color:transparent;height:0;width:0;">${vorschauzeile}</span>`
    : '';

  const baseStyles = `
    body { margin:0; padding:0; background:${brandBg}; color:${brandText}; font-family:"Helvetica Neue", Arial, sans-serif; }
    h1, h2, h3 { font-family: Georgia, "Times New Roman", serif; font-weight:300; color:${brandText}; margin:0 0 16px; }
    h1 { font-size:32px; line-height:1.15; }
    h2 { font-size:26px; line-height:1.2; }
    h3 { font-size:22px; line-height:1.25; }
    p, li, td { font-size:16px; line-height:1.6; color:${brandText}; }
    a { color:${brandPrimary}; text-decoration:underline; }
    small { color:${brandMuted}; }
  `;

  const header = `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0; padding:0; background:${brandBg};">
      <tr>
        <td align="center" style="padding:28px 18px 16px;">
          <table role="presentation" cellpadding="0" cellspacing="0" width="640" style="max-width:640px;">
            <tr>
              <td style="padding:12px 0; text-align:left;">
                <a href="https://wineacademy.plan-p.de" style="text-decoration:none; color:${brandText}; font-weight:600; font-size:15px;">
                  <img src="${logoUrl}" alt="Wine Academy" width="180" style="max-width:180px; height:auto; display:block; margin:0 0 8px;" />
                </a>
              </td>
              <td style="text-align:right; font-size:13px; color:${brandMuted}; font-family:'Helvetica Neue', Arial, sans-serif;">
                ${vorschauzeile ? vorschauzeile : ''}
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  `;

  const containerStart = `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${brandBg}; margin:0; padding:0;">
      <tr>
        <td align="center" style="padding:0 18px 32px;">
          <table role="presentation" cellpadding="0" cellspacing="0" width="640" style="max-width:640px; background:#ffffff; border-radius:14px; border:1px solid #e5e7eb; box-shadow:0 10px 35px rgba(0,0,0,0.06); overflow:hidden;">
            <tr>
              <td style="padding:28px 26px 16px;">
  `;

  const containerEnd = `
              </td>
            </tr>
          </table>
          <table role="presentation" cellpadding="0" cellspacing="0" width="640" style="max-width:640px; margin-top:18px;">
            <tr>
              <td style="text-align:left; font-size:12px; color:${brandMuted}; font-family:'Helvetica Neue', Arial, sans-serif;">
                Wine Academy Hamburg · Schlossweg 10 · 22607 Hamburg
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  `;

  switch (layout) {
    case 'rechnung':
      return `<!doctype html><html><head><meta charset="utf-8"><title>Rechnung</title><style>${baseStyles}</style></head><body>${safeVorschauzeile}${header}${containerStart}${normalisedHtml}${containerEnd}</body></html>`;
    case 'backoffice':
      return `<!doctype html><html><head><meta charset="utf-8"><title>Backoffice</title><style>${baseStyles}</style></head><body>${safeVorschauzeile}${header}${containerStart}${normalisedHtml}${containerEnd}</body></html>`;
    case 'default':
    default:
      return `<!doctype html><html><head><meta charset="utf-8"><title>Wine Academy</title></head><body style="margin:0;padding:0;background:#ffffff;font-family:Arial,Helvetica,sans-serif;">${safeVorschauzeile}${normalisedHtml}</body></html>`;
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

  return { messageId: response.messageId ?? undefined, transport: 'smtp' as const };
}

export default factories.createCoreService(CONTENT_UID, ({ strapi }) => ({
  async render(options: { template: TemplateEntity; platzhalter?: Record<string, unknown> }) {
    const { template, platzhalter } = options;
    const platzhalterDaten = compilePlatzhalterPayload(template, platzhalter, { enableFallbacks: false });
    const subject = renderTemplateString(template.betreff || template.name || 'Benachrichtigung', platzhalterDaten);
    const vorschauzeile = renderTemplateString(template.vorschauzeile ?? '', platzhalterDaten) || undefined;
    const rawHtml = renderTemplateString(template.bodyHtml ?? '', platzhalterDaten);
    const html = applyLayout(template.layout, rawHtml, vorschauzeile);
    const text = template.bodyText ? renderTemplateString(template.bodyText, platzhalterDaten) : toPlainText(rawHtml);
    return { subject, html, text };
  },
  async send(options: SendOptions) {
    const { anwendungsfall, recipients, platzhalter, categories } = options;
    const uniqueRecipients = Array.from(new Set((recipients || []).map((email) => email?.trim()).filter(Boolean)));
    if (uniqueRecipients.length === 0) {
      return [];
    }

    const templates = await strapi.entityService.findMany(CONTENT_UID, {
      filters: { anwendungsfall } as any,
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

    const settings = await getSystemSettings(strapi);
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
          stack: error?.stack,
          transportError: {
            code: error?.code,
            response: error?.response,
            responseCode: error?.responseCode,
            command: error?.command,
            rejected: error?.rejected,
            envelope: error?.envelope,
          },
          emailDebug: {
            from: settings?.fromEmail,
            replyTo: settings?.antwortEmail,
            categories,
          },
        });
        results.push({ recipient, error: error?.message ?? String(error) });
      }
    }

    return results;
  },
}));
