export default {
  routes: [
    {
      method: 'POST',
      path: '/public/paypal/webhook',
      handler: 'paypal.handleWebhook',
      config: { auth: false },
    },
  ],
};
