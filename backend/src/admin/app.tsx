import type { StrapiApp } from '@strapi/strapi/admin';

export default {
  config: {
    // Enable German in the admin interface language selector
    locales: ['en', 'de'],
  },
  bootstrap(app: StrapiApp) {},
};

