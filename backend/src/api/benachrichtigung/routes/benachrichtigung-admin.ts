export default {
  routes: [
    {
      method: 'POST',
      path: '/benachrichtigungen/:id/test-send',
      handler: 'benachrichtigung.testSend',
      config: {
        policies: ['admin::isAuthenticatedAdmin'],
        middlewares: [],
      },
      type: 'admin',
    },
  ],
};
