// import type { Core } from '@strapi/strapi';

export default {
  // Läuft bevor die App initialisiert wird
  register(/* { strapi }: { strapi: Core.Strapi } */) {},

  // Bootstrap ohne Seed/Reset-Logik (bewusst leer)
  async bootstrap(/* { strapi }: { strapi: Core.Strapi } */) {},
};
