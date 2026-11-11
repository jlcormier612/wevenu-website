/**
 * Venue portal mobile chrome: header, tours, contracts at phone widths.
 * Sandbox only. Read-mostly; no customer messages.
 */
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

config({ path: ".env.local", quiet: true });

const require = createRequire(
  "/Users/jensmac/Developer/wevenu-website/marketing/package.json",
);
const { chromium } = require("playwright");
const ssrUtils = require(
  "/Users/jensmac/Developer/wevenu-website/node_modules/@supabase/ssr/dist/main/utils/index.js",
);

const APP = "https://app.sandbox.hellotocheers.com";
const FANCY_EMAIL = "jennifer@hellotocheers.com";
const FANCY = "a415ac52-cd74-42a6-8df7-7a8f6e71d080";
const OUT_DIR = "docs/qa/venue-mobile-chrome";
const EXPECTED_PREFIX = process.env.EXPECTED_TIP_PREFIX ?? "";
const WIDTHS = [320, 375, 390, 430];

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
if (!url.includes("wvpsldwwjqdannqasrdf")) throw new Error("refusing non-sandbox supabase");

const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false },
});
const anon = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
  auth: { persistSession: false },
});

type Check = { name: string; pass: boolean; detail: string };
const checks: Check[] = [];
function record(name: string, pass: boolean, detail: string) {
  checks.push({ name, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"} ${name} — ${detail}`);
}

async function cookiesFor(email: string) {
  const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
  });
  if (linkErr) throw linkErr;
  const { data: otpData, error: otpErr } = await anon.auth.verifyOtp({
    type: "email",
    token_hash: linkData.properties!.hashed_token!,
  });
  if (otpErr || !otpData.session) throw otpErr ?? new Error("no session");
  const cookieName = "sb-wvpsldwwjqdannqasrdf-auth-token";
  const encoded = "base64-" + ssrUtils.stringToBase64URL(JSON.stringify(otpData.session));
  return [
    ...ssrUtils.createChunks(cookieName, encoded).map(
      (c: { name: string; value: string }) => ({
        name: c.name,
        value: c.value,
        domain: "app.sandbox.hellotocheers.com",
        path: "/",
        httpOnly: false,
        secure: true,
        sameSite: "Lax" as const,
      }),
    ),
    {
      name: "htc_active_venue_id",
      value: FANCY,
      domain: "app.sandbox.hellotocheers.com",
      path: "/",
      httpOnly: false,
      secure: true,
      sameSite: "Lax" as const,
    },
  ];
}

function boxesOverlap(
  a: { x: number; y: number; width: number; height: number },
  b: { x: number; y: number; width: number; height: number },
  pad = 1,
) {
  return !(
    a.x + a.width <= b.x + pad
    || b.x + b.width <= a.x + pad
    || a.y + a.height <= b.y + pad
    || b.y + b.height <= a.y + pad
  );
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.context().addCookies(await cookiesFor(FANCY_EMAIL));

  try {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(`${APP}/dashboard`, { waitUntil: "domcontentloaded", timeout: 90000 });
    await page.waitForTimeout(1500);
    const html = await page.content();
    const sha = html.match(/dpl=([0-9a-f]{40})/)?.[1] ?? "";
    if (EXPECTED_PREFIX) {
      record("deployed_sha_prefix", !!sha && sha.startsWith(EXPECTED_PREFIX), `sha=${sha}`);
    } else {
      record("deployed_sha_captured", !!sha, `sha=${sha}`);
    }

    for (const w of WIDTHS) {
      await page.setViewportSize({ width: w, height: 844 });
      await page.goto(`${APP}/dashboard`, { waitUntil: "domcontentloaded", timeout: 90000 });
      await page.waitForTimeout(1200);

      const header = page.locator("header").first();
      const logo = header.locator("img").first();
      const menu = header.getByRole("button", { name: /Open navigation/i });
      const search = header.getByRole("button", { name: /^Search$/i });
      const logoBox = await logo.boundingBox().catch(() => null);
      const menuBox = await menu.boundingBox().catch(() => null);
      const searchBox = await search.boundingBox().catch(() => null);
      const logoOk = !!logoBox && logoBox.width >= 28 && logoBox.height >= 28;
      const noLogoSearchOverlap =
        !logoBox || !searchBox || !boxesOverlap(logoBox, searchBox);
      const noMenuSearchOverlap =
        !menuBox || !searchBox || !boxesOverlap(menuBox, searchBox);
      record(
        `header_${w}_no_overlap`,
        logoOk && noLogoSearchOverlap && noMenuSearchOverlap,
        JSON.stringify({ logoBox, menuBox, searchBox, logoOk }),
      );
      await page.screenshot({ path: `${OUT_DIR}/header-${w}.png` });
    }

    // Tours at 390
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${APP}/tours`, { waitUntil: "domcontentloaded", timeout: 90000 });
    await page.waitForTimeout(2000);
    const tourSelect = page.locator("[data-slot='select-trigger'], button").filter({ hasText: /Scheduled|Confirmed|Completed/i }).first();
    const tourBadge = page.locator("text=/Scheduled|Confirmed|Completed/").first();
    const selBox = await tourSelect.boundingBox().catch(() => null);
    const badgeBox = await tourBadge.boundingBox().catch(() => null);
    // Badge and select may both exist; they must not occupy the same box.
    const toursOk =
      !selBox
      || !badgeBox
      || Math.abs(selBox.y - badgeBox.y) > 8
      || Math.abs(selBox.x - badgeBox.x) > 40;
    record("tours_390_status_not_stacked", toursOk, JSON.stringify({ selBox, badgeBox }));
    await page.screenshot({ path: `${OUT_DIR}/tours-390.png`, fullPage: true });

    // Contracts at 390 — event date must be fully visible in mobile card
    await page.goto(`${APP}/contracts`, { waitUntil: "domcontentloaded", timeout: 90000 });
    await page.waitForTimeout(2000);
    const eventLabel = page.getByText(/Event /i).first();
    const eventVisible = (await eventLabel.count()) > 0
      && await eventLabel.isVisible().catch(() => false);
    const eventBox = await eventLabel.boundingBox().catch(() => null);
    const dateNotClipped = !!eventBox && eventBox.x + eventBox.width <= 390 - 8;
    record(
      "contracts_390_event_date_visible",
      eventVisible && dateNotClipped,
      JSON.stringify({ eventVisible, eventBox }),
    );
    await page.screenshot({ path: `${OUT_DIR}/contracts-390.png`, fullPage: true });

    // Desktop control
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(`${APP}/contracts`, { waitUntil: "domcontentloaded", timeout: 90000 });
    await page.waitForTimeout(1000);
    const tableHead = page.getByRole("columnheader", { name: /Event Date/i });
    record(
      "contracts_desktop_table_present",
      (await tableHead.count()) > 0,
      `heads=${await tableHead.count()}`,
    );
    await page.screenshot({ path: `${OUT_DIR}/contracts-desktop.png` });
  } finally {
    await browser.close();
  }

  const pass = checks.every((c) => c.pass);
  const result = { at: new Date().toISOString(), tipPrefix: EXPECTED_PREFIX || null, pass, checks };
  writeFileSync(`${OUT_DIR}/browser-results.json`, JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
  if (!pass) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
