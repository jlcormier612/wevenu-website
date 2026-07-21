import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, "..", "preview-pdfs");
const BASE = process.env.PREVIEW_BASE_URL ?? "http://localhost:3001";

const PAGES = [
  { file: "Home.pdf", path: "/" },
  { file: "Why.pdf", path: "/our-story" },
  { file: "Product.pdf", path: "/product" },
  { file: "Features.pdf", path: "/features" },
  { file: "Pricing.pdf", path: "/pricing" },
  { file: "Trust.pdf", path: "/trust" },
  { file: "Resources.pdf", path: "/resources" },
];

await mkdir(OUT_DIR, { recursive: true });

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 1,
});

for (const pageDef of PAGES) {
  const page = await context.newPage();
  const url = `${BASE}${pageDef.path}`;
  console.log(`Rendering ${url} → ${pageDef.file}`);

  await page.goto(url, { waitUntil: "load", timeout: 120_000 });
  await page.waitForTimeout(1500);

  // Trigger lazy-loaded content
  await page.evaluate(async () => {
    const delay = (ms) => new Promise((r) => setTimeout(r, ms));
    const total = Math.max(
      document.documentElement.scrollHeight,
      document.body.scrollHeight,
    );
    for (let y = 0; y < total; y += 900) {
      window.scrollTo(0, y);
      await delay(120);
    }
    window.scrollTo(0, 0);
    await delay(300);
  });

  // Let images settle
  await page.evaluate(async () => {
    const images = Array.from(document.images);
    await Promise.all(
      images.map((img) =>
        img.complete
          ? Promise.resolve()
          : new Promise((resolve) => {
              img.addEventListener("load", resolve, { once: true });
              img.addEventListener("error", resolve, { once: true });
            }),
      ),
    );
  });

  const height = await page.evaluate(() =>
    Math.max(
      document.documentElement.scrollHeight,
      document.body.scrollHeight,
      document.documentElement.offsetHeight,
    ),
  );

  // Chromium PDF height limit ~200 inches; keep a safety margin
  const pdfHeight = Math.min(Math.ceil(height + 40), 18000);

  await page.pdf({
    path: path.join(OUT_DIR, pageDef.file),
    printBackground: true,
    width: "1440px",
    height: `${pdfHeight}px`,
    margin: { top: "0", right: "0", bottom: "0", left: "0" },
  });

  await page.close();
  console.log(`  wrote ${pageDef.file} (${height}px → pdf ${pdfHeight}px)`);
}

await browser.close();
console.log(`\nDone. PDFs in ${OUT_DIR}`);
console.log("Note: no dedicated /luv page exists yet — Luv.pdf skipped.");
