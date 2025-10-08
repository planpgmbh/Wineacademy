export default {
  routes: [
    {
      method: "GET",
      path: "/public/footer",
      handler: "footer.public",
      config: {
        auth: false,
      },
    },
  ],
};
