export const roundCurrency = (value: number): number =>
  Math.round((value + Number.EPSILON) * 100) / 100;

export function normaliseShippingInput(value: unknown): number | null {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    const sanitised = trimmed.replace(/[^0-9,.-]/g, "").replace(/,/g, ".");
    if (!sanitised) {
      return null;
    }
    let parsed = Number.parseFloat(sanitised);
    if (!Number.isFinite(parsed)) {
      return null;
    }
    const hasDecimal = /[.,]/.test(sanitised);
    if (!hasDecimal && Number.isInteger(parsed)) {
      const abs = Math.abs(parsed);
      if (abs >= 100 && abs < 10000) {
        parsed /= 100;
      }
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
