// Lightweight lifecycles without explicit Strapi TS types to keep build simple

type Teilnehmer = {
  vorname: string;
  nachname: string;
  email: string;
  geburtstag: string;
  wsetCandidateNumber?: string;
  besondereBeduerfnisse?: string;
};

const ensureTeilnehmerArray = (teilnehmer: any[]) => {
  if (!Array.isArray(teilnehmer) || teilnehmer.length < 1) {
    throw new Error('Mindestens ein Teilnehmer ist erforderlich');
  }
};

const ensureFirmaFieldsIfNeeded = (data: any) => {
  if (data.rechnungstyp === 'firma') {
    const required = ['firmenname', 'rechnungsEmail', 'strasse', 'plz', 'stadt', 'land'];
    for (const f of required) {
      if (!data[f] || String(data[f]).trim() === '') {
        throw new Error(`Feld '${f}' ist bei Firmenrechnung erforderlich`);
      }
    }
  }
};

const computeAnzahlUndPreis = async (data: any) => {
  const teilnehmer = data.teilnehmer as Teilnehmer[];
  const anzahl = Array.isArray(teilnehmer) ? teilnehmer.length : 0;
  if (anzahl < 1) throw new Error('Mindestens ein Teilnehmer ist erforderlich');
  data.anzahl = anzahl;

  // preisProPlatz: falls nicht gesetzt, vom Termin ziehen
  if (data.termin && (data.preisProPlatz === undefined || data.preisProPlatz === null)) {
    // @ts-ignore strapi global
    const termin = await (strapi as any).db.query('api::termin.termin').findOne({ where: { id: data.termin }, select: ['preis'] });
    if (termin?.preis !== undefined && termin?.preis !== null) data.preisProPlatz = termin.preis;
  }

  if (data.preisProPlatz !== undefined && data.preisProPlatz !== null) {
    const p = Number(data.preisProPlatz);
    data.preisProPlatz = p;
    data.gesamtpreis = p * anzahl;
  }
};

const beforeCreate = async (event: any) => {
  const { data } = event.params;
  
  ensureTeilnehmerArray(data.teilnehmer);
  ensureFirmaFieldsIfNeeded(data);
  await computeAnzahlUndPreis(data);
};

const beforeUpdate = async (event: any) => {
  const { data } = event.params;
  if (data.teilnehmer) ensureTeilnehmerArray(data.teilnehmer);
  if (data.rechnungstyp) ensureFirmaFieldsIfNeeded(data);
  await computeAnzahlUndPreis(data);
};

export default {
  beforeCreate,
  beforeUpdate,
};
