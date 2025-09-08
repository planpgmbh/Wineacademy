import { factories } from '@strapi/strapi';

/**
 * PayPal Webhook Controller mit Signaturprüfung über
 * POST /v1/notifications/verify-webhook-signature
 *
 * Erforderliche ENVs (werden i. d. R. via docker-compose gesetzt):
 *  - PAYPAL_MODE=sandbox|live (default sandbox)
 *  - PAYPAL_CLIENT_ID
 *  - PAYPAL_CLIENT_SECRET
 *  - PAYPAL_WEBHOOK_ID
 */

function getPaypalBase() {
  const mode = String(process.env.PAYPAL_MODE || 'sandbox').toLowerCase();
  return mode === 'live' ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com';
}

async function getAccessToken(): Promise<string> {
  const client = process.env.PAYPAL_CLIENT_ID || '';
  const secret = process.env.PAYPAL_CLIENT_SECRET || '';
  const base = getPaypalBase();
  const res = await fetch(`${base}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: 'Basic ' + Buffer.from(`${client}:${secret}`).toString('base64'),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });
  if (!res.ok) throw new Error(`PayPal token ${res.status}`);
  const json = (await res.json()) as { access_token?: string };
  if (!json.access_token) throw new Error('PayPal token missing');
  return json.access_token;
}

async function verifySignature(headers: Record<string, string | undefined>, webhookEvent: any): Promise<boolean> {
  const webhookId = process.env.PAYPAL_WEBHOOK_ID || '';
  if (!webhookId) return false;
  const base = getPaypalBase();

  const payload = {
    transmission_id: headers['paypal-transmission-id'],
    transmission_time: headers['paypal-transmission-time'],
    cert_url: headers['paypal-cert-url'],
    auth_algo: headers['paypal-auth-algo'],
    transmission_sig: headers['paypal-transmission-sig'],
    webhook_id: webhookId,
    webhook_event: webhookEvent,
  } as Record<string, any>;

  // Wenn wesentliche Header fehlen, verifizieren wir nicht
  if (!payload.transmission_id || !payload.transmission_time || !payload.cert_url || !payload.auth_algo || !payload.transmission_sig) {
    return false;
  }
  const token = await getAccessToken();
  const res = await fetch(`${base}/v1/notifications/verify-webhook-signature`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`PayPal verify ${res.status}: ${text}`);
  }
  const out = (await res.json()) as { verification_status?: string };
  return out.verification_status === 'SUCCESS';
}

export default factories.createCoreController('api::buchung.buchung', ({ strapi }) => ({
  async handleWebhook(ctx) {
    try {
      const body = ctx.request.body as any;
      const eventType = body?.event_type || body?.eventType;

      // Signatur prüfen (wenn ENV konfiguriert)
      let verified = false;
      try {
        verified = await verifySignature(ctx.request.headers as any, body);
      } catch (e) {
        strapi.log.warn(`[paypal] verify error: ${(e as any)?.message || e}`);
      }

      if (!verified) {
        // Ignorieren, aber 200 zurückgeben, damit PayPal nicht unendlich retried
        ctx.status = 200;
        ctx.body = { ok: true, verified: false };
        return;
      }

      if (eventType === 'PAYMENT.CAPTURE.COMPLETED') {
        const captureId = body?.resource?.id || body?.resource?.capture_id;
        if (captureId) {
          const existing = await strapi.db.query('api::buchung.buchung').findOne({
            where: {
              $or: [
                { zahlungsreferenz: captureId },
                { paypalCaptureId: captureId } as any,
              ] as any,
            },
            select: ['id', 'status'],
          });
          if (existing) {
            await strapi.entityService.update('api::buchung.buchung', existing.id, {
              data: { status: 'bezahlt', zahlungsmethode: 'paypal', zahlungsreferenz: captureId },
            });
          }
        }
      }

      ctx.status = 200;
      ctx.body = { ok: true, verified: true };
    } catch (err) {
      strapi.log.error('PayPal webhook error', err);
      ctx.status = 200; // Webhooks nie 500 geben
      ctx.body = { ok: true };
    }
  },
}));
