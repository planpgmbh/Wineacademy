export default ({ env }) => ({
  host: env('HOST', '0.0.0.0'),
  port: env.int('PORT', 1337),
  // Öffentliche Basis-URL der App. In Staging/Prod inkl. Pfadprefix setzen (z. B. https://domain/api)
  url: env('PUBLIC_URL'),
  // Hinter einem Reverse Proxy (Traefik) korrekte Protokoll/Host-Erkennung aktivieren
  proxy: true,
  app: {
    keys: env.array('APP_KEYS'),
  },
});
