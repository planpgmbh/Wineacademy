const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

const normalisePrices = (data: any) => {
  const defaultVat = Number(process.env.VAT_RATE ?? 19);
  const mwstAktiv = data.mwst !== undefined ? !!data.mwst : true;
  const rawSteuer = data.steuerSatz != null ? Number(data.steuerSatz) : defaultVat;
  const steuerSatz = mwstAktiv ? (Number.isFinite(rawSteuer) ? rawSteuer : defaultVat) : 0;

  let netto = data.preisNetto != null ? Number(data.preisNetto) : undefined;
  let brutto = data.preisBrutto != null ? Number(data.preisBrutto) : undefined;

  if (!Number.isFinite(netto as number) && !Number.isFinite(brutto as number)) {
    throw new Error('Preis (netto oder brutto) erforderlich');
  }

  if (!Number.isFinite(netto as number) && Number.isFinite(brutto as number)) {
    netto = mwstAktiv ? round2((brutto as number) / (1 + steuerSatz / 100)) : brutto;
  }
  if (!Number.isFinite(brutto as number) && Number.isFinite(netto as number)) {
    brutto = mwstAktiv ? round2((netto as number) * (1 + steuerSatz / 100)) : netto;
  }

  data.mwst = mwstAktiv;
  data.steuerSatz = steuerSatz;
  data.preisNetto = round2(netto as number);
  data.preisBrutto = round2(brutto as number);
};

export default {
  beforeCreate(event: any) {
    normalisePrices(event.params.data);
  },
  beforeUpdate(event: any) {
    if (event.params.data) {
      normalisePrices(event.params.data);
    }
  },
};
