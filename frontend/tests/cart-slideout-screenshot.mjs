import puppeteer from "puppeteer";

const TARGET_URL = process.env.CART_SCREENSHOT_URL ?? "http://localhost:3000";
const OUTPUT_PATH = process.env.CART_SCREENSHOT_PATH ?? "artifacts/local-cart_slideout.png";

async function openCartAndCapture() {
  const browser = await puppeteer.launch({
    headless: "new",
    defaultViewport: { width: 1440, height: 1024 },
  });

  try {
    const page = await browser.newPage();
    await page.goto(TARGET_URL, { waitUntil: "networkidle0", timeout: 60000 });

    await page.waitForSelector('button[aria-label^="Warenkorb öffnen"]', { timeout: 15000 });
    await page.click('button[aria-label^="Warenkorb öffnen"]');

    await page.waitForFunction(
      () => {
        const aside = document.querySelector("aside");
        if (!aside) {
          return false;
        }
        const { width, height } = aside.getBoundingClientRect();
        return width > 0 && height > 0;
      },
      { timeout: 15000 },
    );

    const aside = await page.$("aside");
    if (!aside) {
      throw new Error("Cart slideout <aside> not found after opening the cart.");
    }

    const boundingBox = await aside.boundingBox();
    if (!boundingBox) {
      throw new Error("Could not determine bounding box for cart slideout.");
    }

    await page.screenshot({
      path: OUTPUT_PATH,
      clip: boundingBox,
    });
  } finally {
    await browser.close();
  }
}

openCartAndCapture().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
