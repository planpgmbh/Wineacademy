export default {
  config: {
    locales: ['de'],
    theme: {
      light: {
        colors: {
          primary100: '#f0f4fb',
          primary200: '#dbe5f6',
          primary500: '#3b5b99',
          primary600: '#2b4270',
          primary700: '#1f3150',
          accent200: '#f3dbe1',
          accent500: '#8c1430',
          neutral100: '#f7f8fb',
          neutral200: '#e5e7eb',
          neutral500: '#4b5563',
          neutral700: '#1f2937',
          neutral900: '#0f172a',
        },
      },
    },
  },
  register(app: any) {
    // Direktlink zu "bezahlt"-Bestellungen im Content-Manager
    app.addMenuLink({
      to: '/content-manager/collection-types/api::bestellung.bestellung?page=1&pageSize=20&sort=updatedAt:DESC&filters[$and][0][bestellstatus][$eq]=bezahlt',
      icon: 'Money',
      intlLabel: { id: 'menu.bestellungen.bezahlt', defaultMessage: 'Bestellungen – bezahlt' },
      permissions: [],
    });

  },
  bootstrap() {},
  async registerTrads({ locales }: { locales: string[] }) {
    const importedTrads = await Promise.all(
      locales.map(async (locale) => {
        try {
          const translations = await import(`./translations/${locale}.json`);
          return { data: translations.default, locale };
        } catch (error) {
          return { data: {}, locale };
        }
      })
    );

    return importedTrads;
  },
};
