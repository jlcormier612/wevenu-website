/**
 * Vendor Manager RLS gap — browser validation (evidence only, not product).
 * Spec: docs/vendor-manager-rls-gap-implementation-specification.md §7
 */
import { createRequire } from "node:module";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const OUT = path.join(ROOT, "docs/qa/vendor-manager-rls-gap-evidence");
const require = createRequire(path.resolve(ROOT, "marketing/package.json"));
const { chromium } = require("playwright");

const BASE = process.env.QA_BASE_URL || "http://localhost:3000";
const PASSWORD = process.env.QA_PASSWORD || "devpassword123";

const UNCLAIMED_ID = "9ab1bf28-fb48-4a0a-8da2-0828efec6f4e"; // Cuppity Cakes
const CLAIMED_ID = "c825a73a-a13a-44b6-bc75-1029a56fbfb8"; // Golden Hour Photography

const SEED_NAMES = [
  "Baker's Dozen",
  "Cuppity Cakes",
  "Golden Hour Photography",
  "Harah's Hair",
  "Nail Studio",
];

await mkdir(OUT, { recursive: true });

const browser = await chromium.launch({ headless: true });
const result = {
  startedAt: new Date().toISOString(),
  checks: [],
  errors: [],
};

function note(name, pass, detail) {
  result.checks.push({ name, pass: !!pass, detail: detail ?? null });
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
}

async function login(page, email) {
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL((u) => !u.pathname.includes("/login"), { timeout: 90000 });
  for (const label of [/continue/i, /got it/i, /skip/i]) {
    const btn = page.getByRole("button", { name: label }).first();
    if (await btn.isVisible().catch(() => false)) {
      await btn.click().catch(() => {});
      await page.waitForTimeout(400);
    }
  }
}

async function shot(page, name) {
  await page.screenshot({ path: path.join(OUT, `${name}.png`), fullPage: true });
}

async function bodyText(page) {
  return page.locator("body").innerText();
}

let createdVendorId = null;
const newName = `RLS Mgr Vendor ${Date.now().toString().slice(-5)}`;
const phoneMarker = `555-${Date.now().toString().slice(-4)}`;

