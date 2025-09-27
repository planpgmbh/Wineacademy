export default {
  routes: [
    {
      method: 'GET',
      path: '/public/bestellungen/:id',
      handler: 'bestellung.publicGet',
      config: { auth: false },
    },
  ],
};
