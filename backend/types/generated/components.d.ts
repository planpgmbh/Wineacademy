import type { Schema, Struct } from '@strapi/strapi';

export interface BuchungTeilnehmer extends Struct.ComponentSchema {
  collectionName: 'components_buchung_teilnehmer';
  info: {
    description: 'Teilnehmerdaten f\u00FCr eine Buchung';
    displayName: 'Teilnehmer';
  };
  attributes: {
    besondereBeduerfnisse: Schema.Attribute.Text;
    email: Schema.Attribute.Email;
    geburtstag: Schema.Attribute.Date;
    nachname: Schema.Attribute.String & Schema.Attribute.Required;
    vorname: Schema.Attribute.String & Schema.Attribute.Required;
    wsetCandidateNumber: Schema.Attribute.String;
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

declare module '@strapi/strapi' {
  export module Public {
    export interface ComponentSchemas {
      'buchung.teilnehmer': BuchungTeilnehmer;
      'termin.seminartag': TerminSeminartag;
    }
  }
}
