export default {
  routes: [
    {
      method: 'GET',
      path: '/public/produkte',
      handler: 'produkt.publicList',
      config: { auth: false },
    },
  ],
};
