export default {
  routes: [
    {
      method: 'GET',
      path: '/public/buchungen/:id',
      handler: 'buchung.publicGet',
      config: { auth: false },
    },
  ],
};

