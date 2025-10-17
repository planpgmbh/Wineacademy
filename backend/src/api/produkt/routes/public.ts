export default {
  routes: [
    {
      method: 'GET',
      path: '/public/produkte',
      handler: 'produkt.publicList',
      config: { auth: false },
    },
    {
      method: 'GET',
      path: '/public/produkte/:slug',
      handler: 'produkt.publicDetail',
      config: { auth: false },
    },
  ],
};
