import { customAlphabet } from 'nanoid';
import { normaliseShippingValue, roundCurrency } from '../../../utils/shipping';

type StrapiInstance = {
  db: any;
  entityService: any;
  log: { info?: (...args: any[]) => void; error?: (...args: any[]) => void; warn?: (...args: any[]) => void };
};

type GutscheinDetails = {
  versandArt?: 'digital' | 'physisch';
  empfaengerVorname?: string;
  empfaengerNachname?: string;
  empfaengerEmail?: string;
  adresszusatz?: string;
  strasse?: string;
  plz?: string;
  stadt?: string;
  land?: string;
  lieferDatum?: string;
  persoenlicheNachricht?: string;
  versandkosten?: number;
};

type BestellungPosition = {
  id?: number;
  typ?: string;
  titel?: string;
  beschreibung?: string;
  menge?: number;
  betrag?: number;
  summeBrutto?: number;
  einzelpreisBrutto?: number;
  versandkosten?: number;
  gutscheinDetails?: GutscheinDetails | null;
};

type GutscheinCreateInput = {
  name: string;
  code: string;
  betrag: number;
  restwert: number;
  aktiv: boolean;
  bestellung: number;
  versandDetails?: GutscheinDetails | null;
};

type ExistingGutschein = {
  id: number;
  bestellung: { id: number } | null;
  code: string;
};

type BestellungEntity = {
  id: number;
  bestellstatus: string;
  bestellnummer?: string | null;
  positionen: BestellungPosition[];
  gutscheine?: ExistingGutschein[];
};

type CreateResult = {
  id: number;
  code: string;
};

type GutscheinSettings = {
  name?: string | null;
  versandkosten?: number | null;
};

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const nanoidSegment = customAlphabet(CODE_ALPHABET, 4);

const round2 = roundCurrency;

function generateVoucherCode(): string {
  return `${nanoidSegment()}-${nanoidSegment()}-${nanoidSegment()}-${nanoidSegment()}`;
}

function normaliseGutscheinDetails(
  details: GutscheinDetails | null | undefined,
  defaultShipping?: number | null
): GutscheinDetails | null {
  if (!details || typeof details !== 'object') {
    return null;
  }
  const trimmed = <T extends string | undefined>(value: T): T => {
    if (typeof value !== 'string') {
      return value;
    }
    const result = value.trim();
    return (result as T) || undefined;
  };
  const result: GutscheinDetails = {
    versandArt: details.versandArt === 'physisch' ? 'physisch' : 'digital',
    empfaengerVorname: trimmed(details.empfaengerVorname),
    empfaengerNachname: trimmed(details.empfaengerNachname),
    empfaengerEmail: trimmed(details.empfaengerEmail),
    adresszusatz: trimmed(details.adresszusatz),
    strasse: trimmed(details.strasse),
    plz: trimmed(details.plz),
    stadt: trimmed(details.stadt),
    land: trimmed(details.land) || 'Deutschland',
    lieferDatum: trimmed(details.lieferDatum),
    persoenlicheNachricht: trimmed(details.persoenlicheNachricht),
    versandkosten: undefined,
  };
  if (!result.empfaengerVorname || !result.empfaengerNachname) {
    const legacyName = trimmed((details as { empfaengerName?: string }).empfaengerName);
    if (legacyName) {
      const parts = legacyName.split(/\s+/).filter(Boolean);
      if (!result.empfaengerVorname && parts.length > 0) {
        result.empfaengerVorname = parts.shift();
      }
      if (!result.empfaengerNachname && parts.length > 0) {
        result.empfaengerNachname = parts.join(' ');
      }
      if (!result.empfaengerNachname && result.empfaengerVorname) {
        result.empfaengerNachname = result.empfaengerVorname;
      }
    }
  }
  if (result.versandArt === 'digital') {
    result.strasse = undefined;
    result.plz = undefined;
    result.stadt = undefined;
    result.land = undefined;
    const shipping = normaliseShippingValue(details.versandkosten);
    if (shipping != null && shipping > 0) {
      result.versandkosten = shipping;
    } else {
      result.versandkosten = undefined;
    }
  } else {
    result.empfaengerEmail = undefined;
    const shipping =
      normaliseShippingValue(details.versandkosten) ??
      (defaultShipping != null ? normaliseShippingValue(defaultShipping) : null);
    if (shipping != null && shipping > 0) {
      result.versandkosten = shipping;
    }
  }
  return result;
}

async function loadOrder(strapi: StrapiInstance, id: number): Promise<BestellungEntity | null> {
  const entity = await strapi.entityService.findOne('api::bestellung.bestellung', id, {
    fields: ['id', 'bestellstatus', 'bestellnummer'],
    populate: {
      positionen: true,
      gutscheine: {
        fields: ['id', 'code'],
      },
    },
  });
  return entity as BestellungEntity | null;
}

async function createGutschein(strapi: StrapiInstance, input: GutscheinCreateInput): Promise<CreateResult> {
  const created = await strapi.entityService.create('api::gutschein.gutschein', {
    data: {
      name: input.name,
      code: input.code,
      betrag: input.betrag,
      restwert: input.restwert,
      aktiv: input.aktiv,
      bestellung: input.bestellung,
      versandDetails: input.versandDetails ?? null,
    },
  });
  return { id: created.id, code: created.code } as CreateResult;
}

