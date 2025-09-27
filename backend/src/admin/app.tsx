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
};
