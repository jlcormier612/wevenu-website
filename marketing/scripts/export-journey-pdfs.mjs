import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, "..", "preview-pdfs", "journey");
const BASE = process.env.PREVIEW_BASE_URL ?? "http://localhost:3001";

/** Product journey chapters — Inquiry through Celebration */
const PAGES = [
  { file: "01-Inquiry.pdf", path: "/product/journey/inquiry" },
  { file: "02-Tour.pdf", path: "/product/journey/tour" },
  { file: "03-Proposal.pdf", path: "/product/journey/proposal" },
  { file: "04-Booking.pdf", path: "/product/journey/contract-inventory" },
  { file: "05-Payments.pdf", path: "/product/journey/invoice-payment" },
  { file: "06-Planning.pdf", path: "/product/journey/planning" },
  { file: "07-Vendors.pdf", path: "/product/journey/vendors" },
  { file: "08-Timeline.pdf", path: "/product/journey/timeline" },
  { file: "09-Floor-Plans.pdf", path: "/product/journey/floor-seating" },
  { file: "10-Client-Experience.pdf", path: "/product/journey/client-portal-website" },
  { file: "11-Guest-Portal.pdf", path: "/product/journey/guest-portal" },
  { file: "12-Celebration.pdf", path: "/product/journey/celebration" },
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
