import { createRequire } from "node:module";
import { readFileSync } from "node:fs";

const require = createRequire(
  "/Users/jensmac/Developer/wevenu-website/marketing/package.json",
);
const { chromium } = require("playwright");
const OUT = "docs/qa/inquiry-email-formatting";

const browser = await chromium.launch({ headless: true });
for (const name of ["inquiry", "summary", "duplicate"] as const) {
  const html = readFileSync(`${OUT}/before-${name}.html`, "utf8");
  for (const width of [1280, 390] as const) {
    const page = await browser.newPage({ viewport: { width, height: 900 } });
    await page.setContent(html, { waitUntil: "load" });
    await page.screenshot({ path: `${OUT}/before-${name}-${width}.png`, fullPage: true });
    await page.close();
  }
}
await browser.close();
console.log("before shots ok");
