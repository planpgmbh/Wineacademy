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
      status: "published",
      populate: {
        abschnitte: {
          on: {
            "landing.hero": true,
            "landing.hero-carousel": { populate: { bilder: true } },
            "landing.hero-blank": true,
            "landing.hero-small": { populate: { hintergrundbild: true } },
            "landing.bildergalerie": { populate: { bilder: true } },
            "landing.text-block": true,
            "landing.card-grid": {
              populate: {
                karten: {
                  populate: {
                    backgroundImage: true
                  }
                }
              }
            },
            "landing.columns": {
              populate: {
                spalten: {
                  populate: {
                    bild: true
                  }
                }
              }
            },
            "landing.seminar-liste": {
              populate: {
                seminarkategorie: {
                  fields: ["id", "name", "slug", "kurzbeschreibung"]
                }
              }
            },
            "landing.tabs": {
              populate: {
                reiter: true
              }
            },
            "landing.seminar-finder": {
              populate: {
                standardKategorie: {
                  fields: ["id", "name", "slug"]
                },
                sichtbareFilter: {
                  fields: ["id", "name", "slug"]
                }
              }
            }
          },
        },
        seo: true,
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
      seo: entry.seo ?? null,
      updatedAt: entry.updatedAt ?? null,
    };
  },
}));
