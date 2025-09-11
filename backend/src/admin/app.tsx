export default {
  register(app: any) {
    // Direktlink zu "bezahlt"-Buchungen im Content-Manager
    app.addMenuLink({
      to: '/content-manager/collection-types/api::buchung.buchung?page=1&pageSize=20&sort=updatedAt:DESC&filters[$and][0][buchungsstatus][$eq]=bezahlt',
      icon: 'Money',
      intlLabel: { id: 'menu.buchungen.bezahlt', defaultMessage: 'Buchungen – bezahlt' },
      permissions: [],
    });
  },
  bootstrap() {},
};
