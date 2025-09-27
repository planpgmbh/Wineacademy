#!/usr/bin/env node
const fs = require('fs/promises');
const path = require('path');
const puppeteer = require('puppeteer');

const BASE_URL = 'https://wineacademy.plan-p.de';
const SEMINAR_SLUG = 'masterclass-sake';
const RESULTS_DIR = path.join(process.cwd(), 'artifacts');

const PAYPAL_EMAIL = process.env.PAYPAL_EMAIL || process.env.PAYPAL_SANDBOX_EMAIL;
const PAYPAL_PASSWORD = process.env.PAYPAL_PASSWORD || process.env.PAYPAL_SANDBOX_PASSWORD;

async function createContext(browser) {
  if (typeof browser.createBrowserContext === 'function') {
    const context = await browser.createBrowserContext();
    return { context, async close() { await context.close(); } };
  }
  if (typeof browser.createIncognitoBrowserContext === 'function') {
    const context = await browser.createIncognitoBrowserContext();
    return { context, async close() { await context.close(); } };
  }
  const context = browser.defaultBrowserContext();
  return { context, async close() {} };
}

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

async function saveScreenshot(page, name) {
  await ensureDir(RESULTS_DIR);
  const file = path.join(RESULTS_DIR, `${Date.now()}-${name}`);
  await page.screenshot({ path: file, fullPage: true });
  return file;
}

async function waitForButton(page, text, { enabledOnly = false } = {}) {
  await page.waitForFunction((buttonText, enabled) => {
    const buttons = Array.from(document.querySelectorAll('button'));
    return buttons.some((btn) => {
      const label = btn.textContent ? btn.textContent.trim().toLowerCase() : '';
      if (!label.includes(buttonText.toLowerCase())) return false;
      if (enabled && (btn.disabled || btn.getAttribute('aria-disabled') === 'true')) return false;
      const rect = btn.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    });
  }, {}, text, enabledOnly);
}

async function clickButtonByText(page, text) {
  const clicked = await page.evaluate((buttonText) => {
    const buttons = Array.from(document.querySelectorAll('button'));
    const target = buttons.find((btn) => {
      const label = btn.textContent ? btn.textContent.trim().toLowerCase() : '';
      return label.includes(buttonText.toLowerCase());
    });
    if (!target) return false;
    target.click();
    return true;
  }, text);
  if (!clicked) {
    throw new Error(`Button '${text}' nicht gefunden`);
  }
}

async function fillSectionInputs(page, sectionTitle, fields) {
  await page.evaluate(({ sectionTitle, fields }) => {
    const sections = Array.from(document.querySelectorAll('section'));
    const section = sections.find(sec => {
      const heading = sec.querySelector('h2, h3');
      const text = heading ? heading.textContent || '' : sec.textContent || '';
      return text.toLowerCase().includes(sectionTitle.toLowerCase());
    });
    if (!section) {
      throw new Error(`Section '${sectionTitle}' nicht gefunden`);
    }
    const setValue = (labelText, value) => {
      if (value === undefined || value === null) return;
      const label = Array.from(section.querySelectorAll('label')).find((lab) => {
        const t = lab.textContent ? lab.textContent.replace(/\*/g, '').trim().toLowerCase() : '';
        return t.startsWith(labelText.toLowerCase());
      });
      if (!label) {
        if (value === '' || value === undefined || value === null) return;
        throw new Error(`Label '${labelText}' nicht gefunden`);
      }
      const input = label.querySelector('input, textarea');
      if (!input) throw new Error(`Eingabefeld '${labelText}' nicht gefunden`);
      input.focus();
      const proto = input instanceof HTMLTextAreaElement
        ? HTMLTextAreaElement.prototype
        : HTMLInputElement.prototype;
      const valueSetter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
      if (!valueSetter) throw new Error('Konnte Value-Setter nicht finden');
      valueSetter.call(input, value);
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
    };
    fields.forEach(({ label, value }) => setValue(label, value));
  }, { sectionTitle, fields });
}

