import sgMail, { MailDataRequired, ClientResponse } from '@sendgrid/mail';
import type { SystemSettings } from './settings';
import { getSystemSettings } from './settings';

let initialised = false;

function ensureClient() {
  if (initialised) {
    return;
  }
  const apiKey = process.env.SENDGRID_API_KEY;
  if (!apiKey) {
    throw new Error('SENDGRID_API_KEY ist nicht gesetzt.');
  }
  sgMail.setApiKey(apiKey);
  initialised = true;
}

export interface SendEmailOptions {
  to: string;
  subject?: string;
  html?: string;
  text?: string;
  templateId?: string;
  dynamicTemplateData?: Record<string, unknown>;
  categories?: string[];
  headers?: Record<string, string>;
}

export interface SendEmailResult {
  messageId?: string | null;
  response: ClientResponse;
}

function buildBaseMessage(settings: SystemSettings, options: SendEmailOptions): MailDataRequired {
  const base = {
    to: options.to,
    from: {
      email: settings.fromEmail,
      name: settings.fromName,
    },
  } as MailDataRequired;

  if (settings.replyToEmail) {
    base.replyTo = settings.replyToEmail;
  }

  if (options.headers) {
    base.headers = Object.fromEntries(
      Object.entries(options.headers).map(([key, value]) => [key, String(value)])
    );
  }

  if (options.categories) {
    base.categories = options.categories;
  }

  if (options.templateId) {
    base.templateId = options.templateId;
    if (options.dynamicTemplateData) {
      base.dynamicTemplateData = options.dynamicTemplateData;
    }
  } else {
    base.subject = options.subject ?? 'Wine Academy Benachrichtigung';
    base.html = options.html;
    if (options.text) {
      base.text = options.text;
    }
  }

  return base;
}

export async function sendEmail(strapi: any, options: SendEmailOptions): Promise<SendEmailResult> {
  ensureClient();
  const settings = await getSystemSettings(strapi);
  if (!settings.fromEmail) {
    throw new Error('Absenderadresse ist nicht konfiguriert.');
  }

  const message = buildBaseMessage(settings, options);
  const [response] = await sgMail.send(message, false);

  const messageId = Array.isArray(response?.headers?.['x-message-id'])
    ? (response.headers['x-message-id'][0] as string)
    : (response?.headers?.['x-message-id'] as string | undefined);

  return {
    messageId: messageId ?? null,
    response,
  };
}
