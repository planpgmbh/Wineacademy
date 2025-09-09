// Lightweight lifecycles without explicit Strapi TS types to keep build simple

type Teilnehmer = {
  vorname: string;
  nachname: string;
  email: string;
  geburtstag: string;
  wsetCandidateNumber?: string;
  besondereBeduerfnisse?: string;
};

const getTeilnehmerList = (raw: any): any[] => {
  if (Array.isArray(raw)) return raw;
  if (raw && typeof raw === 'object') {
    if (Array.isArray((raw as any).set)) return (raw as any).set;
    if (Array.isArray((raw as any).create)) return (raw as any).create;
  }
  return [];
};

const ensureTeilnehmerArray = (teilnehmer: any) => {
  const list = getTeilnehmerList(teilnehmer);
  if (!Array.isArray(list) || list.length < 1) {
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

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

const computeAnzahlUndPreis = async (data: any) => {
  const teilnehmer = getTeilnehmerList(data.teilnehmer) as Teilnehmer[];
  const anzahl = Array.isArray(teilnehmer) ? teilnehmer.length : 0;
  if (anzahl < 1) throw new Error('Mindestens ein Teilnehmer ist erforderlich');
  data.anzahl = anzahl;

  // Konfiguration
  const defaultVat = Number(process.env.VAT_RATE ?? 19);
  const pricesIncludeVat = String(process.env.PRICES_INCLUDE_VAT ?? 'true') === 'true';

  // Eingabequellen priorisieren: preisBrutto -> preisNetto -> termin.preis (als Brutto, wenn pricesIncludeVat=true)
  let preisBrutto: number | undefined = data.preisBrutto != null ? Number(data.preisBrutto) : undefined;
  let preisNetto: number | undefined = data.preisNetto != null ? Number(data.preisNetto) : undefined;

  // Fallback von termin.preis
  if (preisBrutto == null && preisNetto == null && data.termin) {
    const termin = await (strapi as any).db.query('api::termin.termin').findOne({ where: { id: data.termin }, select: ['preis'] });
    if (termin?.preis != null) {
      if (pricesIncludeVat) preisBrutto = Number(termin.preis);
      else preisNetto = Number(termin.preis);
    }
  }

  // MwSt-Entscheidung
  const mitMwst = data.mitMwst !== undefined ? !!data.mitMwst : true;
  let steuerSatz = Number(data.steuerSatz != null ? data.steuerSatz : defaultVat);
  if (!mitMwst) steuerSatz = 0;
  data.mitMwst = mitMwst;
  data.steuerSatz = steuerSatz;

  // Brutto/Netto berechnen
  if (mitMwst) {
    if (preisBrutto == null && preisNetto != null) preisBrutto = round2(preisNetto * (1 + steuerSatz / 100));
    if (preisNetto == null && preisBrutto != null) preisNetto = round2(preisBrutto / (1 + steuerSatz / 100));
  } else {
    if (preisNetto == null && preisBrutto != null) preisNetto = preisBrutto; // ohne MwSt: brutto==netto
    if (preisBrutto == null && preisNetto != null) preisBrutto = preisNetto;
  }

  // Falls noch immer undefiniert, Fehler
  if (preisBrutto == null || preisNetto == null) throw new Error('Preis (brutto oder netto) erforderlich');

  const steuerBetrag = round2(mitMwst ? preisBrutto - preisNetto : 0);
  const gesamtpreisBrutto = round2(preisBrutto * anzahl);
  const gesamtpreisNetto = round2(preisNetto * anzahl);
  const gesamtsteuerBetrag = round2(steuerBetrag * anzahl);

  // Setze neue Felder
  data.preisBrutto = preisBrutto;
  data.preisNetto = preisNetto;
  data.steuerBetrag = steuerBetrag;
  data.gesamtpreisBrutto = gesamtpreisBrutto;
  data.gesamtpreisNetto = gesamtpreisNetto;
  data.gesamtsteuerBetrag = gesamtsteuerBetrag;

  // Legacy-Felder weiter bedienen (für Abwärtskompatibilität)
  data.preisProPlatz = preisBrutto;
  data.gesamtpreis = gesamtpreisBrutto;
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