async function toggleCheckbox(page, labelText, shouldCheck = true) {
  await page.evaluate(({ labelText, shouldCheck }) => {
    const label = Array.from(document.querySelectorAll('label')).find((lab) => {
      const text = lab.textContent ? lab.textContent.trim() : '';
      return text.includes(labelText);
    });
    if (!label) throw new Error(`Checkbox '${labelText}' nicht gefunden`);
    const input = label.querySelector('input[type="checkbox"]');
    if (!input) throw new Error(`Checkbox-Input '${labelText}' nicht gefunden`);
    if (input.checked !== shouldCheck) {
      input.click();
    }
  }, { labelText, shouldCheck });
}

async function selectPaymentMethod(page, labelText) {
  await page.evaluate(({ labelText }) => {
    const label = Array.from(document.querySelectorAll('label')).find((lab) => {
      const text = lab.textContent ? lab.textContent.trim() : '';
      return text.includes(labelText);
    });
    if (!label) throw new Error(`Zahlungsoption '${labelText}' nicht gefunden`);
    const input = label.querySelector('input[type="radio"]');
    if (!input) throw new Error(`Radio-Input '${labelText}' nicht gefunden`);
    if (input.disabled) throw new Error(`Zahlungsoption '${labelText}' ist deaktiviert.`);
    if (!input.checked) input.click();
  }, { labelText });
}

async function addSeminarToCartAndOpenCheckout(page) {
  await page.goto(`${BASE_URL}/seminare/${SEMINAR_SLUG}`, { waitUntil: 'networkidle0' });
  console.log(`[add-to-cart] Seite geladen: ${SEMINAR_SLUG}`);
  await waitForButton(page, 'In den Warenkorb', { enabledOnly: true });
  console.log('[add-to-cart] Button gefunden, klicke ...');
  await clickButtonByText(page, 'In den Warenkorb');

  await page.waitForFunction(() => {
    const buttons = Array.from(document.querySelectorAll('button'));
    return buttons.some((btn) => btn.textContent && btn.textContent.includes('Weiter zur Kasse') && !btn.disabled);
  }, { timeout: 20000 });

  console.log('[add-to-cart] Weiter zur Kasse aktiv');
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'networkidle0' }),
    clickButtonByText(page, 'Weiter zur Kasse'),
  ]);
  console.log('[add-to-cart] Checkout geöffnet');

  await page.evaluate((apiBase) => {
    if (window.__patchedFetch) return;
    const originalFetch = window.fetch.bind(window);
    window.fetch = (input, init) => {
      let url = typeof input === 'string' ? input : input.url;
      if (url && url.startsWith('http://localhost:1337')) {
        const newUrl = url.replace('http://localhost:1337', apiBase);
        if (typeof input === 'string') {
          return originalFetch(newUrl, init);
        }
        const request = new Request(newUrl, input);
        return originalFetch(request, init);
      }
      return originalFetch(input, init);
    };
    window.__patchedFetch = true;
  }, `${BASE_URL}`);
}

async function fillCheckoutForms(page, participant, billing) {
  const participantReady = await page.waitForFunction(() => {
    const sections = Array.from(document.querySelectorAll('section'));
    return sections.some((sec) => {
      const text = sec.textContent || '';
      return text.includes('Teilnehmerdaten');
    });
  }, { timeout: 15000 }).catch(() => null);

  if (!participantReady) {
    throw new Error('Teilnehmerdaten-Sektion nicht gefunden (Warenkorb enthält ggf. kein Seminar).');
  }

  console.log('[checkout] Teilnehmerdaten verfügbar');

  await fillSectionInputs(page, 'Teilnehmer', [
    { label: 'Vorname', value: participant.firstName },
    { label: 'Nachname', value: participant.lastName },
    { label: 'E-Mail', value: participant.email },
  ]);

  await fillSectionInputs(page, 'Rechnungsadresse', [
    { label: 'Vorname', value: billing.firstName },
    { label: 'Nachname', value: billing.lastName },
    { label: 'Straße', value: billing.street },
    { label: 'PLZ', value: billing.zip },
    { label: 'Stadt', value: billing.city },
    { label: 'Land', value: billing.country },
    { label: 'E-Mail', value: billing.email },
    { label: 'Telefon', value: billing.phone },
    { label: 'Firmenname', value: billing.company },
    { label: 'Rechnungs-E-Mail', value: billing.invoiceEmail },
    { label: 'UstId', value: billing.vatId },
  ]);

  await toggleCheckbox(page, 'Ich akzeptiere die AGB.', true);
  await toggleCheckbox(page, 'Ich habe die Datenschutzhinweise gelesen.', true);

  const debugSnapshot = await page.evaluate(() => {
    const collect = (sectionTitle) => {
      const sections = Array.from(document.querySelectorAll('section'));
      const section = sections.find((sec) => {
        const heading = sec.querySelector('h2, h3');
        const text = heading ? heading.textContent || '' : sec.textContent || '';
        return text.includes(sectionTitle);
      });
      if (!section) return {};
      const entries = {};
      ['Vorname', 'Nachname', 'E-Mail', 'Straße', 'PLZ', 'Stadt', 'Land'].forEach((labelText) => {
        const label = Array.from(section.querySelectorAll('label')).find((lab) => {
          const text = lab.textContent ? lab.textContent.replace(/\*/g, '').trim() : '';
          return text.startsWith(labelText);
        });
        if (label) {
          const input = label.querySelector('input');
          if (input) entries[labelText] = input.value;
        }
      });
      return entries;
    };
    return {
      teilnehmer: collect('Teilnehmerdaten'),
      rechnung: collect('Rechnungsadresse'),
    };
  });
  console.log('[checkout] Debug Formularwerte', debugSnapshot);
}

