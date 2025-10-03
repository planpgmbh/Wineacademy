import { factories } from '@strapi/strapi';
import type { UID } from '@strapi/types';

interface TestSendBody {
  email?: string;
  platzhalter?: Record<string, unknown>;
}

const CONTENT_UID = 'api::benachrichtigung.benachrichtigung' as UID.ContentType;

export default factories.createCoreController(CONTENT_UID, ({ strapi }) => ({
  async testSend(ctx) {
    const id = Number(ctx.params?.id);
    if (!Number.isFinite(id)) {
      return ctx.badRequest('Ungültige Benachrichtigungs-ID');
    }

    const body = (ctx.request.body ?? {}) as TestSendBody;
    const recipient = body.email?.trim();
    if (!recipient) {
      return ctx.badRequest('Empfängeradresse (email) ist erforderlich');
    }

    const template = await strapi.entityService.findOne(CONTENT_UID as any, id, {
      populate: { platzhalter: true },
    });

    if (!template) {
      return ctx.notFound('Benachrichtigung nicht gefunden');
    }

    try {
      const overridePlatzhalter =
        body.platzhalter ?? (body as Record<string, unknown> & { tokens?: Record<string, unknown> }).tokens;

      const result = await strapi.service(CONTENT_UID).testSend({
        template,
        recipient,
        overridePlatzhalter,
      });

      ctx.body = {
        ok: true,
        messageId: result?.messageId ?? null,
        transport: result?.transport ?? 'sendgrid',
      };
      return ctx.body;
    } catch (error: any) {
      strapi.log.error('[benachrichtigung.testSend] Fehler', error);
      const message = error?.message || 'Testversand fehlgeschlagen';
      return ctx.badRequest(message);
    }
  },
}));
