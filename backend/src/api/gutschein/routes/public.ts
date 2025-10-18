export default {
  routes: [
    {
      method: 'GET',
      path: '/public/gutscheine/template',
      handler: 'gutschein.template',
      config: { auth: false },
    },
    {
      method: 'POST',
      path: '/public/gutscheine/pricing',
      handler: 'gutschein.pricing',
      config: { auth: false },
    },
    {
      method: 'POST',
      path: '/public/gutscheine/validate',
      handler: 'gutschein.validate',
      config: { auth: false },
    },
  ],
};
