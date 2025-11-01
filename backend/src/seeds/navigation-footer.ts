import { nowIso, upsertSingleType } from './helpers';

export async function seedNavigationAndFooter(strapi: any, log: (msg: string) => void) {
  const navigationItems = [
    {
      titel: 'Wine Academy',
      link: '/wine-academy',
      ziel: '_self',
      unterpunkte: [
        { titel: 'Über uns', link: '/wine-academy', ziel: '_self' },
        { titel: 'Studio', link: '/wine-academy-studio', ziel: '_self' },
        { titel: 'Team', link: '/wine-academy-team', ziel: '_self' },
        { titel: 'Unsere Philosophie', link: '/wine-academy-philosophie', ziel: '_self' },
      ],
    },
    {
      titel: 'Sommelier',
      link: '/sommelier',
      ziel: '_self',
      unterpunkte: [
        { titel: 'Sommelier', link: '/sommelier', ziel: '_self' },
        { titel: 'WSET', link: '/wset', ziel: '_self' },
      ],
    },
    {
      titel: 'Kurse',
      link: '/kurse',
      ziel: '_self',
      unterpunkte: [
        { titel: 'Masterclasses', link: '/kurse-masterclasses', ziel: '_self' },
        { titel: 'Weinkurse', link: '/kurse-weinkurse', ziel: '_self' },
      ],
    },
    { titel: 'Events', link: '/veranstaltungen', ziel: '_self', unterpunkte: [] },
    { titel: 'Gutscheine', link: '/gutscheine', ziel: '_self', unterpunkte: [] },
    { titel: 'Kontakt', link: '/kontakt', ziel: '_self', unterpunkte: [] },
  ];

  const navigationId = await upsertSingleType(strapi, 'api::navigation.navigation', {
    items: navigationItems,
    publishedAt: nowIso(),
  });
  log(`Navigation aktualisiert (ID ${navigationId})`);

  const footerSections = [
    {
      titel: 'Post an uns',
      typ: 'kontakt',
      text: ['Eimsbütteler Chaussee 37', '20259 Hamburg', 'Tel.: 040-88 12 80 27', 'post@wineacademy.de'].join(
        '\n'
      ),
      links: [],
      logos: [],
    },
    {
      titel: 'Rechtliches',
      typ: 'links',
      links: [
        { label: 'AGB', href: '/agb', ziel: '_self' },
        { label: 'Widerruf', href: '/widerruf', ziel: '_self' },
        { label: 'Zahlungsarten', href: '/zahlungsarten', ziel: '_self' },
        { label: 'Bildnachweise', href: '/bildnachweise', ziel: '_self' },
        { label: 'Impressum', href: '/impressum', ziel: '_self' },
        { label: 'Datenschutz', href: '/datenschutz', ziel: '_self' },
      ],
      logos: [],
    },
    {
      titel: 'Wine Academy',
      typ: 'links',
      links: [
        { label: 'Über uns', href: '/wine-academy', ziel: '_self' },
        { label: 'Studio', href: '/wine-academy-studio', ziel: '_self' },
        { label: 'Team', href: '/wine-academy-team', ziel: '_self' },
        { label: 'Unsere Philosophie', href: '/wine-academy-philosophie', ziel: '_self' },
        { label: 'Sommelier', href: '/sommelier', ziel: '_self' },
        { label: 'WSET', href: '/wset', ziel: '_self' },
        { label: 'Masterclasses', href: '/kurse-masterclasses', ziel: '_self' },
        { label: 'Weinkurse', href: '/kurse-weinkurse', ziel: '_self' },
        { label: 'Events', href: '/veranstaltungen', ziel: '_self' },
      ],
      logos: [],
    },
    {
      titel: 'Zertifikate',
      typ: 'logos',
      links: [],
      logos: [
        { name: 'WSET', href: 'https://www.wsetglobal.com/' },
        { name: 'Certuria', href: 'https://www.certuria.de/' },
      ],
    },
  ];

  const footerId = await upsertSingleType(strapi, 'api::footer.footer', {
    sections: footerSections,
    publishedAt: nowIso(),
  });
  log(`Footer aktualisiert (ID ${footerId})`);
}