async function runInvoiceScenario(browser) {
  console.log('[invoice] Starte Szenario');
  const { context, close } = await createContext(browser);
  const page = await context.newPage();
  page.setDefaultTimeout(60000);
  await page.setRequestInterception(true);
  page.on('request', (req) => {
    if (req.url().includes('/api/public/bestellungen')) {
      console.log(`[invoice] Request ${req.method()} ${req.url()}`);
      if (req.method() === 'POST') {
        console.log('[invoice] Payload', req.postData());
      }
    }
    if (req.url().startsWith('http://localhost:1337/')) {
      const redirectedUrl = req.url().replace('http://localhost:1337', BASE_URL);
      req.continue({ url: redirectedUrl });
      return;
    }
    req.continue();
  });
  page.on('response', (res) => {
    if (res.url().includes('/api/public/bestellungen')) {
      console.log(`[invoice] Response ${res.status()} ${res.url()}`);
    }
  });
  const result = { scenario: 'invoice', success: false };

  try {
    console.log('[invoice] öffne Checkout');
    await addSeminarToCartAndOpenCheckout(page);

    console.log('[invoice] fülle Formulare');
    await fillCheckoutForms(page, {
      firstName: 'Test',
      lastName: 'Kundin',
      email: 'test-kundin@example.com',
    }, {
      firstName: 'Rechnung',
      lastName: 'Empfaenger',
      email: 'rechnung@example.com',
      street: 'Musterstraße 1',
      zip: '20095',
      city: 'Hamburg',
      country: 'Deutschland',
      phone: '+4940123456',
      company: undefined,
      vatId: undefined,
      invoiceEmail: undefined,
    });

    // Rechnung ist default, aber sicherheitshalber auswählen
    await selectPaymentMethod(page, 'Auf Rechnung');

    console.log('[invoice] sende Bestellung');
    const orderResponsePromise = page
      .waitForResponse((res) => {
        return res.url().includes('/api/public/bestellungen') && res.request().method() === 'POST';
      }, { timeout: 60000 })
      .catch(() => null);
    const validationPromise = page
      .waitForFunction(() => {
        const node = document.querySelector('div.border-red-300');
        return node ? node.textContent || '' : undefined;
      }, { timeout: 60000 })
      .then((handle) => handle ? handle.jsonValue() : null)
      .catch(() => null);

    await clickButtonByText(page, 'Bestellung abschließen');

    const winner = await Promise.race([
      orderResponsePromise.then((res) => ({ kind: 'response', value: res })),
      validationPromise.then((msg) => ({ kind: 'validation', value: msg })),
    ]);

    if (winner.kind === 'validation' && winner.value) {
      throw new Error(`Validierung fehlgeschlagen: ${winner.value}`);
    }

    const orderResponse = winner.kind === 'response' ? winner.value : null;
    if (!orderResponse) {
      throw new Error('Keine Antwort von /bestellungen erhalten');
    }
    const status = orderResponse.status();
    const responseBody = await orderResponse.text();
    if (status >= 400) {
      throw new Error(`Bestellung fehlgeschlagen (HTTP ${status}): ${responseBody}`);
    }

    console.log('[invoice] warte auf Bestätigungsseite');
    await page.waitForSelector('h1', { visible: true });
    const confirmationText = await page.evaluate(() => {
      const heading = document.querySelector('h1');
      const paragraph = document.querySelector('p');
      return {
        heading: heading ? heading.textContent : null,
        paragraph: paragraph ? paragraph.textContent : null,
      };
    });

    result.success = confirmationText.heading?.includes('Vielen Dank!') || false;
    result.details = confirmationText;
    result.screenshot = await saveScreenshot(page, 'invoice-success.png');
  } catch (err) {
    result.error = err instanceof Error ? err.message : String(err);
    result.screenshot = await saveScreenshot(page, 'invoice-error.png');
    throw err;
  } finally {
    await close();
  }
  return result;
}

