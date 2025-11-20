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
  layout?: 'kunde' | 'backoffice';
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
    layout: values.layout ?? 'kunde',
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

export const notificationSeedData: NotificationSeed[] = [
    {
      name: 'Bestellbestätigung',
      anwendungsfall: 'bestellbestaetigung',
      layout: 'kunde',
      beschreibung: 'Kundenmail direkt nach Checkout.',
      betreff: 'Wir haben deine Bestellung {{bestellung.bestellnummer}} erhalten',
      vorschauzeile: 'Danke für deine Buchung bei der Wine Academy.',
      bodyHtml: `<h1 style="margin:0 0 18px 0;">Deine Bestellung</h1>
<hr style="border:0;border-top:1px solid #e2e3e5;margin:18px 0 22px;" />
<p style="font-weight:700;margin:0 0 6px 0;">Hallo {{kunde.vorname}},</p>
<p style="margin:0 0 14px 0;">wir haben deine Bestellung {{bestellung.bestellnummer}} erhalten. Danke für dein Vertrauen in die Wine Academy Hamburg.</p>

<hr style="border:0;border-top:1px solid #e2e3e5;margin:18px 0 18px;" />
<h2 style="margin:0 0 12px 0;">Bestellübersicht</h2>
<div style="margin:0 0 10px 0;">{{bestellung.positionenTableHtml}}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:12px 0 12px 0;font-weight:700;">
  <tr>
    <td style="padding:12px 0;border-top:1px solid #e2e3e5;border-bottom:1px solid #e2e3e5;text-align:left;">Gesamtbetrag</td>
    <td style="padding:12px 0;border-top:1px solid #e2e3e5;border-bottom:1px solid #e2e3e5;text-align:right;white-space:nowrap;">{{bestellung.summeBrutto}}</td>
  </tr>
</table>
<a class="wa-btn wa-btn-primary" href="{{links.rechnung}}" style="display:inline-block;width:100%;max-width:320px;text-align:center;background:#8bb5d7;color:#ffffff;text-decoration:none;padding:14px 18px;border-radius:10px;font-weight:700;margin:16px auto 11px;border:1px solid rgba(0,0,0,0.08);box-sizing:border-box;">Rechnung herunterladen</a>
{{bestellung.termineSectionHtml}}`,
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
      name: 'Zahlungsbestätigung',
      anwendungsfall: 'zahlungsbestaetigung',
      layout: 'kunde',
      beschreibung: 'Bestätigt Zahlungseingang und liefert ggf. Gutscheincodes.',
      betreff: 'Zahlung für {{bestellung.bestellnummer}} ist eingegangen',
      vorschauzeile: 'Wir haben deine Zahlung erhalten und schalten alle Leistungen frei.',
      bodyHtml: `<h1 style="margin:0 0 18px 0;">Zahlungsbestätigung</h1>
<hr style="border:0;border-top:1px solid #e2e3e5;margin:18px 0 18px;" />
<p style="margin:0 0 12px 0;">Hallo {{kunde.vorname}},</p>
<p style="margin:0 0 12px 0;">wir haben deine Zahlung über {{bestellung.zahlungsbetrag}} zu Bestellung {{bestellung.bestellnummer}} am {{bestellung.zahlungsdatum}} erhalten.</p>
{{gutscheineHtml}}
<a class="wa-btn wa-btn-primary" href="{{links.rechnung}}" style="display:inline-block;width:100%;max-width:320px;text-align:center;background:#8bb5d7;color:#ffffff;text-decoration:none;padding:14px 18px;border-radius:10px;font-weight:700;margin:16px auto 11px;border:1px solid rgba(0,0,0,0.08);box-sizing:border-box;">Rechnung herunterladen</a>`,
      bodyText: `Hallo {{kunde.vorname}},

wir haben deine Zahlung für Bestellung {{bestellung.bestellnummer}} am {{bestellung.zahlungsdatum}} erhalten. Betrag: {{bestellung.zahlungsbetrag}}.

Rechnung: {{links.rechnung}}

Viele Grüße
Wine Academy Hamburg`,
    },
    {
      name: 'Gutscheinversand',
      anwendungsfall: 'rechnung_gutschein',
      layout: 'kunde',
      beschreibung: 'Versandmail für Geschenkgutscheine inklusive Gutschein-Code.',
      betreff: 'Dein Geschenkgutschein {{bestellung.bestellnummer}}',
      vorschauzeile: 'Hier ist dein Geschenkgutschein.',
      bodyHtml: `<h1 style="margin:0 0 18px 0;">Geschenkgutschein</h1>
<hr style="border:0;border-top:1px solid #e2e3e5;margin:18px 0 20px;" />
<p style="font-weight:700;margin:0 0 6px 0;">Hallo {{kunde.vorname}},</p>
<p style="margin:0 0 12px 0;">wir haben deine Bestellung {{bestellung.bestellnummer}} erhalten. Danke für dein Vertrauen in die Wine Academy Hamburg.</p>
<p style="margin:0 0 18px 0;">Hier ist dein Geschenkgutschein im Wert von {{bestellung.summeBrutto}}.</p>
{{anhang.gutscheineHtml}}
<p style="margin:0 0 6px 0;">Viel Freude beim Verschenken!</p>
<p style="margin:0;">Herzliche Grüße<br/>Wine Academy Hamburg</p>`,
      bodyText: `Hallo {{kunde.vorname}},

wir haben deine Bestellung {{bestellung.bestellnummer}} erhalten. Danke für dein Vertrauen in die Wine Academy Hamburg.

Hier ist dein Geschenkgutschein im Wert von {{bestellung.summeBrutto}}:
{{anhang.gutscheineText}}

Viel Freude beim Verschenken!
Wine Academy Hamburg`,
    },
    {
      name: 'Backoffice Benachrichtigung',
      anwendungsfall: 'backoffice_benachrichtigung',
      layout: 'backoffice',
      beschreibung: 'Interne Info, sobald eine Bestellung eingeht.',
      betreff: 'Neue Bestellung {{bestellung.bestellnummer}}',
      vorschauzeile: 'Neue Bestellung wartet auf Prüfung.',
      bodyHtml: `<h1 style="margin:0 0 18px 0;">Neue Bestellung {{bestellung.bestellnummer}}</h1>
<hr style="border:0;border-top:1px solid #e2e3e5;margin:18px 0 18px;" />

<p style="margin:0 0 8px 0;"><strong>Status:</strong> {{bestellung.status}}</p>
<p style="margin:0 0 8px 0;"><strong>Zahlungsmethode:</strong> {{bestellung.zahlungsmethode}}</p>
<p style="margin:0 0 8px 0;"><strong>Rechnungstyp:</strong> {{bestellung.rechnungstyp}}</p>
<hr style="border:0;border-top:1px solid #e2e3e5;margin:16px 0 16px;" />

<p style="margin:0 0 8px 0;"><strong>Bestellung</strong></p>
<div style="margin:0 0 12px 0;">{{bestellung.positionenTableHtml}}</div>
<hr style="border:0;border-top:1px solid #e2e3e5;margin:16px 0 16px;" />

<p style="margin:0 0 12px 0;"><strong>Summen</strong><br/>Brutto: {{bestellung.summeBrutto}}<br/>Netto: {{bestellung.summeNetto}}<br/>Steuer: {{bestellung.summeSteuer}}<br/>Gutschein: {{bestellung.gutscheinBetrag}}</p>
<hr style="border:0;border-top:1px solid #e2e3e5;margin:16px 0 16px;" />

<p style="margin:0 0 10px 0;"><strong>Kunde</strong><br/>{{bestellung.kunde.vorname}} {{bestellung.kunde.nachname}}<br/>E-Mail: {{bestellung.kunde.email}}<br/>Telefon: {{bestellung.kunde.telefon}}</p>
<p style="margin:0 0 12px 0;"><strong>Rechnungsadresse</strong><br/>{{bestellung.adresse.strasse}}<br/>{{bestellung.adresse.plz}} {{bestellung.adresse.stadt}} ({{bestellung.adresse.land}})<br/>Rechnungs-E-Mail: {{bestellung.adresse.rechnungsEmail}}<br/>USt-ID: {{bestellung.adresse.ustId}}</p>
<hr style="border:0;border-top:1px solid #e2e3e5;margin:16px 0 12px;" />

<p style="margin:0 0 8px 0;"><strong>Teilnehmer</strong></p>
<div style="margin:0 0 12px 0;">{{bestellung.teilnehmerHtml}}</div>

<hr style="border:0;border-top:1px solid #e2e3e5;margin:18px 0 10px;" />
<a class="wa-btn wa-btn-primary" href="{{links.rechnung}}" style="display:inline-block;width:100%;max-width:320px;text-align:center;background:#8bb5d7;color:#ffffff;text-decoration:none;padding:14px 18px;border-radius:10px;font-weight:700;margin:16px auto 11px;border:1px solid rgba(0,0,0,0.08);box-sizing:border-box;">Rechnung herunterladen</a>`,
      bodyText: `Neue Bestellung {{bestellung.bestellnummer}}
Status: {{bestellung.status}}
Zahlungsmethode: {{bestellung.zahlungsmethode}}
Rechnungstyp: {{bestellung.rechnungstyp}}
Summen:
  Brutto: {{bestellung.summeBrutto}}
  Netto: {{bestellung.summeNetto}}
  Steuer: {{bestellung.summeSteuer}}
  Gutschein: {{bestellung.gutscheinBetrag}}
Kunde:
  {{bestellung.kunde.vorname}} {{bestellung.kunde.nachname}}
  E-Mail: {{bestellung.kunde.email}}
  Telefon: {{bestellung.kunde.telefon}}
Adresse:
  {{bestellung.adresse.firmenname}}
  {{bestellung.adresse.strasse}}
  {{bestellung.adresse.plz}} {{bestellung.adresse.stadt}} ({{bestellung.adresse.land}})
  Rechnungs-E-Mail: {{bestellung.adresse.rechnungsEmail}}
  USt-ID: {{bestellung.adresse.ustId}}
Positionen:
{{bestellung.positionenText}}

Rechnung: {{links.rechnung}}
Notizen: {{bestellung.notizen}}`,
    },
    {
      name: 'Storno-Bestätigung',
      anwendungsfall: 'storno_bestaetigung',
      layout: 'kunde',
      beschreibung: 'Kundenbenachrichtigung bei erfolgreicher Stornierung.',
      betreff: 'Bestellung {{bestellung.bestellnummer}} wurde storniert',
      vorschauzeile: 'Wir haben deine Stornierung bestätigt.',
      bodyHtml: `<h1 style="margin:0 0 18px 0;">Stornobestätigung</h1>
<hr style="border:0;border-top:1px solid #e2e3e5;margin:18px 0 18px;" />
<p style="margin:0 0 12px 0;">Hallo {{kunde.vorname}},</p>
<p style="margin:0 0 12px 0;">wir bestätigen die Stornierung deiner Bestellung {{bestellung.bestellnummer}} am {{stornierung.datum}}.</p>
<p style="margin:0 0 12px 0;">Bei Fragen melde dich gerne jederzeit.</p>
<p style="margin:0 0 18px 0;">Viele Grüße<br/>Wine Academy Hamburg</p>

<hr style="border:0;border-top:1px solid #e2e3e5;margin:16px 0 18px;" />
<h2 style="margin:0 0 12px 0;">Bestellübersicht</h2>
<div style="margin:0 0 12px 0;">{{bestellung.positionenTableHtml}}</div>
<p style="margin:0 0 8px 0;"><strong>Summe brutto:</strong> {{bestellung.summeBrutto}}</p>
<hr style="border:0;border-top:1px solid #e2e3e5;margin:16px 0 12px;" />
<a class="wa-btn wa-btn-primary" href="{{links.stornoRechnung}}" style="display:inline-block;width:100%;max-width:320px;text-align:center;background:#8bb5d7;color:#ffffff;text-decoration:none;padding:14px 18px;border-radius:10px;font-weight:700;margin:16px auto 11px;border:1px solid rgba(0,0,0,0.08);box-sizing:border-box;">Stornorechnung herunterladen</a>`,
      bodyText: `Hallo {{kunde.vorname}},

wir bestätigen die Stornierung deiner Bestellung {{bestellung.bestellnummer}} am {{stornierung.datum}}.

Summe brutto: {{bestellung.summeBrutto}}
Stornorechnung: {{links.stornoRechnung}}

Viele Grüße
Wine Academy Hamburg`,
    },
    {
      name: 'Storno-Backoffice',
      anwendungsfall: 'storno_backoffice',
      layout: 'backoffice',
      beschreibung: 'Interne Info zum Statuswechsel auf storniert.',
      betreff: 'Bestellung {{bestellung.bestellnummer}} wurde storniert',
      vorschauzeile: 'Storno ist eingegangen.',
      bodyHtml: `<h1 style="margin:0 0 18px 0;">Bestellung {{bestellung.bestellnummer}} storniert</h1>
<hr style="border:0;border-top:1px solid #e2e3e5;margin:18px 0 18px;" />

<p style="margin:0 0 8px 0;"><strong>Status:</strong> {{bestellung.status}}</p>
<p style="margin:0 0 8px 0;"><strong>Stornodatum:</strong> {{stornierung.datum}}</p>
<p style="margin:0 0 8px 0;"><strong>Zahlungsmethode:</strong> {{bestellung.zahlungsmethode}}</p>
<hr style="border:0;border-top:1px solid #e2e3e5;margin:16px 0 16px;" />

<p style="margin:0 0 12px 0;"><strong>Summen</strong><br/>Brutto: {{bestellung.summeBrutto}}<br/>Netto: {{bestellung.summeNetto}}<br/>Steuer: {{bestellung.summeSteuer}}<br/>Gutschein: {{bestellung.gutscheinBetrag}}</p>
<hr style="border:0;border-top:1px solid #e2e3e5;margin:16px 0 16px;" />

<p style="margin:0 0 10px 0;"><strong>Kunde</strong><br/>{{bestellung.kunde.vorname}} {{bestellung.kunde.nachname}}<br/>E-Mail: {{bestellung.kunde.email}}<br/>Telefon: {{bestellung.kunde.telefon}}</p>
<p style="margin:0 0 12px 0;"><strong>Rechnungsadresse</strong><br/>{{bestellung.adresse.strasse}}<br/>{{bestellung.adresse.plz}} {{bestellung.adresse.stadt}} ({{bestellung.adresse.land}})<br/>Rechnungs-E-Mail: {{bestellung.adresse.rechnungsEmail}}<br/>USt-ID: {{bestellung.adresse.ustId}}</p>
<hr style="border:0;border-top:1px solid #e2e3e5;margin:16px 0 12px;" />

<p style="margin:0 0 8px 0;"><strong>Bestellung</strong></p>
<div style="margin:0 0 12px 0;">{{bestellung.positionenTableHtml}}</div>

<hr style="border:0;border-top:1px solid #e2e3e5;margin:16px 0 12px;" />
<p style="margin:0 0 8px 0;"><strong>Teilnehmer</strong></p>
<div style="margin:0 0 12px 0;">{{bestellung.teilnehmerHtml}}</div>

<hr style="border:0;border-top:1px solid #e2e3e5;margin:16px 0 12px;" />
<a class="wa-btn wa-btn-primary" href="{{links.stornoRechnung}}" style="display:inline-block;width:100%;max-width:320px;text-align:center;background:#8bb5d7;color:#ffffff;text-decoration:none;padding:14px 18px;border-radius:10px;font-weight:700;margin:16px auto 11px;border:1px solid rgba(0,0,0,0.08);box-sizing:border-box;">Stornorechnung herunterladen</a>
<a class="wa-btn wa-btn-secondary" href="{{links.rechnung}}" style="display:inline-block;width:100%;max-width:320px;text-align:center;background:#e2e3e5;color:#111110;text-decoration:none;padding:14px 18px;border-radius:10px;font-weight:700;margin:16px auto 11px;border:1px solid rgba(0,0,0,0.12);box-sizing:border-box;">Alte Rechnungen herunterladen</a>`,
      bodyText: `Storno {{bestellung.bestellnummer}}
Status: {{bestellung.status}}
Stornodatum: {{stornierung.datum}}
Zahlungsmethode: {{bestellung.zahlungsmethode}}
Summen:
  Brutto: {{bestellung.summeBrutto}}
  Netto: {{bestellung.summeNetto}}
  Steuer: {{bestellung.summeSteuer}}
  Gutschein: {{bestellung.gutscheinBetrag}}
Kunde:
  {{bestellung.kunde.vorname}} {{bestellung.kunde.nachname}}
  E-Mail: {{bestellung.kunde.email}}
  Telefon: {{bestellung.kunde.telefon}}
Adresse:
  {{bestellung.adresse.firmenname}}
  {{bestellung.adresse.strasse}}
  {{bestellung.adresse.plz}} {{bestellung.adresse.stadt}} ({{bestellung.adresse.land}})
  Rechnungs-E-Mail: {{bestellung.adresse.rechnungsEmail}}
  USt-ID: {{bestellung.adresse.ustId}}
Positionen:
{{bestellung.positionenText}}

Rechnung: {{links.rechnung}}
Stornorechnung: {{links.stornoRechnung}}
Notizen: {{bestellung.notizen}}`,
    },
  ];
export async function seedNotifications(strapi: any, log: (msg: string) => void) {
  for (const seed of notificationSeedData) {
    await upsertBenachrichtigung(strapi, seed);
    log(`Benachrichtigung '${seed.name}' bereitgestellt.`);
  }
}
