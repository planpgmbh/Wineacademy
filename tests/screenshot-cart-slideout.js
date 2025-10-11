#!/usr/bin/env node
const path = require("path");
const fs = require("fs/promises");
const puppeteer = require(require.resolve("puppeteer", { paths: [path.join(__dirname, "..", "frontend", "node_modules")] }));

const BASE_URL = process.env.CART_SCREENSHOT_BASE_URL || "https://wineacademy.plan-p.de";
const OUTPUT_PATH =
  process.env.CART_SCREENSHOT_OUTPUT ||
  path.join(process.cwd(), "artifacts", "frontend-cart-slideout.png");

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function ensureDirectory(filePath) {
  const dir = path.dirname(filePath);
  await fs.mkdir(dir, { recursive: true });
}

async function openCartSlideout(page) {
  await page.goto(BASE_URL, { waitUntil: "networkidle0" });

  await page.waitForSelector('button[aria-label^="Warenkorb öffnen"]', { timeout: 15000 });

  await page.evaluate(() => {
    const sampleItems = [
      {
        id: "sample-seminar-1",
        title: "WSET® Level 1 Weine Tasting Set Klein (2cl)",
        description: "",
        price: 98.9,
        quantity: 1,
        imageUrl:
          "https://images.unsplash.com/photo-1524592094714-0f0654e20314?auto=format&fit=crop&w=180&q=80",
        type: "seminar",
        seminarDays: ["Samstag, 18. August 2025", "Freitag, 17. August 2025", "Donnerstag, 16. August 2025"],
      },
      {
        id: "sample-seminar-2",
        title: "WSET® Level 1 Weine Tasting Set Klein (2cl)",
        description: "",
        price: 98.9,
        quantity: 1,
        imageUrl:
          "https://images.unsplash.com/photo-1524592094714-0f0654e20314?auto=format&fit=crop&w=180&q=80",
        type: "seminar",
        seminarDays: ["Donnerstag, 16. August 2025"],
      },
      {
        id: "sample-product-1",
        title: "Produktname",
        description: "",
        price: 98.9,
        quantity: 1,
        imageUrl:
          "https://images.unsplash.com/photo-1524592094714-0f0654e20314?auto=format&fit=crop&w=180&q=80",
        type: "product",
      },
    ];
    try {
      window.localStorage.setItem("wineacademy-cart", JSON.stringify({ items: sampleItems }));
    } catch {
      // ignore storage issues
    }
    window.dispatchEvent(
      new CustomEvent("wineacademy:cart:update", {
        detail: { items: sampleItems, source: "screenshot-script" },
      }),
    );
  });

  await delay(500);

  await page.evaluate(() => {
    const button = document.querySelector('button[aria-label^="Warenkorb öffnen"]');
    if (button instanceof HTMLElement) {
      button.click();
    }
  });

  await page.waitForFunction(() => {
    const asides = Array.from(document.querySelectorAll("aside"));
    return asides.some((aside) => aside.textContent?.includes("Warenkorb"));
  }, { timeout: 15000 });

  await delay(800);
}

async function captureSlideout(page) {
  const handle = await page.evaluateHandle(() => {
    const asides = Array.from(document.querySelectorAll("aside"));
    return asides.find((aside) => aside.textContent?.includes("Warenkorb")) ?? null;
  });
  const slideout = handle.asElement();
  if (!slideout) {
    throw new Error("Slideout konnte nicht gefunden werden.");
  }

  const box = await slideout.boundingBox();
  if (!box) {
    throw new Error("Bounding Box des Slideouts konnte nicht ermittelt werden.");
  }

  await ensureDirectory(OUTPUT_PATH);

  await page.screenshot({
    path: OUTPUT_PATH,
    clip: {
      x: Math.max(box.x - 8, 0),
      y: Math.max(box.y - 8, 0),
      width: box.width + 16,
      height: box.height + 16,
    },
  });

  await handle.dispose();

  return OUTPUT_PATH;
}

async function main() {
  const browser = await puppeteer.launch({ headless: "new", defaultViewport: { width: 1440, height: 900 } });
  const page = await browser.newPage();
  try {
    await openCartSlideout(page);
    const screenshotPath = await captureSlideout(page);
    console.log(`Screenshot gespeichert: ${screenshotPath}`);
  } catch (error) {
    console.error("Screenshot fehlgeschlagen:", error);
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
}

main();
