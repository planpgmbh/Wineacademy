import type { Schema, Struct } from '@strapi/strapi';

export interface BestellungPosition extends Struct.ComponentSchema {
  collectionName: 'components_bestellung_positionen';
  info: {
    description: 'Warenkorbposition einer Bestellung';
    displayName: 'Position';
  };
  attributes: {
    beschreibung: Schema.Attribute.Text;
    einzelpreisBrutto: Schema.Attribute.Decimal;
    einzelpreisNetto: Schema.Attribute.Decimal;
    menge: Schema.Attribute.Integer &
      Schema.Attribute.SetMinMax<
        {
          min: 1;
        },
        number
      > &
      Schema.Attribute.DefaultTo<1>;
    produkt: Schema.Attribute.Relation<'oneToOne', 'api::produkt.produkt'>;
    steuerSatz: Schema.Attribute.Decimal;
    summeBrutto: Schema.Attribute.Decimal;
    summeNetto: Schema.Attribute.Decimal;
    summeSteuer: Schema.Attribute.Decimal;
    termin: Schema.Attribute.Relation<'oneToOne', 'api::termin.termin'>;
    titel: Schema.Attribute.String & Schema.Attribute.Required;
    typ: Schema.Attribute.Enumeration<['seminar', 'produkt', 'gutschein']> &
      Schema.Attribute.DefaultTo<'produkt'>;
  };
}

export interface BenachrichtigungPlatzhalter extends Struct.ComponentSchema {
  collectionName: 'components_benachrichtigung_platzhalter';
  info: {
    description: 'Beschreibt verfügbare Platzhalter innerhalb einer Benachrichtigung';
    displayName: 'Platzhalter';
  };
  attributes: {
    beispiel: Schema.Attribute.String;
    beschreibung: Schema.Attribute.Text;
    schluessel: Schema.Attribute.String & Schema.Attribute.Required;
  };
}

export interface GutscheinTab extends Struct.ComponentSchema {
  collectionName: 'components_gutschein_reiter';
  info: {
    description: 'Inhaltstab für Gutschein-Details';
    displayName: 'Tab';
  };
  attributes: {
    inhalt: Schema.Attribute.RichText;
    titel: Schema.Attribute.String & Schema.Attribute.Required;
  };
}

export interface SeminarTab extends Struct.ComponentSchema {
  collectionName: 'components_seminar_reiter';
  info: {
    description: 'Ein Inhaltstab für Seminardetails';
    displayName: 'Tab';
  };
  attributes: {
    inhalt: Schema.Attribute.CustomField<'plugin::advanced-richtext.advanced-richtext'>;
    titel: Schema.Attribute.String & Schema.Attribute.Required;
  };
}

export interface LandingSeminarFinder extends Struct.ComponentSchema {
  collectionName: 'components_landing_seminar_finders';
  info: {
    description: 'Filtermodul zur Seminar-Suche auf Landingpages';
    displayName: 'Seminar Finder';
  };
  attributes: {
    überschrift: Schema.Attribute.String;
    überschriftStufe: Schema.Attribute.Enumeration<['h2', 'h3', 'h4']> &
      Schema.Attribute.DefaultTo<'h2'>;
    hintergrundfarbe: Schema.Attribute.Enumeration<[
      'neutral',
      'black',
      'wine-blue',
      'wine-blue-light',
      'wine-blue-lighter',
      'wine-blue-lightest',
      'wine-blue-dark',
      'wine-blue-darker',
      'wine-blue-darkest'
    ]>;
    standardKategorie: Schema.Attribute.Relation<'oneToOne', 'api::kategorie.kategorie'>;
    sichtbareFilter: Schema.Attribute.Relation<'oneToMany', 'api::kategorie.kategorie'>;
  };
}

export interface LandingHero extends Struct.ComponentSchema {
  collectionName: 'components_landing_heroes';
  info: {
    description: 'Großes Hero-Element mit Video-Hintergrund und Call-to-Action.';
    displayName: 'Hero (Video)';
  };
  attributes: {
    überschrift: Schema.Attribute.String & Schema.Attribute.Required;
    überschriftStufe: Schema.Attribute.Enumeration<['h1', 'h2', 'h3', 'h4']> &
      Schema.Attribute.DefaultTo<'h2'>;
    einleitung: Schema.Attribute.Text;
    heroVideo: Schema.Attribute.Media<'videos'>;
    heroPosterBild: Schema.Attribute.Media<'images'>;
    buttonText: Schema.Attribute.String;
    buttonLink: Schema.Attribute.String;
  };
}

