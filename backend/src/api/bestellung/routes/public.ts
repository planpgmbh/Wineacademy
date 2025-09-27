export default {
  routes: [
    {
      method: 'POST',
      path: '/public/bestellungen',
      handler: 'bestellung.publicCreate',
      config: { auth: false },
    },
  ],
};
