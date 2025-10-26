export const roundCurrency = (value: number): number =>
  Math.round((value + Number.EPSILON) * 100) / 100;

export function normaliseShippingInput(value: unknown): number | null {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === "string") {
    const sanitised = value.replace(/[^0-9,.-]/g, "").replace(/,/g, ".");
    if (!sanitised) {
      return null;
    }
    const parsed = Number.parseFloat(sanitised);
    if (!Number.isFinite(parsed)) {
      return null;
    }
    return roundCurrency(parsed);
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    const abs = Math.abs(value);
    const needsScaling = Number.isInteger(value) && abs >= 100 && abs < 10000;
    const result = needsScaling ? value / 100 : value;
    return roundCurrency(result);
  }

  return null;
}
