export default {
  routes: [
    {
      method: "GET",
      path: "/public/settings/tracking",
      handler: "einstellung.publicTracking",
      config: {
        auth: false,
      },
    },
  ],
};
