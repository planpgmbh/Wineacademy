import { factories } from "@strapi/strapi";
import type { UID } from "@strapi/types";

const CONTENT_UID = "api::footer.footer" as UID.ContentType;

export default factories.createCoreService(CONTENT_UID);
