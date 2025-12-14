import path from 'path';

export default () => ({
  'adentdk-tiptap-editor': {
    enabled: true,
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
