export default ({ env }) => [
  'strapi::logger',
  'global::force-https',
  'strapi::errors',
  'strapi::security',
  {
    name: 'strapi::cors',
    config: {
      origin: env.array('CORS_ORIGINS', ['*']),
      headers: [
        'Content-Type',
        'Authorization',
        'Origin',
        'Accept',
        'Access-Control-Request-Method',
        'Access-Control-Request-Headers',
      ],
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'],
      keepHeaderOnError: true,
    },
  },
  'strapi::poweredBy',
  'strapi::query',
  {
    name: 'strapi::body',
    config: {
      formLimit: '10mb',
      jsonLimit: '2mb',
      textLimit: '2mb',
      formidable: {
        maxFileSize: 25 * 1024 * 1024,
      },
    },
  },
  'global::restrict-upload-types',
  'strapi::session',
  'strapi::favicon',
  'strapi::public',
];
