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
  if (data.termin) {
    const termin = await (strapi as any).db.query('api::termin.termin').findOne({
      where: { id: data.termin },
      select: ['preis'],
      populate: { seminar: { select: ['mitMwst', 'standardPreis'] } },
    });
    // MwSt-Flag vom Seminar übernehmen, wenn nicht explizit gesetzt
    if (data.mitMwst === undefined && termin?.seminar && typeof termin.seminar.mitMwst === 'boolean') {
      data.mitMwst = !!termin.seminar.mitMwst;
    }
    // Preis-Fallback: Terminpreis → Seminar.standardPreis
    const basisPreis = (termin?.preis != null) ? Number(termin.preis) : (termin?.seminar?.standardPreis != null ? Number(termin.seminar.standardPreis) : undefined);
    if (basisPreis != null) {
      if (pricesIncludeVat) preisBrutto = basisPreis;
      else preisNetto = basisPreis;
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

const afterCreate = async (event: any) => {
  const rec = event?.result;
  if (!rec) return;
  try {
    // Bereits verknüpft → nichts tun
    if (rec.kunde) return;
    const email: string | undefined = rec.rechnungstyp === 'firma' ? (rec.rechnungsEmail || rec.email) : rec.email;
    if (!email) return;
    // Kunde suchen
    const existing = await (strapi as any).db.query('api::kunde.kunde').findOne({ where: { email }, select: ['id'] });
    let kundeId = existing?.id;
    if (!kundeId) {
      const created = await (strapi as any).entityService.create('api::kunde.kunde', {
        data: {
          vorname: rec.vorname || '—',
          nachname: rec.nachname || (rec.rechnungstyp === 'firma' ? (rec.firmenname || '—') : '—'),
          email,
          telefon: rec.telefon,
          strasse: rec.strasse,
          plz: rec.plz,
          stadt: rec.stadt,
          land: rec.land,
        },
      });
      kundeId = created.id;
    }
    if (kundeId) {
      await (strapi as any).entityService.update('api::buchung.buchung', rec.id, { data: { kunde: kundeId } });
    }
  } catch (e) {
    (strapi as any).log?.warn?.(`[buchung.afterCreate] Kunde-Verknüpfung übersprungen: ${(e as any)?.message || e}`);
  }

  // Titel automatisch setzen, wenn leer: "ID | VORNAME NACHNAME"
  try {
    const hasTitel = rec.titel && String(rec.titel).trim() !== '';
    if (!hasTitel && rec.id) {
      const parts = [
        String(rec.id),
        '|',
        String(rec.vorname || '').toUpperCase().trim(),
        String(rec.nachname || '').toUpperCase().trim(),
      ].filter((p) => p !== '');
      const titel = `${parts[0]} | ${[parts[2], parts[3]].filter(Boolean).join(' ')}`;
      await (strapi as any).entityService.update('api::buchung.buchung', rec.id, { data: { titel } });
    }
  } catch (e) {
    (strapi as any).log?.warn?.(`[buchung.afterCreate] Titel-Setzung übersprungen: ${(e as any)?.message || e}`);
  }
};

export default {
  beforeCreate,
  beforeUpdate,
  afterCreate,
};
