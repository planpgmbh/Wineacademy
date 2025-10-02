export default {
  routes: [
    {
      method: 'POST',
      path: '/benachrichtigung-templates/:id/test-send',
      handler: 'benachrichtigung-template.testSend',
      config: {
        policies: ['admin::isAuthenticatedAdmin'],
        middlewares: [],
      },
      type: 'admin',
    },
  ],
};
