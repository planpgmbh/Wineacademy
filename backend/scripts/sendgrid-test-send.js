'use strict';

process.env.NODE_ENV = process.env.NODE_ENV || 'production';

const { createStrapi } = require('@strapi/strapi');

const RECIPIENT = process.env.SENDGRID_TEST_RECIPIENT || 'philipp@plan-p.de';
const ANWENDUNGSFALL = 'bestellbestaetigung';

async function run() {
  const app = await createStrapi({ distDir: './dist' });
  await app.load();

  try {
    const [template] = await app.entityService.findMany('api::benachrichtigung.benachrichtigung', {
      filters: { anwendungsfall: ANWENDUNGSFALL },
      populate: ['platzhalter'],
      limit: 1,
    });

    if (!template) {
      throw new Error(`Benachrichtigung mit Anwendungsfall "${ANWENDUNGSFALL}" nicht gefunden.`);
    }

    const service = app.service('api::benachrichtigung.benachrichtigung');
    try {
      const result = await service.testSend({
        template,
        recipient: RECIPIENT,
      });
      console.log(JSON.stringify(result, null, 2));
    } catch (error) {
      const details = {
        message: error.message,
        code: error.code,
        responseStatus: error.response?.statusCode ?? error.code,
        responseBody: error.response?.body ?? null,
      };
      console.error('SendGrid-Testversand fehlgeschlagen:', JSON.stringify(details, null, 2));
      throw error;
    }
  } finally {
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
