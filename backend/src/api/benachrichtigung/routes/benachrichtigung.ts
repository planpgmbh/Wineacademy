import { factories } from '@strapi/strapi';
import type { UID } from '@strapi/types';

const CONTENT_UID = 'api::benachrichtigung.benachrichtigung' as UID.ContentType;

export default factories.createCoreRouter(CONTENT_UID);
