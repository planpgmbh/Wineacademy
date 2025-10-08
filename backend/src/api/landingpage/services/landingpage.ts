import { factories } from "@strapi/strapi";
import type { UID } from "@strapi/types";

const CONTENT_UID = "api::landingpage.landingpage" as UID.ContentType;

export default factories.createCoreService(CONTENT_UID);
