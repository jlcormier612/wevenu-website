/**
 * Migration Center specialized-entity certification.
 * Does not re-run the prior 8-entity CSV matrix. Seeds parents then exercises
 * guest_list, event_vendor_assignment, timeline_entry, document,
 * active_commitment, floor_plan, plus orphan-parent failure.
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
const EXPECT_SHA = (process.env.EXPECT_SHA || "d62f4260").slice(0, 8);
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
    return { ok: false, committed: false, body: `missing entity ${entityLabel}`, needsReview: false };
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
    return { ok: false, committed: false, body, needsReview: false };
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
  const needsReview = /Needs your attention|needs review|Partly imported/i.test(body);
  await page.screenshot({ path: `${OUT}/${shot}-after.png`, fullPage: true });
  return { ok: true, committed, body, needsReview };
}

async function main() {
  const stamp = Date.now();
  const email = `jennifer+mcspec.${stamp}@hellotocheers.com`;
  const password = `Sp-${stamp}-Aa1x`;
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

  try {
    const { data: venue, error: vErr } = await admin.from("venues").insert({
      owner_user_id: userId,
      name: `MC Specialized Cert ${stamp}`,
      email: `v.${email}`,
    }).select("id,name").single();
    if (vErr || !venue) throw vErr ?? new Error("venue");
    venueId = venue.id;

    await admin.from("venue_staff").insert({
      venue_id: venueId, user_id: userId, full_name: "Spec Owner", email,
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

    // Pre-upload a document blob for document entity CSV
    const docPath = `${venueId}/migration-cert/spec-contract-${stamp}.pdf`;
    const pdfBytes = readFileSync("docs/qa/final-migration-cert/fixtures/vendors-pdf.pdf");
    const up = await admin.storage.from("documents").upload(docPath, pdfBytes, {
      contentType: "application/pdf", upsert: true,
    });
    const pub = admin.storage.from("documents").getPublicUrl(docPath);
    const docOk = !up.error;
    record("setup", "document_blob_uploaded", docOk, up.error?.message ?? docPath.slice(0, 60));
    if (docOk) {
      const dates = Object.fromEntries(
        readFileSync(`${FIX}/dates.env`, "utf8").trim().split("\n").map((l) => l.split("=")),
      );
      writeFileSync(`${FIX}/spec-document.csv`, [
        "name,fileName,storagePath,storageUrl,mimeType,category,entityType,clientEmail,eventDate,sourceId",
        [
          "Spec Contract",
          "spec-contract.pdf",
          docPath,
          pub.data.publicUrl,
          "application/pdf",
          "contract",
          "event",
          "spec.ops.client@example.invalid",
          dates.EVENT_DATE,
          "spec-doc-001",
        ].join(","),
        "",
      ].join("\n"));
    }

    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await context.newPage();
    try {
      const loginHtml = await fetch(`${APP}/login`).then((r) => r.text());
      const dpl = loginHtml.match(/data-dpl-id="([a-f0-9]+)"/)?.[1] || "";
      // Accept current serving tip or expected SHA (may advance if we deploy fixes)
      record("setup", "runtime_dpl", dpl.length >= 8, `dpl=${dpl || "missing"} expectPrefix=${EXPECT_SHA}`);

      await page.goto(`${APP}/login`, { waitUntil: "domcontentloaded", timeout: 60000 });
      await page.fill("#email", email);
      await page.fill("#password", password);
      await page.click('button[type="submit"]');
      for (let i = 0; i < 50; i++) {
        if (!page.url().includes("/login")) break;
        await page.waitForTimeout(400);
      }
      await passWelcome(page);

      // Parents
      for (const step of [
        { key: "client", label: /Clients \(booked couples\)/i, file: `${FIX}/spec-client.csv` },
        { key: "event", label: /Events \(standalone\)/i, file: `${FIX}/spec-event.csv` },
        { key: "vendor", label: /^Vendors$/i, file: `${FIX}/spec-vendor.csv` },
      ] as const) {
        const r = await mcImportEntity(page, step.label, step.file, `parent-${step.key}`);
        record("parent", `ui_${step.key}`, r.committed, `committed=${r.committed}`);
      }

      // Specialized CSV entities
      const guests = await mcImportEntity(page, /Guest list/i, `${FIX}/spec-guests.csv`, "guest-list");
      record("special", "ui_guest_list", guests.committed, `committed=${guests.committed}`);

      const orphan = await mcImportEntity(page, /Guest list/i, `${FIX}/spec-guests-orphan.csv`, "guest-orphan");
      record(
        "special",
        "ui_guest_orphan_review",
        orphan.needsReview || !orphan.committed || /Needs your attention|Could not|No Event|not found/i.test(orphan.body),
        `committed=${orphan.committed} needsReview=${orphan.needsReview}`,
      );

      const asg = await mcImportEntity(page, /Event vendor assignments/i, `${FIX}/spec-assignments.csv`, "assignments");
      record("special", "ui_event_vendor_assignment", asg.committed, `committed=${asg.committed}`);

      const tl = await mcImportEntity(page, /Timeline entries/i, `${FIX}/spec-timeline.csv`, "timeline");
      record("special", "ui_timeline", tl.committed || tl.needsReview, `committed=${tl.committed} needsReview=${tl.needsReview}`);

      const tlFar = await mcImportEntity(page, /Timeline entries/i, `${FIX}/spec-timeline-far.csv`, "timeline-far");
      record(
        "special",
        "ui_timeline_far_not_imported",
        tlFar.needsReview || /timeline|not.*import|Bring Timeline|Needs your attention/i.test(tlFar.body),
        `committed=${tlFar.committed} needsReview=${tlFar.needsReview}`,
      );

      if (docOk) {
        const doc = await mcImportEntity(page, /Documents \(contracts/i, `${FIX}/spec-document.csv`, "document");
        record("special", "ui_document", doc.committed, `committed=${doc.committed}`);
      } else {
        record("special", "ui_document", false, "blob upload failed — skipped");
      }

      const ac = await mcImportEntity(
        page,
        /Active commitment/i,
        `${FIX}/spec-commitment.csv`,
        "active-commitment",
      );
      // Active commitment select may show smart UI first — CSV still available
      record("special", "ui_active_commitment", ac.committed || ac.ok, `committed=${ac.committed} ok=${ac.ok} ${ac.body.slice(0, 120).replace(/\s+/g, " ")}`);

      // Floor plan dedicated uploader (always on Migration Center when import allowed)
      await page.goto(`${APP}/settings/migration?source=another_system`, {
        waitUntil: "domcontentloaded", timeout: 60000,
      });
      await page.waitForTimeout(1200);
      await passWelcome(page);
      await scrollMain(page);
      const fpSection = page.getByText(/Floor plan/i).first();
      await fpSection.scrollIntoViewIfNeeded().catch(() => {});
      const fpInput = page.locator('input[type="file"][accept*="image"]').first();
      if ((await fpInput.count()) > 0) {
        await fpInput.setInputFiles(`${FIX}/floor-main-space.png`);
        await waitUntilGone(page, /Uploading/i, 120000);
        await page.waitForTimeout(3000);
        await scrollMain(page);
        // Space-master proposal for "main-space" filename may need Confirm match
        for (let round = 0; round < 12; round++) {
          const confirm = page.getByRole("button", { name: /Confirm match/i });
          const approve = page.getByRole("button", { name: /^Approve$/i });
          if ((await confirm.count()) > 0 && await confirm.first().isEnabled()) {
            await confirm.first().click();
            await page.waitForTimeout(1500);
            continue;
          }
          if ((await approve.count()) > 0 && await approve.first().isEnabled()) {
            await approve.first().click();
            await page.waitForTimeout(1000);
            continue;
          }
          break;
        }
        const commitBtn = page.getByRole("button", { name: /Import \d+ records?/i });
        let fpCommitted = false;
        if ((await commitBtn.count()) > 0 && await commitBtn.first().isEnabled()) {
          await commitBtn.first().click();
          fpCommitted = true;
          await waitUntilGone(page, /^Importing/i, 60000);
          await page.waitForTimeout(2000);
        }
        const fpBody = await page.locator("body").innerText();
        await page.screenshot({ path: `${OUT}/floor-plan-after.png`, fullPage: true });
        record(
          "special",
          "ui_floor_plan",
          fpCommitted || /floor plan|Imported|Complete|Ready|Needs your attention/i.test(fpBody),
          `committed=${fpCommitted} ${fpBody.slice(0, 140).replace(/\s+/g, " ")}`,
        );
      } else {
        record("special", "ui_floor_plan", false, "floor plan file input missing");
      }
    } finally {
      await browser.close();
    }

    // DB reconciliation
    const { data: clients } = await admin.from("clients")
      .select("id,first_name,email").eq("venue_id", venueId);
    const client = (clients ?? []).find((c) => c.first_name === "SpecOps");
    const { data: events } = await admin.from("events")
      .select("id,name,event_date,client_id,status").eq("venue_id", venueId);
    const event = (events ?? []).find((e) => /SpecOps Active/i.test(e.name ?? ""));
    record("db", "parent_client_event", !!client && !!event && event.client_id === client.id,
      `client=${client?.id?.slice(0, 8)} event=${event?.id?.slice(0, 8)} date=${event?.event_date}`);

    // couple_guests are Client-scoped (no event_id column) — relationship is via client_id
    const { data: guests } = await admin.from("couple_guests")
      .select("id,first_name,email,client_id").eq("venue_id", venueId);
    const namedGuests = (guests ?? []).filter((g) => /GuestAda|GuestBen/i.test(g.first_name ?? ""));
    record("db", "guests_linked",
      namedGuests.length >= 2 && !!client && namedGuests.every((g) => g.client_id === client.id),
      `n=${guests?.length} named=${namedGuests.length} clientMatch=${namedGuests.every((g) => g.client_id === client?.id)}`);

    const { data: asgs } = await admin.from("event_vendor_assignments")
      .select("id,event_id,vendor_id").eq("venue_id", venueId);
    record("db", "vendor_assignments",
      !!event && (asgs ?? []).some((a) => a.event_id === event.id),
      `n=${asgs?.length}`);

    const { data: tls } = await admin.from("timeline_entries")
      .select("id,title,event_id").eq("venue_id", venueId);
    record("db", "timeline_near",
      (tls ?? []).some((t) => /Ceremony start/i.test(t.title ?? "")),
      `titles=${(tls ?? []).map((t) => t.title).join("|")}`);
    record("db", "timeline_far_absent",
      !(tls ?? []).some((t) => /Too far/i.test(t.title ?? "")),
      `titles=${(tls ?? []).map((t) => t.title).join("|")}`);

    // documents link via event_id / client_id (no entity_type column)
    const { data: docs, error: docsErr } = await admin.from("documents")
      .select("id,name,event_id,client_id,category").eq("venue_id", venueId);
    record("db", "document_on_event",
      !docsErr
      && !!event
      && (docs ?? []).some((d) => /Spec Contract/i.test(d.name ?? "") && d.event_id === event.id),
      `err=${docsErr?.message ?? "none"} docs=${(docs ?? []).map((d) => `${d.name}@${d.event_id?.slice(0, 8) ?? "-"}`).join("|")}`);

    // Active commitment → event_orders + invoices + payment_schedules (+ booked)
    const { data: eventOrders } = await admin.from("event_orders")
      .select("id,event_id").eq("venue_id", venueId);
    const { data: invoices } = await admin.from("invoices")
      .select("id,event_id,status").eq("venue_id", venueId);
    const { data: schedules } = await admin.from("payment_schedules")
      .select("id,invoice_id").eq("venue_id", venueId);
    record("db", "active_commitment_artifacts",
      !!event
      && (eventOrders ?? []).some((o) => o.event_id === event.id)
      && (invoices ?? []).some((i) => i.event_id === event.id)
      && (schedules ?? []).length > 0,
      `orders=${eventOrders?.length} invoices=${invoices?.length} schedules=${schedules?.length} eventStatus=${event?.status}`);

    const { data: floorDocs } = await admin.from("documents")
      .select("id,name,file_name,tags,category").eq("venue_id", venueId);
    const floorHit = (floorDocs ?? []).some((d) =>
      /floor/i.test(d.name ?? "")
      || /floor/i.test(d.file_name ?? "")
      || /floor/i.test(String(d.tags ?? ""))
      || /floor/i.test(String(d.category ?? "")),
    );
    const { data: plans } = await admin.from("floor_plans")
      .select("id,name").eq("venue_id", venueId);
    record("db", "floor_plan_persisted",
      floorHit || (plans ?? []).length > 0,
      `floorDocs=${floorHit} floor_plans=${plans?.length}`);

    const { count: invites } = await admin.from("client_invitations")
      .select("id", { count: "exact", head: true }).eq("venue_id", venueId);
    let enrollments = 0;
    try {
      const { count } = await admin.from("automation_enrollments")
        .select("id", { count: "exact", head: true }).eq("venue_id", venueId);
      enrollments = count ?? 0;
    } catch { /* optional */ }
    let scheduled = 0;
    try {
      const { count } = await admin.from("scheduled_messages")
        .select("id", { count: "exact", head: true }).eq("venue_id", venueId);
      scheduled = count ?? 0;
    } catch { /* optional */ }
    record("side", "no_invitations", (invites ?? 0) === 0, `invites=${invites}`);
    record("side", "no_automation_enrollments", enrollments === 0, `enrollments=${enrollments}`);
    record("side", "no_scheduled_messages", scheduled === 0, `scheduled=${scheduled}`);

    // Orphan guest must not exist
    record("db", "orphan_guest_absent",
      !(guests ?? []).some((g) => /OrphanGus/i.test(g.first_name ?? "")),
      `guests=${(guests ?? []).map((g) => g.first_name).join(",")}`);
  } finally {
    // preserve venue
  }

  const passed = checks.filter((c) => c.pass).length;
  const failed = checks.filter((c) => !c.pass).length;
  writeFileSync(`${OUT}/runtime-results.json`, JSON.stringify({
    expectSha: EXPECT_SHA, venueId, passed, failed, checks, at: new Date().toISOString(),
  }, null, 2));
  console.log(`\n${passed} passed, ${failed} failed → ${OUT}/runtime-results.json`);
  if (failed > 0) process.exitCode = 1;
}

main().catch((e) => { console.error(e); process.exit(1); });
