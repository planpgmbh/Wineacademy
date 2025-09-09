export default {
  routes: [
    {
      method: 'POST',
      path: '/public/gutscheine/validate',
      handler: 'gutschein.validate',
      config: { auth: false },
    },
  ],
};

