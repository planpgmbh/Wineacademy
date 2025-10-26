export const roundCurrency = (value: number): number =>
  Math.round((value + Number.EPSILON) * 100) / 100;

export const normaliseShippingValue = (input: unknown): number | null => {
  if (input === null || input === undefined) {
    return null;
  }

  if (typeof input === 'string') {
    const sanitized = input.replace(/[^0-9,.-]/g, '').replace(',', '.');
    if (!sanitized) {
      return null;
    }
    const parsed = Number.parseFloat(sanitized);
    if (!Number.isFinite(parsed)) {
      return null;
    }
    return roundCurrency(parsed);
  }

  if (typeof input === 'number' && Number.isFinite(input)) {
    const absolute = Math.abs(input);
    const needsScaling = Number.isInteger(input) && absolute >= 100 && absolute < 10000;
    const value = needsScaling ? input / 100 : input;
    return roundCurrency(value);
  }

  return null;
};