async function clickPayPalButton(browser, page) {
  await page.waitForSelector('iframe[src*="paypal.com"]', { visible: true, timeout: 120000 });
  const frameHandles = await page.$$('iframe[src*="paypal.com"]');
  const frameHandle = frameHandles.at(-1);
  if (!frameHandle) throw new Error('PayPal-Button iframe nicht gefunden');
  const frame = await frameHandle.contentFrame();
  if (!frame) throw new Error('PayPal-Frame konnte nicht gelesen werden');

  await frame.waitForSelector('div[data-funding-source], button', { visible: true, timeout: 120000 });

  const targetPromise = browser.waitForTarget((target) => target.type() === 'page' && target.url().includes('paypal.com'), { timeout: 60000 });

  const clicked = await frame.evaluate(() => {
    const fundingButtons = Array.from(document.querySelectorAll('div[data-funding-source] button'));
    const button = fundingButtons.find((btn) => btn.closest('div[data-funding-source]')?.getAttribute('data-funding-source') === 'paypal')
      || fundingButtons.find((btn) => btn.closest('div[data-funding-source]'))
      || document.querySelector('button');
    if (!button) return false;
    button.click();
    return true;
  });
  if (!clicked) throw new Error('PayPal-Button konnte nicht geklickt werden');

  const target = await targetPromise;
  const popup = await target.page();
  if (!popup) throw new Error('PayPal-Popup konnte nicht ermittelt werden');
  await popup.bringToFront();
  popup.setDefaultTimeout(60000);
  return popup;
}

async function authenticatePayPal(popup) {
  const emailSelector = 'input#email, input[name="login_email"]';
  await popup.waitForSelector(emailSelector, { visible: true, timeout: 60000 });
  const emailInput = await popup.$(emailSelector);
  if (!emailInput) throw new Error('PayPal-E-Mail-Feld nicht gefunden');
  await emailInput.click({ clickCount: 3 });
  await emailInput.type(PAYPAL_EMAIL, { delay: 30 });

  const nextButton = await popup.$('#btnNext');
  if (nextButton) {
    await Promise.all([
      popup.waitForSelector('input#password, input[name="login_password"]', { visible: true }),
      nextButton.click(),
    ]);
  }

  const passwordSelector = 'input#password, input[name="login_password"]';
  await popup.waitForSelector(passwordSelector, { visible: true, timeout: 60000 });
  const passwordInput = await popup.$(passwordSelector);
  if (!passwordInput) throw new Error('PayPal-Passwortfeld nicht gefunden');
  await passwordInput.click({ clickCount: 3 });
  await passwordInput.type(PAYPAL_PASSWORD, { delay: 30 });

  const loginButton = await popup.$('#btnLogin, button#btnLogin');
  if (!loginButton) throw new Error('PayPal-Login-Button nicht gefunden');

  await Promise.all([
    popup.waitForNavigation({ waitUntil: 'networkidle0' }),
    loginButton.click(),
  ]);
}

async function confirmPayPalPayment(popup) {
  const submitSelector = '#payment-submit-btn, button[data-testid="submit-button"]';
  await popup.waitForSelector(submitSelector, { visible: true, timeout: 60000 });
  const submitButton = await popup.$(submitSelector);
  if (!submitButton) throw new Error('PayPal-Bestätigungsbutton nicht gefunden');

  await Promise.all([
    popup.waitForNavigation({ waitUntil: 'networkidle0' }).catch(() => null),
    submitButton.click(),
  ]);

  // Warten, bis Fenster schließt (PayPal schließt automatisch nach Rückgabe)
  await popup.waitForClose({ timeout: 60000 }).catch(() => null);
}

