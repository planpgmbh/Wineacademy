import { factories } from "@strapi/strapi";
import type { UID } from "@strapi/types";

const CONTENT_UID = "api::landingpage.landingpage" as UID.ContentType;

export default factories.createCoreController(CONTENT_UID, ({ strapi }) => ({
  async public(ctx) {
    const { slug } = ctx.params;
    const requestedStatus = typeof ctx.query?.status === "string" ? ctx.query.status : null;
    const token = typeof ctx.query?.token === "string" ? ctx.query.token : null;
    const previewSecret = process.env.PREVIEW_SECRET ?? process.env.ADMIN_JWT_SECRET ?? null;

    const wantsDraft = requestedStatus === "draft";
    const tokenValid = wantsDraft && previewSecret && token === previewSecret;

    // Drafts nur mit gültigem Token ausliefern, sonst Published.
    const statusesToTry: Array<"draft" | "published"> = tokenValid ? ["draft", "published"] : ["published"];

    if (typeof slug !== "string" || slug.length === 0) {
      return ctx.badRequest("Slug erforderlich");
    }

    let entry: any = null;

    for (const status of statusesToTry) {
      const entries = await strapi.entityService.findMany(CONTENT_UID as any, {
        filters: { slug },
        status,
        populate: {
          abschnitte: {
            on: {
              "landing.hero": {
                populate: {
                  heroVideo: true,
                  heroPosterBild: true,
                },
              },
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
                  spalten: true
                }
              },
              "landing.trennlinie": true,
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
              },
              "landing.seminar-produkt-karten": {
                populate: {
                  seminarkategorie: {
                    fields: ["id", "name", "slug", "kurzbeschreibung"]
                  },
                  produkte: {
                    fields: ["id", "name", "slug", "kurzbeschreibung"],
                    populate: {
                      bild: true
                    }
                  }
                }
              }
            },
          },
          seo: true,
        },
        limit: 1,
      } as any);

      const candidate = Array.isArray(entries) ? entries[0] : entries;
      if (candidate) {
        entry = candidate;
        break;
      }
    }

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
