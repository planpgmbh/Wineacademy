#!/usr/bin/env node

/**
 * Erweiterter Puppeteer-Checkout-Test
 *
 * Ziel:
 * - Mehrere Bestellszenarien gegen die Staging-Umgebung automatisiert durchführen.
 * - Kombinationen aus Seminar, Produkt, Gutscheinbetrag und Gutscheincode abdecken.
 * - Ausschließlich Zahlungsart "Rechnung" verwenden.
 *
 * Ausgabe:
 * - Für jedes Szenario: Bestell-ID, -nummer und Basisdaten.
 * - Fehlermeldung inkl. Schritt, falls ein Szenario scheitert.
 *
 * Anpassungen:
 * - CHECKOUT_BASE_URL: Basis der Staging-Instanz (Default https://wineacademy.plan-p.de).
 * - DEBUG_PUPPETEER=1 aktiviert Browser-Console-Logging.
 * - CHECKOUT_TIMEOUT definierbar für Navigation-/Aktionstimeouts.
 * - CHECKOUT_VOUCHER_PERCENT etc. erlauben Override der Testgutscheine.
 */

const fs = require("fs");
const path = require("path");
const puppeteer = require("puppeteer");

const DEFAULT_BASE_URL = "https://wineacademy.plan-p.de";
const BASE_URL = (process.env.CHECKOUT_BASE_URL || DEFAULT_BASE_URL).replace(/\/$/, "");
const API_BASE = `${BASE_URL}/api/public`;
const DEBUG = process.env.DEBUG_PUPPETEER === "1";
const DEFAULT_TIMEOUT = Number.parseInt(process.env.CHECKOUT_TIMEOUT || "", 10) || 45000;

const VOUCHER_CODES = {
  percentage: (process.env.CHECKOUT_VOUCHER_PERCENT || "WELCOME10").trim(),
  amount25: (process.env.CHECKOUT_VOUCHER_AMOUNT || "TEST-25").trim(),
  amount50: (process.env.CHECKOUT_VOUCHER_AMOUNT50 || "WSET50").trim()
};
const DEFAULT_VAT_RATE = 19;

const EURO = new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" });
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const normaliseText = (input) => (input ?? "").replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
const isClose = (actual, expected, tolerance = 0.01) =>
  Math.abs(Number(actual ?? 0) - Number(expected ?? 0)) <= tolerance;
