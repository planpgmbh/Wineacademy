export default {
  routes: [
    {
      method: 'GET',
      path: '/public/kategorien',
      handler: 'kategorie.publicList',
      config: {
        auth: false,
      },
    },
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
