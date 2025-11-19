import { runSevDeskPaymentStatusSync } from '../src/api/bestellung/services/sevdesk-payment-sync';

const DEFAULT_RULE = '*/15 * * * *';
const DEFAULT_TZ = process.env.SEVDESK_PAYMENT_SYNC_TZ || process.env.TZ || 'Europe/Berlin';

export default {
  'sevdesk-payment-sync': {
    task: async ({ strapi }: { strapi: any }) => {
      await runSevDeskPaymentStatusSync(strapi);
    },
    options: {
      rule: process.env.SEVDESK_PAYMENT_SYNC_CRON || DEFAULT_RULE,
      tz: DEFAULT_TZ,
    },
  },
};
