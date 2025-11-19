import { nowIso } from './helpers';

type NotificationSeed = {
  name: string;
  anwendungsfall:
    | 'bestellbestaetigung'
    | 'zahlungsbestaetigung'
    | 'rechnung_gutschein'
    | 'backoffice_benachrichtigung'
    | 'storno_bestaetigung'
    | 'storno_backoffice';
  layout?: 'default' | 'rechnung' | 'backoffice';
  beschreibung?: string;
  betreff: string;
  vorschauzeile?: string;
  bodyHtml?: string;
  bodyText?: string;
};

async function upsertBenachrichtigung(strapi: any, values: NotificationSeed) {
  const existing = await strapi.db
    .query('api::benachrichtigung.benachrichtigung')
    .findOne({ where: { anwendungsfall: values.anwendungsfall }, select: ['id'] });

  const data: Record<string, unknown> = {
    name: values.name,
    anwendungsfall: values.anwendungsfall,
    layout: values.layout ?? 'default',
    beschreibung: values.beschreibung ?? undefined,
    betreff: values.betreff,
    vorschauzeile: values.vorschauzeile ?? undefined,
    bodyHtml: values.bodyHtml ?? undefined,
    bodyText: values.bodyText ?? undefined,
    aktiv: true,
    publishedAt: nowIso(),
  };

  if (existing) {
    await strapi.entityService.update('api::benachrichtigung.benachrichtigung', existing.id, { data });
    return existing.id as number;
  }
  const created = await strapi.entityService.create('api::benachrichtigung.benachrichtigung', { data });
  return created.id as number;
}

