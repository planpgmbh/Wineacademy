export default {
  routes: [
    {
      method: 'GET',
      path: '/public/bestellungen/:id',
      handler: 'bestellung.publicGet',
      config: { auth: false },
    },
    {
      method: 'GET',
      path: '/public/bestellungen/:id/rechnung',
      handler: 'bestellung.publicDownloadInvoice',
      config: { auth: false },
    },
    {
      method: 'GET',
      path: '/public/bestellungen/:id/storno',
      handler: 'bestellung.publicDownloadStorno',
      config: { auth: false },
    },
    {
      method: 'GET',
      path: '/public/bestellungen/:id/email-preview',
      handler: 'bestellung.publicEmailPreview',
      config: { auth: false },
    },
  ],
};