async function runPayPalScenario(browser) {
  if (!PAYPAL_EMAIL || !PAYPAL_PASSWORD) {
    throw new Error('PayPal-Zugangsdaten fehlen (PAYPAL_EMAIL/PAYPAL_PASSWORD)');
  }

  console.log('[paypal] Starte Szenario');
  const { context, close } = await createContext(browser);
  const page = await context.newPage();
  page.setDefaultTimeout(60000);
  await page.setRequestInterception(true);
  page.on('request', (req) => {
    if (req.url().includes('/api/public/bestellungen')) {
      console.log(`[paypal] Request ${req.method()} ${req.url()}`);
      if (req.method() === 'POST') {
        console.log('[paypal] Payload', req.postData());
      }
    }
    if (req.url().startsWith('http://localhost:1337/')) {
      const redirectedUrl = req.url().replace('http://localhost:1337', BASE_URL);
      req.continue({ url: redirectedUrl });
      return;
    }
    req.continue();
  });
  page.on('response', (res) => {
    if (res.url().includes('/api/public/bestellungen')) {
      console.log(`[paypal] Response ${res.status()} ${res.url()}`);
    }
  });
  const result = { scenario: 'paypal', success: false };

  try {
    console.log('[paypal] öffne Checkout');
    await addSeminarToCartAndOpenCheckout(page);

    console.log('[paypal] fülle Formulare');
    await fillCheckoutForms(page, {
      firstName: 'Pay',
      lastName: 'PalTest',
      email: 'paytest@example.com',
    }, {
      firstName: 'Pay',
      lastName: 'Pal Rechnung',
      email: 'pay-test@example.com',
      street: 'Sandboxallee 2',
      zip: '20354',
      city: 'Hamburg',
      country: 'Deutschland',
      phone: '+4940234567',
      company: undefined,
      vatId: undefined,
      invoiceEmail: undefined,
    });

    await selectPaymentMethod(page, 'PayPal');

    console.log('[paypal] warte auf PayPal-SDK');
    await page.waitForFunction(
      () => document.querySelectorAll('iframe[src*="paypal.com"]').length > 0,
      { timeout: 120000 }
    );

    console.log('[paypal] klicke PayPal-Button');
    const paypalPopup = await clickPayPalButton(browser, page);

    console.log('[paypal] PayPal-Login');
    await authenticatePayPal(paypalPopup);
    console.log('[paypal] PayPal-Bestätigung');
    await confirmPayPalPayment(paypalPopup);

    // Erfolg auf Checkout-Seite abwarten
    console.log('[paypal] warte auf Bestätigungsseite');
    await page.waitForSelector('h1', { visible: true, timeout: 60000 });
    const confirmationText = await page.evaluate(() => {
      const heading = document.querySelector('h1');
      const paragraph = document.querySelector('p');
      return {
        heading: heading ? heading.textContent : null,
        paragraph: paragraph ? paragraph.textContent : null,
      };
    });
    result.success = confirmationText.heading?.includes('Vielen Dank!') || false;
    result.details = confirmationText;
    result.screenshot = await saveScreenshot(page, 'paypal-success.png');
  } catch (err) {
    result.error = err instanceof Error ? err.message : String(err);
    result.screenshot = await saveScreenshot(page, 'paypal-error.png');
    throw err;
  } finally {
    await close();
  }
  return result;
}

async function main() {
  await ensureDir(RESULTS_DIR);
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const summary = [];
  try {
    summary.push(await runInvoiceScenario(browser));
  } catch (err) {
    summary.push({ scenario: 'invoice', success: false, error: err instanceof Error ? err.message : String(err) });
  }

  try {
    summary.push(await runPayPalScenario(browser));
  } catch (err) {
    summary.push({ scenario: 'paypal', success: false, error: err instanceof Error ? err.message : String(err) });
  }

  await browser.close();

  const reportPath = path.join(RESULTS_DIR, `checkout-report-${Date.now()}.json`);
  await fs.writeFile(reportPath, JSON.stringify(summary, null, 2), 'utf8');
  console.log(`Test-Report gespeichert unter: ${reportPath}`);
  console.log(JSON.stringify(summary, null, 2));
}

main().catch(async (err) => {
  console.error('Puppeteer-Tests fehlgeschlagen:', err);
  process.exitCode = 1;
});
