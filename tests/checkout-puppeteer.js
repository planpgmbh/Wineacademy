#!/usr/bin/env node

/**
 * Puppeteer Checkout Smoke Test
 *
 * Ablauf:
 * 1. Seminar + Termin über die Public API abfragen.
 * 2. Auswahl in localStorage (booking:lastSelection) speichern und Cart-Count setzen.
 * 3. Checkout öffnen, Formularschritte (Teilnehmer, Rechnungsadresse, Übersicht, Zahlung) durchlaufen.
 * 4. Sicherstellen, dass PayPal-Button oder Hinweis sichtbar ist.
 *
 * Basis-URL kann über CHECKOUT_BASE_URL überschrieben werden (Default: https://wineacademy.plan-p.de).
 */

const fs = require("fs");
const path = require("path");
const puppeteer = require("puppeteer");

const DEFAULT_BASE_URL = "https://wineacademy.plan-p.de";
const BASE_URL = (process.env.CHECKOUT_BASE_URL || DEFAULT_BASE_URL).trim();
const PAYPAL_EMAIL = process.env.PAYPAL_SANDBOX_EMAIL?.trim() || null;
const PAYPAL_PASSWORD = process.env.PAYPAL_SANDBOX_PASSWORD || null;
const DEBUG = process.env.DEBUG_PUPPETEER === "1";
const PAYPAL_CONFIRM_TIMEOUT = Number(process.env.PAYPAL_CONFIRM_TIMEOUT || "90000");

