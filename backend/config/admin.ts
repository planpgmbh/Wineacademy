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
  preview: {
    enabled: true,
    config: {
      allowedOrigins: env.array('PREVIEW_ALLOWED_ORIGINS', [env('FRONTEND_BASE_URL', env('PUBLIC_URL', ''))].filter(Boolean)),
      handler: async (uid: string, { documentId, status }: { documentId?: string; status?: 'draft' | 'published' }) => {
        if (uid !== 'api::landingpage.landingpage' || !documentId) {
          return undefined;
        }

        const previewSecret = env('PREVIEW_SECRET', env('ADMIN_JWT_SECRET'));
        const frontendBase = env('PREVIEW_FRONTEND_URL', env('FRONTEND_BASE_URL', env('PUBLIC_URL', ''))).replace(/\/*$/, '');

        if (!previewSecret || !frontendBase) {
          return undefined;
        }

        const documentService = strapi.documents(uid as any);
        const document = (await documentService.findOne({
          documentId,
          status: status === 'published' ? 'published' : 'draft',
          fields: ['slug'],
        })) as Record<string, unknown> | null;

        const slug = typeof document?.slug === 'string' ? (document.slug as string) : null;
        if (!slug) {
          return undefined;
        }

        const searchParams = new URLSearchParams({
          secret: previewSecret,
          type: 'landingpage',
          documentId,
          status: status === 'published' ? 'published' : 'draft',
          slug,
        });

        return `${frontendBase}/preview?${searchParams.toString()}`;
      },
    },
  },
  flags: {
    nps: env.bool('FLAG_NPS', true),
    promoteEE: env.bool('FLAG_PROMOTE_EE', true),
  },
});
