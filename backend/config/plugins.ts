import path from 'path';

export default () => ({
  'advanced-richtext': {
    enabled: true,
    resolve: path.resolve(__dirname, '../src/plugins/advanced-richtext'),
  },
});
