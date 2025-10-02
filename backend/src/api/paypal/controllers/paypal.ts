import { factories } from '@strapi/strapi';

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

async function generateVoucherCode(strapi: any): Promise<string> {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  for (let attempt = 0; attempt < 20; attempt += 1) {
    let code = '';
    for (let i = 0; i < 4; i += 1) {
      const block = Array.from({ length: 4 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join('');
      code += block;
      if (i < 3) code += '-';
    }
    const existing = await strapi.db.query('api::gutschein.gutschein').findOne({ where: { code } });
    if (!existing) return code;
  }
  throw new Error('Konnte keinen eindeutigen Gutscheincode erzeugen');
}

export default factories.createCoreController('api::bestellung.bestellung', ({ strapi }) => ({
  async handleWebhook(ctx) {
    try {
      const body = ctx.request.body as any;
      const eventType = body?.event_type || body?.eventType;

      let verified = false;
      try {
        verified = await verifySignature(ctx.request.headers as any, body);
      } catch (e) {
        strapi.log.warn(`[paypal] verify error: ${(e as any)?.message || e}`);
      }

      if (!verified) {
        ctx.status = 200;
        ctx.body = { ok: true, verified: false };
        return;
      }

      if (eventType === 'PAYMENT.CAPTURE.COMPLETED') {
        const captureId = body?.resource?.id || body?.resource?.capture_id;
        const orderId = body?.resource?.supplementary_data?.related_ids?.order_id;
        if (captureId) {
          const existing = await strapi.db.query('api::bestellung.bestellung').findOne({
            where: {
              $or: [
                { zahlungsreferenz: captureId },
                ...(orderId ? [{ paypalOrderId: orderId }] : []),
              ] as any,
            },
            select: [
              'id',
              'bestellstatus',
              'zuZahlenBrutto',
              'summePositionenBrutto',
              'gutscheinBetrag',
              'gutscheinCode',
            ],
          });
          if (existing) {
            const amt = body?.resource?.amount;
            const ccy = amt?.currency_code || amt?.currencyCode || null;
            const valStr = amt?.value || amt?.amount || null;
            const val = valStr ? Number(valStr) : NaN;
            const expected = typeof existing.zuZahlenBrutto === 'number'
              ? Number(existing.zuZahlenBrutto)
              : round2(Math.max(0, Number(existing.summePositionenBrutto || 0) - Number(existing.gutscheinBetrag || 0)));

            if (ccy !== 'EUR') {
              strapi.log.warn(`[paypal webhook] Currency mismatch for capture ${captureId}: ${ccy}!=EUR`);
            } else if (Number.isFinite(val) && Math.abs(val - expected) <= 0.01) {
              await strapi.entityService.update('api::bestellung.bestellung', existing.id, {
                data: { bestellstatus: 'bezahlt', zahlungsmethode: 'paypal', zahlungsreferenz: captureId },
              });

              const full = await strapi.entityService.findOne('api::bestellung.bestellung', existing.id, {
                populate: {
                  positionen: true,
                  gutscheine: { filters: { istTemplate: false }, fields: ['code', 'betrag'] },
                },
              });

              const fullAny = full as any;
              const existingCodesByAmount = new Map<number, number>();
              const currentVouchers = Array.isArray(fullAny?.gutscheine) ? fullAny.gutscheine : [];
              for (const g of currentVouchers) {
                const amount = g.betrag != null ? Number(g.betrag) : NaN;
                if (Number.isFinite(amount)) {
                  existingCodesByAmount.set(amount, (existingCodesByAmount.get(amount) || 0) + 1);
                }
              }

              const newCodes: string[] = [];
              const positionen = Array.isArray(fullAny?.positionen) ? fullAny.positionen : [];
              for (const pos of positionen) {
                if (pos.typ !== 'gutschein') continue;
                const menge = Math.max(1, Number(pos.menge ?? 1));
                const betrag = pos.einzelpreisBrutto != null ? Number(pos.einzelpreisBrutto) : NaN;
                if (!Number.isFinite(betrag)) continue;
                const key = betrag;
                const already = existingCodesByAmount.get(key) || 0;
                const missing = Math.max(0, menge - already);
                for (let i = 0; i < missing; i += 1) {
                  const code = await generateVoucherCode(strapi);
                  newCodes.push(code);
                  await strapi.entityService.create('api::gutschein.gutschein', {
                    data: {
                      name: pos.titel,
                      beschreibung: pos.beschreibung,
                      code,
                      betrag,
                      istTemplate: false,
                      aktiv: true,
                      bestellung: existing.id,
                    },
                  });
                }
                existingCodesByAmount.set(key, already + missing);
              }

              if (newCodes.length > 0) {
                const existingCodes = (fullAny?.gutscheinCode ? String(fullAny.gutscheinCode).split(',').map((c: string) => c.trim()).filter(Boolean) : []);
                const merged = [...existingCodes, ...newCodes];
                await strapi.entityService.update('api::bestellung.bestellung', existing.id, {
                  data: { gutscheinCode: merged.join(', ') },
                });
              }
            } else {
              strapi.log.warn(`[paypal webhook] Amount mismatch for capture ${captureId}: received=${valStr} expected=${expected}`);
            }
          }
        }
      }

      ctx.status = 200;
      ctx.body = { ok: true, verified: true };
    } catch (err) {
      strapi.log.error('PayPal webhook error', err);
      ctx.status = 200;
      ctx.body = { ok: true };
    }
  },
}));

function round2(n: number) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}