async function fetchSeminarSelection() {
  const response = await fetch(`${BASE_URL}/api/public/seminare?limit=1`);
  if (!response.ok) {
    throw new Error(`Seminar-API antwortet nicht (${response.status})`);
  }
  const seminars = await response.json();
  if (!Array.isArray(seminars) || seminars.length === 0) {
    throw new Error("Seminar-API lieferte keine Daten.");
  }
  const seminar = seminars.find((entry) => Array.isArray(entry.termine) && entry.termine.length > 0) || seminars[0];
  if (!seminar || !Array.isArray(seminar.termine) || seminar.termine.length === 0) {
    throw new Error("Kein Seminar mit verfügbaren Terminen gefunden.");
  }
  const termin = seminar.termine[0];
  return {
    seminar,
    termin,
    selection: {
      type: "seminar",
      slug: seminar.slug,
      seminarSlug: seminar.slug,
      title: seminar.name,
      quantity: 1,
      dateId: String(termin.id),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
  };
}

async function fillFieldByLabel(page, labelText, value) {
  await page.evaluate(
    ({ labelText, value }) => {
      const labels = Array.from(document.querySelectorAll("label.form-control"));
      const target = labels.find((label) => {
        const text = label.innerText.replace(/\s+/g, " ").trim().toLowerCase();
        return text.startsWith(labelText.toLowerCase());
      });
      if (!target) {
        throw new Error(`Feld mit Label "${labelText}" nicht gefunden.`);
      }
      const input = target.querySelector("input, textarea");
      if (!input) {
        throw new Error(`Input für Label "${labelText}" nicht gefunden.`);
      }
      input.focus();
      const prototype = Object.getPrototypeOf(input);
      const descriptor = Object.getOwnPropertyDescriptor(prototype, "value");
      descriptor?.set?.call(input, value);
      input.dispatchEvent(
        new InputEvent("input", {
          bubbles: true,
          data: value,
          inputType: "insertText",
          composed: true
        })
      );
      input.dispatchEvent(new Event("change", { bubbles: true }));
    },
    { labelText, value }
  );
  if (DEBUG) {
    const currentValue = await page.evaluate((labelText) => {
      const labels = Array.from(document.querySelectorAll("label.form-control"));
      const target = labels.find((label) => {
        const text = label.innerText.replace(/\s+/g, " ").trim().toLowerCase();
        return text.startsWith(labelText.toLowerCase());
      });
      if (!target) {
        return null;
      }
      const input = target.querySelector("input, textarea");
      return input ? input.value : null;
    }, labelText);
    console.log(`[DEBUG] Feld "${labelText}" hat nun Wert:`, currentValue);
  }
}

async function setCheckboxByLabel(page, labelText, checked = true) {
  await page.evaluate(
    ({ labelText, checked }) => {
      const labels = Array.from(document.querySelectorAll("label.label"));
      const target = labels.find((label) => {
        const text = label.innerText.replace(/\s+/g, " ").trim().toLowerCase();
        return text.startsWith(labelText.toLowerCase());
      });
      if (!target) {
        throw new Error(`Checkbox mit Label "${labelText}" nicht gefunden.`);
      }
      const input = target.querySelector("input[type=\"checkbox\"]");
      if (!input) {
        throw new Error(`Checkbox-Input für Label "${labelText}" nicht gefunden.`);
      }
      const needsToggle = input.checked !== checked;
      if (needsToggle) {
        input.click();
      }
    },
    { labelText, checked }
  );
  if (DEBUG) {
    const currentValue = await page.evaluate((labelText) => {
      const labels = Array.from(document.querySelectorAll("label.label"));
      const target = labels.find((label) => {
        const text = label.innerText.replace(/\s+/g, " ").trim().toLowerCase();
        return text.startsWith(labelText.toLowerCase());
      });
      if (!target) {
        return null;
      }
      const input = target.querySelector("input[type=\"checkbox\"]");
      return input ? input.checked : null;
    }, labelText);
    console.log(`[DEBUG] Checkbox "${labelText}" =>`, currentValue);
  }
}

async function clickButtonByText(page, text) {
  const clicked = await page.evaluate((buttonText) => {
    const buttons = Array.from(document.querySelectorAll("button"));
    const target = buttons.find((btn) => btn.textContent && btn.textContent.replace(/\s+/g, " ").includes(buttonText));
    if (target) {
      target.click();
      return true;
    }
    return false;
  }, text);
  if (!clicked) {
    throw new Error(`Button "${text}" nicht gefunden.`);
  }
}

async function selectPaymentOption(page, optionText) {
  const clicked = await page.evaluate((text) => {
    const labels = Array.from(document.querySelectorAll("label"));
    const target = labels.find((label) => label.textContent && label.textContent.includes(text));
    if (!target) return false;
    const input = target.querySelector('input[type="radio"]');
    if (!input) return false;
    input.click();
    input.dispatchEvent(new Event("change", { bubbles: true }));
    return true;
  }, optionText);
  if (!clicked) {
    throw new Error(`Zahlungsoption "${optionText}" nicht gefunden.`);
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForAnySelector(context, selectors, options = {}) {
  const timeout = options.timeout ?? 10000;
  const visible = options.visible ?? true;
  const start = Date.now();

  while (Date.now() - start < timeout) {
    const remaining = timeout - (Date.now() - start);
    for (const selector of selectors) {
      let handle = null;
      try {
        handle = await context.waitForSelector(selector, {
          timeout: Math.min(remaining, 1500),
          visible
        });
      } catch (error) {
        if (error && typeof error.message === "string") {
          const message = error.message;
          if (message.includes("detached Frame") || message.includes("Waiting for selector") || message.includes("waiting failed")) {
            continue;
          }
        }
        if (error && error.name === "TimeoutError") {
          continue;
        }
        throw error;
      }
      if (!handle) {
        continue;
      }
      const disabled = await context.evaluate((element) => {
        const attr = element.getAttribute("aria-disabled");
        const isDisabled = element.hasAttribute("disabled") || attr === "true";
        const style = window.getComputedStyle(element);
        const invisible = style.visibility === "hidden" || style.display === "none";
        return isDisabled || invisible;
      }, handle).catch((error) => {
        if (error && typeof error.message === "string" && error.message.includes("detached")) {
          return true;
        }
        throw error;
      });
      if (disabled) {
        try {
          await handle.dispose();
        } catch {
          // ignore dispose errors
        }
        continue;
      }
      return { selector, handle };
    }
    await sleep(250);
  }
  return null;
}

async function typeIntoSelector(context, selectors, value, options = {}) {
  if (!value) {
    return null;
  }
  const target = await waitForAnySelector(context, selectors, {
    timeout: options.timeout ?? 15000,
    visible: true
  });
  if (!target) {
    return null;
  }
  try {
    await target.handle.focus();
    await context.evaluate((element) => {
      if ("value" in element) {
        element.value = "";
      }
    }, target.handle);
    await target.handle.type(value, { delay: options.delay ?? 30 });
    return target.selector;
  } finally {
    try {
      await target.handle.dispose();
    } catch {
      // ignore dispose errors
    }
  }
}

async function clickFirstAvailable(context, selectors, options = {}) {
  const target = await waitForAnySelector(context, selectors, options);
  if (!target) {
    return null;
  }
  try {
    await target.handle.click();
    return target.selector;
  } finally {
    try {
      await target.handle.dispose();
    } catch {
      // ignore dispose errors
    }
  }
}

async function waitForPayPalContext(page, timeout = 45000) {
  const browser = page.browser();
  const start = Date.now();

  const match = (url) =>
    typeof url === "string" &&
    url.includes("paypal") &&
    (url.includes("checkout") || url.includes("hermes") || url.includes("consent") || url.includes("smart/checkout"));

  while (Date.now() - start < timeout) {
    const frame = page.frames().find((candidate) => match(candidate.url()));
    if (frame) {
      return { type: "frame", frame };
    }

    const targets = browser.targets();
    for (const target of targets) {
      if (target.type() !== "page") {
        continue;
      }
      const url = target.url();
      if (match(url)) {
        try {
          const popup = await target.page();
          return { type: "page", page: popup };
        } catch (error) {
          if (DEBUG) {
            console.warn("[DEBUG] PayPal-Popup konnte nicht gelesen werden:", error.message);
          }
        }
      }
    }
    await sleep(250);
  }

  throw new Error("PayPal-Checkout wurde nicht geladen.");
}

async function clickPayPalButton(page) {
  const iframeSelectorCandidates = [
    "div.paypal-buttons iframe.component-frame",
    "div.paypal-buttons iframe.prerender-frame",
    "div[class*='paypal-buttons'] iframe.component-frame",
    "div[class*='paypal-buttons'] iframe.prerender-frame",
    "iframe.component-frame",
    "iframe.prerender-frame",
    "iframe[id*='paypal']",
    "iframe[src*='paypal.com']",
    "iframe[src*='paypalobjects.com']"
  ];

  for (const selector of iframeSelectorCandidates) {
    const handle = await page.waitForSelector(selector, { timeout: 4000 }).catch(() => null);
    if (!handle) {
      continue;
    }
    try {
      const frame = await handle.contentFrame();
      if (!frame) {
        continue;
      }
      const clickResult = await frame.evaluate(() => {
        const candidates = [
          "button",
          "[role='button']",
          "[data-funding-source='paypal']",
          "[data-testid='funding-button']",
          ".paypal-button",
          ".paypal-button-label-container"
        ];
        for (const selector of candidates) {
          const element = document.querySelector(selector);
          if (element && typeof element === "object" && "click" in element) {
            (element).dispatchEvent(
              new MouseEvent("click", { bubbles: true, cancelable: true, composed: true })
            );
            return { success: true, selector };
          }
        }
        return { success: false };
      }).catch(() => ({ success: false, selector: null }));
      if (clickResult.success) {
        if (DEBUG) {
          console.log("[DEBUG] PayPal-Button per Iframe geklickt:", selector, "→", clickResult.selector);
        }
        return;
      }
      if (DEBUG) {
        console.warn("[DEBUG] Kein klickbarer Button im PayPal-Iframe:", selector);
      }
    } catch (error) {
      if (DEBUG) {
        console.warn("[DEBUG] Klick auf PayPal-Iframe fehlgeschlagen:", selector, error.message);
      }
    } finally {
      try {
        await handle.dispose();
      } catch {
        // ignore dispose errors
      }
    }
  }

  const fallbackSelectors = [
    "div[data-testid='paypal-button'] button",
    "div[data-testid='paypal-button']",
    "div[id*='paypal'] button",
    "div.paypal-buttons button",
    "button[data-funding-source='paypal']",
    "button[data-testid='paypal-funding-button']"
  ];

  for (const selector of fallbackSelectors) {
    const handle = await page.waitForSelector(selector, { timeout: 2000 }).catch(() => null);
    if (!handle) {
      continue;
    }
    try {
      await page.evaluate((element) => {
        element.click();
      }, handle);
      if (DEBUG) {
        console.log("[DEBUG] PayPal-Button per Fallback-Selector geklickt:", selector);
      }
      return;
    } catch (error) {
      if (DEBUG) {
        console.warn("[DEBUG] Klick auf PayPal-Fallback-Selector fehlgeschlagen:", selector, error.message);
      }
    } finally {
      try {
        await handle.dispose();
      } catch {
        // ignore dispose errors
      }
    }
  }

  throw new Error("PayPal-Button konnte nicht geladen werden.");
}

async function waitForCheckoutContextToClose(page, context) {
  if (context.type === "page" && context.page) {
    const start = Date.now();
    while (!context.page.isClosed() && Date.now() - start < 60000) {
      try {
        await context.page.waitForEvent("close", { timeout: 500 });
      } catch {
        // ignore timeout and retry
      }
    }
    if (!context.page.isClosed()) {
      throw new Error("PayPal-Popup hat sich nicht geschlossen.");
    }
    return;
  }

  if (context.type === "frame" && context.frame) {
    const start = Date.now();
    while (Date.now() - start < 60000) {
      const stillPresent = !context.frame.isDetached() && page.frames().includes(context.frame);
      if (!stillPresent) {
        return;
      }
      await sleep(500);
    }
    throw new Error("PayPal-Checkout-Overlay hat sich nicht geschlossen.");
  }
}

function collectContextFrames(context) {
  const frames = new Set();

  const addFrame = (frame) => {
    if (
      !frame ||
      frames.has(frame) ||
      (typeof frame.isDetached === "function" && frame.isDetached())
    ) {
      return;
    }
    frames.add(frame);
    const children = frame.childFrames();
    for (const child of children) {
      addFrame(child);
    }
  };

  if (context.page) {
    try {
      const page = context.page;
      addFrame(page.mainFrame());
      for (const frame of page.frames()) {
        addFrame(frame);
      }
    } catch {
      // ignore page frame collection errors
    }
  }

  if (context.frame) {
    addFrame(context.frame);
  }

  return Array.from(frames);
}

async function typeIntoSelectorInFrames(frames, selectors, value, options = {}) {
  for (const frame of frames) {
    const selector = await typeIntoSelector(frame, selectors, value, options);
    if (selector) {
      return { selector, frame };
    }
  }
  return null;
}

async function clickFirstAvailableInFrames(frames, selectors, options = {}) {
  for (const frame of frames) {
    const selector = await clickFirstAvailable(frame, selectors, options);
    if (selector) {
      return { selector, frame };
    }
  }
  return null;
}

async function waitForAnySelectorInFrames(frames, selectors, options = {}) {
  for (const frame of frames) {
    const result = await waitForAnySelector(frame, selectors, options);
    if (result) {
      return { ...result, frame };
    }
  }
  return null;
}

async function completePayPalCheckout(page, email, password) {
  const contextPromise = waitForPayPalContext(page);
  await clickPayPalButton(page);
  const context = await contextPromise;
  const surface = context.page ?? context.frame;
  if (!surface) {
    throw new Error("PayPal-Fenster konnte nicht geöffnet werden.");
  }

  if (DEBUG) {
    const contextUrl = context.page ? context.page.url() : context.frame?.url();
    console.log("[DEBUG] PayPal-Kontext erkannt:", context.type, "→", contextUrl);
    if (context.frame) {
      const childFrames = context.frame.childFrames().map((child) => ({
        url: child.url(),
        name: child.name()
      }));
      console.log("[DEBUG] PayPal-Kindframes:", childFrames);
    }
  }

  let candidateFrames = collectContextFrames(context);
  if (DEBUG) {
    console.log(
      "[DEBUG] Kandidaten-Frames für PayPal-Interaktion:",
      candidateFrames.map((frame) => ({ url: frame.url(), name: frame.name() }))
    );
  }

  const emailSelectors = [
    "input#email",
    "input[name='login_email']",
    "input#email-internal",
    "input[data-testid='email-input']"
  ];
  const nextSelectors = [
    "button#btnNext",
    "button[data-testid='login-continue-button']",
    "button#emailBtn",
    "button[name='btnNext']"
  ];
  const passwordSelectors = [
    "input#password",
    "input[name='login_password']",
    "input#password-internal",
    "input[data-testid='password-input']"
  ];
  const loginSelectors = [
    "button#btnLogin",
    "button#btnlogin",
    "button[data-testid='login-submit-button']",
    "button[name='btnLogin']"
  ];
  const stayLoggedInSelectors = [
    "button#confirmButtonTop",
    "button[data-testid='secondary-button']"
  ];
  const confirmSelectors = [
    "button#payment-submit-btn",
    "button[data-testid='submit-button-internal']",
    "button[data-testid='submit-button-initial']",
    "button#checkoutsubmit",
    "button[data-testid='continue-button']"
  ];

  await surface.waitForSelector("body", { timeout: 20000 }).catch(() => null);

  const typedEmailResult = await typeIntoSelectorInFrames(candidateFrames, emailSelectors, email);
  if (typedEmailResult && DEBUG) {
    console.log("[DEBUG] PayPal-E-Mail Feld genutzt:", typedEmailResult.selector);
  }
  if (typedEmailResult) {
    const nextFrames = [typedEmailResult.frame, ...candidateFrames.filter((frame) => frame !== typedEmailResult.frame)];
    const nextClicked = await clickFirstAvailableInFrames(nextFrames, nextSelectors, { timeout: 15000 });
    if (DEBUG) {
      console.log(
        "[DEBUG] PayPal-E-Mail Weiter-Button:",
        nextClicked ? nextClicked.selector : "nicht gefunden"
      );
    }
  }

  const typedPasswordResult = await typeIntoSelectorInFrames(candidateFrames, passwordSelectors, password, {
    timeout: 20000
  });
  if (typedPasswordResult && DEBUG) {
    console.log("[DEBUG] PayPal-Passwort Feld genutzt:", typedPasswordResult.selector);
  }
  if (typedPasswordResult) {
    const loginFrames = [typedPasswordResult.frame, ...candidateFrames.filter((frame) => frame !== typedPasswordResult.frame)];
    const loginClicked = await clickFirstAvailableInFrames(loginFrames, loginSelectors, { timeout: 20000 });
    if (DEBUG) {
      console.log(
        "[DEBUG] PayPal-Login Button:",
        loginClicked ? loginClicked.selector : "nicht gefunden"
      );
    }
    if (loginClicked) {
      try {
        if (context.page) {
          await context.page.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 60000 });
        } else if (typedPasswordResult.frame) {
          await typedPasswordResult.frame.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 60000 });
        }
      } catch {
        // navigation timeout is acceptable; continue
      }
    }
    candidateFrames = collectContextFrames(context);
    if (DEBUG) {
      console.log(
        "[DEBUG] Aktualisierte Kandidaten-Frames nach Login:",
        candidateFrames.map((frame) => ({ url: frame.url(), name: frame.name() }))
      );
    }
  }

  const stayLoggedInClicked = await clickFirstAvailableInFrames(candidateFrames, stayLoggedInSelectors, { timeout: 10000 });
  if (stayLoggedInClicked && DEBUG) {
    console.log("[DEBUG] PayPal-\"Eingeloggt bleiben\" Button:", stayLoggedInClicked.selector);
  }

  if (DEBUG) {
    for (const frame of candidateFrames) {
      try {
        const buttons = await frame.evaluate(() => {
          return Array.from(document.querySelectorAll("button, [role='button']")).map((element) => ({
            tag: element.tagName,
            id: element.id || null,
            dataTestId: element.getAttribute("data-testid"),
            text: element.textContent?.trim() || null
          }));
        });
        console.log("[DEBUG] Buttons im Frame:", frame.url(), buttons);
      } catch (error) {
        console.warn("[DEBUG] Buttons im Frame konnten nicht ermittelt werden:", frame.url(), error.message);
      }
    }
  }

  const confirmTarget = await waitForAnySelectorInFrames(candidateFrames, confirmSelectors, {
    timeout: PAYPAL_CONFIRM_TIMEOUT,
    visible: true
  });
  if (!confirmTarget) {
    throw new Error("PayPal-Bestätigungsbutton wurde nicht gefunden.");
  }
  try {
    if (DEBUG) {
      console.log("[DEBUG] PayPal-Bestätigungsbutton geklickt:", confirmTarget.selector);
    }
    await confirmTarget.handle.click();
  } finally {
    try {
      await confirmTarget.handle.dispose();
    } catch {
      // ignore dispose errors
    }
  }

  await waitForCheckoutContextToClose(page, context);
}

