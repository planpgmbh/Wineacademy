'use strict';

process.env.NODE_ENV = process.env.NODE_ENV || 'production';

const { createStrapi } = require('@strapi/strapi');

async function upsertSettings(strapi) {
  const data = {
    absenderName: 'technik@plan-p.de',
    absenderEmail: 'technik@plan-p.de',
    antwortEmail: 'schuberth@plan-p.de',
    benachrichtigungen: [
      {
        bezeichnung: 'Backoffice',
        email: 'philipp@plan-p.de',
        typ: 'bestellung',
        aktiv: true,
      },
    ],
  };

  const settings = await strapi.entityService.findMany('api::einstellung.einstellung', {
    fields: ['id'],
  });

  const existing = Array.isArray(settings) ? settings[0] : settings;

  if (existing && existing.id) {
    await strapi.entityService.update('api::einstellung.einstellung', existing.id, { data });
    strapi.log.info('Einstellungen aktualisiert.');
    return { action: 'updated', id: existing.id };
  }

  const created = await strapi.entityService.create('api::einstellung.einstellung', { data });
  strapi.log.info('Einstellungen erstellt.');
  return { action: 'created', id: created.id };
}

async function upsertNotification(strapi) {
  const where = { anwendungsfall: 'bestellbestaetigung' };
  const data = {
    name: 'Testbestätigung',
    anwendungsfall: 'bestellbestaetigung',
    layout: 'default',
    beschreibung: 'Testbenachrichtigung für SendGrid-Konfiguration',
    betreff: 'Wine Academy – Testbenachrichtigung',
    vorschauzeile: 'Dies ist eine Testzustellung für die SendGrid-Konfiguration.',
    bodyHtml: '<p>Hallo {{kunde.vorname}},</p><p>dies ist eine Testbenachrichtigung der Wine Academy. Deine Bestellnummer lautet {{bestellung.bestellnummer}}.</p><p>Viele Grüße<br/>Wine Academy</p>',
    bodyText: 'Hallo {{kunde.vorname}},\n\nDies ist eine Testbenachrichtigung der Wine Academy. Deine Bestellnummer lautet {{bestellung.bestellnummer}}.\n\nViele Grüße\nWine Academy',
    platzhalter: [
      {
        schluessel: 'kunde.vorname',
        beschreibung: 'Vorname des Kunden',
        beispiel: 'Philipp',
      },
      {
        schluessel: 'bestellung.bestellnummer',
        beschreibung: 'Bestellnummer inklusive Präfix',
        beispiel: 'WA-TEST-001',
      },
    ],
    testPayload: {
      kunde: {
        vorname: 'Philipp',
        nachname: 'Plan-P',
      },
      bestellung: {
        bestellnummer: 'WA-TEST-001',
        summeBrutto: '0,00 €',
      },
    },
    aktiv: true,
    sendgridVorlagenId: null,
  };

  const existingList = await strapi.entityService.findMany('api::benachrichtigung.benachrichtigung', {
    filters: where,
    fields: ['id'],
    limit: 1,
  });

  const existing = Array.isArray(existingList) ? existingList[0] : existingList;

  if (existing && existing.id) {
    await strapi.entityService.update('api::benachrichtigung.benachrichtigung', existing.id, { data });
    strapi.log.info('Benachrichtigung aktualisiert.');
    return { action: 'updated', id: existing.id };
  }

  const created = await strapi.entityService.create('api::benachrichtigung.benachrichtigung', { data });
  strapi.log.info('Benachrichtigung erstellt.');
  return { action: 'created', id: created.id };
}

async function run() {
  const app = await createStrapi({ distDir: './dist' });
  await app.load();
  try {
    const settingsResult = await upsertSettings(app);
    const notificationResult = await upsertNotification(app);
    console.log(JSON.stringify({ settingsResult, notificationResult }, null, 2));
  } finally {
    // Kurze Pause, damit eventuelle Lifecycle-Events ihre DB-Zugriffe abschließen können
    await new Promise((resolve) => setTimeout(resolve, 250));
    try {
      await app.destroy();
    } catch (error) {
      console.warn('Warnung: Strapi konnte nicht sauber herunterfahren.', error.message);
    }
  }
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
