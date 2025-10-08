export default {
  routes: [
    {
      method: "GET",
      path: "/public/navigation",
      handler: "navigation.public",
      config: {
        auth: false,
      },
    },
  ],
};
