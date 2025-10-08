export default {
  routes: [
    {
      method: "GET",
      path: "/public/landing-pages/:slug",
      handler: "landingpage.public",
      config: {
        auth: false,
      },
    },
  ],
};
