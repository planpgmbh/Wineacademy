export default {
  routes: [
    {
      method: 'GET',
      path: '/public/seminare',
      handler: 'seminar.publicList',
      config: { auth: false },
    },
    {
      method: 'GET',
      path: '/public/seminare/:slug',
      handler: 'seminar.publicDetail',
      config: { auth: false },
    },
  ],
};

