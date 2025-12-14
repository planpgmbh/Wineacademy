import pluginPkg from './package.json';
import pluginId from './admin/src/pluginId';
import { Pencil } from '@strapi/icons';

const displayName =
  pluginPkg?.strapi?.displayName ?? pluginPkg?.strapi?.name ?? pluginPkg?.name ?? 'Advanced Richtext';

const plugin = {
  register(app) {
    app.registerPlugin({
      id: pluginId,
      name: displayName,
    });
    app.customFields.register({
      name: 'advanced-richtext',
      pluginId,
      type: 'text',
      intlLabel: {
        id: `${pluginId}.field.label`,
        defaultMessage: displayName,
      },
      intlDescription: {
        id: `${pluginId}.field.description`,
        defaultMessage: 'Richtext-Feld mit Toolbar und HTML-Ansicht.',
      },
      icon: Pencil,
      components: {
        Input: async () => import('./admin/src/components/AdvancedRichTextInput'),
      },
    });
  },
  bootstrap() {},
  async registerTrads({ locales }) {
    const importedTrads = await Promise.all(
      locales.map(async (locale) => {
        try {
          const translations = await import(`./admin/src/translations/${locale}.json`);
          return { data: translations.default ?? translations, locale };
        } catch (error) {
          return { data: {}, locale };
        }
      })
    );

    return importedTrads;
  },
};

export default plugin;
