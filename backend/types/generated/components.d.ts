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

export interface BenachrichtigungToken extends Struct.ComponentSchema {
  collectionName: 'components_benachrichtigung_tokens';
  info: {
    description: 'Platzhalterbeschreibung für Benachrichtigungen';
    displayName: 'Token';
  };
  attributes: {
    beispiel: Schema.Attribute.String;
    beschreibung: Schema.Attribute.Text;
    schluessel: Schema.Attribute.String & Schema.Attribute.Required;
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
    label: Schema.Attribute.String & Schema.Attribute.Required;
    typ: Schema.Attribute.Enumeration<['bestellung', 'storno', 'sonstiges']> &
      Schema.Attribute.DefaultTo<'bestellung'>;
  };
}

declare module '@strapi/strapi' {
  export module Public {
    export interface ComponentSchemas {
      'benachrichtigung.token': BenachrichtigungToken;
      'bestellung.position': BestellungPosition;
      'system.benachrichtigungsempfaenger': SystemBenachrichtigungsempfaenger;
      'termin.seminartag': TerminSeminartag;
    }
  }
}
