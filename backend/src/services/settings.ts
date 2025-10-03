export type NotificationType = "bestellung" | "storno" | "sonstiges";

export interface NotificationRecipient {
  bezeichnung: string;
  email: string;
  typ: NotificationType;
}

export interface SystemSettings {
  fromEmail: string;
  fromName?: string;
  antwortEmail?: string;
  formattedFrom: string;
  recipients: NotificationRecipient[];
}

function parseAddress(input?: string | null): { name?: string; email?: string } {
  if (!input) {
    return {};
  }
  const match = input.match(/^\s*"?([^<>\"]+)"?\s*<([^>]+)>\s*$/);
  if (match) {
    return { name: match[1].trim(), email: match[2].trim() };
  }
  return { email: input.trim() };
}

function formatAddress(email: string, name?: string): string {
  return name && name.length > 0 ? `${name} <${email}>` : email;
}

export async function getSystemSettings(strapi: any): Promise<SystemSettings> {
  const entry = await strapi.entityService.findMany("api::einstellung.einstellung", {
    populate: { benachrichtigungen: true },
  });

  const settingsRecord = Array.isArray(entry) ? entry[0] : entry;

  const envFrom = parseAddress(process.env.EMAIL_FROM);
  const envReplyTo = parseAddress(process.env.EMAIL_REPLY_TO);

  const fromEmail = (settingsRecord?.absenderEmail as string | undefined)?.trim() || envFrom.email || "";
  const fromName = (settingsRecord?.absenderName as string | undefined)?.trim() || envFrom.name;
  const antwortEmail = (settingsRecord?.antwortEmail as string | undefined)?.trim() || envReplyTo.email || fromEmail;

  const rawRecipients = Array.isArray(settingsRecord?.benachrichtigungen)
    ? (settingsRecord.benachrichtigungen as Array<Record<string, unknown>>)
    : [];

  const recipients: NotificationRecipient[] = rawRecipients
    .map((item) => {
      const candidate = item as {
        email?: string;
        bezeichnung?: string;
        typ?: NotificationType;
        aktiv?: boolean;
      } | undefined;

      const email = candidate?.email ? candidate.email.trim() : "";
      if (!email) {
        return null;
      }
      if (candidate?.aktiv === false) {
        return null;
      }
      const bezeichnung = candidate?.bezeichnung?.trim() || email;
      const typ = candidate?.typ || "sonstiges";
      return { bezeichnung, email, typ } as NotificationRecipient;
    })
    .filter((value): value is NotificationRecipient => value !== null);

  return {
    fromEmail,
    fromName,
    antwortEmail,
    formattedFrom: formatAddress(fromEmail, fromName),
    recipients,
  };
}

export async function getNotificationRecipients(strapi: any, typ?: NotificationType): Promise<NotificationRecipient[]> {
  const settings = await getSystemSettings(strapi);
  return typ ? settings.recipients.filter((recipient) => recipient.typ === typ) : settings.recipients;
}

export function resolveFromAddress(settings: SystemSettings): string {
  return formatAddress(settings.fromEmail, settings.fromName);
}
