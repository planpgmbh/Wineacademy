import { factories } from "@strapi/strapi";
import type { UID } from "@strapi/types";

const CONTENT_UID = "api::footer.footer" as UID.ContentType;

interface FooterLink {
  label: string;
  href: string;
  ziel: "_self" | "_blank";
}

interface FooterLogo {
  name: string | null;
  href: string | null;
  logo: {
    url: string | null;
    alternativeText: string | null;
    width: number | null;
    height: number | null;
  } | null;
}

interface FooterSection {
  titel: string;
  typ: "kontakt" | "links" | "logos";
  text: string | null;
  links: FooterLink[];
  logos: FooterLogo[];
}

function mapFooterLink(entry: any): FooterLink | null {
  if (typeof entry?.label !== "string" || typeof entry?.href !== "string") {
    return null;
  }
  return {
    label: entry.label,
    href: entry.href,
    ziel: entry?.ziel === "_blank" ? "_blank" : "_self",
  };
}

function mapFooterLogo(entry: any): FooterLogo | null {
  const media = entry?.logo;
  return {
    name: typeof entry?.name === "string" ? entry.name : null,
    href: typeof entry?.href === "string" ? entry.href : null,
    logo: media
      ? {
          url: typeof media.url === "string" ? media.url : null,
          alternativeText: typeof media.alternativeText === "string" ? media.alternativeText : null,
          width: Number.isFinite(media.width) ? Number(media.width) : null,
          height: Number.isFinite(media.height) ? Number(media.height) : null,
        }
      : null,
  };
}

function mapFooterSection(entry: any): FooterSection | null {
  if (typeof entry?.titel !== "string") {
    return null;
  }

  const typValues = ["kontakt", "links", "logos"] as const;
  const sectionType = typValues.includes(entry?.typ) ? entry.typ : "links";

  const links = Array.isArray(entry?.links)
    ? entry.links.map(mapFooterLink).filter((link): link is FooterLink => link !== null)
    : [];

  const logos = Array.isArray(entry?.logos)
    ? entry.logos.map(mapFooterLogo).filter((logo): logo is FooterLogo => logo !== null)
    : [];

  return {
    titel: entry.titel,
    typ: sectionType,
    text: typeof entry?.text === "string" && entry.text.trim().length > 0 ? entry.text : null,
    links,
    logos,
  };
}

export default factories.createCoreController(CONTENT_UID, ({ strapi }) => ({
  async public(ctx) {
    const result = await strapi.entityService.findMany(CONTENT_UID as any, {
      populate: {
        sections: {
          populate: {
            links: true,
            logos: {
              populate: {
                logo: true,
              },
            },
          },
        },
      },
      publicationState: "live",
    } as any);

    const footer = (Array.isArray(result) ? result[0] : result) as any;
    const sectionsRaw = Array.isArray(footer?.sections) ? footer.sections : [];
    const sections = sectionsRaw.map(mapFooterSection).filter((section): section is FooterSection => section !== null);

    ctx.body = {
      sections,
      updatedAt: footer?.updatedAt ?? null,
    };
  },
}));
