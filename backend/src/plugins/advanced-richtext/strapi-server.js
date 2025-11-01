"use strict";

const pluginId = "advanced-richtext";
const fieldName = "advanced-richtext";

module.exports = {
  register({ strapi }) {
    try {
      strapi.customFields.register({
        name: fieldName,
        plugin: pluginId,
        type: "text",
        inputSize: {
          default: 12,
          isResizable: true,
        },
      });
      strapi.log.info(`[${pluginId}] Custom Field registriert (type=text).`);
    } catch (error) {
      if (
        error &&
        typeof error.message === "string" &&
        error.message.includes("already registered")
      ) {
        strapi.log.warn(
          `[${pluginId}] Custom Field bereits registriert – überspringe Duplikat.`
        );
        return;
      }
      throw error;
    }
  },
  bootstrap() {},
};
