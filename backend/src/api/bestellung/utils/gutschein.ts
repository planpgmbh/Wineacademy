const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

type GutscheinTemplate = {
  minBetrag?: number | null;
  maxBetrag?: number | null;
};

export interface GutscheinPositionAdjustment {
  brutto: number;
  netto: number;
  steuerSatz: number;
}

export interface GutscheinTotals {
  summeGutschein: number;
  gutscheinNetto: number;
  gutscheinSteuer: number;
  dueBrutto: number;
  dueNetto: number;
  dueSteuer: number;
}

export class GutscheinHelper {
  private template: GutscheinTemplate | null | undefined;

  constructor(private readonly strapi: any) {}

  isGutscheinPosition(raw: any, produkt: any): boolean {
    return Boolean(raw?.typ === 'gutschein' || produkt?.gutschein);
  }

  private async getTemplate(): Promise<GutscheinTemplate | null> {
    if (this.template !== undefined) {
      return this.template;
    }
    this.template = await this.strapi.db.query('api::gutschein.gutschein').findOne({
      where: { istTemplate: true },
      select: ['minBetrag', 'maxBetrag'],
    });
    return this.template as GutscheinTemplate | null;
  }

  async applyAdjustments(raw: any, produkt: any): Promise<GutscheinPositionAdjustment | null> {
    if (!this.isGutscheinPosition(raw, produkt)) {
      return null;
    }
    const template = await this.getTemplate();
    if (!template) {
      throw new Error('Kein Gutschein-Template konfiguriert');
    }

    const betragCandidate =
      raw?.betrag != null
        ? Number(raw.betrag)
        : Number(raw?.einzelpreisBrutto ?? produkt?.preisBrutto ?? produkt?.preisNetto);

    if (!Number.isFinite(betragCandidate) || betragCandidate <= 0) {
      throw new Error('Gutscheinbetrag ungültig');
    }

    const min = template.minBetrag != null ? Number(template.minBetrag) : undefined;
    const max = template.maxBetrag != null ? Number(template.maxBetrag) : undefined;

    if (min != null && betragCandidate < min) {
      throw new Error(`Gutscheinbetrag muss mindestens ${min} sein`);
    }
    if (max != null && betragCandidate > max) {
      throw new Error(`Gutscheinbetrag darf höchstens ${max} sein`);
    }

    const betrag = round2(betragCandidate);

    return {
      brutto: betrag,
      netto: betrag,
      steuerSatz: 0,
    };
  }
}

export function calculateGutscheinTotals(
  summePositionenBrutto: number,
  summePositionenNetto: number,
  summeSteuer: number,
  gutscheinBetrag: number
): GutscheinTotals {
  const summeGutschein = round2(Math.max(0, Number.isFinite(gutscheinBetrag) ? gutscheinBetrag : 0));
  const dueBrutto = round2(Math.max(0, summePositionenBrutto - summeGutschein));
  const ratio = summePositionenBrutto > 0 ? summePositionenNetto / summePositionenBrutto : 1;
  const gutscheinNetto = round2(summeGutschein * ratio);
  const gutscheinSteuer = round2(summeGutschein - gutscheinNetto);
  const dueNetto = round2(Math.max(0, summePositionenNetto - gutscheinNetto));
  const dueSteuer = round2(Math.max(0, summeSteuer - gutscheinSteuer));

  return {
    summeGutschein,
    gutscheinNetto,
    gutscheinSteuer,
    dueBrutto,
    dueNetto,
    dueSteuer,
  };
}
