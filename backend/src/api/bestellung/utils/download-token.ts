import crypto from 'node:crypto';

type TokenVariant = 'invoice' | 'storno' | 'preview';

const DEFAULT_TOKEN_TTL_SECONDS = numberFromEnv(
  process.env.ORDER_DOWNLOAD_TOKEN_TTL_SECONDS,
  60 * 60 * 24 * 14
);

function numberFromEnv(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

const base64urlEncode = (input: Buffer): string =>
  input
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');

const base64urlDecode = (input: string): Buffer => {
  const normalized = input.replace(/-/g, '+').replace(/_/g, '/');
  const padding = normalized.length % 4 === 0 ? '' : '='.repeat(4 - (normalized.length % 4));
  return Buffer.from(normalized + padding, 'base64');
};

const getSecret = (): string | null => {
  if (process.env.INVOICE_DOWNLOAD_SECRET) {
    const trimmed = process.env.INVOICE_DOWNLOAD_SECRET.trim();
    if (trimmed) {
      return trimmed;
    }
  }
  const appKeys = process.env.APP_KEYS?.split(',').map((key) => key.trim()).filter(Boolean);
  if (appKeys && appKeys.length > 0) {
    return appKeys[0];
  }
  return null;
};

const signPayload = (payload: string, secret: string): string =>
  base64urlEncode(crypto.createHmac('sha256', secret).update(payload).digest());

export const createDownloadToken = (
  identifier: string,
  variant: TokenVariant,
  ttlSeconds = DEFAULT_TOKEN_TTL_SECONDS
): string | null => {
  const secret = getSecret();
  if (!secret) {
    return null;
  }
  const exp = Math.floor(Date.now() / 1000) + Math.max(60, ttlSeconds);
  const payloadObject = { id: identifier, v: variant, exp };
  const payload = base64urlEncode(Buffer.from(JSON.stringify(payloadObject), 'utf-8'));
  const signature = signPayload(payload, secret);
  return `${payload}.${signature}`;
};

export const verifyDownloadToken = (
  identifier: string,
  variant: TokenVariant,
  token: string | null | undefined
): boolean => {
  if (!token) return false;
  const secret = getSecret();
  if (!secret) return false;
  const [payload, signature] = token.split('.');
  if (!payload || !signature) return false;

  const expectedSignature = signPayload(payload, secret);
  const sigBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expectedSignature);
  if (sigBuffer.length !== expectedBuffer.length) {
    return false;
  }
  if (!crypto.timingSafeEqual(sigBuffer, expectedBuffer)) {
    return false;
  }

  try {
    const decoded = base64urlDecode(payload).toString('utf-8');
    const parsed = JSON.parse(decoded);
    if (parsed.id !== identifier) {
      return false;
    }
    if (parsed.v !== variant) {
      return false;
    }
    if (typeof parsed.exp !== 'number' || parsed.exp < Math.floor(Date.now() / 1000)) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
};

export type { TokenVariant };
