export default {
  routes: [
    {
      method: 'GET',
      path: '/public/kategorien/:slug',
      handler: 'kategorie.publicDetail',
      config: {
        auth: false,
      },
    },
  ],
};

