import { factories } from "@strapi/strapi";

export default factories.createCoreController("api::einstellung.einstellung", ({ strapi }) => ({
  async publicTracking(ctx) {
    const entry = await strapi.entityService.findMany("api::einstellung.einstellung", {
      populate: { trackingSnippets: true } as any,
      limit: 1,
    });

    const settings = Array.isArray(entry) ? entry[0] : entry;
    const snippetsRaw = Array.isArray(settings?.trackingSnippets)
      ? (settings.trackingSnippets as Array<Record<string, unknown>>)
      : [];

    const snippets = snippetsRaw
      .map((snippet, index) => {
        const enabled = snippet?.enabled ?? true;
        const code = typeof snippet?.code === "string" ? snippet.code : "";
        if (!code || enabled === false) return null;
        const label = typeof snippet?.label === "string" ? snippet.label : `Snippet ${index + 1}`;
        const typ = typeof snippet?.typ === "string" ? snippet.typ : "custom";
        const position =
          snippet?.position === "body_end" || snippet?.position === "head" ? snippet.position : "head";
        const remark = typeof snippet?.remark === "string" ? snippet.remark : undefined;
        return {
          label,
          typ,
          position,
          code,
          remark,
        };
      })
      .filter(Boolean);

    ctx.body = snippets;
  },
}));
