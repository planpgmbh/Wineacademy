import { factories } from "@strapi/strapi";
import type { UID } from "@strapi/types";

const CONTENT_UID = "api::landingpage.landingpage" as UID.ContentType;

export default factories.createCoreController(CONTENT_UID, ({ strapi }) => ({
  async public(ctx) {
    const { slug } = ctx.params;
    if (typeof slug !== "string" || slug.length === 0) {
      return ctx.badRequest("Slug erforderlich");
    }

    const entries = await strapi.entityService.findMany(CONTENT_UID as any, {
      filters: { slug },
      publicationState: "live",
      populate: {
        abschnitte: {
          on: {
            "landing.card-grid": { populate: { karten: true } },
            "landing.icon-grid": { populate: { items: true } },
          },
        },
      },
      limit: 1,
    } as any);

    const entry = Array.isArray(entries) ? entries[0] : entries;
    if (!entry) {
      return ctx.notFound("Landingpage nicht gefunden");
    }

    ctx.body = {
      id: entry.id,
      titel: entry.titel,
      slug: entry.slug,
      abschnitte: entry.abschnitte ?? [],
      updatedAt: entry.updatedAt ?? null,
    };
  },
}));
