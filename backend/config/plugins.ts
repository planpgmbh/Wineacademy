export default () => ({
  'adentdk-tiptap-editor': {
    enabled: true,
  },
  upload: {
    config: {
      // Strapi-seitige Dateigroessenbegrenzung (25 MB)
      sizeLimit: 25 * 1024 * 1024,
      // Automatisch optimierte Bildvarianten für verschiedene Viewports
      breakpoints: {
        thumbnail: 200,
        small: 640,
        medium: 1024,
        large: 1600,
      },
    },
  },
});
