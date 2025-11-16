import nodemailer, { type Transporter } from 'nodemailer';
import type { SystemSettings } from './settings';
import { getSystemSettings } from './settings';

let transporter: Transporter | null = null;

function isTransportEnabled(): boolean {
  const flag = process.env.EMAIL_TRANSPORT_ENABLED;
  if (!flag) {
    return true;
  }
  const normalised = flag.trim().toLowerCase();
  return !['0', 'false', 'no', 'off', 'disabled'].includes(normalised);
}

export interface SendEmailOptions {
  to: string;
  subject?: string;
  html?: string;
  text?: string;
  categories?: string[];
  headers?: Record<string, string>;
}

export interface SendEmailResult {
  messageId?: string | null;
  response: string | undefined;
}

function toBoolean(value: string | undefined, defaultValue: boolean): boolean {
  if (typeof value === 'undefined') {
    return defaultValue;
  }
  const normalised = value.trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalised)) {
    return true;
  }
  if (['0', 'false', 'no', 'off'].includes(normalised)) {
    return false;
  }
  return defaultValue;
}

function ensureTransport(): Transporter {
  if (transporter) {
    return transporter;
  }

  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const secure = toBoolean(process.env.SMTP_SECURE, port === 465);
  const user = process.env.SMTP_USER || process.env.SMTP_USERNAME;
  const pass = process.env.SMTP_PASS || process.env.SMTP_PASSWORD;
  const allowSelfSigned = toBoolean(process.env.SMTP_ALLOW_SELF_SIGNED, false);
  const requireTLS = toBoolean(process.env.SMTP_REQUIRE_TLS, false);

  if (!host) {
    throw new Error('SMTP_HOST ist nicht gesetzt.');
  }

  transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    requireTLS,
    auth: user ? { user, pass } : undefined,
    tls: allowSelfSigned ? { rejectUnauthorized: false } : undefined,
  });

  return transporter;
}

function buildBaseMessage(settings: SystemSettings, options: SendEmailOptions) {
  const base = {
    to: options.to,
    from: {
      address: settings.fromEmail,
      name: settings.fromName,
    },
  } as {
    to: string;
    from: { address: string; name?: string };
    replyTo?: string;
    subject?: string;
    html?: string;
    text?: string;
    headers?: Record<string, string>;
  };

  if (settings.antwortEmail) {
    base.replyTo = settings.antwortEmail;
  }

  base.headers = base.headers ?? {};

  if (options.headers) {
    base.headers = {
      ...base.headers,
      ...Object.fromEntries(Object.entries(options.headers).map(([key, value]) => [key, String(value)])),
    };
  }

  if (options.categories) {
    base.headers['X-Categories'] = options.categories.join(',');
  }

  base.subject = options.subject ?? 'Wine Academy Benachrichtigung';
  base.html = options.html;
  if (options.text) {
    base.text = options.text;
  }

  return base;
}

export async function sendEmail(strapi: any, options: SendEmailOptions): Promise<SendEmailResult> {
  if (!isTransportEnabled()) {
    if (strapi?.log?.info) {
      strapi.log.info('E-Mail-Versand deaktiviert, Nachricht wird nicht gesendet.', {
        to: options.to,
        subject: options.subject,
      });
    }

    return {
      messageId: null,
      response: 'EMAIL_TRANSPORT_ENABLED=false',
    };
  }

  const transport = ensureTransport();
  const settings = await getSystemSettings(strapi);
  if (!settings.fromEmail) {
    throw new Error('Absenderadresse ist nicht konfiguriert.');
  }

  const message = buildBaseMessage(settings, options);
  const result = await transport.sendMail(message);

  return {
    messageId: result.messageId ?? null,
    response: typeof result.response === 'string' ? result.response : undefined,
  };
}
