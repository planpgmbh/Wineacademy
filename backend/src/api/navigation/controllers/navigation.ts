import { factories } from "@strapi/strapi";
import type { UID } from "@strapi/types";

const CONTENT_UID = "api::navigation.navigation" as UID.ContentType;

interface NavigationSubItem {
  titel: string;
  link: string | null;
  ziel: "_self" | "_blank";
}

interface NavigationItem extends NavigationSubItem {
  unterpunkte: NavigationSubItem[];
}

function mapSubItem(entry: any): NavigationSubItem {
  return {
    titel: typeof entry?.titel === "string" ? entry.titel : "",
    link: typeof entry?.link === "string" && entry.link.length > 0 ? entry.link : null,
    ziel: entry?.ziel === "_blank" ? "_blank" : "_self",
  };
}

function mapMenuItem(entry: any): NavigationItem {
  const unterpunkteRaw = Array.isArray(entry?.unterpunkte) ? entry.unterpunkte : [];
  return {
    ...mapSubItem(entry),
    unterpunkte: unterpunkteRaw.map(mapSubItem),
  };
}

export default factories.createCoreController(CONTENT_UID, ({ strapi }) => ({
  async public(ctx) {
    const result = await strapi.entityService.findMany(CONTENT_UID as any, {
      populate: {
        items: {
          populate: {
            unterpunkte: true,
          },
        },
      },
      publicationState: "live",
    } as any);

    const navigation = (Array.isArray(result) ? result[0] : result) as any;
    const items = Array.isArray(navigation?.items) ? navigation.items.map(mapMenuItem) : [];

    ctx.body = {
      items,
      updatedAt: navigation?.updatedAt ?? null,
    };
  },
}));