export interface LandingHeroBlank extends Struct.ComponentSchema {
  collectionName: 'components_landing_hero_blanks';
  info: {
    description: 'Hero-Sektion nur mit Headline und Einleitung.';
    displayName: 'Hero (Blank)';
  };
  attributes: {
    überschrift: Schema.Attribute.String & Schema.Attribute.Required;
    überschriftStufe: Schema.Attribute.Enumeration<['h1', 'h2', 'h3', 'h4']> &
      Schema.Attribute.DefaultTo<'h2'>;
    einleitung: Schema.Attribute.Text;
  };
}

export interface LandingHeroCarousel extends Struct.ComponentSchema {
  collectionName: 'components_landing_hero_carousels';
  info: {
    description: 'Hero-Sektion mit vollflächigem Bildkarussell, Titel und Einleitungstext.';
    displayName: 'Hero (Bildkarussell)';
  };
  attributes: {
    überschrift: Schema.Attribute.String & Schema.Attribute.Required;
    überschriftStufe: Schema.Attribute.Enumeration<['h1', 'h2', 'h3', 'h4']> &
      Schema.Attribute.DefaultTo<'h2'>;
    einleitung: Schema.Attribute.Text;
    rotationSekunden: Schema.Attribute.Integer & Schema.Attribute.DefaultTo<8> &
      Schema.Attribute.SetMinMax<{
        max: 60;
        min: 2;
      }, number>;
    bilder: Schema.Attribute.Media<'images', true>;
  };
}

export interface LandingBildergalerie extends Struct.ComponentSchema {
  collectionName: 'components_landing_bildergalerien';
  info: {
    description: 'Bildkarussell für Hero- oder Content-Bereiche.';
    displayName: 'Bildergalerie';
  };
  attributes: {
    rotationSekunden: Schema.Attribute.Integer & Schema.Attribute.DefaultTo<7> &
      Schema.Attribute.SetMinMax<{
        max: 60;
        min: 2;
      }, number>;
    breite: Schema.Attribute.Enumeration<['full', 'content']> &
      Schema.Attribute.DefaultTo<'full'>;
    bilder: Schema.Attribute.Media<'images', true>;
  };
}

export interface LandingHeroSmall extends Struct.ComponentSchema {
  collectionName: 'components_landing_hero_smalls';
  info: {
    description: 'Kompakter Hero-Bereich mit stark weichgezeichnetem Hintergrundbild.';
    displayName: 'Hero (Klein)';
  };
  attributes: {
    überschrift: Schema.Attribute.String & Schema.Attribute.Required;
    überschriftStufe: Schema.Attribute.Enumeration<['h1', 'h2', 'h3', 'h4']> &
      Schema.Attribute.DefaultTo<'h2'>;
    einleitung: Schema.Attribute.Text;
    hintergrundbild: Schema.Attribute.Media<'images'>;
  };
}

export interface LandingCard extends Struct.ComponentSchema {
  collectionName: 'components_landing_cards';
  info: {
    description: 'Einfache Karte für Teaser-Abschnitte.';
    displayName: 'Karte';
  };
  attributes: {
    überschrift: Schema.Attribute.String & Schema.Attribute.Required;
    einleitung: Schema.Attribute.String;
    link: Schema.Attribute.String;
    textAlignment: Schema.Attribute.Enumeration<['left', 'center', 'right']> &
      Schema.Attribute.DefaultTo<'left'>;
    verticalAlignment: Schema.Attribute.Enumeration<['top', 'center', 'bottom']> &
      Schema.Attribute.DefaultTo<'top'>;
    backgroundImage: Schema.Attribute.Media<'images'>;
    darkModeEnabled: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<false>;
  };
}

export interface LandingColumn extends Struct.ComponentSchema {
  collectionName: 'components_landing_columns_einträge';
  info: {
    description: 'Einzelne Spalte innerhalb des Spalten-Layouts.';
    displayName: 'Spalte';
  };
  attributes: {
    titel: Schema.Attribute.String & Schema.Attribute.Private & Schema.Attribute.DefaultTo<'Spalte'>;
    bild: Schema.Attribute.Media<'images'>;
    inhalt: Schema.Attribute.CustomField<'plugin::advanced-richtext.advanced-richtext'>;
  };
}

export interface LandingColumns extends Struct.ComponentSchema {
  collectionName: 'components_landing_column_sections';
  info: {
    description: 'Abschnitt mit bis zu drei individuell befüllbaren Spalten.';
    displayName: 'Spalten';
  };
  attributes: {
    überschrift: Schema.Attribute.String;
    überschriftStufe: Schema.Attribute.Enumeration<['h2', 'h3', 'h4']> &
      Schema.Attribute.DefaultTo<'h2'>;
    darstellung: Schema.Attribute.Enumeration<['box', 'plain']> &
      Schema.Attribute.DefaultTo<'plain'>;
    hintergrundfarbe: Schema.Attribute.Enumeration<[
      'neutral',
      'black',
      'wine-blue',
      'wine-blue-light',
      'wine-blue-lighter',
      'wine-blue-lightest',
      'wine-blue-dark',
      'wine-blue-darker',
      'wine-blue-darkest'
    ]>;
    spalten: Schema.Attribute.Component<'landing.column', true> &
      Schema.Attribute.SetMinMax<
        {
          min: 1;
          max: 3;
        },
        number
      >;
  };
}