export async function seedNotifications(strapi: any, log: (msg: string) => void) {
  const notificationSeeds: NotificationSeed[] = [
    {
      name: 'Bestellbestätigung',
      anwendungsfall: 'bestellbestaetigung',
      layout: 'default',
      beschreibung: 'Kundenmail direkt nach Checkout.',
      betreff: 'Wir haben deine Bestellung {{bestellung.bestellnummer}} erhalten',
      vorschauzeile: 'Danke für deine Buchung bei der Wine Academy.',
      bodyHtml: `<div style="background:#f8f8f8;padding:24px 0;">
  <div style="max-width:680px;margin:0 auto;padding:16px 14px;">
    <div style="background:#ffffff;border:1px solid #d7d9dd;border-radius:32px;padding:32px 24px 34px;box-shadow:0 16px 40px rgba(0,0,0,0.06);">
      <img style="display:block;width:146px;height:auto;margin:0 0 30px 0;" src="{{links.logo}}" alt="Wine Academy Hamburg" />
      <h1 style="font-family:'SerifbabeAlpha',Georgia,serif;font-size:46px;line-height:1.08;font-weight:300;letter-spacing:-0.01em;margin:0 0 18px 0;color:#1c1b1a;">Deine Bestellung</h1>
      <hr style="border:0;border-top:1px solid #e2e3e5;margin:18px 0 22px;" />
      <p style="font-weight:700;color:#111110;margin:0 0 6px 0;font-size:17px;line-height:1.5;">Hallo {{kunde.vorname}},</p>
      <p style="font-size:16px;color:#111110;line-height:1.55;margin:0 0 14px 0;">wir haben deine Bestellung {{bestellung.bestellnummer}} erhalten. Danke für dein Vertrauen in die Wine Academy Hamburg.</p>

      <hr style="border:0;border-top:1px solid #e2e3e5;margin:18px 0 18px;" />
      <h2 style="font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:22px;line-height:1.25;font-weight:700;letter-spacing:-0.01em;margin:0 0 12px 0;color:#111110;">Bestellübersicht</h2>
      <div style="margin:0 0 10px 0;">{{bestellung.positionenTableHtml}}</div>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:12px 0 12px 0;color:#111110;font-weight:700;font-size:17px;">
        <tr>
          <td style="padding:12px 0;border-top:1px solid #e2e3e5;border-bottom:1px solid #e2e3e5;text-align:left;">Gesamtbetrag</td>
          <td style="padding:12px 0;border-top:1px solid #e2e3e5;border-bottom:1px solid #e2e3e5;text-align:right;white-space:nowrap;">{{bestellung.summeBrutto}}</td>
        </tr>
      </table>
      <a href="{{links.rechnung}}" style="display:inline-block;background:#8bb5d7;color:#ffffff;text-decoration:none;padding:14px 18px;border-radius:10px;font-weight:700;font-size:16px;margin:12px 0 10px;border:1px solid rgba(0,0,0,0.08);">Rechnung herunterladen</a>
      <hr style="border:0;border-top:1px solid #e2e3e5;margin:18px 0 22px;" />

      <h2 style="font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:22px;line-height:1.25;font-weight:700;letter-spacing:-0.01em;margin:0 0 12px 0;color:#111110;">Termine</h2>
      {{bestellung.termineHtml}}

      <hr style="border:0;border-top:1px solid #e2e3e5;margin:22px 0 18px;" />
      <div style="margin-top:8px;">
        <img src="{{links.logo}}" alt="Wine Academy Hamburg" style="width:54px;height:auto;display:block;margin-bottom:10px;" />
        <div style="font-size:13px;line-height:1.6;color:#111110;">
          <div style="font-weight:700;margin-bottom:4px;">Wineacademy</div>
          Eimsbütteler Chaussee 37<br/>
          20259 Hamburg<br/>
          Tel.: 040-88 12 80 27<br/>
          post@wineacademy.de
        </div>
      </div>
    </div>
    <div style="text-align:center;font-size:12px;line-height:1.6;color:#9aa0a6;margin:14px 0 0 0;">
      Wird diese E-Mail nicht korrekt angezeigt?
      <a href="{{links.preview}}" style="color:#7a9ec1;text-decoration:underline;">Hier öffnen</a>.
    </div>
  </div>
</div>` ,
      bodyText: `Hallo {{kunde.vorname}},

wir haben deine Bestellung {{bestellung.bestellnummer}} erhalten. Danke für dein Vertrauen in die Wine Academy Hamburg.

Bestellübersicht:
{{bestellung.positionenText}}

Gesamtbetrag: {{bestellung.summeBrutto}}
Rechnung: {{links.rechnung}}

{{bestellung.termineText}}

Viele Grüße
Wine Academy Hamburg`,
    },
    {
      name: 'Gutscheinversand',
      anwendungsfall: 'rechnung_gutschein',
      layout: 'default',
      beschreibung: 'Versandmail für Geschenkgutscheine inklusive Gutschein-Code.',
      betreff: 'Dein Geschenkgutschein {{bestellung.bestellnummer}}',
      vorschauzeile: 'Hier ist dein Geschenkgutschein.',
      bodyHtml: `<div style="background:#f8f8f8;padding:24px 0;">
  <div style="max-width:680px;margin:0 auto;padding:16px 14px;">
    <div style="background:#ffffff;border:1px solid #d7d9dd;border-radius:32px;padding:32px 24px 34px;box-shadow:0 16px 40px rgba(0,0,0,0.06);">
      <img style="display:block;width:146px;height:auto;margin:0 0 30px 0;" src="{{links.logo}}" alt="Wine Academy Hamburg" />
      <h1 style="font-family:'SerifbabeAlpha',Georgia,serif;font-size:46px;line-height:1.08;font-weight:300;letter-spacing:-0.01em;margin:0 0 18px 0;color:#1c1b1a;">Geschenkgutschein</h1>
      <hr style="border:0;border-top:1px solid #e2e3e5;margin:18px 0 20px;" />
      <p style="font-weight:700;color:#111110;margin:0 0 6px 0;font-size:17px;line-height:1.5;">Hallo {{kunde.vorname}},</p>
      <p style="font-size:16px;color:#111110;line-height:1.55;margin:0 0 12px 0;">wir haben deine Bestellung {{bestellung.bestellnummer}} erhalten. Danke für dein Vertrauen in die Wine Academy Hamburg.</p>
      <p style="font-size:16px;color:#111110;line-height:1.55;margin:0 0 18px 0;">Hier ist dein Geschenkgutschein im Wert von {{bestellung.summeBrutto}}.</p>
      <div style="margin:10px 0 22px 0;">{{anhang.gutscheineHtml}}</div>
      <p style="font-size:16px;color:#111110;line-height:1.55;margin:0 0 6px 0;">Viel Freude beim Verschenken!</p>
      <p style="font-size:16px;color:#111110;line-height:1.55;margin:0;">Herzliche Grüße<br/>Wine Academy Hamburg</p>
      <hr style="border:0;border-top:1px solid #e2e3e5;margin:24px 0 18px;" />
      <div style="margin-top:8px;">
        <img src="{{links.logo}}" alt="Wine Academy Hamburg" style="width:54px;height:auto;display:block;margin-bottom:10px;" />
        <div style="font-size:13px;line-height:1.6;color:#111110;">
          <div style="font-weight:700;margin-bottom:4px;">Wineacademy</div>
          Eimsbütteler Chaussee 37<br/>
          20259 Hamburg<br/>
          Tel.: 040-88 12 80 27<br/>
          post@wineacademy.de
        </div>
      </div>
    </div>
    <div style="text-align:center;font-size:12px;line-height:1.6;color:#9aa0a6;margin:14px 0 0 0;">
      Wird diese E-Mail nicht korrekt angezeigt?
      <a href="{{links.preview}}" style="color:#7a9ec1;text-decoration:underline;">Hier öffnen</a>.
    </div>
  </div>
</div>`,
      bodyText: `Hallo {{kunde.vorname}},

wir haben deine Bestellung {{bestellung.bestellnummer}} erhalten. Danke für dein Vertrauen in die Wine Academy Hamburg.

Hier ist dein Geschenkgutschein im Wert von {{bestellung.summeBrutto}}:
{{anhang.gutscheineText}}

Viel Freude beim Verschenken!
Wine Academy Hamburg`,
    },
  ];

  for (const seed of notificationSeeds) {
    await upsertBenachrichtigung(strapi, seed);
    log(`Benachrichtigung '${seed.name}' bereitgestellt.`);
  }
}
