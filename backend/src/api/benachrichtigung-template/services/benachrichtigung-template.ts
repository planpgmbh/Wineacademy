import { factories } from '@strapi/strapi';
import { sendEmail } from '../../../services/notification-email';

interface TokenDefinition {
  id?: number;
  schluessel?: string;
  beschreibung?: string;
  beispiel?: string;
}

interface TemplateEntity {
  id: number;
  name?: string;
  templateKey?: string;
  layout?: 'default' | 'rechnung' | 'backoffice';
  beschreibung?: string | null;
  betreff?: string | null;
  preheader?: string | null;
  bodyHtml?: string | null;
  bodyText?: string | null;
  tokens?: TokenDefinition[] | null;
  testPayload?: Record<string, unknown> | null;
  sendgridTemplateId?: string | null;
  aktiv?: boolean | null;
}

interface TestSendOptions {
  template: TemplateEntity;
  recipient: string;
  overrideTokens?: Record<string, unknown>;
}

const TOKEN_REGEX = /{{\s*([\w.-]+)\s*}}/g;

function compileTokenPayload(template: TemplateEntity, overrideTokens?: Record<string, unknown>) {
  const base: Record<string, unknown> = {};

  if (template.tokens) {
    for (const token of template.tokens) {
      if (!token?.schluessel) continue;
      if (token.beispiel && typeof token.beispiel !== 'undefined') {
        base[token.schluessel] = token.beispiel;
      }
    }
  }

  if (template.testPayload && typeof template.testPayload === 'object') {
    Object.assign(base, template.testPayload);
  }

  if (overrideTokens && typeof overrideTokens === 'object') {
    Object.assign(base, overrideTokens);
  }

  return base;
}

function renderTemplateString(value: string | null | undefined, tokens: Record<string, unknown>) {
  if (!value) {
    return '';
  }
  return value.replace(TOKEN_REGEX, (_match, key) => {
    const raw = tokens[key];
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

function applyLayout(layout: TemplateEntity['layout'], html: string, preheader?: string | null) {
  const normalisedHtml = html || '';
  const safePreheader = preheader ? `<span style="display:none!important;opacity:0;color:transparent;height:0;width:0;">${preheader}</span>` : '';

  switch (layout) {
    case 'rechnung':
      return `<!doctype html><html><head><meta charset="utf-8"><title>Rechnung</title></head><body style="font-family:Arial,Helvetica,sans-serif;background-color:#f6f6f6;margin:0;padding:24px;">${safePreheader}<div style="background:#ffffff;border-radius:12px;padding:32px;box-shadow:0 2px 12px rgba(0,0,0,0.08);">${normalisedHtml}</div><p style="color:#6b7280;font-size:12px;margin-top:24px;">Wine Academy Hamburg · Schlossweg 10 · 22607 Hamburg</p></body></html>`;
    case 'backoffice':
      return `<!doctype html><html><head><meta charset="utf-8"><title>Backoffice</title></head><body style="font-family:Arial,Helvetica,sans-serif;background-color:#1f2937;color:#f9fafb;margin:0;padding:32px;">${safePreheader}<div style="background:#111827;border-radius:12px;padding:24px;">${normalisedHtml}</div></body></html>`;
    case 'default':
    default:
      return `<!doctype html><html><head><meta charset="utf-8"><title>Wine Academy</title></head><body style="font-family:Arial,Helvetica,sans-serif;background-color:#f8f5f0;margin:0;padding:24px;">${safePreheader}<div style="background:#ffffff;border-radius:12px;padding:32px;box-shadow:0 1px 10px rgba(18,18,18,0.08);">${normalisedHtml}</div><p style="color:#9ca3af;font-size:12px;margin-top:24px;">Wine Academy Hamburg</p></body></html>`;
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

export default factories.createCoreService('api::benachrichtigung-template.benachrichtigung-template' as const, ({ strapi }) => ({
  async testSend(options: TestSendOptions) {
    const { template, recipient, overrideTokens } = options;
    if (template.aktiv === false) {
      throw new Error('Template ist deaktiviert.');
    }

    const tokenData = compileTokenPayload(template, overrideTokens);

    if (template.sendgridTemplateId) {
      const response = await sendEmail(strapi, {
        to: recipient,
        templateId: template.sendgridTemplateId,
        dynamicTemplateData: tokenData,
      });
      return { messageId: response.messageId ?? undefined, transport: 'sendgrid' };
    }

    const subject = renderTemplateString(template.betreff || template.name || 'Benachrichtigung', tokenData);
    const preheader = renderTemplateString(template.preheader ?? '', tokenData) || undefined;
    const rawHtml = renderTemplateString(template.bodyHtml ?? '', tokenData);
    const html = applyLayout(template.layout, rawHtml, preheader);
    const text = template.bodyText ? renderTemplateString(template.bodyText, tokenData) : toPlainText(rawHtml);

    const response = await sendEmail(strapi, {
      to: recipient,
      subject,
      html,
      text,
    });

    return { messageId: response.messageId ?? undefined, transport: 'sendgrid' };
  },
}));
