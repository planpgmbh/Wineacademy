import { nowIso } from './helpers';

type Platzhalter = {
  schluessel: string;
  beschreibung?: string;
  beispiel?: string;
};

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
  platzhalter?: Platzhalter[];
  testPayload?: Record<string, unknown>;
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
    platzhalter: Array.isArray(values.platzhalter)
      ? values.platzhalter.map((entry) => ({
          schluessel: entry.schluessel,
          beschreibung: entry.beschreibung ?? undefined,
          beispiel: entry.beispiel ?? undefined,
        }))
      : [],
  };

  if (values.testPayload) {
    data.testPayload = values.testPayload;
  }

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
      bodyHtml: `<div style="background:#f5f7fa;padding:32px 0;">
  <div style="max-width:680px;margin:0 auto;padding:16px;">
    <div style="background:#ffffff;border:1px solid #d7d9dd;border-radius:34px;padding:48px;">
      <img style="display:block;width:140px;height:auto;margin:0 0 36px 0;" src="{{links.logo}}" alt="Wine Academy Hamburg" />
      <h1 style="font-family:'SerifbabeAlpha',Georgia,serif;font-size:54px;line-height:1.08;font-weight:300;letter-spacing:-0.01em;margin:0 0 18px 0;color:#111110;">Deine Bestellung</h1>
      <hr style="border:0;border-top:1px solid #d7d9dd;margin:24px 0;" />
      <p style="font-weight:700;color:#111110;margin:0 0 6px 0;font-size:18px;line-height:1.5;">Hallo {{kunde.vorname}},</p>
      <p style="font-size:18px;color:#111110;line-height:1.5;margin:0 0 10px 0;">wir haben deine Bestellung {{bestellung.bestellnummer}} erhalten. Danke für dein Vertrauen in die Wine Academy Hamburg.</p>
      <hr style="border:0;border-top:1px solid #d7d9dd;margin:24px 0;" />
      <h2 style="font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:28px;line-height:1.15;font-weight:600;letter-spacing:-0.01em;margin:0 0 12px 0;color:#111110;">Bestellübersicht</h2>
      {{bestellung.positionenTableHtml}}
      <hr style="border:0;border-top:1px solid #d7d9dd;margin:24px 0;" />
      <div style="display:flex;justify-content:space-between;align-items:baseline;font-weight:700;font-size:18px;margin:20px 0 6px 0;color:#111110;">
        <span>Gesamtbetrag</span>
        <span>{{bestellung.summeBrutto}}</span>
      </div>
      <hr style="border:0;border-top:1px solid #d7d9dd;margin:24px 0;" />
      <a href="{{links.rechnung}}" style="display:inline-block;background:#8bb5d7;color:#ffffff;text-decoration:none;padding:16px 22px;border-radius:8px;font-weight:700;font-size:18px;margin:16px 0 16px;border:1px solid rgba(0,0,0,0.1);">Rechnung herunterladen</a>
      <hr style="border:0;border-top:1px solid #d7d9dd;margin:24px 0;" />
      <h2 style="font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:28px;line-height:1.15;font-weight:600;letter-spacing:-0.01em;margin:0 0 12px 0;color:#111110;">Termine</h2>
      {{bestellung.termineHtml}}
      <hr style="border:0;border-top:1px solid #d7d9dd;margin:24px 0;" />
      <div style="margin-top:24px;">
        <img src="{{links.logo}}" alt="Wine Academy Hamburg" style="width:58px;height:auto;display:block;margin-bottom:10px;" />
        <div style="font-size:13px;line-height:1.6;color:#111110;">
          <div style="font-weight:700;margin-bottom:4px;">Wineacademy</div>
          Eimsbütteler Chaussee 37<br/>
          20259 Hamburg<br/>
          Tel.: 040-88 12 80 27<br/>
          post@wineacademy.de
        </div>
      </div>
    </div>
  </div>
</div>`,
      bodyText: `Hallo {{kunde.vorname}},

wir haben deine Bestellung {{bestellung.bestellnummer}} erhalten. Danke für dein Vertrauen in die Wine Academy Hamburg.

Bestellübersicht:
{{bestellung.positionenText}}

Gesamtbetrag: {{bestellung.summeBrutto}}
Rechnung: {{links.rechnung}}

{{bestellung.termineText}}

Viele Grüße
Wine Academy Hamburg`,
      platzhalter: [
        { schluessel: 'kunde.vorname', beispiel: 'Max' },
        { schluessel: 'bestellung.bestellnummer', beispiel: 'WA-20251001' },
        { schluessel: 'bestellung.summeBrutto', beispiel: '1.270,00 €' },
        {
          schluessel: 'bestellung.positionenTableHtml',
          beschreibung: 'HTML-Tabelle mit allen Positionen inklusive Mengen und Summen.',
          beispiel:
            '<table><tr><td>Sensorik Essentials</td><td>2</td><td>530,00 €</td></tr><tr><td>WSET Level 2</td><td>1</td><td>950,00 €</td></tr></table>',
        },
        {
          schluessel: 'links.rechnung',
          beschreibung: 'Direktlink zum PDF der Rechnung.',
          beispiel: 'https://wineacademy.plan-p.de/api/public/bestellungen/WA-20251001/rechnung',
        },
      ],
      testPayload: {
        kunde: { vorname: 'Max', nachname: 'Beispiel' },
        bestellung: {
          bestellnummer: 'WA-20251001',
          summeBrutto: '1.270,00 €',
          zahlungsmethode: 'Rechnung',
          zahlungsstatus: 'offen',
          positionenTableHtml:
            '<table><thead><tr><th>Position</th><th>Menge</th><th>Summe</th></tr></thead><tbody><tr><td>Sensorik Essentials</td><td>2</td><td>530,00 €</td></tr><tr><td>WSET Level 2</td><td>1</td><td>950,00 €</td></tr></tbody></table>',
        },
        links: {
          rechnung: 'https://wineacademy.plan-p.de/api/public/bestellungen/WA-20251001/rechnung',
        },
      },
    },
    {
      name: 'Zahlungsbestätigung',
      anwendungsfall: 'zahlungsbestaetigung',
      layout: 'default',
      beschreibung: 'Automatische Bestätigung nach Zahlungseingang.',
      betreff: 'Zahlung für {{bestellung.bestellnummer}} ist eingegangen',
      vorschauzeile: 'Wir haben deine Zahlung erhalten und schalten alle Leistungen frei.',
      bodyHtml: `<h1>Hallo {{kunde.vorname}},</h1>
  <p>deine Zahlung über {{bestellung.zahlungsbetrag}} zu Bestellung {{bestellung.bestellnummer}} ist am {{bestellung.zahlungsdatum}} eingegangen.</p>
  {{gutscheineHtml}}
  <p>Deine Rechnung kannst du jederzeit hier herunterladen: <a href="{{links.rechnung}}">Rechnung herunterladen</a>.</p>
  <p>Vielen Dank und bis bald!<br/>Wine Academy Hamburg</p>`,
      bodyText: `Hallo {{kunde.vorname}},

  wir haben deine Zahlung für Bestellung {{bestellung.bestellnummer}} am {{bestellung.zahlungsdatum}} erhalten. Betrag: {{bestellung.zahlungsbetrag}}.

  Rechnung: {{links.rechnung}}

  Viele Grüße
  Wine Academy Hamburg`,
      platzhalter: [
        { schluessel: 'kunde.vorname', beispiel: 'Anna' },
        { schluessel: 'bestellung.bestellnummer', beispiel: 'WA-20251001' },
        { schluessel: 'bestellung.zahlungsdatum', beispiel: '03.10.2025' },
        { schluessel: 'bestellung.zahlungsbetrag', beispiel: '1.270,00 €' },
        {
          schluessel: 'gutscheineHtml',
          beschreibung: 'HTML-Liste mit generierten Gutscheincodes (falls vorhanden).',
          beispiel: '<ul><li>Gutschein: CODE-1234 (50 €)</li></ul>',
        },
        {
          schluessel: 'links.rechnung',
          beschreibung: 'Direktlink zur Rechnung.',
          beispiel: 'https://wineacademy.plan-p.de/api/public/bestellungen/WA-20251001/rechnung',
        },
      ],
      testPayload: {
        kunde: { vorname: 'Anna' },
        bestellung: {
          bestellnummer: 'WA-20251001',
          zahlungsdatum: '03.10.2025',
          zahlungsbetrag: '1.270,00 €',
        },
        gutscheineHtml: '<ul><li>Gutschein: WA3K-9XYZ (50 €)</li></ul>',
        links: {
          rechnung: 'https://wineacademy.plan-p.de/api/public/bestellungen/WA-20251001/rechnung',
        },
      },
    },
    {
      name: 'Rechnung & Gutscheinversand',
      anwendungsfall: 'rechnung_gutschein',
      layout: 'rechnung',
      beschreibung: 'Mail mit Links zu Rechnung und ggf. Gutschein-PDFs.',
      betreff: 'Deine Unterlagen zu {{bestellung.bestellnummer}}',
      vorschauzeile: 'Hier findest du Rechnung und Gutscheincodes zur Bestellung.',
      bodyHtml: `<h1>Hallo {{kunde.vorname}},</h1>
  <p>anbei erhältst du die Rechnung zu deiner Bestellung {{bestellung.bestellnummer}}.</p>
  <p><a href="{{anhang.rechnungUrl}}">Rechnung herunterladen</a></p>
  {{anhang.gutscheineHtml}}
  <p>Viel Freude mit unseren Seminaren!<br/>Wine Academy Hamburg</p>`,
      bodyText: `Hallo {{kunde.vorname}},

  die Rechnung zu deiner Bestellung {{bestellung.bestellnummer}} findest du hier: {{anhang.rechnungUrl}}.
  {{anhang.gutscheineText}}

  Viele Grüße
  Wine Academy Hamburg`,
      platzhalter: [
        { schluessel: 'kunde.vorname', beispiel: 'Anna' },
        { schluessel: 'bestellung.bestellnummer', beispiel: 'WA-20251001' },
        {
          schluessel: 'anhang.rechnungUrl',
          beschreibung: 'Direkter Link zum Rechnungs-PDF.',
          beispiel: 'https://wineacademy.plan-p.de/uploads/WA-20251001.pdf',
        },
        {
          schluessel: 'anhang.gutscheineHtml',
          beschreibung: 'HTML-Liste aller Gutschein-PDFs.',
          beispiel: '<ul><li><a href="https://.../GUT-123.pdf">GUT-123.pdf</a></li></ul>',
        },
        {
          schluessel: 'anhang.gutscheineText',
          beschreibung: 'Textuelle Auflistung der Gutscheine für Plain-Text-Version.',
          beispiel: 'Gutschein WA3K-9XYZ (50 €)',
        },
      ],
      testPayload: {
        kunde: { vorname: 'Anna' },
        bestellung: { bestellnummer: 'WA-20251001' },
        anhang: {
          rechnungUrl: 'https://wineacademy.plan-p.de/uploads/WA-20251001.pdf',
          gutscheineHtml:
            '<ul><li><a href="https://wineacademy.plan-p.de/uploads/GUT-123.pdf">GUT-123.pdf</a></li></ul>',
          gutscheineText: 'Gutschein WA3K-9XYZ (50 €)',
        },
      },
    },
    {
      name: 'Backoffice Benachrichtigung',
      anwendungsfall: 'backoffice_benachrichtigung',
      layout: 'backoffice',
      beschreibung: 'Interne Info bei neuen Bestellungen.',
      betreff: 'Neue Bestellung {{bestellung.bestellnummer}}',
      vorschauzeile: 'Neue Bestellung wartet auf Prüfung.',
      bodyHtml: `<h1>Neue Bestellung {{bestellung.bestellnummer}}</h1>
  <p><strong>Status:</strong> {{bestellung.status}}</p>
  <p><strong>Zahlungsmethode:</strong> {{bestellung.zahlungsmethode}}</p>
  <p><strong>Rechnungstyp:</strong> {{bestellung.rechnungstyp}}</p>
  <p><strong>Summen</strong><br/>
  Brutto: {{bestellung.summeBrutto}}<br/>
  Netto: {{bestellung.summeNetto}}<br/>
  Steuer: {{bestellung.summeSteuer}}<br/>
  Gutschein: {{bestellung.gutscheinBetrag}}</p>
  <p><strong>Kunde</strong><br/>
  {{bestellung.kunde.vorname}} {{bestellung.kunde.nachname}}<br/>
  E-Mail: {{bestellung.kunde.email}}<br/>
  Telefon: {{bestellung.kunde.telefon}}</p>
  <p><strong>Rechnungsadresse</strong><br/>
  {{bestellung.adresse.firmenname}}<br/>
  {{bestellung.adresse.strasse}}<br/>
  {{bestellung.adresse.plz}} {{bestellung.adresse.stadt}} ({{bestellung.adresse.land}})<br/>
  Rechnungs-E-Mail: {{bestellung.adresse.rechnungsEmail}}<br/>
  USt-ID: {{bestellung.adresse.ustId}}</p>
  <p><strong>Positionen</strong></p>
  {{bestellung.positionenTableHtml}}
  <p><strong>Rechnung:</strong> {{links.rechnung}}</p>
  <p><strong>Notizen:</strong> {{bestellung.notizen}}</p>`,
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
      platzhalter: [
        { schluessel: 'bestellung.bestellnummer', beispiel: 'WA-20251001' },
        { schluessel: 'bestellung.status', beispiel: 'offen' },
        { schluessel: 'bestellung.zahlungsmethode', beispiel: 'rechnung' },
        { schluessel: 'bestellung.summeBrutto', beispiel: '1.270,00 €' },
        { schluessel: 'bestellung.summeNetto', beispiel: '1.067,23 €' },
        { schluessel: 'bestellung.summeSteuer', beispiel: '202,77 €' },
        { schluessel: 'bestellung.gutscheinBetrag', beispiel: '0,00 €' },
        { schluessel: 'bestellung.rechnungstyp', beispiel: 'firma' },
        { schluessel: 'bestellung.kunde.vorname', beispiel: 'Anna' },
        { schluessel: 'bestellung.kunde.nachname', beispiel: 'Beispiel' },
        { schluessel: 'bestellung.kunde.email', beispiel: 'anna@example.com' },
        { schluessel: 'bestellung.kunde.telefon', beispiel: '+49 40 123456' },
        { schluessel: 'bestellung.adresse.firmenname', beispiel: 'Weinliebhaber GmbH' },
        { schluessel: 'bestellung.adresse.strasse', beispiel: 'Weinplatz 1' },
        { schluessel: 'bestellung.adresse.plz', beispiel: '20095' },
        { schluessel: 'bestellung.adresse.stadt', beispiel: 'Hamburg' },
        { schluessel: 'bestellung.adresse.land', beispiel: 'Deutschland' },
        { schluessel: 'bestellung.adresse.rechnungsEmail', beispiel: 'billing@example.com' },
        { schluessel: 'bestellung.adresse.ustId', beispiel: 'DE123456789' },
        { schluessel: 'bestellung.positionenTableHtml', beschreibung: 'HTML-Tabelle der Positionen.' },
        { schluessel: 'bestellung.positionenText', beschreibung: 'Textuelle Auflistung der Positionen.' },
        { schluessel: 'bestellung.notizen', beispiel: 'Bitte veganen Wein berücksichtigen.' },
        {
          schluessel: 'links.rechnung',
          beschreibung: 'Direktlink zum Rechnungs-PDF.',
          beispiel: 'https://wineacademy.plan-p.de/api/public/bestellungen/WA-20251001/rechnung',
        },
      ],
      testPayload: {
        bestellung: {
          bestellnummer: 'WA-20251001',
          status: 'offen',
          zahlungsmethode: 'rechnung',
          summeBrutto: '1.270,00 €',
          summeNetto: '1.067,23 €',
          summeSteuer: '202,77 €',
          gutscheinBetrag: '0,00 €',
          rechnungstyp: 'firma',
          kunde: {
            vorname: 'Anna',
            nachname: 'Beispiel',
            email: 'anna@example.com',
            telefon: '+49 40 123456',
          },
          adresse: {
            firmenname: 'Weinliebhaber GmbH',
            strasse: 'Weinplatz 1',
            plz: '20095',
            stadt: 'Hamburg',
            land: 'Deutschland',
            rechnungsEmail: 'billing@example.com',
            ustId: 'DE123456789',
          },
          positionenTableHtml:
            '<table><tr><td>Sensorik Essentials</td><td>2</td><td>530,00 €</td></tr><tr><td>WSET Level 2</td><td>1</td><td>950,00 €</td></tr></table>',
          positionenText: 'Sensorik Essentials · Menge: 2 · Summe: 530,00 €',
          notizen: 'Bitte veganen Wein berücksichtigen.',
        },
        links: {
          rechnung: 'https://wineacademy.plan-p.de/api/public/bestellungen/WA-20251001/rechnung',
        },
      },
    },
    {
      name: 'Storno-Bestätigung',
      anwendungsfall: 'storno_bestaetigung',
      layout: 'default',
      beschreibung: 'Kundenbenachrichtigung nach Stornierungen.',
      betreff: 'Bestellung {{bestellung.bestellnummer}} wurde storniert',
      vorschauzeile: 'Wir haben deine Stornierung bestätigt.',
      bodyHtml: `<h1>Hallo {{kunde.vorname}},</h1>
  <p>wir bestätigen die Stornierung deiner Bestellung {{bestellung.bestellnummer}} am {{stornierung.datum}}.</p>
  <p><strong>Bestellübersicht</strong></p>
  {{bestellung.positionenTableHtml}}
  <p><strong>Summe brutto:</strong> {{bestellung.summeBrutto}}</p>
  <p><strong>Stornorechnung:</strong> {{links.stornoRechnung}}</p>
  <p>Bei Fragen melde dich gerne jederzeit.</p>
  <p>Viele Grüße<br/>Wine Academy Hamburg</p>`,
      bodyText: `Hallo {{kunde.vorname}},

  wir bestätigen die Stornierung deiner Bestellung {{bestellung.bestellnummer}} am {{stornierung.datum}}.

  Summe brutto: {{bestellung.summeBrutto}}
  Stornorechnung: {{links.stornoRechnung}}

  Viele Grüße
  Wine Academy Hamburg`,
      platzhalter: [
        { schluessel: 'kunde.vorname', beispiel: 'Max' },
        { schluessel: 'bestellung.bestellnummer', beispiel: 'WA-20251001' },
        { schluessel: 'bestellung.summeBrutto', beispiel: '1.270,00 €' },
        {
          schluessel: 'bestellung.positionenTableHtml',
          beschreibung: 'Übersicht der stornierten Positionen als Tabelle.',
          beispiel:
            '<table><tr><td>Sensorik Essentials</td><td>2</td><td>530,00 €</td></tr><tr><td>WSET Level 2</td><td>1</td><td>950,00 €</td></tr></table>',
        },
        {
          schluessel: 'stornierung.datum',
          beschreibung: 'Datum der Stornierung im ISO-Format.',
          beispiel: '2025-10-08',
        },
        {
          schluessel: 'links.stornoRechnung',
          beschreibung: 'Direktlink zur Stornorechnung.',
          beispiel: 'https://wineacademy.plan-p.de/api/public/bestellungen/WA-20251001/storno',
        },
      ],
      testPayload: {
        kunde: { vorname: 'Max' },
        bestellung: {
          bestellnummer: 'WA-20251001',
          summeBrutto: '1.270,00 €',
          positionenTableHtml:
            '<table><tr><td>Sensorik Essentials</td><td>2</td><td>530,00 €</td></tr><tr><td>WSET Level 2</td><td>1</td><td>950,00 €</td></tr></table>',
        },
        stornierung: {
          datum: '2025-10-08',
        },
        links: {
          stornoRechnung: 'https://wineacademy.plan-p.de/api/public/bestellungen/WA-20251001/storno',
        },
      },
    },
    {
      name: 'Storno-Backoffice',
      anwendungsfall: 'storno_backoffice',
      layout: 'backoffice',
      beschreibung: 'Interne Info bei stornierten Bestellungen.',
      betreff: 'Bestellung {{bestellung.bestellnummer}} wurde storniert',
      vorschauzeile: 'Storno ist eingegangen.',
      bodyHtml: `<h1>Bestellung {{bestellung.bestellnummer}} wurde storniert</h1>
  <p><strong>Status:</strong> {{bestellung.status}}</p>
  <p><strong>Stornodatum:</strong> {{stornierung.datum}}</p>
  <p><strong>Zahlungsmethode:</strong> {{bestellung.zahlungsmethode}}</p>
  <p><strong>Summen</strong><br/>
  Brutto: {{bestellung.summeBrutto}}<br/>
  Netto: {{bestellung.summeNetto}}<br/>
  Steuer: {{bestellung.summeSteuer}}<br/>
  Gutschein: {{bestellung.gutscheinBetrag}}</p>
  <p><strong>Kunde</strong><br/>
  {{bestellung.kunde.vorname}} {{bestellung.kunde.nachname}}<br/>
  E-Mail: {{bestellung.kunde.email}}<br/>
  Telefon: {{bestellung.kunde.telefon}}</p>
  <p><strong>Rechnungsadresse</strong><br/>
  {{bestellung.adresse.firmenname}}<br/>
  {{bestellung.adresse.strasse}}<br/>
  {{bestellung.adresse.plz}} {{bestellung.adresse.stadt}} ({{bestellung.adresse.land}})<br/>
  Rechnungs-E-Mail: {{bestellung.adresse.rechnungsEmail}}<br/>
  USt-ID: {{bestellung.adresse.ustId}}</p>
  <p><strong>Positionen</strong></p>
  {{bestellung.positionenTableHtml}}
  <p><strong>Rechnung:</strong> {{links.rechnung}}</p>
  <p><strong>Stornorechnung:</strong> {{links.stornoRechnung}}</p>
  <p><strong>Notizen:</strong> {{bestellung.notizen}}</p>`,
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
      platzhalter: [
        { schluessel: 'bestellung.bestellnummer', beispiel: 'WA-20251001' },
        { schluessel: 'bestellung.status', beispiel: 'storniert' },
        { schluessel: 'stornierung.datum', beispiel: '2025-10-08' },
        { schluessel: 'bestellung.zahlungsmethode', beispiel: 'rechnung' },
        { schluessel: 'bestellung.summeBrutto', beispiel: '1.270,00 €' },
        { schluessel: 'bestellung.summeNetto', beispiel: '1.067,23 €' },
        { schluessel: 'bestellung.summeSteuer', beispiel: '202,77 €' },
        { schluessel: 'bestellung.gutscheinBetrag', beschreibung: 'Summe eingelöster Gutscheine.' },
        {
          schluessel: 'bestellung.positionenTableHtml',
          beschreibung: 'HTML-Tabelle der stornierten Positionen.',
        },
        {
          schluessel: 'links.stornoRechnung',
          beschreibung: 'Direktlink zur Stornorechnung.',
          beispiel: 'https://wineacademy.plan-p.de/api/public/bestellungen/WA-20251001/storno',
        },
      ],
      testPayload: {
        bestellung: {
          bestellnummer: 'WA-20251001',
          status: 'storniert',
          zahlungsmethode: 'rechnung',
          summeBrutto: '1.270,00 €',
          summeNetto: '1.067,23 €',
          summeSteuer: '202,77 €',
          gutscheinBetrag: '0,00 €',
          kunde: {
            vorname: 'Anna',
            nachname: 'Beispiel',
            email: 'anna@example.com',
            telefon: '+49 40 123456',
          },
          adresse: {
            firmenname: '',
            strasse: 'Weinplatz 1',
            plz: '20095',
            stadt: 'Hamburg',
            land: 'Deutschland',
            rechnungsEmail: 'kunde@example.com',
            ustId: '',
          },
          positionenTableHtml:
            '<table><tr><td>Sensorik Essentials</td><td>2</td><td>530,00 €</td></tr><tr><td>WSET Level 2</td><td>1</td><td>950,00 €</td></tr></table>',
          positionenText: 'Sensorik Essentials · Menge: 2 · Summe: 530,00 €',
          notizen: '-',
        },
        stornierung: { datum: '2025-10-08' },
        links: {
          rechnung: 'https://wineacademy.plan-p.de/api/public/bestellungen/WA-20251001/rechnung',
          stornoRechnung: 'https://wineacademy.plan-p.de/api/public/bestellungen/WA-20251001/storno',
        },
      },
    },
  ];

  for (const notification of notificationSeeds) {
    const id = await upsertBenachrichtigung(strapi, notification);
    log(`Benachrichtigung angelegt/aktualisiert: ${notification.anwendungsfall} (ID ${id})`);
  }
}