export interface LandingTrennlinie extends Struct.ComponentSchema {
  collectionName: 'components_landing_trennlinien';
  info: {
    description: 'Horizontale Linie mit Logo zur optischen Trennung zwischen Abschnitten.';
    displayName: 'Trennlinie';
  };
  attributes: {
    breite: Schema.Attribute.Enumeration<['normal', 'weit']> &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<'normal'>;
  };
}

export interface LandingCardGrid extends Struct.ComponentSchema {
  collectionName: 'components_landing_card_grids';
  info: {
    description: 'Mehrspaltiges Grid aus einfachen Karten.';
    displayName: 'Karten-Grid';
  };
  attributes: {
    hintergrundfarbe: Schema.Attribute.Enumeration<[
      'neutral',
      'black',
      'wine-blue',
      'wine-blue-light',
      'wine-blue-lighter',
      'wine-blue-lightest',
      'wine-blue-dark',
      'wine-blue-darker',
      'wine-blue-darkest'
    ]>;
    karten: Schema.Attribute.Component<'landing.card', true>;
  };
}

export interface LandingSeminarListe extends Struct.ComponentSchema {
  collectionName: 'components_landing_seminar_listen';
  info: {
    description: 'Liste der nächsten Seminare für eine ausgewählte Kategorie.';
    displayName: 'Seminarliste';
  };
  attributes: {
    überschrift: Schema.Attribute.String;
    überschriftStufe: Schema.Attribute.Enumeration<['h2', 'h3', 'h4']> &
      Schema.Attribute.DefaultTo<'h2'>;
    hintergrundfarbe: Schema.Attribute.Enumeration<[
      'neutral',
      'black',
      'wine-blue',
      'wine-blue-light',
      'wine-blue-lighter',
      'wine-blue-lightest',
      'wine-blue-dark',
      'wine-blue-darker',
      'wine-blue-darkest'
    ]>;
    einleitung: Schema.Attribute.Text;
    seminarkategorie: Schema.Attribute.Relation<'oneToOne', 'api::kategorie.kategorie'> & Schema.Attribute.Required;
    anzahl: Schema.Attribute.Integer & Schema.Attribute.DefaultTo<6> &
      Schema.Attribute.SetMinMax<{
        max: 24;
        min: 1;
      }, number>;
    buttonText: Schema.Attribute.String & Schema.Attribute.DefaultTo<'Zum Seminar'>;
    mehrButtonText: Schema.Attribute.String & Schema.Attribute.DefaultTo<'Mehr laden'>;
    mehrButtonAnzeigen: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<true>;
  };
}

export interface LandingSeminarProduktKarten extends Struct.ComponentSchema {
  collectionName: 'components_landing_seminar_produkt_karten';
  info: {
    description: 'Raster für Seminare oder Produkte mit Lade-Button.';
    displayName: 'Seminar/Produkt-Karten';
  };
  attributes: {
    überschrift: Schema.Attribute.String;
    überschriftStufe: Schema.Attribute.Enumeration<['h2', 'h3', 'h4']> &
      Schema.Attribute.DefaultTo<'h2'>;
    hintergrundfarbe: Schema.Attribute.Enumeration<[
      'neutral',
      'black',
      'wine-blue',
      'wine-blue-light',
      'wine-blue-lighter',
      'wine-blue-lightest',
      'wine-blue-dark',
      'wine-blue-darker',
      'wine-blue-darkest'
    ]>;
    einleitung: Schema.Attribute.Text;
    modus: Schema.Attribute.Enumeration<['seminare', 'produkte']> &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<'seminare'>;
    seminarkategorie: Schema.Attribute.Relation<'oneToOne', 'api::kategorie.kategorie'>;
    produkte: Schema.Attribute.Relation<'oneToMany', 'api::produkt.produkt'>;
    anzahl: Schema.Attribute.Integer &
      Schema.Attribute.DefaultTo<6> &
      Schema.Attribute.SetMinMax<{
        max: 24;
        min: 1;
      }, number>;
    buttonText: Schema.Attribute.String & Schema.Attribute.DefaultTo<'Mehr erfahren'>;
    mehrButtonText: Schema.Attribute.String & Schema.Attribute.DefaultTo<'Mehr laden'>;
    mehrButtonAnzeigen: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<true>;
  };
}