const formatDateISO = (date) => {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const resolveSevDeskToken = () => {
  const direct = (process.env.SEVDESK_API_TOKEN || "").trim();
  if (direct) {
    return direct;
  }
  try {
    const envPath = path.resolve(__dirname, "../.env.staging");
    const content = fs.readFileSync(envPath, "utf8");
    const match = content.match(/^SEVDESK_API_TOKEN\s*=\s*([^\r\n#]+)/m);
    if (match && match[1]) {
      return match[1].trim();
    }
  } catch {
    // ignore
  }
  return null;
};

async function fetchSevDeskInvoiceByNumber(invoiceNumber) {
  const token = resolveSevDeskToken();
  if (!token) {
    return null;
  }
  const response = await fetch(`https://my.sevdesk.de/api/v1/Invoice?invoiceNumber=${encodeURIComponent(invoiceNumber)}`, {
    headers: { Authorization: token }
  });
  if (!response.ok) {
    throw new Error(`SevDesk-Anfrage fehlgeschlagen (${response.status})`);
  }
  const data = await response.json();
  if (data && Array.isArray(data.objects) && data.objects.length > 0) {
    return data.objects[0];
  }
  return null;
}

function assertClose(actual, expected, label, tolerance = 0.01) {
  if (!isClose(actual, expected, tolerance)) {
    throw new Error(`${label} weicht ab (erwartet ${expected}, erhalten ${actual})`);
  }
}

function logDebug(...args) {
  if (DEBUG) {
    console.log("[DEBUG]", ...args);
  }
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function fetchJson(path, init) {
  const url = path.startsWith("http") ? path : `${API_BASE}${path}`;
  const response = await fetch(url, init);
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`Request fehlgeschlagen (${response.status}) für ${url} – ${body}`);
  }
  return response.json();
}

function parseNumber(value) {
  if (value == null) return null;
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === "string") {
    const cleaned = value.replace(",", ".").trim();
    if (!cleaned) return null;
    const parsed = Number.parseFloat(cleaned);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function clampAmount(amount, template) {
  const min = template?.minBetrag != null ? Number(template.minBetrag) : null;
  const max = template?.maxBetrag != null ? Number(template.maxBetrag) : null;
  let result = amount;
  if (min != null && result < min) {
    result = min;
  }
  if (max != null && result > max) {
    result = max;
  }
  return Math.round((result + Number.EPSILON) * 100) / 100;
}

function formatTerminLabel(termin) {
  if (!termin?.starttag) {
    return `Termin #${termin?.id ?? "?"}`;
  }
  const date = new Date(termin.starttag);
  if (Number.isNaN(date.valueOf())) {
    return `Termin #${termin.id}`;
  }
  const weekday = new Intl.DateTimeFormat("de-DE", { weekday: "short" }).format(date);
  const datePart = new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  }).format(date);
  return `${weekday.endsWith(".") ? weekday : `${weekday}.`} ${datePart}`;
}

async function prepareBaseData() {
  const seminarsPayload = await fetchJson("/seminare");
  const seminars = Array.isArray(seminarsPayload)
    ? seminarsPayload
        .filter((entry) => Array.isArray(entry.termine) && entry.termine.length > 0)
        .map((entry) => {
          const termin = entry.termine[0];
          return {
            id: entry.id,
            slug: entry.slug,
            title: entry.name,
            terminId: termin.id,
            terminLabel: formatTerminLabel(termin),
            preisBrutto: parseNumber(entry.preis),
            steuerSatz: entry.mwst === false ? 0 : 19
          };
        })
    : [];

  assert(seminars.length > 0, "Keine Seminardaten verfügbar.");

  const productSlugs = ["verkostungsset-sensorik", "weinbuch-klassiker"];
  const productDetails = await Promise.all(
    productSlugs.map((slug) =>
      fetchJson(`/produkte/${encodeURIComponent(slug)}`).catch((error) => {
        throw new Error(`Produktdaten für "${slug}" konnten nicht geladen werden: ${error.message}`);
      })
    )
  );

  const products = productDetails.map((product) => {
    const brutto = parseNumber(product.preisBrutto ?? product.preisNetto ?? null);
    const netto = parseNumber(product.preisNetto ?? null);
    const steuerSatz =
      product.mwst === false
        ? 0
        : parseNumber(product.steuerSatz ?? null) ??
          (brutto != null && netto != null && netto > 0 ? Math.round(((brutto / netto - 1) * 100 + Number.EPSILON) * 100) / 100 : 19);
    return {
      id: product.id,
      slug: product.slug,
      title: product.name,
      preisBrutto: brutto,
      preisNetto: netto,
      steuerSatz,
      isVoucher: Boolean(product.gutschein)
    };
  });

  const voucherTemplate = await fetchJson("/gutscheine/template").catch(() => ({
    name: "Geschenkgutschein",
    minBetrag: 50,
    maxBetrag: 500
  }));

  return { seminars, products, voucherTemplate };
}

function buildScenarios(baseData) {
  const seminarPrimary = baseData.seminars.find((entry) => entry.slug === "sensorik-essentials") || baseData.seminars[0];
  const seminarSecondary =
    baseData.seminars.find((entry) => entry.slug !== seminarPrimary.slug) || baseData.seminars[baseData.seminars.length - 1];
  const seminarVatFree =
    baseData.seminars.find((entry) => entry.steuerSatz === 0) ||
    baseData.seminars.find((entry) => entry.slug === "wset-level-3-weine");
  assert(seminarVatFree, "Kein seminar ohne MwSt gefunden.");

  const productSensorik = baseData.products.find((entry) => entry.slug === "verkostungsset-sensorik") || baseData.products[0];
  const productWeinbuch = baseData.products.find((entry) => entry.slug === "weinbuch-klassiker") || baseData.products[baseData.products.length - 1];

  const voucherAmount = clampAmount(120, baseData.voucherTemplate);
  const voucherAmountCompany = clampAmount(80, baseData.voucherTemplate);
  const mixedVoucherCode = VOUCHER_CODES.percentage;

  const seminarMixTotals = (() => {
    const taxableGross = seminarPrimary.preisBrutto ?? seminarPrimary.preis ?? 0;
    const vatFreeGross = seminarVatFree.preisBrutto ?? seminarVatFree.preis ?? 0;
    const totalGross = taxableGross + vatFreeGross;
    const totalNet = (taxableGross / (1 + DEFAULT_VAT_RATE / 100)) + vatFreeGross;
    const totalTax = totalGross - totalNet;
    const discount = Math.min(totalGross * 0.1, 100);
    const ratio = totalNet / totalGross;
    const discountNet = Math.round((discount * ratio + Number.EPSILON) * 100) / 100;
    const discountTax = Math.round(((discount - discountNet) + Number.EPSILON) * 100) / 100;
    const dueGross = Math.round(((totalGross - discount) + Number.EPSILON) * 100) / 100;
    const dueNet = Math.round(((totalNet - discountNet) + Number.EPSILON) * 100) / 100;
    const dueTax = Math.round(((totalTax - discountTax) + Number.EPSILON) * 100) / 100;
    return {
      subtotal: totalGross,
      discount,
      tax: dueTax,
      total: dueGross,
      net: dueNet
    };
  })();

  return [
    {
      name: "Szenario A: Seminar + Produkt + Gutscheinbetrag (Privat)",
      cart: {
        seminars: [
          {
            slug: seminarPrimary.slug,
            title: seminarPrimary.title,
            terminId: seminarPrimary.terminId,
            quantity: 2,
            participants: [
              {
                firstName: "Anna",
                lastName: "Sommer",
                email: "anna.sommer+puppeteer@example.com",
                wsetNumber: "A-1001",
                specialNeeds: "Vegetarisch"
              },
              {
                firstName: "Ben",
                lastName: "Winter",
                email: "ben.winter+puppeteer@example.com",
                wsetNumber: "B-1002",
                specialNeeds: ""
              }
            ]
          }
        ],
        product: { ...productSensorik, quantity: 1 },
        voucherSelection: {
          amount: voucherAmount,
          title: "Geschenkgutschein",
          description: "Automatischer Testgutschein"
        }
      },
      voucherCode: null,
      billing: {
        type: "privat",
        street: "Weinbergweg 7",
        zip: "20095",
        city: "Hamburg",
        country: "Deutschland",
        contactFirstName: "Clara",
        contactLastName: "Rechnung",
        contactEmail: "clara.rechnung+privat@example.com",
        phone: "+49 40 1234567",
        newsletterOptIn: true
      },
      voucherDetails: {
        selection: {
          versandArt: "digital",
          empfaengerName: "Mara Beschenkt",
          empfaengerEmail: "mara.beschenkt@example.com",
          lieferDatum: formatDateISO(new Date(Date.now() + 5 * 24 * 60 * 60 * 1000)),
          persoenlicheNachricht: "Alles Gute und viel Freude!"
        }
      }
    },
    {
      name: "Szenario B: Produktbestellung mit Gutscheincode (Privat)",
      cart: {
        product: { ...productWeinbuch, quantity: 3 }
      },
      voucherCode: VOUCHER_CODES.percentage,
      billing: {
        type: "privat",
        street: "Musterweg 15",
        zip: "50667",
        city: "Köln",
        country: "Deutschland",
        contactFirstName: "Daniel",
        contactLastName: "Direkt",
        contactEmail: "daniel.direkt@example.com",
        phone: "+49 221 9876543",
        newsletterOptIn: false
      }
    },
    {
      name: "Szenario C: Seminar (Firmenrechnung) + Gutscheinbetrag",
      cart: {
        seminars: [
          {
            slug: seminarSecondary.slug,
            title: seminarSecondary.title,
            terminId: seminarSecondary.terminId,
            quantity: 3,
            participants: [
              {
                firstName: "Eva",
                lastName: "Kontor",
                email: "eva.kontor@example.com",
                wsetNumber: "EK-3001",
                specialNeeds: ""
              },
              {
                firstName: "Fritz",
                lastName: "Logistik",
                email: "fritz.logistik@example.com",
                wsetNumber: "FL-3002",
                specialNeeds: "Glutenfrei"
              },
              {
                firstName: "Greta",
                lastName: "Support",
                email: "greta.support@example.com",
                wsetNumber: "",
                specialNeeds: ""
              }
            ]
          }
        ],
        voucherSelection: {
          amount: voucherAmountCompany,
          title: "Firmen-Gutschein",
          description: "Testgutschein Firmenrechnung"
        }
      },
      voucherCode: null,
      billing: {
        type: "firma",
        companyName: "Weinhandel Muster GmbH",
        vatId: "DE123456789",
        invoiceEmail: "buchhaltung@example.com",
        street: "Weinplatz 3",
        zip: "80331",
        city: "München",
        country: "Deutschland",
        contactFirstName: "Henriette",
        contactLastName: "Hanse",
        contactEmail: "henriette.hanse@example.com",
        phone: "+49 89 123456",
        newsletterOptIn: true
      },
      voucherDetails: {
        selection: {
          versandArt: "physisch",
          empfaengerName: "Max Mustermann",
          adresszusatz: "c/o Empfang",
          strasse: "Geschenkweg 12",
          plz: "70173",
          stadt: "Stuttgart",
          land: "Deutschland",
          lieferDatum: formatDateISO(new Date(Date.now() + 12 * 24 * 60 * 60 * 1000)),
          persoenlicheNachricht: "Viele Grüße vom gesamten Team!"
        }
      }
    },
    {
      name: "Szenario D: Seminare gemischte MwSt + Gutschein",
      cart: {
        seminars: [
          {
            slug: seminarPrimary.slug,
            title: seminarPrimary.title,
            terminId: seminarPrimary.terminId,
            quantity: 1,
            participants: [
              {
                firstName: "Laura",
                lastName: "Steuer",
                email: "laura.steuer@example.com",
                wsetNumber: "LS-4001",
                specialNeeds: ""
              }
            ]
          },
          {
            slug: seminarVatFree.slug,
            title: seminarVatFree.title,
            terminId: seminarVatFree.terminId,
            quantity: 1,
            participants: [
              {
                firstName: "Martin",
                lastName: "Nullsteuer",
                email: "martin.nullsteuer@example.com",
                wsetNumber: "MN-5001",
                specialNeeds: ""
              }
            ]
          }
        ]
      },
      voucherCode: mixedVoucherCode,
      billing: {
        type: "privat",
        street: "Steuerweg 9",
        zip: "22765",
        city: "Hamburg",
        country: "Deutschland",
        contactFirstName: "Laura",
        contactLastName: "Steuer",
        contactEmail: "laura.steuer@example.com",
        phone: "+49 40 7654321",
        newsletterOptIn: false
      },
      assertions: {
        overviewTotals: [
          { label: "Zwischensumme", value: EURO.format(seminarMixTotals.subtotal) },
          { label: "Gutschein", value: `-${EURO.format(seminarMixTotals.discount)}` },
          { label: "Steuern", value: EURO.format(seminarMixTotals.tax) },
          { label: "Gesamtsumme", value: EURO.format(seminarMixTotals.total) }
        ]
      },
      postCheck: async (result) => {
        const invoiceNumber =
          (result.orderNumber || result.orderSummary?.bestellnummer || "").replace(/\.$/, "");
        const token = resolveSevDeskToken();
        if (!token) {
          console.warn("⚠️  SEVDESK_API_TOKEN nicht gesetzt – Rechnung für MwSt-Mix nicht geprüft.");
          return;
        }
        if (!invoiceNumber) {
          console.warn("⚠️  Keine Bestellnummer für MwSt-Mix gefunden, SevDesk-Prüfung übersprungen.");
          return;
        }
        const invoice = await fetchSevDeskInvoiceByNumber(invoiceNumber);
        if (!invoice) {
          console.warn(`⚠️  SevDesk-Rechnung ${invoiceNumber} nicht gefunden.`);
          return;
        }
        assertClose(Number(invoice.sumGross), seminarMixTotals.total, "SevDesk Brutto (MwSt-Mix)");
        assertClose(Number(invoice.sumTax), seminarMixTotals.tax, "SevDesk Steuer (MwSt-Mix)");
      }
    }
  ];
}

function buildSeminarSelectionPayload(seminar, quantity) {
  const dateId = seminar.terminId != null ? String(seminar.terminId) : null;
  const slugPart = (seminar.slug ?? "seminar").toLowerCase();
  const datePart = dateId ?? "any";
  return {
    id: `${slugPart || "seminar"}::${datePart}`,
    type: "seminar",
    slug: seminar.slug,
    seminarSlug: seminar.slug,
    title: seminar.title,
    seminarTitle: seminar.title,
    quantity,
    dateId,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}

function buildProductSelectionPayload(product, quantity) {
  const price = product.preisBrutto ?? product.preisNetto ?? null;
  return {
    type: "product",
    slug: product.slug,
    productSlug: product.slug,
    title: product.title,
    productTitle: product.title,
    quantity,
    priceValue: price,
    priceNetto: product.preisNetto ?? null,
    steuerSatz: product.steuerSatz ?? null,
    priceFormatted: price != null ? EURO.format(price) : null,
    isVoucher: Boolean(product.isVoucher),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}

function buildVoucherSelectionPayload(selection) {
  return {
    amount: selection.amount,
    title: selection.title,
    description: selection.description ?? null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}

function getScenarioVoucherItems(scenario) {
  const items = [];
  const product = scenario.cart?.product;
  if (product && product.isVoucher) {
    const quantity = Math.max(1, Math.trunc(product.quantity ?? 1));
    items.push({
      key: "product",
      title: product.title || "Gutschein",
      quantity
    });
  }
  if (scenario.cart?.voucherSelection) {
    items.push({
      key: "selection",
      title: scenario.cart.voucherSelection.title || "Geschenkgutschein",
      quantity: 1
    });
  }
  return items;
}

async function setCartState(page, scenario) {
  const payload = {
    seminars: [],
    product: null,
    voucher: null,
    cartCount: 0
  };

  const seminarEntries = Array.isArray(scenario.cart?.seminars) && scenario.cart?.seminars.length
    ? scenario.cart.seminars
    : scenario.cart?.seminar
      ? [scenario.cart.seminar]
      : [];

  seminarEntries.forEach((seminarEntry) => {
    const quantity = Math.max(1, Math.trunc(seminarEntry.quantity ?? 1));
    payload.seminars.push(buildSeminarSelectionPayload(seminarEntry, quantity));
    payload.cartCount += quantity;
  });

  if (scenario.cart?.product) {
    const quantity = Math.max(1, Math.trunc(scenario.cart.product.quantity ?? 1));
    payload.product = buildProductSelectionPayload(scenario.cart.product, quantity);
    payload.cartCount += quantity;
  }

  if (scenario.cart?.voucherSelection) {
    payload.voucher = buildVoucherSelectionPayload(scenario.cart.voucherSelection);
    payload.cartCount += 1;
  }

  const hasItems = payload.seminars.length > 0 || !!payload.product || !!payload.voucher;
  const cartCount = Math.max(payload.cartCount, hasItems ? 1 : 0);

  await page.evaluate((data) => {
    window.localStorage.clear();
    if (Array.isArray(data.seminars) && data.seminars.length) {
      window.localStorage.setItem("booking:lastSelection", JSON.stringify(data.seminars));
    }
    if (data.product) {
      window.localStorage.setItem("cart:productSelection", JSON.stringify(data.product));
    }
    if (data.voucher) {
      window.localStorage.setItem("voucher:lastSelection", JSON.stringify(data.voucher));
    }
    window.localStorage.setItem("cart:count", String(data.cartCount));
  }, { ...payload, cartCount });
}

async function getSectionHandle(page, headingText) {
  await page.waitForFunction(() => Boolean(document.querySelector("form section")), {
    timeout: DEFAULT_TIMEOUT
  });
  const section = await page.$("form section");
  if (!section) {
    return null;
  }
  if (headingText) {
    const currentHeading = await page
      .$eval("h1", (node) => node.textContent?.toLowerCase().trim() || "")
      .catch(() => "");
    if (DEBUG) {
      console.log("[DEBUG] getSectionHandle", headingText, { currentHeading });
    }
    if (!currentHeading.includes(headingText.toLowerCase())) {
      if (DEBUG) {
        console.warn(`[DEBUG] Erwarteter Schritt "${headingText}", gefunden "${currentHeading || "unbekannt"}".`);
      }
    }
  }
  return section;
}

async function typeValue(inputHandle, value) {
  if (!inputHandle || value == null || value === "") {
    return;
  }
  await inputHandle.evaluate((element) => {
    if ("value" in element) {
      element.value = "";
      element.dispatchEvent(new Event("input", { bubbles: true }));
    }
  });
  await inputHandle.type(value, { delay: 20 });
}

async function fillParticipantsStep(page, scenario) {
  const seminarEntries = Array.isArray(scenario.cart?.seminars) && scenario.cart?.seminars.length
    ? scenario.cart.seminars
    : scenario.cart?.seminar
      ? [scenario.cart.seminar]
      : [];

  await page.waitForFunction(() => Boolean(document.querySelector("form section")), {
    timeout: DEFAULT_TIMEOUT
  });

  const section = await getSectionHandle(page, "Teilnehmer");
  if (!section) {
    if (seminarEntries.length === 0) {
      return;
    }
    throw new Error("Teilnehmer-Abschnitt nicht gefunden.");
  }

  if (seminarEntries.length === 0) {
    await page.$eval("form", (form) => form.requestSubmit());
    await page.waitForFunction(() => {
      const heading = document.querySelector("h1")?.textContent || "";
      return heading.includes("Gutscheine") || heading.includes("Rechnungsadresse");
    }, { timeout: DEFAULT_TIMEOUT });
    return;
  }

  const defaultParticipant = {
    firstName: "Test",
    lastName: "Teilnehmer",
    email: "teilnehmer@example.com",
    wsetNumber: "",
    specialNeeds: ""
  };
  const fallbackParticipants =
    Array.isArray(scenario.participants) && scenario.participants.length
      ? scenario.participants
      : [defaultParticipant];

  const participantGroups = seminarEntries.map((entry) => {
    const quantity = Math.max(1, Math.trunc(entry.quantity ?? 1));
    const source = Array.isArray(entry.participants) && entry.participants.length ? entry.participants : fallbackParticipants;
    const normalised = [];
    for (let i = 0; i < quantity; i += 1) {
      const origin = source[i] || source[0] || defaultParticipant;
      normalised.push({
        firstName: origin.firstName ?? defaultParticipant.firstName,
        lastName: origin.lastName ?? defaultParticipant.lastName,
        email: origin.email ?? "",
        wsetNumber: origin.wsetNumber ?? "",
        specialNeeds: origin.specialNeeds ?? ""
      });
    }
    return normalised;
  });

  await page.evaluate(
    ({ groups, fallback }) => {
      const section = document.querySelector("form section");
      if (!section) {
        throw new Error("Teilnehmer-Abschnitt konnte clientseitig nicht gefunden werden.");
      }
      const container =
        Array.from(section.querySelectorAll("div")).find((node) =>
          node instanceof HTMLElement && node.querySelector("div.rounded-2xl")
        ) || null;
      if (!container) {
        throw new Error("Teilnehmer-Gruppencontainer nicht gefunden.");
      }
      const groupContainers = Array.from(container.children).filter((node) =>
        node instanceof HTMLElement && node.querySelector("div.rounded-2xl")
      );
      if (groupContainers.length < groups.length) {
        throw new Error(`Erwartete ${groups.length} Teilnehmer-Gruppen, gefunden ${groupContainers.length}.`);
      }

      const setValue = (element, value) => {
        if (!element) return;
        const prototype = Object.getPrototypeOf(element);
        const descriptor = Object.getOwnPropertyDescriptor(prototype, "value");
        descriptor?.set?.call(element, value);
        element.dispatchEvent(new Event("input", { bubbles: true }));
        element.dispatchEvent(new Event("change", { bubbles: true }));
      };

      groups.forEach((participants, groupIndex) => {
        const container = groupContainers[groupIndex];
        const cards = Array.from(container.querySelectorAll("div.rounded-2xl"));
        cards.forEach((card, cardIndex) => {
          const participant = participants[cardIndex] || participants[0] || fallback;
          const inputs = card.querySelectorAll("input");
          const textarea = card.querySelector("textarea");
          setValue(inputs[0], participant.firstName || "");
          setValue(inputs[1], participant.lastName || "");
          setValue(inputs[2], participant.email || "");
          setValue(inputs[3], participant.wsetNumber || "");
          setValue(textarea, participant.specialNeeds || "");
        });
      });
    },
    { groups: participantGroups, fallback: defaultParticipant }
  );

  await page.$eval("form", (form) => form.requestSubmit());
  await page.waitForFunction(() => {
    const heading = document.querySelector("h1")?.textContent || "";
    return heading.includes("Gutscheine") || heading.includes("Rechnungsadresse");
  }, { timeout: DEFAULT_TIMEOUT });
}

async function fillVoucherStep(page, scenario) {
  const voucherItems = getScenarioVoucherItems(scenario);
  const section = await getSectionHandle(page, "Gutscheine");

  if (!section) {
    if (voucherItems.length === 0) {
      return;
    }
    throw new Error("Gutschein-Abschnitt wurde nicht gefunden.");
  }

  if (voucherItems.length === 0) {
    await page.$eval("form", (form) => form.requestSubmit());
    await page.waitForFunction(() => document.body.innerText.includes("Rechnungsadresse"), {
      timeout: DEFAULT_TIMEOUT
    });
    return;
  }

  const containers = await section.$$("div.py-6");
  assert(containers.length >= voucherItems.length, "Unerwartete Anzahl Gutschein-Karten.");

  const detailMap = scenario.voucherDetails || {};
  const defaultDetails = {
    versandArt: "digital",
    empfaengerName: "Gutschein Empfänger",
    empfaengerEmail: "gutschein@example.com",
    adresszusatz: "",
    strasse: "Gutscheinweg 1",
    plz: "20095",
    stadt: "Hamburg",
    land: "Deutschland",
    lieferDatum: "",
    persoenlicheNachricht: ""
  };

  for (let index = 0; index < voucherItems.length; index += 1) {
    const item = voucherItems[index];
    const container = containers[index];
    const rawDetails = detailMap[item.key] || {};
    const details = {
      ...defaultDetails,
      ...rawDetails,
      versandArt: rawDetails.versandArt === "physisch" ? "physisch" : "digital"
    };

    const shippingButtons = await container.$$(`button[role="tab"]`);
    if (details.versandArt === "physisch" && shippingButtons[1]) {
      await shippingButtons[1].click();
      await delay(150);
    } else if (shippingButtons[0]) {
      await shippingButtons[0].click();
      await delay(150);
    }

    const fillField = async (selector, value) => {
      if (value == null || value === "") {
        return;
      }
      const handle = await container.$(selector);
      if (!handle) {
        return;
      }
      const inputType = await handle.evaluate((element) => {
        if (element instanceof HTMLInputElement) {
          return element.type || null;
        }
        return null;
      });
      if (inputType === "date") {
        await handle.evaluate(
          (element, nextValue) => {
            if ("value" in element) {
              element.value = nextValue;
              element.dispatchEvent(new Event("input", { bubbles: true }));
              element.dispatchEvent(new Event("change", { bubbles: true }));
            }
          },
          value
        );
      } else {
        await typeValue(handle, value);
      }
      await handle.dispose();
    };

    await fillField(`#voucher-${item.key}-name`, details.empfaengerName || `Empfänger ${index + 1}`);

    if (details.versandArt === "digital") {
      await fillField(
        `#voucher-${item.key}-email`,
        details.empfaengerEmail || `gutschein-${index + 1}@example.com`
      );
    } else {
      await fillField(`#voucher-${item.key}-strasse`, details.strasse || defaultDetails.strasse);
      if (details.adresszusatz) {
        await fillField(`#voucher-${item.key}-adresszusatz`, details.adresszusatz);
      }
      await fillField(`#voucher-${item.key}-plz`, details.plz || defaultDetails.plz);
      await fillField(`#voucher-${item.key}-stadt`, details.stadt || defaultDetails.stadt);
      await fillField(`#voucher-${item.key}-land`, details.land || defaultDetails.land);
    }

    if (details.lieferDatum) {
      await fillField(`#voucher-${item.key}-lieferdatum`, details.lieferDatum);
    }
    if (details.persoenlicheNachricht) {
      await fillField(`#voucher-${item.key}-nachricht`, details.persoenlicheNachricht);
    }
  }

  await page.$eval("form", (form) => form.requestSubmit());
  await page.waitForFunction(() => {
    const heading = document.querySelector("h1")?.textContent || "";
    return heading.includes("Rechnungsadresse");
  }, { timeout: DEFAULT_TIMEOUT });
}

async function fillBillingStep(page, billing) {
  const section = await getSectionHandle(page, "Rechnungsadresse");
  assert(section, "Rechnungsadresse-Abschnitt wurde nicht gefunden.");

  if (billing.type === "firma") {
    const buttons = await section.$$("button");
    const buttonEntries = await Promise.all(
      buttons.map(async (button) => {
        const text = ((await button.evaluate((node) => node.textContent?.trim() || "")) || "").toLowerCase();
        return { button, text };
      })
    );
    if (DEBUG) {
      console.log("[DEBUG] Rechnungstyp Buttons:", buttonEntries.map((entry) => entry.text));
    }
    const firmaEntry =
      buttonEntries.find((entry) => entry.text.includes("geschäft")) ||
      buttonEntries.find((entry) => entry.text.includes("firma"));
    const firmaButton = firmaEntry?.button ?? null;
    if (firmaButton) {
      await firmaButton.click();
      await delay(150);
    }
  }

  const fillByLabel = async (needle, value) => {
    if (!value) {
      return;
    }
    const targetId = await section.$$eval(
      "label",
      (nodes, search) => {
        const target = search.toLowerCase();
        for (const node of nodes) {
          const text = (node.textContent || "").toLowerCase();
          if (text.includes(target)) {
            return node.getAttribute("for");
          }
        }
        return null;
      },
      needle
    );
    assert(targetId, `Feld für "${needle}" nicht gefunden.`);
    const selector = `#${targetId.replace(/([\\#:.\[\],=])/g, "\\$1")}`;
    const inputHandle = await section.$(selector);
    assert(inputHandle, `Eingabefeld für "${needle}" nicht gefunden.`);
    if (DEBUG) {
      const labelText = await section.$$eval(
        "label",
        (nodes, id) => {
          const match = nodes.find((node) => node.getAttribute("for") === id);
          return match ? match.textContent?.trim() || "" : "";
        },
        targetId
      );
      console.log(`[DEBUG] Label ${needle}:`, labelText);
    }
    await typeValue(inputHandle, value);
    await inputHandle.dispose();
  };

  const fillById = async (id, value) => {
    if (!value) {
      return;
    }
    const selector = `#${id.replace(/([\\#:.\[\],=])/g, "\\$1")}`;
    const inputHandle = await section.$(selector);
    assert(inputHandle, `Eingabefeld für "${id}" nicht gefunden.`);
    if (DEBUG) {
      const labelText = await section.$$eval(
        "label",
        (nodes, inputId) => {
          const match = nodes.find((node) => node.getAttribute("for") === inputId);
          return match ? match.textContent?.trim() || "" : "";
        },
        id
      );
      console.log(`[DEBUG] Feld ${id}:`, labelText);
    }
    await typeValue(inputHandle, value);
    await inputHandle.dispose();
  };

  await fillByLabel("vorname", billing.contactFirstName ?? "");
  await fillByLabel("nachname", billing.contactLastName ?? "");
  await fillById("billing-contactEmail", billing.contactEmail ?? "");
  await fillByLabel("telefon", billing.phone ?? "");
  await fillByLabel("straße", billing.street ?? "");
  await fillByLabel("postleitzahl", billing.zip ?? "");
  await fillByLabel("stadt", billing.city ?? "");
  await fillByLabel("land", billing.country ?? "");

  if (billing.type === "firma") {
    await fillById("billing-companyName", billing.companyName ?? "");
    await fillById("billing-invoiceEmail", billing.invoiceEmail ?? "");
    if (billing.vatId) {
      await fillById("billing-vatId", billing.vatId);
    }
  }

  await page.$eval("form", (form) => form.requestSubmit());
  try {
    await page.waitForFunction(() => {
      const heading = document.querySelector("h1")?.textContent || "";
      return heading.includes("Bestellübersicht");
    }, { timeout: DEFAULT_TIMEOUT });
  } catch (error) {
    const errorPreview = await page
      .evaluate(() => document.body.innerText.slice(-800))
      .catch(() => "n/a");
    throw new Error(`Wechsel zur Bestellübersicht fehlgeschlagen: ${errorPreview}`);
  }
}

async function applyVoucherCode(page, code) {
  if (!code) {
    return;
  }
  const input = await page.$("input[placeholder='Code eingeben']");
  assert(input, "Feld für Gutscheincode nicht gefunden.");
  await typeValue(input, code);

  const button = await page.evaluateHandle(() => {
    const buttons = Array.from(document.querySelectorAll("button"));
    return buttons.find((btn) => btn.textContent?.trim() === "Code prüfen") || null;
  });
  assert(button, "Button \"Code prüfen\" nicht gefunden.");
  await button.click();
  await delay(300);

  await page.waitForFunction(
    (voucherCode) => {
      const text = document.body.innerText || "";
      if (text.includes("Gutschein angewendet") || text.includes("Rabattcode angewendet")) {
        return true;
      }
      if (text.includes("Gutscheincode") && text.includes("nicht") && text.includes("validiert")) {
        throw new Error(`Gutscheincode ${voucherCode} konnte nicht validiert werden.`);
      }
      return false;
    },
    { timeout: DEFAULT_TIMEOUT },
    code
  );
}

async function handleOverviewStep(page, scenario) {
  const section = await getSectionHandle(page, "Bestellübersicht");
  assert(section, "Bestellübersicht-Abschnitt wurde nicht gefunden.");

  await applyVoucherCode(page, scenario.voucherCode);

  if (DEBUG) {
    const checkboxDebug = await page.evaluate(() =>
      Array.from(document.querySelectorAll("input[type='checkbox']")).map((input) => ({
        id: input.id,
        name: input.name,
        label: input.closest("label")?.innerText?.trim() || "",
        parentClass: input.parentElement?.className || ""
      }))
    );
    console.log("[DEBUG] Checkbox-Übersicht:", checkboxDebug);
  }

  const checkboxHandles = await page.$$("input[type='checkbox']");
  let agbCheckbox = null;
  let privacyCheckbox = null;
  let newsletterCheckbox = null;

  for (const checkbox of checkboxHandles) {
    const labelText = await checkbox.evaluate((node) => node.closest("label")?.innerText?.trim() || "");
    if (!labelText) {
      continue;
    }
    const lowerText = labelText.toLowerCase();
    if (lowerText.includes("agb")) {
      agbCheckbox = checkbox;
    } else if (lowerText.includes("datenschutz")) {
      privacyCheckbox = checkbox;
    } else if (lowerText.includes("newsletter") || lowerText.includes("neuigkeiten")) {
      newsletterCheckbox = checkbox;
    } else {
      await checkbox.dispose();
    }
  }

  assert(agbCheckbox, "AGB-Checkbox nicht gefunden.");
  assert(privacyCheckbox, "Datenschutz-Checkbox nicht gefunden.");

  await agbCheckbox.click();
  await privacyCheckbox.click();
  if (scenario.billing.newsletterOptIn && newsletterCheckbox) {
    await newsletterCheckbox.click();
  }

  // Dispose remaining checkbox handles
  for (const checkbox of checkboxHandles) {
    if (checkbox !== agbCheckbox && checkbox !== privacyCheckbox && checkbox !== newsletterCheckbox) {
      await checkbox.dispose();
    }
  }
  await agbCheckbox.dispose();
  await privacyCheckbox.dispose();
  if (newsletterCheckbox) {
    await newsletterCheckbox.dispose();
  }

  if (scenario.assertions?.overviewTotals?.length) {
    const overviewRaw = await page.evaluate(() => document.body.innerText);
    const overviewText = normaliseText(overviewRaw);
    if (DEBUG) {
      console.log("[DEBUG] Bestellübersicht:", overviewText);
    }
    for (const assertion of scenario.assertions.overviewTotals) {
      const label = normaliseText(assertion.label);
      const value = normaliseText(assertion.value);
      if (label && !overviewText.includes(label)) {
        throw new Error(`[Bestellübersicht] Kennzeichnung "${assertion.label}" wurde nicht gefunden.`);
      }
      if (value && !overviewText.includes(value)) {
        throw new Error(`[Bestellübersicht] Wert "${assertion.value}" wurde nicht gefunden.`);
      }
    }
  }

  await page.$eval("form", (form) => form.requestSubmit());
  await page.waitForFunction(() => document.body.innerText.includes("Zahlung"), { timeout: DEFAULT_TIMEOUT });
}

async function handlePaymentStep(page) {
  const section = await getSectionHandle(page, "Zahlung");
  assert(section, "Zahlungsabschnitt nicht gefunden.");

  await page.$eval("form", (form) => form.requestSubmit());
}

async function waitForConfirmation(page) {
  await page.waitForFunction(
    () => window.location.search.includes("order=") || document.body.innerText.includes("Vielen Dank"),
    { timeout: DEFAULT_TIMEOUT * 2 }
  );

  return page.evaluate(() => {
    const url = new URL(window.location.href);
    const orderId = url.searchParams.get("order");
    const numberText =
      Array.from(document.querySelectorAll("p, span, strong"))
        .map((node) => node.textContent?.trim() || "")
        .find((text) => text.includes("Bestellnummer")) || null;
    return { orderId, numberText, confirmationUrl: url.toString() };
  });
}

async function fetchOrderSummary(orderId) {
  if (!orderId) {
    return null;
  }
  return fetchJson(`/bestellungen/${encodeURIComponent(orderId)}`).catch((error) => {
    logDebug(`Bestellstatus für ${orderId} konnte nicht geladen werden: ${error.message}`);
    return null;
  });
}

async function runScenario(browser, scenario) {
  const page = await browser.newPage();
  page.setDefaultTimeout(DEFAULT_TIMEOUT);
  page.setDefaultNavigationTimeout(DEFAULT_TIMEOUT);
  let createdOrderResponse = null;
  let lastOrderRequestPayload = null;

  const handleResponse = async (res) => {
    const url = res.url();
    if (!url.includes("/api/public/bestellungen")) return;
    if (res.request().method() !== "POST") return;
    if (DEBUG) {
      console.log(`[Browser-${scenario.name}] RESPONSE ${res.status()} ${url}`);
    }
    try {
      const text = await res.text();
      const status = res.status();
      if (!text) {
        createdOrderResponse = status >= 400 ? { status } : null;
      } else {
        try {
          const parsed = JSON.parse(text);
          createdOrderResponse = status >= 400 ? { status, error: parsed } : parsed;
        } catch (parseError) {
          createdOrderResponse = status >= 400 ? { status, error: text } : { raw: text };
        }
      }
      if (status >= 400) {
        const errorText =
          typeof createdOrderResponse?.error === "string"
            ? createdOrderResponse.error
            : JSON.stringify(createdOrderResponse?.error);
        console.error(
          `[Browser-${scenario.name}] Bestellung fehlgeschlagen (${status}): ${errorText || "Unbekannter Fehler"}`
        );
        if (lastOrderRequestPayload && DEBUG) {
          console.error(`[Browser-${scenario.name}] Request-Payload: ${lastOrderRequestPayload}`);
        }
      }
    } catch (error) {
      logDebug(`Antwort konnte nicht geparst werden: ${error.message}`);
    }
  };

  const handleOrderRequest = (req) => {
    if (req.url().includes("/api/public/bestellungen") && req.method() === "POST") {
      try {
        lastOrderRequestPayload = req.postData();
      } catch {
        lastOrderRequestPayload = null;
      }
    }
  };

  if (DEBUG) {
    page.on("console", (msg) => console.log(`[Browser-${scenario.name}]`, msg.type().toUpperCase(), msg.text()));
    page.on("requestfailed", (req) => console.log(`[Browser-${scenario.name}] REQUEST FAILED:`, req.url(), req.failure()?.errorText));
  }
  page.on("response", handleResponse);
  page.on("request", handleOrderRequest);

  try {
    await page.goto(BASE_URL, { waitUntil: "domcontentloaded", timeout: DEFAULT_TIMEOUT });
    await setCartState(page, scenario);
    await page.goto(`${BASE_URL}/checkout`, { waitUntil: "domcontentloaded", timeout: DEFAULT_TIMEOUT });
    await page.waitForSelector("form", { timeout: DEFAULT_TIMEOUT });

    await fillParticipantsStep(page, scenario);
    await fillVoucherStep(page, scenario);
    await fillBillingStep(page, scenario.billing);
    await handleOverviewStep(page, scenario);
    await handlePaymentStep(page);

    if (DEBUG) {
      console.log("[DEBUG] Order response payload:", createdOrderResponse);
    }
    if (createdOrderResponse && (createdOrderResponse.error || createdOrderResponse.raw)) {
      throw new Error(
        `Bestellung fehlgeschlagen: ${
          createdOrderResponse.error?.message || createdOrderResponse.raw || JSON.stringify(createdOrderResponse.error)
        }`
      );
    }

    let confirmation;
    try {
      confirmation = await waitForConfirmation(page);
    } catch (error) {
      const bodyPreview = await page
        .evaluate(() => document.body.innerText.slice(-1000))
        .catch(() => "n/a");
      throw new Error(`Bestellbestätigung nicht erreicht: ${bodyPreview}`);
    }
    let resolvedOrderId = confirmation.orderId || (createdOrderResponse?.id != null ? String(createdOrderResponse.id) : "");
    let missingOrderIdNote = null;
    if (!resolvedOrderId) {
      const currentUrl = await page.url();
      const bodyPreview = await page.evaluate(() => document.body.innerText.slice(-500));
      missingOrderIdNote = {
        url: currentUrl,
        response: createdOrderResponse,
        preview: bodyPreview.replace(/\s+/g, " ").trim()
      };
      logDebug(`Bestell-ID fehlte, nutze Bestellnummer als Referenz (${missingOrderIdNote.preview})`);
    }

    const orderSummary = resolvedOrderId ? await fetchOrderSummary(resolvedOrderId) : null;
    const orderNumberMatch = confirmation.numberText ? confirmation.numberText.match(/WA-\d+/) : null;
    const orderNumber = orderNumberMatch?.[0] || createdOrderResponse?.bestellnummer || null;

    return {
      scenario: scenario.name,
      orderId: resolvedOrderId || null,
      orderNumber,
      confirmationUrl: confirmation.confirmationUrl,
      orderSummary,
      notes: missingOrderIdNote
    };
  } finally {
    page.off("response", handleResponse);
    await page.close();
  }
}

async function main() {
  console.log("🚀 Starte Puppeteer-Checkout-Szenarien gegen:", BASE_URL);
  const baseData = await prepareBaseData();
  const scenarios = buildScenarios(baseData);
  const filter = (process.env.CHECKOUT_SCENARIO || "").trim().toLowerCase();
  const activeScenarios = filter
    ? scenarios.filter((scenario) => scenario.name.toLowerCase().includes(filter))
    : scenarios;

  assert(activeScenarios.length > 0, filter ? `Kein Szenario passt zum Filter "${filter}".` : "Keine Szenarien definiert.");

  console.log(`ℹ️ Es werden ${activeScenarios.length} Szenarien ausgeführt${filter ? ` (Filter "${filter}")` : ""}.`);

  const browser = await puppeteer.launch({
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--window-size=1280,1024"]
  });

  const results = [];
  try {
    for (const scenario of activeScenarios) {
      const startedAt = Date.now();
      console.log(`→ ${scenario.name} ...`);
      try {
        const result = await runScenario(browser, scenario);
        if (typeof scenario.postCheck === "function") {
          await scenario.postCheck(result);
        }
        const duration = ((Date.now() - startedAt) / 1000).toFixed(1);
        console.log(
          `   ✅ Erfolgreich (Order-ID ${result.orderId}${
            result.orderNumber ? `, Bestellnummer ${result.orderNumber}` : ""
          }) – Dauer ${duration}s`
        );
        results.push(result);
      } catch (error) {
        console.error(`   ❌ Szenario fehlgeschlagen: ${error.message}`);
        throw error;
      }
    }
  } finally {
    await browser.close();
  }

  console.log("\nZusammenfassung:");
  for (const entry of results) {
    const totals = entry.orderSummary?.totals || {};
    console.log(
      ` - ${entry.scenario}: Order-ID ${entry.orderId}, Bestellnummer ${entry.orderNumber || "n/a"}, Brutto ${
        totals.brutto != null ? EURO.format(totals.brutto) : "n/a"
      }`
    );
  }

  console.log("\nJSON-Ergebnis:");
  console.log(JSON.stringify(results, null, 2));
}

main().catch((error) => {
  console.error("❌ Checkout-Szenarien fehlgeschlagen:", error);
  process.exitCode = 1;
});