async function main() {
  const artifactsDir = path.resolve(__dirname, "../artifacts");
  if (!fs.existsSync(artifactsDir)) {
    fs.mkdirSync(artifactsDir, { recursive: true });
  }

  const { seminar, termin, selection } = await fetchSeminarSelection();
  if (DEBUG) {
    console.log(`Nutze Seminar "${seminar.name}" (Slug: ${seminar.slug}, Termin-ID: ${termin.id})`);
  }

  const browser = await puppeteer.launch({
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--window-size=1280,1024"]
  });
  const page = await browser.newPage();
  page.setDefaultTimeout(20000);
  page.setDefaultNavigationTimeout(45000);
  if (DEBUG) {
    page.on("console", (msg) => console.log("[Browser]", msg.type().toUpperCase(), msg.text()));
    page.on("requestfailed", (req) => {
      console.log("[Browser] REQUEST FAILED:", req.url(), req.failure()?.errorText);
    });
  }

  try {
    await page.goto(BASE_URL, { waitUntil: "domcontentloaded" });

    await page.evaluate((selectionPayload) => {
      window.localStorage.setItem("booking:lastSelection", JSON.stringify(selectionPayload));
      window.localStorage.setItem("cart:count", "1");
    }, selection);

    await page.goto(`${BASE_URL}/checkout`, { waitUntil: "domcontentloaded" });

    await page.waitForSelector("form");

    // Schritt 1: Teilnehmer
    await fillFieldByLabel(page, "Vorname *", "Test");
    await fillFieldByLabel(page, "Nachname *", "Teilnehmer");
    await fillFieldByLabel(page, "E-Mail", "test.teilnehmer@example.com");
    await fillFieldByLabel(page, "Besondere Bedürfnisse", "Keine");
    await clickButtonByText(page, "Weiter zur Rechnungsadresse");
    if (DEBUG) {
      const screenshotPath = path.join(
        artifactsDir,
        `checkout-step-billing-${Date.now()}.png`
      );
      await page.screenshot({ path: screenshotPath, fullPage: true });
      console.log("Screenshot (nach Teilnehmer-Submit):", screenshotPath);
    }
    await page.waitForFunction(() =>
      Array.from(document.querySelectorAll("label.form-control span")).some((span) =>
        span.textContent && span.textContent.includes("Straße und Hausnummer")
      )
    );
    if (DEBUG) {
      const labels = await page.evaluate(() =>
        Array.from(document.querySelectorAll("label.form-control")).map((label) =>
          label.innerText.replace(/\s+/g, " ").trim()
        )
      );
      console.log("Gefundene Formular-Labels (Rechnungsadresse):", labels);
    }

    // Schritt 2: Rechnungsadresse (Privat)
    await fillFieldByLabel(page, "Straße und Hausnummer *", "Testweg 1");
    await fillFieldByLabel(page, "Postleitzahl *", "12345");
    await fillFieldByLabel(page, "Stadt *", "Teststadt");
    await fillFieldByLabel(page, "Land *", "Deutschland");
    await fillFieldByLabel(page, "Vorname *", "Test");
    await fillFieldByLabel(page, "Nachname *", "Besteller");
    await fillFieldByLabel(page, "E-Mail *", "test.besteller@example.com");
    await fillFieldByLabel(page, "Telefon *", "+49 123 456789");
    await clickButtonByText(page, "Weiter zur Bestellübersicht");
    await page.waitForFunction(() => document.body.innerText.includes("Bestellübersicht"));

    // Schritt 3: Bestellübersicht
    await page.waitForFunction(() =>
      Array.from(document.querySelectorAll("label.label span")).some((span) =>
        span.textContent ? span.textContent.includes("Allgemeinen Geschäftsbedingungen") : false
      )
    );
    await setCheckboxByLabel(page, "Ich akzeptiere die Allgemeinen Geschäftsbedingungen");
    await setCheckboxByLabel(page, "Ich bestätige, die Datenschutzhinweise gelesen zu haben");
    await clickButtonByText(page, "Weiter zur Zahlung");
    await page.waitForFunction(() => document.body.innerText.includes("Zahlung"));

    // Schritt 4: Zahlung
    await selectPaymentOption(page, "PayPal");
    if (DEBUG) {
      const screenshotPath = path.join(
        artifactsDir,
        `checkout-step-payment-${Date.now()}.png`
      );
      await page.screenshot({ path: screenshotPath, fullPage: true });
      console.log("Screenshot (Zahlungsschritt nach Auswahl PayPal):", screenshotPath);
    }
    await page.waitForFunction(
      () => typeof window !== "undefined" && !!window.paypal && typeof window.paypal.Buttons === "function",
      { timeout: 20000 }
    ).catch(() => null);
    const payPalButtonHandle = await page
      .waitForFunction(() => {
        const selectors = [
          "div.paypal-buttons iframe",
          "div[class*='paypal-buttons'] iframe",
          "div[data-testid='paypal-button']",
          "div[id*='paypal'] iframe",
          "div[id*='paypal'] button",
          "iframe[src*='paypal']"
        ];
        return selectors.some((selector) => document.querySelector(selector));
      }, { timeout: 20000 })
      .catch(() => null);

    if (!payPalButtonHandle) {
      const warningVisible = await page.evaluate(() => {
        return Array.from(document.querySelectorAll("div")).some((el) =>
          el.textContent?.includes("PayPal-Zahlungen stehen aktuell nicht zur Verfügung")
        );
      });
      if (warningVisible) {
        throw new Error("PayPal-Hinweis angezeigt: Client-ID fehlt auf der Zielumgebung.");
      }
      throw new Error("PayPal-Button nicht gefunden.");
    }

    if (DEBUG) {
      const frames = page.frames();
      const frameDetails = await Promise.all(
        frames.map(async (frame) => {
          let snippet = null;
          try {
            const html = await frame.content();
            snippet = html.slice(0, 120);
          } catch {
            snippet = null;
          }
          return {
            url: frame.url(),
            name: frame.name(),
            parent: frame.parentFrame()?.url() ?? null,
            snippet
          };
        })
      );
      console.log("[DEBUG] Aktive Frames:", frameDetails);
      const frameButtonStats = await Promise.all(
        frames.map(async (frame) => {
          try {
            return {
              name: frame.name(),
              url: frame.url(),
              buttons: await frame.evaluate(() => {
                const selectors = ["button", "[role='button']", "[data-funding-source]"];
                return selectors.map((selector) => ({
                  selector,
                  count: document.querySelectorAll(selector).length
                }));
              })
            };
          } catch {
            return {
              name: frame.name(),
              url: frame.url(),
              buttons: null
            };
          }
        })
      );
      console.log("[DEBUG] Button-Zähler pro Frame:", frameButtonStats);
      const buttonDebug = await page.evaluate(() => {
        const selectors = [
          "div.paypal-buttons iframe",
          "div[class*='paypal-buttons'] iframe",
          "div[data-testid='paypal-button'] button",
          "div[data-testid='paypal-button']",
          "div[id*='paypal'] iframe",
          "div[id*='paypal'] button",
          "button[data-funding-source='paypal']",
          "button[data-testid='paypal-funding-button']",
          "iframe[src*='paypal']"
        ];
        const candidates = selectors.map((selector) => {
          const element = document.querySelector(selector);
          if (!element) {
            return { selector, present: false };
          }
          return {
            selector,
            present: true,
            tagName: element.tagName,
            id: element.id ?? null,
            className: element.className ?? null,
            text: element.textContent?.trim() ?? null
          };
        });
        const iframes = Array.from(document.querySelectorAll("iframe")).map((iframe) => ({
          src: iframe.src,
          id: iframe.id,
          className: iframe.className
        }));
        return { candidates, iframes };
      });
      console.log("[DEBUG] PayPal Button-Kandidaten:", buttonDebug.candidates);
      console.log("[DEBUG] Gefundene Iframes:", buttonDebug.iframes);
    }

    if (PAYPAL_EMAIL && PAYPAL_PASSWORD) {
      console.log("ℹ️ PayPal-Sandbox-Bezahlung wird gestartet...");
      await completePayPalCheckout(page, PAYPAL_EMAIL, PAYPAL_PASSWORD);
      await page.waitForFunction(
        () =>
          document.body.innerText.includes("Vielen Dank für deine Bestellung!") ||
          window.location.search.includes("order="),
        { timeout: 90000 }
      );
      if (DEBUG) {
        const screenshotPath = path.join(
          artifactsDir,
          `checkout-success-${Date.now()}.png`
        );
        await page.screenshot({ path: screenshotPath, fullPage: true });
        console.log("Screenshot (Bestätigung):", screenshotPath);
      }
      console.log("✅ PayPal-Zahlung erfolgreich abgeschlossen und Bestätigung angezeigt.");
    } else {
      console.log("✅ Checkout-Test erfolgreich: PayPal-Abschnitt sichtbar (Sandbox-Login übersprungen).");
    }
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error("❌ Checkout-Test fehlgeschlagen:", error.message);
  if (DEBUG) {
    console.error(error);
  }
  process.exitCode = 1;
});
