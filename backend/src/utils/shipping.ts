export const roundCurrency = (value: number): number =>
  Math.round((value + Number.EPSILON) * 100) / 100;

export const normaliseShippingValue = (input: unknown): number | null => {
  if (input === null || input === undefined) {
    return null;
  }

  if (typeof input === 'string') {
    const trimmed = input.trim();
    const sanitized = trimmed.replace(/[^0-9,.-]/g, '').replace(',', '.');
    if (!sanitized) {
      return null;
    }
    let parsed = Number.parseFloat(sanitized);
    if (!Number.isFinite(parsed)) {
      return null;
    }
    const hasDecimalSeparator = /[.,]/.test(sanitized);
    if (!hasDecimalSeparator && Number.isInteger(parsed)) {
      const absolute = Math.abs(parsed);
      if (absolute >= 100 && absolute < 10000) {
        parsed /= 100;
      }
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
