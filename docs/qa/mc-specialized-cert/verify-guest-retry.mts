/**
 * Post-deploy guest_list re-cert on a fresh disposable venue.
 * Also re-checks document_on_event query shape.
 */
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

config({ path: ".env.local", quiet: true });
process.env.NEXT_PUBLIC_APP_URL = "https://app.sandbox.hellotocheers.com";

const require = createRequire(
  "/Users/jensmac/Developer/wevenu-website/marketing/package.json",
);
const { chromium } = require("playwright");

const APP = "https://app.sandbox.hellotocheers.com";
const OUT = "docs/qa/mc-specialized-cert";
const FIX = `${OUT}/fixtures`;
const EXPECT_SHA = (process.env.EXPECT_SHA || "df26942e").slice(0, 8);
const SANDBOX_REF = "wvpsldwwjqdannqasrdf";

if (!process.env.NEXT_PUBLIC_SUPABASE_URL?.includes(SANDBOX_REF)) {
  throw new Error("Refusing to run — not Sandbox Supabase project");
}
mkdirSync(OUT, { recursive: true });

type Check = { group: string; name: string; pass: boolean; detail: string };
const checks: Check[] = [];
function record(group: string, name: string, pass: boolean, detail: string) {
  checks.push({ group, name, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"} [${group}] ${name} — ${detail.slice(0, 400)}`);
}

async function passWelcome(page: any) {
  for (let a = 0; a < 5; a++) {
    const onWelcome = page.url().includes("/welcome");
    const visible = await page.locator('[data-welcome-experience="true"]').isVisible().catch(() => false);
    if (!onWelcome && !visible) return;
    await page.locator("#welcome-experience-agree").check({ force: true }).catch(() => {});
    const boxes = page.locator("input[type='checkbox']");
    const n = await boxes.count();
    for (let i = 0; i < n; i++) await boxes.nth(i).check({ force: true }).catch(() => {});
    await page.waitForTimeout(400);
    const cont = page.getByRole("button", { name: /^Continue$/i });
    if ((await cont.count()) > 0 && await cont.first().isEnabled()) await cont.first().click();
    for (let i = 0; i < 20; i++) {
      if (!page.url().includes("/welcome")) return;
      await page.waitForTimeout(400);
    }
  }
}

async function scrollMain(page: any) {
  await page.evaluate(() => {
    const main = document.querySelector("main") as HTMLElement | null;
    if (main) main.scrollTop = main.scrollHeight;
  }).catch(() => {});
}

async function waitUntilGone(page: any, nameRe: RegExp, maxMs = 90000) {
  const start = Date.now();
  while (Date.now() - start < maxMs) {
    const btn = page.getByRole("button", { name: nameRe });
    if ((await btn.count()) === 0) return true;
    const txt = await btn.first().innerText().catch(() => "");
    if (!nameRe.test(txt)) return true;
    await page.waitForTimeout(500);
  }
  return false;
}

async function mcImportEntity(page: any, entityLabel: RegExp, csvPath: string, shot: string) {
  await page.goto(`${APP}/settings/migration?source=another_system`, {
    waitUntil: "domcontentloaded", timeout: 60000,
  });
  await page.waitForTimeout(1200);
  await passWelcome(page);
  await scrollMain(page);
  const another = page.getByText("Another system", { exact: true });
  if ((await another.count()) > 0) await another.first().click();
  await page.waitForTimeout(300);

  await page.locator("button[role='combobox']").first().click();
  await page.waitForTimeout(350);
  const entityOpt = page.getByRole("option", { name: entityLabel });
  if ((await entityOpt.count()) === 0) {
    await page.keyboard.press("Escape");
    return { ok: false, committed: false, body: `missing entity ${entityLabel}` };
  }
  await entityOpt.first().click();
  await page.waitForTimeout(400);

  await page.locator('input[type="file"][accept=".csv"]').setInputFiles(csvPath);
  await page.waitForTimeout(1800);
  await scrollMain(page);

  const bring = page.getByRole("button", { name: /Bring in \d+ row/i });
  if ((await bring.count()) === 0) {
    const body = await page.locator("body").innerText();
    await page.screenshot({ path: `${OUT}/${shot}-no-bring.png`, fullPage: true });
    return { ok: false, committed: false, body };
  }
  await bring.first().click();
  await waitUntilGone(page, /^Working/i, 90000);
  await page.waitForTimeout(1200);
  await scrollMain(page);

  for (let round = 0; round < 12; round++) {
    const hist = page.getByRole("button", { name: /Import as historical record/i });
    const approve = page.getByRole("button", { name: /^Approve$/i });
    if ((await hist.count()) > 0) { await hist.first().click(); await page.waitForTimeout(1000); continue; }
    if ((await approve.count()) > 0) { await approve.first().click(); await page.waitForTimeout(1000); continue; }
    break;
  }

  let committed = false;
  for (let attempt = 0; attempt < 10; attempt++) {
    const commitBtn = page.getByRole("button", { name: /Import \d+ records?/i });
    if ((await commitBtn.count()) > 0 && await commitBtn.first().isEnabled()) {
      await commitBtn.first().click();
      committed = true;
      await waitUntilGone(page, /^Importing/i, 60000);
      await page.waitForTimeout(2000);
      break;
    }
    await page.waitForTimeout(700);
  }

  const body = await page.locator("body").innerText();
  await page.screenshot({ path: `${OUT}/${shot}-after.png`, fullPage: true });
  return { ok: true, committed, body };
}

async function main() {
  const stamp = Date.now();
  const email = `jennifer+mcguest.${stamp}@hellotocheers.com`;
  const password = `Gg-${stamp}-Aa1x`;
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );

  const { data: created, error: cErr } = await admin.auth.admin.createUser({
    email, password, email_confirm: true,
  });
  if (cErr || !created.user) throw cErr ?? new Error("createUser");
  const userId = created.user.id;
  let venueId = "";

  const { data: venue, error: vErr } = await admin.from("venues").insert({
    owner_user_id: userId,
    name: `MC Guest Retry ${stamp}`,
    email: `v.${email}`,
  }).select("id,name").single();
  if (vErr || !venue) throw vErr ?? new Error("venue");
  venueId = venue.id;

  await admin.from("venue_staff").insert({
    venue_id: venueId, user_id: userId, full_name: "Guest Retry Owner", email,
    role: "owner", is_owner: true, is_active: true,
    accepted_at: new Date().toISOString(),
    access_title: "administrator", title_basis: "administrator",
    capability_overrides: {}, owner_invite_pending: false,
  });
  await admin.from("venue_staff_active_context").upsert({
    user_id: userId, active_venue_id: venueId, updated_at: new Date().toISOString(),
  });
  await admin.from("venue_onboarding_intake").upsert({
    venue_id: venueId, path: "self_setup", venue_name: venue.name,
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
  record("setup", "fixture_venue", true, venueId.slice(0, 8));

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  try {
    const loginHtml = await fetch(`${APP}/login`).then((r) => r.text());
    const dpl = loginHtml.match(/data-dpl-id="([a-f0-9]+)"/)?.[1] || "";
    record("setup", "runtime_dpl", dpl.startsWith(EXPECT_SHA), `dpl=${dpl || "missing"} expectPrefix=${EXPECT_SHA}`);

    await page.goto(`${APP}/login`, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.fill("#email", email);
    await page.fill("#password", password);
    await page.click('button[type="submit"]');
    for (let i = 0; i < 50; i++) {
      if (!page.url().includes("/login")) break;
      await page.waitForTimeout(400);
    }
    await passWelcome(page);

    for (const step of [
      { key: "client", label: /Clients \(booked couples\)/i, file: `${FIX}/spec-client.csv` },
      { key: "event", label: /Events \(standalone\)/i, file: `${FIX}/spec-event.csv` },
    ] as const) {
      const r = await mcImportEntity(page, step.label, step.file, `guest-retry-parent-${step.key}`);
      record("parent", `ui_${step.key}`, r.committed, `committed=${r.committed}`);
    }

    const guests = await mcImportEntity(page, /Guest list/i, `${FIX}/spec-guests.csv`, "guest-retry-list");
    record("special", "ui_guest_list", guests.committed, `committed=${guests.committed}`);

    const orphan = await mcImportEntity(page, /Guest list/i, `${FIX}/spec-guests-orphan.csv`, "guest-retry-orphan");
    record(
      "special",
      "ui_guest_orphan_review",
      /Needs your attention|Could not|No client|not found|Partly/i.test(orphan.body) || !orphan.committed,
      orphan.body.slice(0, 160).replace(/\s+/g, " "),
    );
  } finally {
    await browser.close();
  }

  const { data: clients } = await admin.from("clients")
    .select("id,first_name,email").eq("venue_id", venueId);
  const client = (clients ?? []).find((c) => c.first_name === "SpecOps");
  const { data: guests } = await admin.from("couple_guests")
    .select("id,first_name,email,client_id,notes").eq("venue_id", venueId);
  const named = (guests ?? []).filter((g) => /GuestAda|GuestBen/i.test(g.first_name ?? ""));
  record("db", "guests_linked",
    named.length >= 2 && !!client && named.every((g) => g.client_id === client.id),
    `n=${guests?.length} named=${named.length} names=${named.map((g) => g.first_name).join(",")}`);
  record("db", "orphan_guest_absent",
    !(guests ?? []).some((g) => /OrphanGus/i.test(g.first_name ?? "")),
    `names=${(guests ?? []).map((g) => g.first_name).join(",")}`);

  const { count: invites } = await admin.from("client_invitations")
    .select("id", { count: "exact", head: true }).eq("venue_id", venueId);
  record("side", "no_invitations", (invites ?? 0) === 0, `invites=${invites}`);

  // Reconcile prior venue document false-fail (query shape)
  const priorVenue = "47d34f27-e2b5-45ea-89f6-6f442d02dc2b";
  const { data: priorDocs } = await admin.from("documents")
    .select("id,name,event_id").eq("venue_id", priorVenue);
  const priorEventId = "031aaa3b-dfb4-455e-81de-a767a2234c8e";
  record("db", "prior_document_on_event_reconciled",
    (priorDocs ?? []).some((d) => /Spec Contract/i.test(d.name ?? "") && d.event_id === priorEventId),
    `docs=${(priorDocs ?? []).map((d) => d.name).join("|")}`);

  const passed = checks.filter((c) => c.pass).length;
  const failed = checks.filter((c) => !c.pass).length;
  writeFileSync(`${OUT}/guest-retry-results.json`, JSON.stringify({
    expectSha: EXPECT_SHA, venueId, passed, failed, checks, at: new Date().toISOString(),
  }, null, 2));
  console.log(`\n${passed} passed, ${failed} failed → ${OUT}/guest-retry-results.json`);
  if (failed > 0) process.exit(1);
}

main().catch((e) => { console.error(e); process.exit(1); });
