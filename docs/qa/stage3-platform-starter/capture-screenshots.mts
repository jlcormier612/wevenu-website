/**
 * Capture screenshots for Stage 3 disposable venue (local app + Sandbox DB).
 */
import { chromium } from "playwright";
import { config } from "dotenv";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

config({ path: join(process.cwd(), ".env.local"), quiet: true });

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, "screenshots");
mkdirSync(OUT, { recursive: true });

const creds = JSON.parse(readFileSync("/tmp/stage3-starter-creds.json", "utf8")) as {
  ownerEmail: string;
  password: string;
  venueId: string;
  venueName: string;
};

const APP = process.env.STAGE3_CAPTURE_BASE || "http://127.0.0.1:3000";
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

const result: Record<string, unknown> = {
  app: APP,
  venueId: creds.venueId,
  venueName: creds.venueName,
  shots: [] as string[],
};

async function shot(name: string) {
  const path = join(OUT, `${name}.png`);
  await page.screenshot({ path, fullPage: false });
  (result.shots as string[]).push(path);
  console.log("shot", path);
}

async function settle() {
  await page.waitForTimeout(1200);
}

async function login() {
  await page.goto(`${APP}/login`, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.waitForSelector('input[type="email"], input[name="email"]', { timeout: 30_000 });
  await page.fill('input[type="email"], input[name="email"]', creds.ownerEmail);
  await page.fill('input[type="password"], input[name="password"]', creds.password);
  await page.click('button[type="submit"]');
  await page.waitForTimeout(2500);
}

try {
  await login();

  // Bypass guided setup by navigating the shell if available.
  const templatesNav = page.getByRole("link", { name: /^Templates$/i }).first();
  if (await templatesNav.isVisible().catch(() => false)) {
    await templatesNav.click();
    await settle();
  } else {
    await page.goto(`${APP}/library`, { waitUntil: "domcontentloaded", timeout: 60_000 });
    await settle();
  }
  await shot("02-library-home");

  await page.goto(`${APP}/library/playbooks`, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.waitForTimeout(2000);
  await shot("01-library-playbooks");
  const pbText = await page.locator("body").innerText();
  result.playbookText = {
    hasWeddingClient: /Standard Wedding — Client Planning/i.test(pbText),
    hasWeddingVenue: /Standard Wedding — Venue Planning/i.test(pbText),
    hasCorporate: /Standard Corporate/i.test(pbText),
    hasSocial: /Standard Social/i.test(pbText),
  };

  await page.goto(`${APP}/settings/leads/setup-profiles`, {
    waitUntil: "domcontentloaded",
    timeout: 60_000,
  });
  await page.waitForTimeout(2500);
  await shot("03-setup-profiles");
  const spText = await page.locator("body").innerText();
  result.setupProfilesText = {
    hasStandard: /Standard Wedding Setup/i.test(spText),
    usedForWeddings: /All Weddings|Used for:.*Wedding/i.test(spText),
    mentionsVenueDefaultAssignment: /Used for:.*Venue default/i.test(spText),
  };

  await page.goto(`${APP}/setup-hub`, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.waitForTimeout(2000);
  await shot("04-setup-hub");
  const hubText = await page.locator("body").innerText();
  result.setupHubText = {
    hasClientExperience: /Your Client Experience/i.test(hubText),
    mentionsSetupProfiles: /Setup Profile/i.test(hubText),
  };

  await page.goto(`${APP}/communication/series`, {
    waitUntil: "domcontentloaded",
    timeout: 60_000,
  });
  await page.waitForTimeout(2000);
  await shot("05-automations");
  const autoText = await page.locator("body").innerText();
  result.automationsText = {
    hasNewInquiry: /New Inquiry Welcome/i.test(autoText),
    pausedMentions: (autoText.match(/Paused/gi) ?? []).length,
  };

  result.ok =
    Boolean((result.playbookText as { hasWeddingClient?: boolean }).hasWeddingClient) &&
    Boolean((result.setupProfilesText as { hasStandard?: boolean }).hasStandard);

} catch (e) {
  result.ok = false;
  result.error = e instanceof Error ? e.message : String(e);
  await shot("error-state").catch(() => undefined);
} finally {
  writeFileSync(join(__dirname, "capture-results.json"), JSON.stringify(result, null, 2));
  await browser.close();
  console.log(JSON.stringify(result, null, 2));
  if (!result.ok) process.exitCode = 1;
}