async function loadVoucherSettings(strapi: StrapiInstance): Promise<GutscheinSettings | null> {
  try {
    const response = await strapi.entityService.findMany('api::gutscheineinstellung.gutscheineinstellung', {
      fields: ['name', 'versandkosten'],
      pagination: { limit: 1 },
    });
    const record = Array.isArray(response) ? response[0] : response;
    if (record && typeof record === 'object') {
      const settings = record as GutscheinSettings;
      settings.versandkosten = normaliseShippingValue(settings.versandkosten);
      return settings;
    }
  } catch (error) {
    strapi?.log?.warn?.('[Gutschein-Erzeugung] Einstellungen konnten nicht geladen werden.', {
      error: error instanceof Error ? error.message : error,
    });
  }
  return null;
}

async function ensureUniqueCode(strapi: StrapiInstance, attempts = 10): Promise<string> {
  for (let i = 0; i < attempts; i += 1) {
    const candidate = generateVoucherCode();
    const existing = await strapi.db.query('api::gutschein.gutschein').findOne({
      where: { code: candidate },
      select: ['id'],
    });
    if (!existing) {
      return candidate;
    }
  }
  throw new Error('Konnte keinen eindeutigen Gutscheincode erzeugen.');
}

function hasExistingVoucherForPosition(existing: ExistingGutschein[] | null | undefined, code: string): boolean {
  if (!existing || !existing.length) {
    return false;
  }
  return existing.some((voucher) => voucher.code === code);
}

function resolveVoucherAmount(position: BestellungPosition): number {
  const quantity = Math.max(1, Number(position.menge ?? 1));
  const shipping = normaliseShippingValue(position.gutscheinDetails?.versandkosten) ?? 0;
  const explicitShipping = normaliseShippingValue(position.versandkosten);

  const resolveBase = (): number => {
    if (position.betrag != null) {
      return Number(position.betrag);
    }
    if (position.einzelpreisBrutto != null) {
      return Number(position.einzelpreisBrutto);
    }
    if (position.summeBrutto != null) {
      const total = Number(position.summeBrutto);
      return quantity > 0 ? total / quantity : total;
    }
    return 0;
  };

  const base = resolveBase();
  let amount = round2(base);

  if (shipping > 0 && explicitShipping == null) {
    const perUnitShipping = round2(shipping / quantity);
    if (amount > perUnitShipping) {
      amount = round2(amount - perUnitShipping);
    }
  }

  return amount > 0 ? amount : 0;
}

export async function createGutscheineForPaidOrder(strapi: StrapiInstance, bestellungId: number): Promise<void> {
  const order = await loadOrder(strapi, bestellungId);
  if (!order) {
    return;
  }
  if (String(order.bestellstatus).toLowerCase() !== 'bezahlt') {
    return;
  }
  const existingCodes = new Set((order.gutscheine || []).map((voucher) => voucher.code));

  const voucherPositions = (order.positionen || []).filter((position) => position.typ === 'gutschein');
  if (!voucherPositions.length) {
    return;
  }

  const requiredVoucherCount = voucherPositions.reduce((sum, position) => {
    const quantity = Math.max(1, Number(position.menge ?? 1));
    return sum + quantity;
  }, 0);

  if (existingCodes.size >= requiredVoucherCount) {
    return;
  }

  let remaining = requiredVoucherCount - existingCodes.size;
  const voucherSettings = await loadVoucherSettings(strapi);
  const bestellnummerName =
    typeof order.bestellnummer === 'string' && order.bestellnummer.trim().length > 0
      ? order.bestellnummer.trim()
      : null;
  const defaultVoucherName =
    bestellnummerName ||
    (typeof voucherSettings?.name === 'string' && voucherSettings.name.trim().length > 0
      ? voucherSettings.name.trim()
      : 'Geschenkgutschein');

  for (const position of voucherPositions) {
    const quantity = Math.max(1, Number(position.menge ?? 1));
    const singleAmount = resolveVoucherAmount(position);
    if (!Number.isFinite(singleAmount) || singleAmount <= 0) {
      continue;
    }

    const versandDetails = normaliseGutscheinDetails(position.gutscheinDetails, voucherSettings?.versandkosten ?? null);

    for (let index = 0; index < quantity && remaining > 0; index += 1) {
      let code: string | null = null;
      let attempts = 0;
      while (!code && attempts < 10) {
        const candidate = generateVoucherCode();
        if (!existingCodes.has(candidate)) {
          code = candidate;
        }
        attempts += 1;
      }
      if (!code) {
        code = await ensureUniqueCode(strapi);
      }

      await createGutschein(strapi, {
        name: position.titel?.trim() || defaultVoucherName,
        code,
        betrag: singleAmount,
        restwert: singleAmount,
        aktiv: true,
        bestellung: order.id,
        versandDetails,
      });

      existingCodes.add(code);
      remaining -= 1;

      if (strapi?.log?.info) {
        strapi.log.info('[Gutschein-Erzeugung] Gutschein erstellt.', {
          bestellungId: order.id,
          code,
        });
      }
    }

    if (remaining <= 0) {
      break;
    }
  }
}
