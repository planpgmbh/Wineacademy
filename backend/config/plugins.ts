import path from 'path';

export default () => ({
  'advanced-richtext': {
    enabled: true,
    resolve: path.resolve(__dirname, '../src/plugins/advanced-richtext'),
  },
  upload: {
    config: {
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
