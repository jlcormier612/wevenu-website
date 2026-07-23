import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_OUT = path.join(__dirname, "..", "preview-pdfs");
const JOURNEY_OUT = path.join(ROOT_OUT, "journey");
const BASE = process.env.PREVIEW_BASE_URL ?? "http://localhost:3001";

/** Core marketing surfaces + product journey chapters */
const PAGES = [
  { file: "Home.pdf", path: "/", outDir: ROOT_OUT },
  { file: "Product.pdf", path: "/product", outDir: ROOT_OUT },
  { file: "01-Inquiry.pdf", path: "/product/journey/inquiry", outDir: JOURNEY_OUT },
  { file: "02-Tour.pdf", path: "/product/journey/tour", outDir: JOURNEY_OUT },
  { file: "03-Proposal.pdf", path: "/product/journey/proposal", outDir: JOURNEY_OUT },
  { file: "04-Booking.pdf", path: "/product/journey/contract-inventory", outDir: JOURNEY_OUT },
  { file: "05-Payments.pdf", path: "/product/journey/invoice-payment", outDir: JOURNEY_OUT },
  { file: "06-Planning.pdf", path: "/product/journey/planning", outDir: JOURNEY_OUT },
  { file: "07-Vendors.pdf", path: "/product/journey/vendors", outDir: JOURNEY_OUT },
  { file: "08-Timeline.pdf", path: "/product/journey/timeline", outDir: JOURNEY_OUT },
  { file: "09-Floor-Plans.pdf", path: "/product/journey/floor-seating", outDir: JOURNEY_OUT },
  {
    file: "10-Client-Experience.pdf",
    path: "/product/journey/client-portal-website",
    outDir: JOURNEY_OUT,
  },
  { file: "11-Guest-Portal.pdf", path: "/product/journey/guest-portal", outDir: JOURNEY_OUT },
  { file: "12-Celebration.pdf", path: "/product/journey/celebration", outDir: JOURNEY_OUT },
];

await mkdir(ROOT_OUT, { recursive: true });
await mkdir(JOURNEY_OUT, { recursive: true });

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 1,
  // Final static state for scroll-scrubbed sections (e.g. shared-truth architecture)
  reducedMotion: "reduce",
});

const failures = [];

for (const pageDef of PAGES) {
  const page = await context.newPage();
  const url = `${BASE}${pageDef.path}`;
  const outPath = path.join(pageDef.outDir, pageDef.file);
  console.log(`Rendering ${url} → ${pageDef.file}`);

  try {
    const response = await page.goto(url, { waitUntil: "load", timeout: 120_000 });
    const status = response?.status() ?? 0;
    if (status >= 400) {
      throw new Error(`HTTP ${status}`);
    }

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
      path: outPath,
      printBackground: true,
      width: "1440px",
      height: `${pdfHeight}px`,
      margin: { top: "0", right: "0", bottom: "0", left: "0" },
    });

    console.log(`  wrote ${pageDef.file} (${height}px → pdf ${pdfHeight}px)`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`  FAILED ${pageDef.file}: ${message}`);
    failures.push({ file: pageDef.file, path: pageDef.path, error: message });
  } finally {
    await page.close();
  }
}

await browser.close();

console.log(`\nDone. PDFs in ${ROOT_OUT}`);
if (failures.length) {
  console.log(`\n${failures.length} page(s) failed:`);
  for (const f of failures) {
    console.log(`  - ${f.file} (${f.path}): ${f.error}`);
  }
  process.exitCode = 1;
}
