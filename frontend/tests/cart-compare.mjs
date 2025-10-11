import { readFile } from "node:fs/promises";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import puppeteer from "puppeteer";

const FIGMA_PATH = process.env.CART_FIGMA_PATH ?? "../artifacts/figma-cart_slideout_new.png";
const LOCAL_PATH = process.env.CART_LOCAL_PATH ?? "../artifacts/local-cart_slideout.png";
const DIFF_OUTPUT = process.env.CART_DIFF_PATH ?? "../artifacts/cart_diff.png";
const OVERLAY_OUTPUT = process.env.CART_OVERLAY_PATH ?? "../artifacts/cart_overlay.png";

async function createComparisons() {
  const [figmaBuffer, localBuffer] = await Promise.all([
    readFile(path.resolve(FIGMA_PATH)),
    readFile(path.resolve(LOCAL_PATH)),
  ]);

  const figmaDataUrl = `data:image/png;base64,${figmaBuffer.toString("base64")}`;
  const localDataUrl = `data:image/png;base64,${localBuffer.toString("base64")}`;

  const browser = await puppeteer.launch({
    headless: "new",
  });

  try {
    const page = await browser.newPage();
    const results = await page.evaluate(
      async ({ figmaSrc, localSrc }) => {
        const loadImage = (src) =>
          new Promise((resolve, reject) => {
            const image = new Image();
            image.onload = () => resolve(image);
            image.onerror = (event) => reject(new Error(`Failed to load image: ${src} (${event?.message ?? "unknown"})`));
            image.src = src;
          });

        const [figmaImage, localImage] = await Promise.all([loadImage(figmaSrc), loadImage(localSrc)]);
        const width = Math.max(figmaImage.width, localImage.width);
        const height = Math.max(figmaImage.height, localImage.height);

        const createCanvas = () => {
          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;
          return canvas;
        };

        const overlayCanvas = createCanvas();
        const overlayCtx = overlayCanvas.getContext("2d");
        overlayCtx.fillStyle = "#ffffff";
        overlayCtx.fillRect(0, 0, width, height);
        overlayCtx.globalAlpha = 0.6;
        overlayCtx.drawImage(figmaImage, 0, 0);
        overlayCtx.globalAlpha = 0.6;
        overlayCtx.drawImage(localImage, 0, 0);

        const diffCanvas = createCanvas();
        const diffCtx = diffCanvas.getContext("2d");
        diffCtx.fillStyle = "#000000";
        diffCtx.fillRect(0, 0, width, height);
        diffCtx.globalCompositeOperation = "difference";
        diffCtx.drawImage(figmaImage, 0, 0);
        diffCtx.drawImage(localImage, 0, 0);

        return {
          width,
          height,
          overlayDataUrl: overlayCanvas.toDataURL("image/png"),
          diffDataUrl: diffCanvas.toDataURL("image/png"),
        };
      },
      { figmaSrc: figmaDataUrl, localSrc: localDataUrl },
    );

    const decodeDataUrl = (dataUrl) => {
      const [, base64] = dataUrl.split(",");
      return Buffer.from(base64, "base64");
    };

    await Promise.all([
      writeFile(path.resolve(OVERLAY_OUTPUT), decodeDataUrl(results.overlayDataUrl)),
      writeFile(path.resolve(DIFF_OUTPUT), decodeDataUrl(results.diffDataUrl)),
    ]);

    return { width: results.width, height: results.height };
  } finally {
    await browser.close();
  }
}

createComparisons().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
