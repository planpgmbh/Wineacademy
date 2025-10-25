const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

type GutscheinTemplate = {
  minBetrag?: number | null;
  maxBetrag?: number | null;
};

type GutscheinRecord = {
  id: number;
  code: string;
  typ?: 'betrag' | 'prozent' | null;
  wert?: number | null;
  betrag?: number | null;
  restwert?: number | null;
  aktiv?: boolean | null;
  eingeloest?: boolean | null;
  eingeloestAnzahl?: number | null;
  maxEinloesungen?: number | null;
  mindesteinkauf?: number | null;
  maxRabatt?: number | null;
  gueltigBis?: string | Date | null;
  name?: string | null;
};

export type GutscheinCartTotals = {
  brutto: number;
  netto?: number;
  steuer?: number;
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

export interface GutscheinValidationResult {
  gutscheinId: number;
  code: string;
  typ: 'betrag' | 'prozent';
  betrag: number;
  restbetrag: number;
  name?: string;
  voucher: GutscheinRecord;
}

export class GutscheinHelper {
  private template: GutscheinTemplate | null | undefined;

  constructor(private readonly strapi: any) {}

  normaliseCode(input: string): string {
    return String(input || '')
      .trim()
      .replace(/\s+/g, '')
      .toUpperCase();
  }

  isGutscheinPosition(raw: any, produkt: any): boolean {
    return Boolean(raw?.typ === 'gutschein' || produkt?.gutschein);
  }

  private async getTemplate(): Promise<GutscheinTemplate | null> {
    if (this.template !== undefined) {
      return this.template;
    }
    const settings = await this.strapi.entityService.findMany('api::gutscheineinstellung.gutscheineinstellung', {
      fields: ['minBetrag', 'maxBetrag', 'aktiv'],
      pagination: { limit: 1 },
    });
    const template = Array.isArray(settings) ? settings[0] : settings;
    if (!template || template.aktiv === false) {
      this.template = null;
      return null;
    }
    this.template = {
      minBetrag: template.minBetrag ?? null,
      maxBetrag: template.maxBetrag ?? null,
    };
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

  async findVoucherByCode(code: string): Promise<GutscheinRecord | null> {
    const normalised = this.normaliseCode(code);
    if (!normalised) {
      return null;
    }
    const voucher = await this.strapi.db.query('api::gutschein.gutschein').findOne({
      where: { code: normalised },
      select: [
        'id',
        'code',
        'typ',
        'wert',
        'betrag',
        'restwert',
        'aktiv',
        'eingeloest',
        'eingeloestAnzahl',
        'maxEinloesungen',
        'mindesteinkauf',
        'maxRabatt',
        'gueltigBis',
        'name',
      ],
    });
    return voucher as GutscheinRecord | null;
  }

  private resolveAvailableAmount(voucher: GutscheinRecord): number {
    const amountCandidates = [
      voucher.restwert,
      voucher.betrag,
      voucher.wert,
    ];
    for (const candidate of amountCandidates) {
      if (candidate != null && Number.isFinite(Number(candidate))) {
        const parsed = Number(candidate);
        if (!Number.isNaN(parsed)) {
          return round2(parsed);
        }
      }
    }
    return 0;
  }

  async validateVoucher(code: string, totals: GutscheinCartTotals): Promise<GutscheinValidationResult> {
    const voucher = await this.findVoucherByCode(code);
    if (!voucher) {
      throw new Error('Gutscheincode wurde nicht gefunden.');
    }
    if (voucher.aktiv === false) {
      throw new Error('Dieser Gutscheincode ist aktuell nicht aktiv.');
    }
    if (voucher.eingeloest === true && !voucher.restwert) {
      throw new Error('Dieser Gutscheincode wurde bereits eingelöst.');
    }
    const now = new Date();
    if (voucher.gueltigBis) {
      const expiry = new Date(voucher.gueltigBis);
      if (!Number.isNaN(expiry.valueOf()) && expiry < now) {
        throw new Error('Dieser Gutscheincode ist abgelaufen.');
      }
    }
    const usageCount = voucher.eingeloestAnzahl != null ? Number(voucher.eingeloestAnzahl) : 0;
    if (
      voucher.maxEinloesungen != null &&
      Number.isFinite(Number(voucher.maxEinloesungen)) &&
      Number(voucher.maxEinloesungen) > 0 &&
      usageCount >= Number(voucher.maxEinloesungen)
    ) {
      throw new Error('Dieser Gutscheincode hat das Nutzungslimit erreicht.');
    }
    const brutto = Number(totals?.brutto ?? 0);
    if (!Number.isFinite(brutto) || brutto <= 0) {
      throw new Error('Der Warenkorb enthält keine anrechenbaren Positionen.');
    }
    if (
      voucher.mindesteinkauf != null &&
      Number.isFinite(Number(voucher.mindesteinkauf)) &&
      brutto < Number(voucher.mindesteinkauf)
    ) {
      throw new Error(`Dieser Gutscheincode gilt erst ab ${Number(voucher.mindesteinkauf).toFixed(2)} € Warenkorbwert.`);
    }

    const type = voucher.typ === 'prozent' ? 'prozent' : 'betrag';
    let discount = 0;
    let remaining = 0;

    if (type === 'prozent') {
      const percent = Number(voucher.wert ?? 0);
      if (!Number.isFinite(percent) || percent <= 0) {
        throw new Error('Der Prozentwert für diesen Gutschein ist ungültig.');
      }
      discount = round2((percent / 100) * brutto);
      if (voucher.maxRabatt != null && Number.isFinite(Number(voucher.maxRabatt))) {
        discount = Math.min(discount, round2(Number(voucher.maxRabatt)));
      }
      remaining = 0;
    } else {
      const available = this.resolveAvailableAmount(voucher);
      if (available <= 0) {
        throw new Error('Dieser Gutscheincode enthält kein Guthaben mehr.');
      }
      discount = Math.min(available, brutto);
      if (voucher.maxRabatt != null && Number.isFinite(Number(voucher.maxRabatt))) {
        discount = Math.min(discount, round2(Number(voucher.maxRabatt)));
      }
      remaining = round2(Math.max(0, available - discount));
    }

    discount = round2(Math.max(0, discount));
    if (discount <= 0) {
      throw new Error('Dieser Gutscheincode kann auf den aktuellen Warenkorb nicht angewendet werden.');
    }

    return {
      gutscheinId: voucher.id,
      code: voucher.code,
      typ: type,
      betrag: discount,
      restbetrag: remaining,
      name: voucher.name ?? undefined,
      voucher,
    };
  }

  async registerVoucherRedemption(
    voucher: GutscheinRecord,
    appliedAmount: number,
    remainingAmount: number
  ): Promise<void> {
    if (!voucher?.id) {
      return;
    }
    const usageCount = voucher.eingeloestAnzahl != null ? Number(voucher.eingeloestAnzahl) : 0;
    const nextUsageCount = usageCount + 1;
    const update: Record<string, any> = {
      eingeloestAnzahl: nextUsageCount,
    };

    const type = voucher.typ === 'prozent' ? 'prozent' : 'betrag';
    const limitReached =
      voucher.maxEinloesungen != null &&
      Number.isFinite(Number(voucher.maxEinloesungen)) &&
      Number(voucher.maxEinloesungen) > 0 &&
      nextUsageCount >= Number(voucher.maxEinloesungen);

    let shouldDeactivate = false;

    if (type === 'betrag') {
      update.restwert = round2(Math.max(0, remainingAmount));
      if (remainingAmount <= 0.01) {
        update.eingeloest = true;
        shouldDeactivate = true;
      }
    }

    if (limitReached) {
      update.eingeloest = true;
      shouldDeactivate = true;
    }

    if (shouldDeactivate) {
      update.aktiv = false;
      update.eingeloestAm = new Date().toISOString();
    }

    if (appliedAmount > 0 && type === 'betrag' && !update.eingeloest) {
      update.aktiv = true;
    }

    await this.strapi.entityService.update('api::gutschein.gutschein', voucher.id, {
      data: update,
    });
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
