import { seedLocations } from './locations';
import { seedProducts } from './products';
import { seedVouchers } from './vouchers';
import { seedNavigationAndFooter } from './navigation-footer';
import { seedNotifications } from './notifications';
import { seedSettings } from './settings';
import { seedLandingPages } from './landingpages';
import { seedCategories } from './kategorien';
import { seedSeminars } from './seminare';
import { ensureAuditFields } from './helpers';

export async function runSeed(strapi: any) {
  const log = (msg: string) => strapi.log.info(`[seed] ${msg}`);

  log('Starte Seeding');

  await seedLocations(strapi, log);
  await seedProducts(strapi, log);
  await seedVouchers(strapi, log);
  await seedCategories(strapi, log);
  await seedSeminars(strapi, log);
  await seedNavigationAndFooter(strapi, log);
  await seedNotifications(strapi, log);
  await seedSettings(strapi, log);
  await seedLandingPages(strapi, log);

  await ensureAuditFields(strapi, [
    'landingpages',
    'produkte',
    'gutscheine',
    'kategorien',
    'seminare',
    'standorte',
    'benachrichtigungen',
    'navigations',
    'footers',
    'gutscheineinstellungen',
    'einstellungen',
  ]);

  log('Seeding abgeschlossen');
}
