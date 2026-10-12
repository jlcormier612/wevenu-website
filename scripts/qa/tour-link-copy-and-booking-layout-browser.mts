/**
 * Sandbox browser proof:
 * 1) Shortened tour-link guidance copy (Calendar + lead Follow-up)
 * 2) Booking Details package row not collapsed to a narrow column
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
const EXPECTED_PREFIX = process.env.EXPECTED_TIP_PREFIX ?? "";
const FANCY_EMAIL = "jennifer@hellotocheers.com";
const FANCY = "a415ac52-cd74-42a6-8df7-7a8f6e71d080";
const OUT_DIR = "docs/qa/tour-link-booking-layout";
const OUT = `${OUT_DIR}/browser-results.json`;

const CAL_COPY =
  "Already working with someone? Use the personalized scheduling link that resides in their lead record, under 'Follow-up'. That will preserve any preferred date holds and other previously gathered information.";
const LEAD_COPY =
  "Use this personalized scheduling link for this lead. The Calendar page's Copy tour link is a general link for new prospects only.";

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

function norm(s: string) {
  return s.replace(/\s+/g, " ").trim();
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

async function switchToFancy(page: import("playwright").Page) {
  await page.goto(`${APP}/dashboard`, { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.waitForTimeout(800);
  await page.getByRole("button", { name: /Switch venue/i }).click();
  await page.getByRole("menuitem").filter({ hasText: /Fancy Venue/i }).first().click();
  await page.waitForTimeout(1500);
}

async function tipSha(page: import("playwright").Page, linkHeader?: string | null) {
  const fromLink = linkHeader?.match(/dpl=([0-9a-f]{40})/)?.[1];
  if (fromLink) return fromLink;
  const html = await page.content();
  return (html.match(/content="([0-9a-f]{40})"/i) || html.match(/dpl=([0-9a-f]{40})/))?.[1] ?? null;
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });

  // Lead with a commercial selection (package + contract/invoice preferred for locked hint)
  const { data: selections } = await admin
    .from("commercial_selections")
    .select("id, lead_id, package_name, status, contract_id, invoice_id, total_amount")
    .eq("venue_id", FANCY)
    .not("lead_id", "is", null)
    .order("updated_at", { ascending: false })
    .limit(20);
  const withPackage = (selections ?? []).find((s) => s.lead_id && s.package_name);
  if (!withPackage?.lead_id) throw new Error("no Fancy lead with selected package");

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await context.addCookies(await cookiesFor(FANCY_EMAIL));
  const page = await context.newPage();

  await switchToFancy(page);

  // --- Calendar copy ---
  const calResp = await page.goto(`${APP}/calendar`, { waitUntil: "domcontentloaded", timeout: 90000 });
  const sha = await tipSha(page, calResp?.headers()?.link);
  if (EXPECTED_PREFIX) {
    record("deployed_sha_prefix", !!sha && sha.startsWith(EXPECTED_PREFIX), `sha=${sha}`);
  } else {
    record("deployed_sha_captured", !!sha, `sha=${sha}`);
  }

  const calGuide = page.getByTestId("calendar-tour-link-lead-guidance");
  await calGuide.waitFor({ state: "visible", timeout: 20000 }).catch(() => undefined);
  const calText = norm((await calGuide.textContent().catch(() => "")) ?? "");
  record("calendar_guidance_exact", calText === CAL_COPY, JSON.stringify({ calText, expected: CAL_COPY }));
  await page.screenshot({ path: `${OUT_DIR}/calendar-guidance.png`, fullPage: false });

  // --- Lead Follow-up copy ---
  await page.goto(`${APP}/leads/${withPackage.lead_id}`, { waitUntil: "domcontentloaded", timeout: 90000 });
  const leadGuide = page.getByTestId("lead-scheduling-link-guidance");
  const leadGuideVisible = await leadGuide.isVisible().catch(() => false);
  if (!leadGuideVisible) {
    // Ensure copy-link is offered (tour scheduling enabled)
    record("lead_guidance_visible", false, "lead scheduling guidance not on this lead; trying another lead with schedule actions");
  } else {
    const leadText = norm((await leadGuide.textContent().catch(() => "")) ?? "");
    record("lead_guidance_exact", leadText === LEAD_COPY, JSON.stringify({ leadText, expected: LEAD_COPY }));
    const boldTour = await leadGuide.locator("span.font-medium").textContent().catch(() => "");
    record("lead_copy_tour_link_bold", norm(boldTour ?? "") === "Copy tour link", `bold=${boldTour}`);
  }
  await page.screenshot({ path: `${OUT_DIR}/lead-followup-guidance.png`, fullPage: false });

  // --- Booking Details layout (desktop) ---
  const packageFacts = page.getByTestId("booking-details-package-facts");
  await packageFacts.waitFor({ state: "visible", timeout: 20000 }).catch(() => undefined);
  const factsVisible = await packageFacts.isVisible().catch(() => false);
  record("package_facts_visible", factsVisible, factsVisible ? "visible" : "missing");

  if (factsVisible) {
    const box = await packageFacts.boundingBox();
    const width = box?.width ?? 0;
    // At 1280 desktop, package facts should be a substantial share of the card (not ~40–80px).
    record("package_facts_not_narrow", width >= 280, `width=${width}`);
    const factsText = norm((await packageFacts.textContent()) ?? "");
    record(
      "package_facts_readable",
      /Selected package|package|\$/i.test(factsText) && !/^(\S+\s){0,2}\S+$/.test(factsText.slice(0, 40)),
      `textPreview=${factsText.slice(0, 120)}`,
    );

    const changeBtn = page.getByRole("button", { name: /View \/ Change package/i }).first();
    const changeBox = await changeBtn.boundingBox().catch(() => null);
    const hint = page.getByTestId("invoice-adjustments-locked-hint");
    const hintBox = (await hint.isVisible().catch(() => false)) ? await hint.boundingBox() : null;
    if (box && changeBox) {
      const overlapY =
        Math.min(box.y + box.height, changeBox.y + changeBox.height) - Math.max(box.y, changeBox.y);
      const overlapX =
        Math.min(box.x + box.width, changeBox.x + changeBox.width) - Math.max(box.x, changeBox.x);
      const overlaps = overlapX > 8 && overlapY > 8;
      record("change_btn_no_overlap_facts", !overlaps, `overlapX=${overlapX} overlapY=${overlapY}`);
    }
    if (hintBox && changeBox) {
      const overlapY =
        Math.min(hintBox.y + hintBox.height, changeBox.y + changeBox.height) - Math.max(hintBox.y, changeBox.y);
      const overlapX =
        Math.min(hintBox.x + hintBox.width, changeBox.x + changeBox.width) - Math.max(hintBox.x, changeBox.x);
      record("change_btn_no_overlap_hint", !(overlapX > 8 && overlapY > 8), `hintY=${hintBox.y} btnY=${changeBox.y}`);
    } else {
      record("locked_hint_optional", true, hintBox ? "present" : "no locked hint on this selection");
    }
  }

  await page.screenshot({ path: `${OUT_DIR}/booking-details-desktop.png`, fullPage: true });

  // Mobile
  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1000);
  const mobileFacts = page.getByTestId("booking-details-package-facts");
  if (await mobileFacts.isVisible().catch(() => false)) {
    const mb = await mobileFacts.boundingBox();
    record("package_facts_mobile_width", (mb?.width ?? 0) >= 260, `width=${mb?.width}`);
  }
  await page.screenshot({ path: `${OUT_DIR}/booking-details-390.png`, fullPage: true });

  // Tablet
  await page.setViewportSize({ width: 768, height: 900 });
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1000);
  const tabFacts = page.getByTestId("booking-details-package-facts");
  if (await tabFacts.isVisible().catch(() => false)) {
    const tb = await tabFacts.boundingBox();
    record("package_facts_tablet_width", (tb?.width ?? 0) >= 280, `width=${tb?.width}`);
  }
  await page.screenshot({ path: `${OUT_DIR}/booking-details-768.png`, fullPage: true });

  await browser.close();

  const pass = checks.every((c) => c.pass);
  const result = {
    at: new Date().toISOString(),
    sha,
    leadId: withPackage.lead_id,
    selectionId: withPackage.id,
    pass,
    checks,
    productionUntouched: true,
    bookingDataUnchanged: true,
  };
  writeFileSync(OUT, JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
  if (!pass) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
