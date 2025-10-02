import { factories } from '@strapi/strapi';

interface TestSendBody {
  email?: string;
  tokens?: Record<string, unknown>;
}

export default factories.createCoreController('api::benachrichtigung-template.benachrichtigung-template' as const, ({ strapi }) => ({
  async testSend(ctx) {
    const id = Number(ctx.params?.id);
    if (!Number.isFinite(id)) {
      return ctx.badRequest('Ungültige Template-ID');
    }

    const body = (ctx.request.body ?? {}) as TestSendBody;
    const recipient = body.email?.trim();
    if (!recipient) {
      return ctx.badRequest('Empfängeradresse (email) ist erforderlich');
    }

    const template = await strapi.entityService.findOne('api::benachrichtigung-template.benachrichtigung-template' as any, id, {
      populate: { tokens: true },
    });

    if (!template) {
      return ctx.notFound('Template nicht gefunden');
    }

    try {
      const result = await strapi.service('api::benachrichtigung-template.benachrichtigung-template').testSend({
        template,
        recipient,
        overrideTokens: body.tokens,
      });

      ctx.body = {
        ok: true,
        messageId: result?.messageId ?? null,
        transport: result?.transport ?? 'sendgrid',
      };
      return ctx.body;
    } catch (error: any) {
      strapi.log.error('[benachrichtigung-template.testSend] Fehler', error);
      const message = error?.message || 'Testversand fehlgeschlagen';
      return ctx.badRequest(message);
    }
  },
}));