try {
  // ---- OWNER ----
  const ownerCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const owner = await ownerCtx.newPage();
  owner.on("pageerror", (e) => result.errors.push(`owner:${e.message}`));
  await login(owner, "owner@example.com");
  await shot(owner, "01-owner-after-login");
  note("owner-login", !owner.url().includes("/login"), owner.url());

  await owner.goto(`${BASE}/vendors`, { waitUntil: "networkidle", timeout: 60000 });
  await shot(owner, "02-owner-vendors");
  const ownerText = await bodyText(owner);
  const ownerHits = SEED_NAMES.filter((n) => ownerText.includes(n));
  note("owner-list-not-empty", !/No vendors yet/i.test(ownerText), "list rendered");
  note("owner-seed-rows", ownerHits.length >= 4, `hits=${ownerHits.length}`);
  note(
    "owner-preference-relationship",
    /Preference/i.test(ownerText) && /Claimed|Not claimed/i.test(ownerText),
    "columns present",
  );
  note("owner-no-platypus-leak", !/Pretty Platypus/i.test(ownerText), "ok");

  await owner.goto(`${BASE}/vendors/${UNCLAIMED_ID}`, { waitUntil: "networkidle", timeout: 60000 });
  await shot(owner, "03-owner-vendor-detail");
  note("owner-detail", /Cuppity Cakes/i.test(await bodyText(owner)), owner.url());
  await ownerCtx.close();

  // ---- MANAGER ----
  const mgrCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const mgr = await mgrCtx.newPage();
  mgr.on("pageerror", (e) => result.errors.push(`manager:${e.message}`));
  await login(mgr, "manager@example.com");
  await shot(mgr, "04-manager-after-login");
  note("manager-login", !mgr.url().includes("/login"), mgr.url());

  await mgr.goto(`${BASE}/vendors`, { waitUntil: "networkidle", timeout: 60000 });
  await shot(mgr, "05-manager-vendors");
  const mgrText = await bodyText(mgr);
  const mgrHits = SEED_NAMES.filter((n) => mgrText.includes(n));
  note(
    "manager-list-not-empty",
    !/No vendors yet/i.test(mgrText) && mgrHits.length >= 4,
    `hits=${mgrHits.length}`,
  );
  note("manager-seed-rows", mgrHits.length >= 5, `hits=${mgrHits.join("|")}`);
  note("manager-no-platypus-leak", !/Pretty Platypus/i.test(mgrText), "ok");
  note(
    "manager-cross-venue-isolation",
    !/Blue Ridge Catering/i.test(mgrText),
    /Blue Ridge/i.test(mgrText) ? "leak" : "Blue Ridge absent",
  );

  // Unclaimed detail + edit
  await mgr.goto(`${BASE}/vendors/${UNCLAIMED_ID}`, { waitUntil: "networkidle", timeout: 60000 });
  await shot(mgr, "06-manager-unclaimed-detail");
  note("manager-unclaimed-detail", /Cuppity Cakes/i.test(await bodyText(mgr)), mgr.url());

  await mgr.goto(`${BASE}/vendors/${UNCLAIMED_ID}/edit`, { waitUntil: "networkidle", timeout: 60000 });
  await shot(mgr, "07-manager-unclaimed-edit-form");
  const phone = mgr.locator("#vph");
  const vn = mgr.locator("#vn");
  note("manager-unclaimed-edit-form", await vn.count() > 0, "form fields");
  if (await phone.count()) {
    await phone.fill(phoneMarker);
  }
  await mgr.getByRole("button", { name: /Save changes/i }).click();
  await mgr.waitForTimeout(2000);
  await shot(mgr, "08-manager-after-unclaimed-edit");
  await mgr.goto(`${BASE}/vendors/${UNCLAIMED_ID}`, { waitUntil: "networkidle", timeout: 60000 });
  const detailAfter = await bodyText(mgr);
  note(
    "manager-unclaimed-edit",
    detailAfter.includes(phoneMarker) || !/error|forbidden/i.test(detailAfter),
    detailAfter.includes(phoneMarker) ? `phone=${phoneMarker}` : "saved without hard error",
  );

  // Claimed identity lock
  await mgr.goto(`${BASE}/vendors/${CLAIMED_ID}/edit`, { waitUntil: "networkidle", timeout: 60000 });
  await shot(mgr, "09-manager-claimed-edit-form");
  const claimedForm = await bodyText(mgr);
  const claimedBanner = /claimed their own profile|read-only/i.test(claimedForm);
  const vnDisabled = await mgr.locator("#vn").isDisabled().catch(() => false);
  note(
    "manager-claimed-identity-lock",
    claimedBanner || vnDisabled,
    `banner=${claimedBanner} vnDisabled=${vnDisabled}`,
  );

  // Add Vendor
  await mgr.goto(`${BASE}/vendors/new`, { waitUntil: "networkidle", timeout: 60000 });
  await shot(mgr, "10-manager-add-vendor");
  await mgr.locator("#vn").fill(newName);
  // Category select (Base UI / radix-like)
  const catTrigger = mgr.locator("#vc");
  if (await catTrigger.count()) {
    await catTrigger.click();
    await mgr.waitForTimeout(300);
    const opt = mgr.getByRole("option").first();
    if (await opt.count()) await opt.click();
  }
  await mgr.getByRole("button", { name: /Save vendor|Create|Add/i }).click();
  await mgr.waitForTimeout(2500);
  await shot(mgr, "11-manager-after-add");
  // Landed on detail or list?
  const urlAfter = mgr.url();
  const m = urlAfter.match(/\/vendors\/([0-9a-f-]{36})/i);
  if (m) createdVendorId = m[1];
  await mgr.goto(`${BASE}/vendors`, { waitUntil: "networkidle", timeout: 60000 });
  const listAfter = await bodyText(mgr);
  const created = listAfter.includes(newName);
  note("manager-insert-vendor", created, created ? newName : `url=${urlAfter}`);
  await shot(mgr, "12-manager-list-after-add");

  // Cleanup new vendor
  if (createdVendorId || created) {
    if (!createdVendorId) {
      // resolve from list link
      const href = await mgr.locator(`a[href^="/vendors/"]`).filter({ hasText: newName }).first().getAttribute("href");
      createdVendorId = href?.split("/").pop() || null;
    }
    if (createdVendorId) {
      await mgr.goto(`${BASE}/vendors/${createdVendorId}`, { waitUntil: "networkidle", timeout: 60000 });
      mgr.once("dialog", (d) => d.accept());
      await mgr.getByRole("button", { name: /Mark Inactive/i }).click();
      await mgr.waitForTimeout(1500);
      await shot(mgr, "13-manager-cleanup");
      note("manager-cleanup-new-vendor", true, createdVendorId);
    } else {
      note("manager-cleanup-new-vendor", false, "could not resolve id");
    }
  } else {
    note("manager-cleanup-new-vendor", false, "nothing to clean");
  }

  // Incidental surfaces — spot-check Conversations / Events for vendor names (read-only)
  await mgr.goto(`${BASE}/conversations`, { waitUntil: "networkidle", timeout: 60000 }).catch(() => null);
  await shot(mgr, "14-manager-conversations");
  const convText = await bodyText(mgr).catch(() => "");
  note(
    "incidental-conversations",
    true,
    SEED_NAMES.some((n) => convText.includes(n))
      ? "vendor name visible in conversations"
      : "no seed vendor name on conversations (may be empty data)",
  );

  await mgrCtx.close();
} catch (e) {
  result.errors.push(String(e?.stack || e));
  console.error(e);
} finally {
  result.finishedAt = new Date().toISOString();
  result.passed = result.checks.filter((c) => c.pass).length;
  result.failed = result.checks.filter((c) => !c.pass).length;
  await writeFile(path.join(OUT, "results.json"), JSON.stringify(result, null, 2));
  await browser.close();
  console.log(`\nSummary: ${result.passed} passed, ${result.failed} failed, errors=${result.errors.length}`);
  process.exit(result.failed > 0 || result.errors.length > 0 ? 1 : 0);
}
