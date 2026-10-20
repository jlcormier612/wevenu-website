/**
 * Post-deploy: assertMigrationDocumentStorageExists + MC document UI callout.
 */
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import { assertMigrationDocumentStorageExists } from "../../../lib/migration/document-storage-guard";

config({ path: ".env.local", quiet: true });
process.env.NEXT_PUBLIC_APP_URL = "https://app.sandbox.hellotocheers.com";

const require = createRequire("/Users/jensmac/Developer/wevenu-website/marketing/package.json");
const { chromium } = require("playwright");

const APP = "https://app.sandbox.hellotocheers.com";
const OUT = "docs/qa/exclusion-forensic";
const EXPECT = (process.env.EXPECT_SHA || "").slice(0, 8);
const SANDBOX_REF = "wvpsldwwjqdannqasrdf";
if (!process.env.NEXT_PUBLIC_SUPABASE_URL?.includes(SANDBOX_REF)) throw new Error("not sandbox");
mkdirSync(OUT, { recursive: true });

type Check = { name: string; pass: boolean; detail: string };
const checks: Check[] = [];
function record(name: string, pass: boolean, detail: string) {
  checks.push({ name, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"} ${name} — ${detail.slice(0, 350)}`);
}

async function main() {
  const missing = await assertMigrationDocumentStorageExists(
    "00000000-0000-0000-0000-000000000000/migration-cert/absent.pdf",
  );
  record("guard_rejects_missing", !missing.ok, missing.ok ? "ok" : missing.error.slice(0, 200));

  const realPath = "47d34f27-e2b5-45ea-89f6-6f442d02dc2b/migration-cert/spec-contract-1792521209417.pdf";
  const present = await assertMigrationDocumentStorageExists(realPath);
  record("guard_accepts_existing", present.ok, present.ok ? "ok" : present.error);

  const stamp = Date.now();
  const email = `jennifer+exforensic.${stamp}@hellotocheers.com`;
  const password = `Ef-${stamp}-Aa1x`;
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
  const { data: created, error: cErr } = await admin.auth.admin.createUser({
    email, password, email_confirm: true,
  });
  if (cErr || !created.user) throw cErr ?? new Error("user");
  const { data: venue } = await admin.from("venues").insert({
    owner_user_id: created.user.id,
    name: `Exclusion Forensic ${stamp}`,
    email: `v.${email}`,
  }).select("id,name").single();
  const venueId = venue!.id as string;
  await admin.from("venue_staff").insert({
    venue_id: venueId, user_id: created.user.id, full_name: "Forensic Owner", email,
    role: "owner", is_owner: true, is_active: true,
    accepted_at: new Date().toISOString(),
    access_title: "administrator", title_basis: "administrator",
    capability_overrides: {}, owner_invite_pending: false,
  });
  await admin.from("venue_staff_active_context").upsert({
    user_id: created.user.id, active_venue_id: venueId, updated_at: new Date().toISOString(),
  });
  await admin.from("venue_onboarding_intake").upsert({
    venue_id: venueId, path: "self_setup", venue_name: venue!.name,
    space_mode: "one", spaces: [{ name: "Main Space", maxCapacity: null }],
    offers_tours: true, inquiry_sources: [], bring_business_choice: "another_system",
    submitted_at: new Date().toISOString(),
  }, { onConflict: "venue_id" });
  await admin.from("venue_spaces").insert({
    venue_id: venueId, name: "Main Space", is_active: true, sort_order: 0,
  });
  await admin.from("venue_capacity_rules").upsert({
    venue_id: venueId, max_simultaneous_events: 1, max_simultaneous_tours: 2, min_turnaround_hours: 0,
  }, { onConflict: "venue_id" });

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  try {
    const loginHtml = await fetch(`${APP}/login`).then((r) => r.text());
    const dpl = loginHtml.match(/data-dpl-id="([a-f0-9]+)"/)?.[1] || "";
    record(
      "runtime_dpl",
      !EXPECT || dpl.startsWith(EXPECT),
      `dpl=${dpl || "missing"} expectPrefix=${EXPECT || "(any)"}`,
    );

    await page.goto(`${APP}/login`, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.fill("#email", email);
    await page.fill("#password", password);
    await page.click('button[type="submit"]');
    for (let i = 0; i < 50; i++) {
      if (!page.url().includes("/login")) break;
      await page.waitForTimeout(400);
    }
    // Welcome
    for (let a = 0; a < 4; a++) {
      if (!page.url().includes("/welcome")) break;
      await page.locator("#welcome-experience-agree").check({ force: true }).catch(() => {});
      const boxes = page.locator("input[type='checkbox']");
      const n = await boxes.count();
      for (let i = 0; i < n; i++) await boxes.nth(i).check({ force: true }).catch(() => {});
      await page.waitForTimeout(300);
      const cont = page.getByRole("button", { name: /^Continue$/i });
      if ((await cont.count()) > 0 && await cont.first().isEnabled()) await cont.first().click();
      await page.waitForTimeout(800);
    }

    await page.goto(`${APP}/settings/migration?source=another_system`, {
      waitUntil: "domcontentloaded", timeout: 60000,
    });
    await page.waitForTimeout(1500);
    const another = page.getByText("Another system", { exact: true });
    if ((await another.count()) > 0) await another.first().click();
    await page.waitForTimeout(400);

    await page.locator("button[role='combobox']").first().click();
    await page.waitForTimeout(400);
    await page.getByRole("option", { name: /Documents \(contracts/i }).first().click();
    await page.waitForTimeout(800);
    const body = await page.locator("body").innerText();
    await page.screenshot({ path: `${OUT}/document-ui-callout.png`, fullPage: true });
    record(
      "ui_document_prerequisite_callout",
      /already in Hello to Cheers storage|storagePath|storageUrl|Active commitment/i.test(body),
      body.slice(0, 220).replace(/\s+/g, " "),
    );

    // payment / key_date must not appear as selectable committable options
    await page.locator("button[role='combobox']").first().click();
    await page.waitForTimeout(400);
    const payOpt = await page.getByRole("option", { name: /^Payments \(use Active/i }).count();
    const kdOpt = await page.getByRole("option", { name: /Key dates/i }).count();
    await page.keyboard.press("Escape");
    record("ui_payment_not_committable_select", payOpt === 0, `paymentOptions=${payOpt}`);
    record("ui_key_date_not_committable_select", kdOpt === 0, `keyDateOptions=${kdOpt}`);
  } finally {
    await browser.close();
  }

  const { count: invites } = await admin.from("client_invitations")
    .select("id", { count: "exact", head: true }).eq("venue_id", venueId);
  record("side_no_invitations", (invites ?? 0) === 0, `invites=${invites}`);

  const passed = checks.filter((c) => c.pass).length;
  const failed = checks.filter((c) => !c.pass).length;
  writeFileSync(`${OUT}/verify-document-guard-results.json`, JSON.stringify({
    venueId, passed, failed, checks, at: new Date().toISOString(),
  }, null, 2));
  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

main().catch((e) => { console.error(e); process.exit(1); });
