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
  layout?: 'kunde' | 'backoffice';
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

function applyLayout(
  layout: TemplateEntity['layout'] | undefined,
  html: string,
  options?: { vorschauzeile?: string | null; previewLink?: string | null }
) {
  const brandPrimary = '#8BB5D7';
  const brandText = '#0f172a';
  const brandMuted = '#4b5563';
  const brandBg = '#f7f7f4';
  const logoUrl = process.env.EMAIL_LOGO_URL || 'https://main.wineacademy.de/icons/WineAcademy.png';

  const normalisedHtml = html || '';
  const vorschauzeileText = options?.vorschauzeile || '';
  const safeVorschauzeile = vorschauzeileText
    ? `<span style="display:none!important;opacity:0;color:transparent;height:0;width:0;">${vorschauzeileText}</span>`
    : '';

  const previewLink =
    typeof options?.previewLink === 'string' && options.previewLink ? options.previewLink : null;

  const baseStyles = `
    body { margin:0; padding:0; background:${brandBg}; color:${brandText}; font-family:"Helvetica Neue", Arial, sans-serif; }
    h1 { font-family: Georgia, "Times New Roman", serif; font-weight:300; color:${brandText}; margin:0 0 16px; font-size:45px; line-height:1.12; }
    h2 { font-family:"Helvetica Neue", Arial, sans-serif; font-weight:700; color:${brandText}; margin:0 0 16px; font-size:24px; line-height:1.22; }
    h3 { font-family:"Helvetica Neue", Arial, sans-serif; font-weight:700; color:${brandText}; margin:0 0 16px; font-size:19px; line-height:1.25; }
    p, li, td { font-size:17px; line-height:1.65; color:${brandText}; margin:0 0 10px; }
    a { color:${brandPrimary}; text-decoration:underline; }
    small { color:${brandMuted}; }
    .wa-btn { display:inline-block; width:100%; max-width:320px; text-align:center; text-decoration:none; padding:14px 18px; border-radius:10px; font-weight:700; box-sizing:border-box; margin:16px auto 11px; }
    .wa-btn-primary { background:${brandPrimary}; color:#ffffff; border:1px solid rgba(0,0,0,0.08); }
    .wa-btn-secondary { background:#e2e3e5; color:${brandText}; border:1px solid rgba(0,0,0,0.12); }
    .wa-preview { text-align:center; font-size:12px; line-height:1.6; color:${brandMuted}; margin:14px 0 0 0; padding:12px 0; background:transparent; }
    table[data-wa-table="true"] { width:100%; border-collapse:collapse; border-spacing:0; }
    @media screen and (max-width:520px) {
      body, .wa-layout { background:#ffffff !important; }
      h1 { font-size:28px; line-height:1.2; }
      h2 { font-size:19px; line-height:1.3; }
      h3 { font-size:16px; line-height:1.35; }
      p, li, td { font-size:15px; line-height:1.6; }
      .wa-layout { padding:0 !important; }
      .wa-cell { padding:0 !important; }
      .wa-inner { padding:0 !important; margin:0 !important; }
      .wa-card { box-sizing:border-box; border:0 !important; border-radius:0 !important; box-shadow:none !important; padding:0 15px 15px !important; width:100% !important; }
      .wa-btn, .wa-btn-primary, .wa-btn-secondary { max-width:100% !important; width:100% !important; }
      .wa-preview { text-align:left !important; border-top:1px solid #e2e3e5; margin:14px 15px 0 15px; padding:12px 0; }
    }
  `;

  const cardStart = `<div class="wa-card" style="background:#ffffff;border:1px solid #d7d9dd;border-radius:32px;padding:32px 48px 34px;box-shadow:0 16px 40px rgba(0,0,0,0.06);text-align:left;">
    <img style="display:block;width:146px;height:auto;margin:0 0 30px 0;" src="${logoUrl}" alt="Wine Academy Hamburg" />`;
  const cardEnd = `</div>`;

  const kundenFooter = `
    <hr style="border:0;border-top:1px solid #e2e3e5;margin:24px 0 18px;" />
    <div style="margin-top:8px;">
      <img src="${logoUrl}" alt="Wine Academy Hamburg" style="width:54px;height:auto;display:block;margin-bottom:10px;" />
      <div style="font-size:13px;line-height:1.6;color:${brandText};">
        <div style="font-weight:700;margin-bottom:4px;">Wineacademy</div>
        Eimsbütteler Chaussee 37<br/>
        20259 Hamburg<br/>
        Tel.: 040-88 12 80 27<br/>
        post@wineacademy.de
      </div>
    </div>
  `;

  const kundenPreview =
    previewLink && previewLink.length
      ? `<div class="wa-preview">
        Wird diese E-Mail nicht korrekt angezeigt?
        <a href="${previewLink}" style="color:#7a9ec1;text-decoration:underline;">Hier öffnen</a>.
      </div>`
      : '';

  const kundenWrapper = `<!doctype html><html><head><meta charset="utf-8"><title>Wine Academy</title><style>${baseStyles}</style></head><body>${safeVorschauzeile}
    <table class="wa-layout" role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0; padding:32px 0; background:${brandBg};">
      <tr>
        <td class="wa-cell" align="center" style="padding:0 20px;">
          <div class="wa-inner" style="max-width:680px;width:100%;padding:18px 16px;margin:0 auto;">
            ${cardStart}
              ${normalisedHtml}
              ${kundenFooter}
            ${cardEnd}
            ${kundenPreview}
          </div>
        </td>
      </tr>
    </table>
  </body></html>`;

  const backofficeWrapper = `<!doctype html><html><head><meta charset="utf-8"><title>Wine Academy</title><style>${baseStyles}</style></head><body>${safeVorschauzeile}
    <table class="wa-layout" role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0; padding:32px 0; background:${brandBg};">
      <tr>
        <td class="wa-cell" align="center" style="padding:0 20px;">
          <div class="wa-inner" style="max-width:680px;width:100%;padding:18px 16px;margin:0 auto;">
            ${cardStart}
              ${normalisedHtml}
            ${cardEnd}
          </div>
        </td>
      </tr>
    </table>
  </body></html>`;

  const resolvedLayout = layout || 'kunde';
  if (resolvedLayout === 'backoffice') {
    return backofficeWrapper;
  }
  return kundenWrapper;
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
  const previewLinkValue = resolvePlatzhalterValue(platzhalterDaten, 'links.preview');
  const previewLink = typeof previewLinkValue === 'string' && previewLinkValue ? previewLinkValue : null;
  const html = applyLayout(template.layout, rawHtml, { vorschauzeile, previewLink });
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
    const previewLinkValue = resolvePlatzhalterValue(platzhalterDaten, 'links.preview');
    const previewLink = typeof previewLinkValue === 'string' && previewLinkValue ? previewLinkValue : null;
    const html = applyLayout(template.layout, rawHtml, { vorschauzeile, previewLink });
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
