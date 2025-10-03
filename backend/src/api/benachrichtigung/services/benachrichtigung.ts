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

interface TestSendOptions {
  template: TemplateEntity;
  recipient: string;
  overridePlatzhalter?: Record<string, unknown>;
}

const PLATZHALTER_REGEX = /{{\s*([\w.-]+)\s*}}/g;

function compilePlatzhalterPayload(template: TemplateEntity, overridePlatzhalter?: Record<string, unknown>) {
  const base: Record<string, unknown> = {};

  if (template.platzhalter) {
    for (const eintrag of template.platzhalter) {
      if (!eintrag?.schluessel) continue;
      if (eintrag.beispiel && typeof eintrag.beispiel !== 'undefined') {
        base[eintrag.schluessel] = eintrag.beispiel;
      }
    }
  }

  if (template.testPayload && typeof template.testPayload === 'object') {
    Object.assign(base, template.testPayload);
  }

  if (overridePlatzhalter && typeof overridePlatzhalter === 'object') {
    Object.assign(base, overridePlatzhalter);
  }

  return base;
}

function renderTemplateString(value: string | null | undefined, platzhalter: Record<string, unknown>) {
  if (!value) {
    return '';
  }
  return value.replace(PLATZHALTER_REGEX, (_match, key) => {
    const raw = platzhalter[key];
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

export default factories.createCoreService(CONTENT_UID, ({ strapi }) => ({
  async testSend(options: TestSendOptions) {
    const { template, recipient, overridePlatzhalter } = options;
    if (template.aktiv === false) {
      throw new Error('Benachrichtigung ist deaktiviert.');
    }

    const platzhalterDaten = compilePlatzhalterPayload(template, overridePlatzhalter);

    if (template.sendgridVorlagenId) {
      const response = await sendEmail(strapi, {
        to: recipient,
        templateId: template.sendgridVorlagenId,
        dynamicTemplateData: platzhalterDaten,
      });
      return { messageId: response.messageId ?? undefined, transport: 'sendgrid' };
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
    });

    return { messageId: response.messageId ?? undefined, transport: 'sendgrid' };
  },
}));
