export default {
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
