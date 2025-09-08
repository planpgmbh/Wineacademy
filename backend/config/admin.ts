export default ({ env }) => ({
  // Falls die App unter einem Pfadprefix läuft (z. B. /api), bleibt das Admin-Panel
  // unter /admin erreichbar. Optional via ENV überschreibbar.
  url: env('ADMIN_PUBLIC_URL', '/admin'),
  auth: {
    secret: env('ADMIN_JWT_SECRET'),
  },
  apiToken: {
    salt: env('API_TOKEN_SALT'),
  },
  transfer: {
    token: {
      salt: env('TRANSFER_TOKEN_SALT'),
    },
  },
  secrets: {
    encryptionKey: env('ENCRYPTION_KEY'),
  },
  flags: {
    nps: env.bool('FLAG_NPS', true),
    promoteEE: env.bool('FLAG_PROMOTE_EE', true),
  },
});
