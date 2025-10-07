const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

const getPaypalBase = () => {
  const mode = String(process.env.PAYPAL_MODE || 'sandbox').toLowerCase();
  return mode === 'live' ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com';
};

const getClientCredentials = () => {
  const client = process.env.PAYPAL_CLIENT_ID || '';
  const secret = process.env.PAYPAL_CLIENT_SECRET || process.env.PAYPAL_SECRET || '';
  if (!client || !secret) {
    throw new Error('PayPal Credentials fehlen');
  }
  return { client, secret };
};

const fetchAccessToken = async (): Promise<string> => {
  const base = getPaypalBase();
  const { client, secret } = getClientCredentials();
  const response = await fetch(`${base}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: 'Basic ' + Buffer.from(`${client}:${secret}`).toString('base64'),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });
  if (!response.ok) {
    throw new Error(`PayPal Token Fehler ${response.status}`);
  }
  const json = (await response.json()) as { access_token?: string };
  if (!json.access_token) {
    throw new Error('PayPal Token fehlt');
  }
  return json.access_token;
};

export async function verifyPayPalCapture(captureId: string, expectedTotal: number): Promise<string> {
  const base = getPaypalBase();
  const accessToken = await fetchAccessToken();

  const captureResponse = await fetch(`${base}/v2/payments/captures/${encodeURIComponent(captureId)}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!captureResponse.ok) {
    const text = await captureResponse.text();
    throw new Error(`PayPal Capture Fehler ${captureResponse.status}: ${text}`);
  }
  const capture = (await captureResponse.json()) as {
    status?: string;
    amount?: { value?: string; currency_code?: string };
    id?: string;
  };

  if ((capture.status || '').toUpperCase() !== 'COMPLETED') {
    throw new Error('PayPal Capture nicht abgeschlossen');
  }
  if ((capture.amount?.currency_code || '').toUpperCase() !== 'EUR') {
    throw new Error('PayPal-Währung ist nicht EUR');
  }
  const value = capture.amount?.value ? Number(capture.amount.value) : NaN;
  if (!Number.isFinite(value)) {
    throw new Error('PayPal-Wert ungültig');
  }
  if (Math.abs(value - round2(expectedTotal)) > 0.01) {
    throw new Error('PayPal-Betrag weicht vom erwarteten Betrag ab');
  }

  return capture.id || captureId;
}
