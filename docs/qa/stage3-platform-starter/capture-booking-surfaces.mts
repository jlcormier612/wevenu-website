/**
 * Focused screenshots of the verified Maya Inherit wedding booking surfaces.
 */
import { chromium } from "playwright";
import { config } from "dotenv";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

config({ path: join(process.cwd(), ".env.local"), quiet: true });
const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, "booking-inheritance", "screenshots");
mkdirSync(OUT, { recursive: true });
const creds = JSON.parse(readFileSync("/tmp/stage3-starter-creds.json", "utf8"));
const APP = "http://127.0.0.1:3000";
const EVENT = "e1fb93f2-3c4e-459a-b552-0148e5eab5bf";
const CORP = "65c3bace-0e63-44e0-b9f4-f19023da97f6";

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

await page.goto(`${APP}/login`, { waitUntil: "domcontentloaded" });
await page.fill('input[type="email"]', creds.ownerEmail);
await page.fill('input[type="password"]', creds.password);
await page.click('button[type="submit"]');
await page.waitForTimeout(2500);

const shots: string[] = [];
async function shot(name: string) {
  const path = join(OUT, `${name}.png`);
  await page.screenshot({ path, fullPage: false });
  shots.push(path);
  console.log(path);
}

await page.goto(`${APP}/events/${EVENT}`, { waitUntil: "networkidle", timeout: 60_000 });
await page.waitForTimeout(2000);
// Scroll to Event Setup
await page.getByText(/Event Setup|Standard Wedding Setup|Inherited/i).first().scrollIntoViewIfNeeded().catch(() => undefined);
await page.waitForTimeout(500);
await shot("wedding-09-event-setup-focus");

await page.getByRole("tab", { name: /Planning Tasks/i }).click().catch(async () => {
  await page.getByText(/^Planning Tasks$/i).first().click();
});
await page.waitForTimeout(2000);
await shot("wedding-10-planning-tasks");

await page.getByRole("tab", { name: /^Timeline$/i }).click().catch(async () => {
  await page.getByText(/^Timeline$/i).first().click();
});
await page.waitForTimeout(2000);
await page.getByText(/Ceremony|Guest Arrival|Venue Access/i).first().scrollIntoViewIfNeeded().catch(() => undefined);
await shot("wedding-11-timeline-items");

await page.getByRole("tab", { name: /Questionnaires/i }).click().catch(async () => {
  await page.getByRole("button", { name: /Open Questionnaires/i }).click().catch(() => undefined);
});
await page.waitForTimeout(2000);
await shot("wedding-12-questionnaires");

const weddingText = await page.locator("body").innerText();

await page.goto(`${APP}/events/${CORP}`, { waitUntil: "networkidle", timeout: 60_000 });
await page.waitForTimeout(2000);
await shot("corporate-09-overview");
const corpText = await page.locator("body").innerText();
await page.getByText(/Event Setup|Needs a decision|Not included|Included/i).first().scrollIntoViewIfNeeded().catch(() => undefined);
await shot("corporate-10-setup-area");

writeFileSync(
  join(__dirname, "booking-inheritance", "surface-capture.json"),
  JSON.stringify(
    {
      shots,
      weddingHints: {
        hasStandardWeddingSetup: /Standard Wedding Setup/i.test(weddingText),
        hasClientPlanning: /Client Planning|Complete your questionnaire|Purchase event insurance/i.test(weddingText),
        hasVenuePlanning: /Build timeline|Create floor plan|Venue Planning/i.test(weddingText),
        hasTimelineItems: /Ceremony|Guest Arrival|Venue Access/i.test(weddingText),
        hasQuestionnaires: /Client Planning Questionnaire|Final Details|Questionnaire/i.test(weddingText),
      },
      corpHints: {
        noWeddingSetup: !/Standard Wedding Setup/i.test(corpText),
        isCorporate: /Corporate|Orion/i.test(corpText),
      },
    },
    null,
    2,
  ),
);
await browser.close();
console.log("done");