export interface LandingTextBlock extends Struct.ComponentSchema {
  collectionName: 'components_landing_text_blocks';
  info: {
    description: 'Freier Richtext mit optionalem CTA-Button.';
    displayName: 'Textblock';
  };
  attributes: {
    hintergrundfarbe: Schema.Attribute.Enumeration<[
      'neutral',
      'black',
      'wine-blue',
      'wine-blue-light',
      'wine-blue-lighter',
      'wine-blue-lightest',
      'wine-blue-dark',
      'wine-blue-darker',
      'wine-blue-darkest'
    ]>;
    einleitung: Schema.Attribute.Text &
      Schema.Attribute.CustomField<'plugin::advanced-richtext.advanced-richtext'>;
    buttonText: Schema.Attribute.String;
    buttonLink: Schema.Attribute.String;
  };
}

export interface LandingTab extends Struct.ComponentSchema {
  collectionName: 'components_landing_reiter_einträge';
  info: {
    description: 'Inhaltlicher Tab für Landingpages';
    displayName: 'Tab';
  };
  attributes: {
    inhalt: Schema.Attribute.CustomField<'plugin::advanced-richtext.advanced-richtext'>;
    überschrift: Schema.Attribute.String & Schema.Attribute.Required;
  };
}

export interface LandingTabs extends Struct.ComponentSchema {
  collectionName: 'components_landing_reiter_groups';
  info: {
    description: 'Tab-Gruppe für Landingpages';
    displayName: 'Tabs';
  };
  attributes: {
    überschrift: Schema.Attribute.String;
    überschriftStufe: Schema.Attribute.Enumeration<['h2', 'h3', 'h4']> &
      Schema.Attribute.DefaultTo<'h2'>;
    hintergrundfarbe: Schema.Attribute.Enumeration<[
      'neutral',
      'black',
      'wine-blue',
      'wine-blue-light',
      'wine-blue-lighter',
      'wine-blue-lightest',
      'wine-blue-dark',
      'wine-blue-darker',
      'wine-blue-darkest'
    ]>;
    reiter: Schema.Attribute.Component<'landing.tab', true> & Schema.Attribute.SetMinMax<{ min: 1 }, number>;
  };
}

export interface ProduktTab extends Struct.ComponentSchema {
  collectionName: 'components_produkt_reiter';
  info: {
    description: 'Inhaltstab für Produktdetails';
    displayName: 'Tab';
  };
  attributes: {
    inhalt: Schema.Attribute.RichText;
    titel: Schema.Attribute.String & Schema.Attribute.Required;
  };
}

export interface TerminSeminartag extends Struct.ComponentSchema {
  collectionName: 'components_termin_seminartag';
  info: {
    description: 'Ein Tag mit Start- und Endzeit';
    displayName: 'Seminartag';
  };
  attributes: {
    datum: Schema.Attribute.Date & Schema.Attribute.Required;
    endzeit: Schema.Attribute.Time &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<'17:00:00'>;
    startzeit: Schema.Attribute.Time &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<'10:00:00'>;
  };
}

export interface SystemBenachrichtigungsempfaenger extends Struct.ComponentSchema {
  collectionName: 'components_system_benachrichtigungsempfaenger';
  info: {
    description: 'E-Mail-Empfänger für Systembenachrichtigungen';
    displayName: 'Benachrichtigungsempfänger';
  };
  attributes: {
    aktiv: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<true>;
    email: Schema.Attribute.Email & Schema.Attribute.Required;
    bezeichnung: Schema.Attribute.String & Schema.Attribute.Required;
    typ: Schema.Attribute.Enumeration<['bestellung', 'storno', 'sonstiges']> &
      Schema.Attribute.DefaultTo<'bestellung'>;
  };
}

declare module '@strapi/strapi' {
  export module Public {
    export interface ComponentSchemas {
      'benachrichtigung.platzhalter': BenachrichtigungPlatzhalter;
      'bestellung.position': BestellungPosition;
      'gutschein.tab': GutscheinTab;
      'landing.card': LandingCard;
      'landing.card-grid': LandingCardGrid;
      'landing.hero-blank': LandingHeroBlank;
      'landing.hero': LandingHero;
      'landing.hero-carousel': LandingHeroCarousel;
      'landing.bildergalerie': LandingBildergalerie;
      'landing.hero-small': LandingHeroSmall;
      'landing.column': LandingColumn;
      'landing.columns': LandingColumns;
      'landing.trennlinie': LandingTrennlinie;
      'landing.seminar-liste': LandingSeminarListe;
      'landing.seminar-produkt-karten': LandingSeminarProduktKarten;
      'landing.seminar-finder': LandingSeminarFinder;
      'landing.tab': LandingTab;
      'landing.reiter': LandingTabs;
      'landing.text-block': LandingTextBlock;
      'produkt.tab': ProduktTab;
      'seminar.tab': SeminarTab;
      'system.benachrichtigungsempfaenger': SystemBenachrichtigungsempfaenger;
      'termin.seminartag': TerminSeminartag;
    }
  }
}
