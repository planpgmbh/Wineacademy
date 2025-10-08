import { factories } from "@strapi/strapi";
import type { UID } from "@strapi/types";

const CONTENT_UID = "api::navigation.navigation" as UID.ContentType;

export default factories.createCoreRouter(CONTENT_UID);
