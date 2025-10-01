import type { Context, Next } from 'koa';

/**
 * Ensure Strapi treats proxied admin requests as HTTPS so secure cookies can be issued.
 */
export default () => {
  return async (ctx: Context, next: Next) => {
    const headerName = 'x-forwarded-proto';

    ctx.request.header[headerName] = 'https';
    ctx.req.headers[headerName] = 'https';

    const req = ctx.req as typeof ctx.req & {
      protocol?: string;
      socket: (typeof ctx.req.socket) & { encrypted?: boolean };
    };

    req.protocol = 'https';
    if (req.socket) {
      req.socket.encrypted = true;
    }

    await next();
  };
};
