export default {
  routes: [
    {
      method: 'POST',
      path: '/public/buchungen',
      handler: 'buchung.publicCreate',
      config: { auth: false },
    },
  ],
};

