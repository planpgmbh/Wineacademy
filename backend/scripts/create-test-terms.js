"use strict";

/**
 * Erstellt für jedes veröffentlichte Seminar (aktiv = true) mindestens drei geplante Testtermine.
 * Termine rotieren über die Standorte Hamburg, Mannheim und Digital.
 *
 * Ausführung im Staging-Container:
 *   docker compose -f docker-compose-staging.yml exec -e PORT=1437 service_wineacadamy_staging \
 *     node ./scripts/create-test-terms.js
 */

const path = require("node:path");
const { createStrapi } = require("@strapi/strapi");

const MIN_TERMS_PER_SEMINAR = 3;
const DAYS_BETWEEN_TERMS = 14;

const STANDORT_DEFINITIONS = [
  {
    name: "Wine Academy Hamburg",
    typ: "vorort",
    veranstaltungsort: "Wine Academy Hamburg",
    strasse: "Ferdinandstraße 12",
    plz: "20095",
    stadt: "Hamburg",
    land: "Deutschland"
  },
  {
    name: "Wine Academy Mannheim",
    typ: "vorort",
    veranstaltungsort: "Wine Academy Mannheim",
    strasse: "Friedrichsstraße 18",
    plz: "68161",
    stadt: "Mannheim",
    land: "Deutschland"
  },
  {
    name: "Wine Academy Digital",
    typ: "online",
    veranstaltungsort: "Digital",
    strasse: null,
    plz: null,
    stadt: "Online",
    land: "Deutschland"
  }
];

const toDateString = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const ensureStandorte = async (strapi) => {
  const ensured = [];

  for (const definition of STANDORT_DEFINITIONS) {
    let standort = await strapi.db.query("api::standort.standort").findOne({
      where: { name: definition.name },
      select: ["id", "name", "publishedAt"]
    });

    if (!standort) {
      standort = await strapi.entityService.create("api::standort.standort", {
        data: {
          ...definition,
          publishedAt: new Date().toISOString()
        }
      });
      console.log(`[Termine] Standort "${definition.name}" (#${standort.id}) erstellt.`);
    } else if (!standort.publishedAt) {
      standort = await strapi.entityService.update("api::standort.standort", standort.id, {
        data: { publishedAt: new Date().toISOString() }
      });
      console.log(`[Termine] Standort "${definition.name}" veröffentlicht.`);
    }

    ensured.push({ id: standort.id, name: standort.name });
  }

  return ensured;
};

const fetchPublishedSeminars = (strapi) => {
  return strapi.db.query("api::seminar.seminar").findMany({
    where: {
      aktiv: true,
      publishedAt: { $not: null }
    },
    select: ["id", "name"],
    populate: {
      kategorien: {
        select: ["id", "name"]
      }
    },
    orderBy: { id: "asc" }
  });
};

const fetchUpcomingTerms = (strapi, seminarId, todayStr) => {
  return strapi.db.query("api::termin.termin").findMany({
    where: {
      planungsstatus: "geplant",
      starttag: { $gte: todayStr },
      publishedAt: { $not: null },
      seminar: {
        id: seminarId
      }
    },
    select: ["id", "starttag"],
    orderBy: { starttag: "asc" }
  });
};

const createTerm = async (strapi, seminar, categories, standort, startDateStr) => {
  const created = await strapi.entityService.create("api::termin.termin", {
    data: {
      starttag: startDateStr,
      kapazitaet: 20,
      planungsstatus: "geplant",
      publishedAt: new Date().toISOString(),
      seminar: seminar.id,
      standort: standort.id,
      tageMitUhrzeit: [
        {
          datum: startDateStr,
          startzeit: "10:00:00",
          endzeit: "17:00:00"
        }
      ]
    }
  });

  const categoryLabel = categories.length > 0 ? ` (Kategorien: ${categories.join(", ")})` : "";

  console.log(
    `[Termine] Seminar "${seminar.name}" (#${seminar.id})${categoryLabel}: Termin ${created.id} am ${startDateStr} – Standort: ${standort.name}`
  );
};

(async () => {
  const distDir = path.join(__dirname, "..", "dist");
  const strapi = await createStrapi({ distDir });
  await strapi.load();

  try {
    const standorte = await ensureStandorte(strapi);
    const seminars = await fetchPublishedSeminars(strapi);

    if (!seminars || seminars.length === 0) {
      console.warn("[Termine] Keine veröffentlichten Seminare gefunden. Abbruch.");
      return;
    }

    console.log(`[Termine] ${seminars.length} veröffentlichte Seminare gefunden.`);

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = toDateString(today);
    const standortCount = standorte.length;

    for (let seminarIndex = 0; seminarIndex < seminars.length; seminarIndex += 1) {
      const seminar = seminars[seminarIndex];
      const categories = Array.isArray(seminar.kategorien)
        ? seminar.kategorien.map((cat) => cat.name).filter(Boolean)
        : [];

      const existingTerms = await fetchUpcomingTerms(strapi, seminar.id, todayStr);
      const missingCount = MIN_TERMS_PER_SEMINAR - existingTerms.length;

      if (missingCount <= 0) {
        console.log(
          `[Termine] Seminar "${seminar.name}" (#${seminar.id}) besitzt bereits ${existingTerms.length} geplante Termine.`
        );
        continue;
      }

      for (let offsetIndex = 0; offsetIndex < missingCount; offsetIndex += 1) {
        const totalIndex = existingTerms.length + offsetIndex + 1;
        const offsetDays = seminarIndex + totalIndex * DAYS_BETWEEN_TERMS;

        const startDate = new Date(today);
        startDate.setDate(startDate.getDate() + offsetDays);
        const startDateStr = toDateString(startDate);

        const standort = standorte[(seminarIndex + offsetIndex) % standortCount];

        await createTerm(strapi, seminar, categories, standort, startDateStr);
      }
    }

    console.log("[Termine] Testtermine wurden erstellt.");
  } catch (error) {
    console.error("[Termine] Fehler beim Erstellen der Testtermine:", error);
    process.exitCode = 1;
  } finally {
    try {
      await strapi.destroy();
    } catch (err) {
      // Verbindung evtl. bereits geschlossen – ignorieren
    }
    process.exit(process.exitCode ?? 0);
  }
})();
