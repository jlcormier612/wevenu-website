/**
 * Merge Lead discovery — search → select → preview → cancel / confirm.
 * Controlled Fancy fixtures; asserts persisted state. Sandbox only.
 */
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

config({ path: ".env.local", quiet: true });
const require = createRequire("/Users/jensmac/Developer/wevenu-website/marketing/package.json");
const { chromium } = require("playwright");
const ssrUtils = require(
  "/Users/jensmac/Developer/wevenu-website/node_modules/@supabase/ssr/dist/main/utils/index.js",
);

const APP = "https://app.sandbox.hellotocheers.com";
const FANCY = "a415ac52-cd74-42a6-8df7-7a8f6e71d080";
const EMAIL = "jennifer@hellotocheers.com";
const OUT = "docs/qa/merge-lead-discovery";
mkdirSync(`${OUT}/shots`, { recursive: true });
const EXPECTED = (process.env.EXPECTED_SHA ?? "").slice(0, 40);

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
if (!url.includes("wvpsldwwjqdannqasrdf")) throw new Error("not sandbox");
const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false },
});
const anon = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
  auth: { persistSession: false },
});

type Check = { name: string; pass: boolean; detail: string };
const checks: Check[] = [];
function record(name: string, pass: boolean, detail: string) {
  checks.push({ name, pass, detail: String(detail).slice(0, 2000) });
  console.log(`${pass ? "PASS" : "FAIL"} ${name} — ${String(detail).slice(0, 500)}`);
}

async function servingImage(): Promise<string> {
  const { execSync } = await import("node:child_process");
  const taskArn = execSync(
    "aws ecs list-tasks --cluster htc-sandbox --service-name htc-sandbox-venue-app --desired-status RUNNING --query 'taskArns[0]' --output text",
    { encoding: "utf8" },
  ).trim();
  return execSync(
    `aws ecs describe-tasks --cluster htc-sandbox --tasks ${taskArn} --query 'tasks[0].containers[0].image' --output text`,
    { encoding: "utf8" },
  ).trim();
}

async function servingDigest(): Promise<string> {
  const { execSync } = await import("node:child_process");
  const taskArn = execSync(
    "aws ecs list-tasks --cluster htc-sandbox --service-name htc-sandbox-venue-app --desired-status RUNNING --query 'taskArns[0]' --output text",
    { encoding: "utf8" },
  ).trim();
  return execSync(
    `aws ecs describe-tasks --cluster htc-sandbox --tasks ${taskArn} --query 'tasks[0].containers[0].imageDigest' --output text`,
    { encoding: "utf8" },
  ).trim();
}

async function authCookies() {
  const { data: link } = await admin.auth.admin.generateLink({ type: "magiclink", email: EMAIL });
  const { data: otp, error } = await anon.auth.verifyOtp({
    type: "email",
    token_hash: link!.properties!.hashed_token!,
  });
  if (error || !otp?.session) throw error ?? new Error("session");
  const cookieName = "sb-wvpsldwwjqdannqasrdf-auth-token";
  const encoded = "base64-" + ssrUtils.stringToBase64URL(JSON.stringify(otp.session));
  return [
    ...ssrUtils.createChunks(cookieName, encoded).map((c: { name: string; value: string }) => ({
      name: c.name,
      value: c.value,
      domain: "app.sandbox.hellotocheers.com",
      path: "/",
      httpOnly: false,
      secure: true,
      sameSite: "Lax" as const,
    })),
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

async function insertLead(row: Record<string, unknown>) {
  const { data, error } = await admin
    .from("leads")
    .insert({
      venue_id: FANCY,
      sales_stage: "new_inquiry",
      exclude_from_business_reporting: true,
      ...row,
    })
    .select("id, created_at, updated_at, email, phone, first_name, last_name, merged_into_lead_id")
    .single();
  if (error || !data) throw new Error(error?.message ?? "lead insert failed");
  return data;
}

async function main() {
  const image = await servingImage();
  const digest = await servingDigest();
  const shaFromImage = image.split(":").pop() ?? "";
  record(
    "serving-sha",
    !EXPECTED || shaFromImage.startsWith(EXPECTED.slice(0, 12)),
    `expected=${EXPECTED || "(any)"} ecs=${image}`,
  );
  record("serving-digest", digest.startsWith("sha256:"), digest);

  const stamp = Date.now();
  const cancelEmail = `merge-cancel.${stamp}@hellotocheers-test.invalid`;
  const mergeEmail = `merge-ok.${stamp}@hellotocheers-test.invalid`;
  const phoneToken = `555${String(stamp).slice(-7)}`;
  const uniqueLast = `Discovery${stamp}`;

  // Authoritative space + staff labels for FK preview assertions
  const { data: spaces } = await admin
    .from("venue_spaces")
    .select("id, name")
    .eq("venue_id", FANCY)
    .order("name")
    .limit(2);
  const { data: staffRows } = await admin
    .from("venue_staff")
    .select("id, full_name")
    .eq("venue_id", FANCY)
    .eq("is_active", true)
    .order("full_name")
    .limit(2);
  if (!spaces?.[0]?.id || !spaces[0].name?.trim()) {
    throw new Error("need at least one named venue_spaces row for FK label proof");
  }
  if (!staffRows?.[0]?.id || !staffRows[0].full_name?.trim()
    || !staffRows?.[1]?.id || !staffRows[1].full_name?.trim()) {
    throw new Error("need at least two named active venue_staff rows for FK label proof");
  }
  const spaceId = spaces[0].id as string;
  const spaceName = String(spaces[0].name).trim();
  const staffPrimaryId = staffRows[0].id as string;
  const staffPrimaryName = String(staffRows[0].full_name).trim();
  const staffSecondaryId = staffRows[1].id as string;
  const staffSecondaryName = String(staffRows[1].full_name).trim();

  // Cancel pair — preview must not mutate
  // Late has space (fill into empty early) + conflicting staff vs early.
  const cancelEarly = await insertLead({
    first_name: "CancelEarly",
    last_name: uniqueLast,
    email: cancelEmail,
    phone: null,
    partner_first_name: "Pat",
    partner_last_name: "Early",
    partner_email: `pat.early.${stamp}@hellotocheers-test.invalid`,
    event_date: "2027-05-01",
    inquiry_message: `cancel-early ${stamp}`,
    assigned_staff_id: staffPrimaryId,
  });
  await new Promise((r) => setTimeout(r, 60));
  const cancelLate = await insertLead({
    first_name: "CancelLate",
    last_name: uniqueLast,
    email: `alt-${cancelEmail}`,
    phone: phoneToken,
    partner_first_name: "Pat",
    partner_last_name: "Late",
    event_date: "2027-06-01",
    inquiry_message: `cancel-late ${stamp}`,
    planned_event_space_id: spaceId,
    assigned_staff_id: staffSecondaryId,
  });

  // Confirm pair — default direction (earliest survives).
  // Mixed phone storage shapes (digits vs formatted) reproduce the preview defect.
  const phoneDigitsStored = "6984238542";
  const phoneFormattedStored = "(789) 543-6597";
  const phoneDigitsDisplay = "(698) 423-8542";
  const mergeEarly = await insertLead({
    first_name: "MergeEarly",
    last_name: `Ok${stamp}`,
    email: mergeEmail,
    phone: phoneDigitsStored,
    partner_first_name: "Sam",
    partner_last_name: "Partner",
    partner_email: `sam.partner.${stamp}@hellotocheers-test.invalid`,
    event_date: "2027-08-15",
    inquiry_message: `merge-early ${stamp}`,
    assigned_staff_id: staffPrimaryId,
  });
  await new Promise((r) => setTimeout(r, 60));
  const mergeLate = await insertLead({
    first_name: "MergeLate",
    last_name: `Ok${stamp}`,
    email: mergeEmail,
    phone: phoneFormattedStored,
    inquiry_message: `merge-late ${stamp}`,
    planned_event_space_id: spaceId,
    assigned_staff_id: staffSecondaryId,
  });

  // Reverse pair — later lead chosen as survivor
  const revEmail = `merge-rev.${stamp}@hellotocheers-test.invalid`;
  const revPhone = `666${String(stamp).slice(-7)}`;
  const revEarly = await insertLead({
    first_name: "RevEarly",
    last_name: `Rev${stamp}`,
    email: revEmail,
    phone: null,
    inquiry_message: `rev-early ${stamp}`,
    assigned_staff_id: staffPrimaryId,
  });
  await new Promise((r) => setTimeout(r, 60));
  const revLate = await insertLead({
    first_name: "RevLate",
    last_name: `Rev${stamp}`,
    email: revEmail,
    phone: revPhone,
    inquiry_message: `rev-late ${stamp}`,
    planned_event_space_id: spaceId,
    assigned_staff_id: staffSecondaryId,
  });

  // Decoy for ambiguous last-name search on cancel pair
  const decoy = await insertLead({
    first_name: "Decoy",
    last_name: uniqueLast,
    email: `decoy.${stamp}@hellotocheers-test.invalid`,
    phone: null,
    inquiry_message: `decoy ${stamp}`,
  });

  const { count: winCount } = await admin
    .from("tour_availability_windows")
    .select("id", { count: "exact", head: true })
    .eq("venue_id", FANCY);
  if ((winCount ?? 0) === 0) {
    await admin.from("tour_availability_windows").insert(
      [0, 1, 2, 3, 4, 5, 6].map((day_of_week) => ({
        venue_id: FANCY,
        day_of_week,
        start_time: "09:00",
        end_time: "17:00",
        sort_order: day_of_week,
      })),
    );
  }

  // Unique far-future day so reruns do not collide with prior fixture tours
  // (venue occupancy triggers reject overlapping slots).
  async function insertTour(opts: {
    leadId: string;
    contactName: string;
    contactEmail: string;
    dayOffset: number;
    status?: "scheduled" | "confirmed" | "completed" | "cancelled";
  }) {
    let lastErr = "";
    for (let attempt = 0; attempt < 12; attempt++) {
      const day = 1 + ((stamp + opts.dayOffset + attempt * 7) % 27);
      const hour = 10 + (attempt % 6);
      const iso = new Date(Date.UTC(2030, 2, day, hour, 0, 0)).toISOString();
      const { data, error } = await admin
        .from("tour_appointments")
        .insert({
          venue_id: FANCY,
          lead_id: opts.leadId,
          status: opts.status ?? "scheduled",
          scheduled_at: iso,
          duration_minutes: 60,
          contact_name: opts.contactName,
          contact_email: opts.contactEmail,
          origin: "scheduled",
        })
        .select("id, lead_id, status, scheduled_at")
        .single();
      if (data && !error) return { tour: data, iso };
      lastErr = error?.message ?? "no row";
    }
    throw new Error(`tour fixture failed: ${lastErr}`);
  }

  // Completed tours on cancel pair — prove keep-note (not a fake exclusive choice)
  const { tour: completedOnEarly } = await insertTour({
    leadId: cancelEarly.id,
    contactName: `CancelEarly ${uniqueLast}`,
    contactEmail: cancelEmail,
    dayOffset: 9,
    status: "completed",
  });
  const { tour: completedOnLate } = await insertTour({
    leadId: cancelLate.id,
    contactName: `CancelLate ${uniqueLast}`,
    contactEmail: `alt-${cancelEmail}`,
    dayOffset: 10,
    status: "completed",
  });

  const { tour, iso: tourIso } = await insertTour({
    leadId: mergeLate.id,
    contactName: `MergeLate Ok${stamp}`,
    contactEmail: mergeEmail,
    dayOffset: 0,
  });
  const { tour: revTour, iso: revTourIso } = await insertTour({
    leadId: revEarly.id,
    contactName: `RevEarly Rev${stamp}`,
    contactEmail: revEmail,
    dayOffset: 3,
  });
  record("fixtures", true,
    JSON.stringify({
      cancelEarly: cancelEarly.id,
      cancelLate: cancelLate.id,
      mergeEarly: mergeEarly.id,
      mergeLate: mergeLate.id,
      revEarly: revEarly.id,
      revLate: revLate.id,
      decoy: decoy.id,
      tour: tour.id,
      tourIso,
      revTour: revTour.id,
      revTourIso,
    }));

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await context.addCookies(await authCookies());
  const page = await context.newPage();

  try {
    // ——— Cancel path: search → select → preview → cancel ———
    await page.goto(`${APP}/leads/${cancelEarly.id}`, { waitUntil: "domcontentloaded", timeout: 90_000 });
    await page.waitForTimeout(2500);
    await page.getByTestId("merge-lead-open").click();
    const dlg = page.getByTestId("merge-lead-dialog");
    await dlg.waitFor({ state: "visible", timeout: 15_000 });
    record("dialog-search-first", await dlg.getByTestId("merge-find-duplicate").isVisible(), "find field");
    const dlgText0 = await dlg.innerText();
    record("dialog-no-uuid-ui",
      !/Paste lead ID|troubleshooting|Duplicate lead UUID/i.test(dlgText0)
      && (await dlg.getByTestId("merge-advanced-id-toggle").count()) === 0
      && (await dlg.getByTestId("merge-other-lead-id").count()) === 0,
      "no UUID troubleshooting controls");
    record("continue-disabled-before-preview",
      await dlg.getByTestId("merge-continue-to-confirm").isDisabled(),
      "continue gated until preview");

    // Search by last name → multiple candidates
    await dlg.getByTestId("merge-find-duplicate").fill(uniqueLast);
    await page.waitForTimeout(1200);
    const rows = dlg.getByTestId("merge-candidate-row");
    await rows.first().waitFor({ state: "visible", timeout: 15_000 });
    const rowCount = await rows.count();
    const rowIds: string[] = [];
    for (let i = 0; i < rowCount; i++) {
      rowIds.push((await rows.nth(i).getAttribute("data-lead-id")) ?? "");
    }
    record("search-by-name-multiple", rowCount >= 2, `count=${rowCount} ids=${rowIds.join(",")}`);
    record("current-lead-excluded", !rowIds.includes(cancelEarly.id), `ids=${rowIds.join(",")}`);
    record("search-includes-late", rowIds.includes(cancelLate.id), cancelLate.id);
    record("search-includes-decoy", rowIds.includes(decoy.id), decoy.id);
    record("ambiguous-hint", await dlg.getByTestId("merge-search-ambiguous").isVisible().catch(() => false), "hint");

    // Search by phone
    await dlg.getByTestId("merge-find-duplicate").fill(phoneToken);
    await page.waitForTimeout(1200);
    const phoneRows = dlg.getByTestId("merge-candidate-row");
    await phoneRows.first().waitFor({ state: "visible", timeout: 15_000 });
    const phoneIds: string[] = [];
    for (let i = 0; i < (await phoneRows.count()); i++) {
      phoneIds.push((await phoneRows.nth(i).getAttribute("data-lead-id")) ?? "");
    }
    record("search-by-phone", phoneIds.includes(cancelLate.id) && !phoneIds.includes(cancelEarly.id),
      phoneIds.join(","));

    // Search by email of late — select auto-loads preview
    await dlg.getByTestId("merge-find-duplicate").fill(`alt-${cancelEmail}`);
    await page.waitForTimeout(1200);
    const emailRow = dlg.locator(`[data-testid="merge-candidate-row"][data-lead-id="${cancelLate.id}"]`);
    await emailRow.waitFor({ state: "visible", timeout: 15_000 });
    record("search-by-email", await emailRow.isVisible(), cancelLate.id);

    await emailRow.click();
    await dlg.getByTestId("merge-preview-panel").waitFor({ state: "visible", timeout: 20_000 });
    record("select-shows-selected",
      /Selected/i.test(await emailRow.innerText()),
      "selected badge on row");
    record("auto-preview-after-select", await dlg.getByTestId("merge-preview-panel").isVisible(), "preview auto");
    await page.screenshot({ path: `${OUT}/shots/search-selected-1280.png`, fullPage: false });
    const previewText = await dlg.innerText();
    record("preview-survivor-earliest",
      /CancelEarly/i.test(previewText) && /Survives/i.test(previewText),
      "earliest default");
    record("preview-survivor-reason", await dlg.getByTestId("merge-survivor-reason").isVisible(), "reason");
    // Survivor selection always available (default earliest path)
    const survivorGroup = dlg.getByTestId("merge-survivor-radiogroup");
    record("survivor-radiogroup-visible", await survivorGroup.isVisible(), "always selectable");
    const earlySurvivorRadio = dlg.locator(
      `[data-testid="merge-survivor-radio"][data-lead-id="${cancelEarly.id}"]`,
    );
    const lateSurvivorRadio = dlg.locator(
      `[data-testid="merge-survivor-radio"][data-lead-id="${cancelLate.id}"]`,
    );
    record("survivor-options-both-leads",
      (await earlySurvivorRadio.count()) === 1 && (await lateSurvivorRadio.count()) === 1,
      "both lead radios");
    record("survivor-default-checked-earliest",
      await earlySurvivorRadio.isChecked(),
      "earliest radio checked");
    // Switch to later lead as survivor — preview must reorient (no DB mutation yet)
    await lateSurvivorRadio.click({ force: true });
    await page.waitForTimeout(1500);
    await dlg.getByTestId("merge-preview-panel").waitFor({ state: "visible", timeout: 20_000 });
    const afterOverride = await dlg.innerText();
    record("survivor-override-late-survives",
      (await dlg.getByTestId("merge-preview-survivor").getAttribute("data-lead-id")) === cancelLate.id
      && (await dlg.getByTestId("merge-preview-secondary").getAttribute("data-lead-id")) === cancelEarly.id
      && /You selected a survivor other than the earliest/i.test(afterOverride),
      "late is Survives");
    await page.screenshot({ path: `${OUT}/shots/survivor-override-1280.png`, fullPage: false });
    // Switch back to earliest — original direction restored
    await dlg.locator(`[data-testid="merge-survivor-radio"][data-lead-id="${cancelEarly.id}"]`)
      .click({ force: true });
    await page.waitForTimeout(1500);
    record("survivor-restore-earliest",
      (await dlg.getByTestId("merge-preview-survivor").getAttribute("data-lead-id")) === cancelEarly.id
      && (await dlg.getByTestId("merge-preview-secondary").getAttribute("data-lead-id")) === cancelLate.id,
      "earliest restored");
    // FK labels — names shown, raw UUIDs not exposed in customer-facing preview text
    const fillSpace = dlg.getByTestId("merge-fill-planned_event_space_id");
    const conflictStaff = dlg.getByTestId("merge-conflict-assigned_staff_id");
    const fillSpaceText = await fillSpace.innerText().catch(() => "");
    const staffText = await conflictStaff.innerText().catch(() => "");
    record(
      "preview-space-shows-name",
      fillSpaceText.includes(spaceName) && !fillSpaceText.includes(spaceId),
      fillSpaceText.slice(0, 240) || "missing fill row",
    );
    record(
      "preview-staff-shows-names",
      staffText.includes(staffPrimaryName)
        && staffText.includes(staffSecondaryName)
        && !staffText.includes(staffPrimaryId)
        && !staffText.includes(staffSecondaryId),
      staffText.slice(0, 240) || "missing staff conflict",
    );
    // Tour appointments: distinct completed rows — keep notes, not exclusive radios
    record("tour-policy-visible", await dlg.getByTestId("merge-tour-policy").isVisible(), "keep-both policy");
    const tourRows = dlg.getByTestId("merge-tour-row");
    record("tour-completed-rows", (await tourRows.count()) >= 2, `rows=${await tourRows.count()}`);
    const keepNotes = dlg.getByTestId("merge-tour-keep-note");
    record("tour-keep-notes-for-completed", (await keepNotes.count()) >= 2, `notes=${await keepNotes.count()}`);
    record("tour-no-cancel-on-completed",
      (await dlg.locator(`[data-testid="merge-tour-cancel"][data-tour-id="${completedOnEarly.id}"]`).count()) === 0
      && (await dlg.locator(`[data-testid="merge-tour-cancel"][data-tour-id="${completedOnLate.id}"]`).count()) === 0,
      "completed not cancellable");
    await page.screenshot({ path: `${OUT}/shots/preview-cancel-pair-1280.png`, fullPage: false });

    // Resolve conflicts before Continue (same gate as confirm path)
    {
      const radios = dlg.locator('input[type="radio"][name^="merge-field-"]');
      const n = await radios.count();
      const seen = new Set<string>();
      for (let i = 0; i < n; i++) {
        const radio = radios.nth(i);
        const name = await radio.getAttribute("name");
        if (!name || seen.has(name)) continue;
        seen.add(name);
        await radio.check({ force: true });
      }
      record("cancel-path-conflicts-resolved", true, `groups=${seen.size}`);
    }

    // Continue → final confirm → Cancel keep both (no mutation)
    await dlg.getByTestId("merge-continue-to-confirm").click();
    await dlg.getByTestId("merge-final-confirm").waitFor({ state: "visible", timeout: 10_000 });
    record("final-confirm-appears", await dlg.getByTestId("merge-final-confirm").isVisible(), "irreversible step");
    await page.screenshot({ path: `${OUT}/shots/final-confirm-cancel-path-1280.png`, fullPage: false });
    await dlg.getByTestId("merge-final-cancel").click();
    await page.waitForTimeout(500);
    record("final-cancel-keeps-preview",
      await dlg.getByTestId("merge-preview-panel").isVisible()
      && (await dlg.getByTestId("merge-final-confirm").count()) === 0,
      "back to preview");

    // Close dialog — no mutation
    await dlg.getByRole("button", { name: "Cancel", exact: true }).click();
    await page.waitForTimeout(800);
    const { data: cEarlyAfter } = await admin.from("leads")
      .select("id, merged_into_lead_id, updated_at, email, phone")
      .eq("id", cancelEarly.id).single();
    const { data: cLateAfter } = await admin.from("leads")
      .select("id, merged_into_lead_id, updated_at, email, phone")
      .eq("id", cancelLate.id).single();
    record("cancel-leaves-early-unmerged", cEarlyAfter?.merged_into_lead_id == null,
      JSON.stringify(cEarlyAfter));
    record("cancel-leaves-late-unmerged", cLateAfter?.merged_into_lead_id == null,
      JSON.stringify(cLateAfter));
    record("cancel-identity-unchanged",
      cEarlyAfter?.email === cancelEarly.email
      && cLateAfter?.email === cancelLate.email
      && cLateAfter?.phone === cancelLate.phone
      && cEarlyAfter?.merged_into_lead_id == null
      && cLateAfter?.merged_into_lead_id == null,
      JSON.stringify({ early: cEarlyAfter, late: cLateAfter }));
    const { data: completedEarlyAfter } = await admin.from("tour_appointments")
      .select("id, lead_id, status").eq("id", completedOnEarly.id).single();
    const { data: completedLateAfter } = await admin.from("tour_appointments")
      .select("id, lead_id, status").eq("id", completedOnLate.id).single();
    record("cancel-leaves-completed-tours",
      completedEarlyAfter?.lead_id === cancelEarly.id
      && completedEarlyAfter?.status === "completed"
      && completedLateAfter?.lead_id === cancelLate.id
      && completedLateAfter?.status === "completed",
      JSON.stringify({ early: completedEarlyAfter, late: completedLateAfter }));

    // ——— Confirm path ———
    await page.goto(`${APP}/leads/${mergeLate.id}`, { waitUntil: "domcontentloaded", timeout: 90_000 });
    await page.waitForTimeout(2500);
    await page.getByTestId("merge-lead-open").click();
    const dlg2 = page.getByTestId("merge-lead-dialog");
    await dlg2.waitFor({ state: "visible" });
    await dlg2.getByTestId("merge-find-duplicate").fill(mergeEmail);
    await page.waitForTimeout(1200);
    const mergeCandidate = dlg2.locator(
      `[data-testid="merge-candidate-row"][data-lead-id="${mergeEarly.id}"]`,
    );
    await mergeCandidate.waitFor({ state: "visible", timeout: 15_000 });
    record("confirm-search-finds-early", true, mergeEarly.id);
    record("confirm-self-excluded",
      (await dlg2.locator(`[data-testid="merge-candidate-row"][data-lead-id="${mergeLate.id}"]`).count()) === 0,
      "self not listed");
    await mergeCandidate.click();
    await dlg2.getByTestId("merge-preview-panel").waitFor({ state: "visible", timeout: 20_000 });

    // Phone conflict: both choices display formatted; radio values remain stored strings
    const phoneConflict = dlg2.getByTestId("merge-conflict-phone");
    await phoneConflict.waitFor({ state: "visible", timeout: 10_000 });
    const phoneConflictText = await phoneConflict.innerText();
    record(
      "preview-phone-both-formatted",
      phoneConflictText.includes(phoneDigitsDisplay)
        && phoneConflictText.includes(phoneFormattedStored)
        && !phoneConflictText.includes(phoneDigitsStored),
      phoneConflictText.slice(0, 400),
    );
    await page.screenshot({ path: `${OUT}/shots/phone-conflict-formatted-1280.png`, fullPage: false });

    // Resolve conflicts via label click so controlled React state updates (not force-check alone)
    {
      const conflictBoxes = dlg2.locator('[data-testid^="merge-conflict-"], [data-testid="merge-inquiry-choices"]');
      const conflictCount = await conflictBoxes.count();
      for (let i = 0; i < conflictCount; i++) {
        const firstLabel = conflictBoxes.nth(i).locator("label").first();
        await firstLabel.click({ timeout: 5_000 });
      }
      record("confirm-path-conflicts-resolved", conflictCount > 0, `groups=${conflictCount}`);
    }

    const { data: preTour } = await admin.from("tour_appointments")
      .select("id, lead_id, status, scheduled_at").eq("id", tour.id).single();
    record("pre-merge-tour-on-secondary",
      preTour?.lead_id === mergeLate.id && preTour?.status === "scheduled",
      JSON.stringify(preTour));

    await page.screenshot({ path: `${OUT}/shots/preview-before-confirm-1280.png`, fullPage: false });
    record(
      "confirm-continue-enabled",
      !(await dlg2.getByTestId("merge-continue-to-confirm").isDisabled()),
      "Continue ready after conflict choices",
    );
    await dlg2.getByTestId("merge-continue-to-confirm").click();
    await dlg2.getByTestId("merge-final-confirm").waitFor({ state: "visible", timeout: 10_000 });
    await page.screenshot({ path: `${OUT}/shots/final-confirm-1280.png`, fullPage: false });
    // Double-click protection: fire confirm once; second click while pending should be disabled
    const confirmBtn = dlg2.getByTestId("merge-lead-confirm");
    await confirmBtn.click();
    await Promise.race([
      page.waitForURL(
        (u: URL) => u.pathname.includes(`/leads/${mergeEarly.id}`),
        { timeout: 45_000 },
      ).catch(() => null),
      page.locator("[data-sonner-toast], li[data-sonner-toast]")
        .filter({ hasText: /Leads merged|Already merged/i })
        .first()
        .waitFor({ state: "visible", timeout: 45_000 })
        .catch(() => null),
    ]);
    // Client router.push can lag the success toast; give navigation a beat, then
    // follow secondary→primary redirect if still on the merged lead.
    if (!page.url().includes(`/leads/${mergeEarly.id}`)) {
      await page.waitForTimeout(2500);
    }
    if (!page.url().includes(`/leads/${mergeEarly.id}`)) {
      await page.goto(`${APP}/leads/${mergeLate.id}`, { waitUntil: "domcontentloaded", timeout: 90_000 });
      await page.waitForTimeout(2000);
    }
    const toastText = await page.locator("[data-sonner-toast], li[data-sonner-toast]").allTextContents().catch(() => [] as string[]);
    const redirected = page.url().includes(`/leads/${mergeEarly.id}`);
    record(
      "redirect-to-survivor",
      redirected,
      `${page.url()} | toast=${JSON.stringify(toastText)}`,
    );
    if (!redirected) {
      await page.screenshot({ path: `${OUT}/shots/confirm-failed-1280.png`, fullPage: false });
    }

    const { data: sec } = await admin.from("leads")
      .select("merged_into_lead_id, merged_at, first_name, email").eq("id", mergeLate.id).single();
    const { data: prim } = await admin.from("leads")
      .select("merged_into_lead_id, first_name, phone, partner_email, email, planned_event_space_id, assigned_staff_id")
      .eq("id", mergeEarly.id).single();
    const { data: tourAfter } = await admin.from("tour_appointments")
      .select("id, lead_id, status, scheduled_at").eq("id", tour.id).single();

    record("secondary-soft-marked",
      sec?.merged_into_lead_id === mergeEarly.id && !!sec?.merged_at,
      JSON.stringify(sec));
    record("primary-not-merged", prim?.merged_into_lead_id == null, JSON.stringify(prim));
    // Keep-primary phone: stored digits normalized to venue display form on persist
    record("phone-kept-primary-normalized",
      prim?.phone === phoneDigitsDisplay,
      JSON.stringify({
        got: prim?.phone,
        expect: phoneDigitsDisplay,
        choseStored: phoneDigitsStored,
        secondaryStored: phoneFormattedStored,
      }));
    record("partner-email-kept-on-survivor",
      prim?.partner_email === `sam.partner.${stamp}@hellotocheers-test.invalid`,
      prim?.partner_email ?? "");
    // Fill from secondary space; keep-primary staff (first radio in each group)
    record("space-filled-on-survivor", prim?.planned_event_space_id === spaceId,
      JSON.stringify({ got: prim?.planned_event_space_id, expect: spaceId, name: spaceName }));
    record("staff-kept-primary-on-survivor", prim?.assigned_staff_id === staffPrimaryId,
      JSON.stringify({ got: prim?.assigned_staff_id, expect: staffPrimaryId, name: staffPrimaryName }));
    const tourAtMs = (iso: string | null | undefined) =>
      iso ? Date.parse(iso) : NaN;
    record("tour-reassociated-same-row",
      tourAfter?.id === tour.id
      && tourAfter?.lead_id === mergeEarly.id
      && tourAfter?.status === "scheduled"
      && tourAtMs(tourAfter?.scheduled_at) === tourAtMs(tourIso),
      JSON.stringify(tourAfter));

    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);
    const body = await page.locator("body").innerText();
    record("ui-after-reload-survivor",
      /MergeEarly/i.test(body) && page.url().includes(mergeEarly.id),
      page.url());
    await page.screenshot({ path: `${OUT}/shots/survivor-after-merge-1280.png`, fullPage: false });

    // ——— Reverse direction: later lead selected as survivor ———
    await page.goto(`${APP}/leads/${revEarly.id}`, { waitUntil: "domcontentloaded", timeout: 90_000 });
    await page.waitForTimeout(2500);
    await page.getByTestId("merge-lead-open").click();
    const dlgRev = page.getByTestId("merge-lead-dialog");
    await dlgRev.waitFor({ state: "visible" });
    await dlgRev.getByTestId("merge-find-duplicate").fill(revEmail);
    await page.waitForTimeout(1200);
    const revCandidate = dlgRev.locator(
      `[data-testid="merge-candidate-row"][data-lead-id="${revLate.id}"]`,
    );
    await revCandidate.waitFor({ state: "visible", timeout: 15_000 });
    await revCandidate.click();
    await dlgRev.getByTestId("merge-preview-panel").waitFor({ state: "visible", timeout: 20_000 });
    record("rev-default-earliest-survives",
      (await dlgRev.getByTestId("merge-preview-survivor").getAttribute("data-lead-id")) === revEarly.id,
      "RevEarly default");
    // Choose later lead as survivor
    await dlgRev.locator(`[data-testid="merge-survivor-radio"][data-lead-id="${revLate.id}"]`)
      .click({ force: true });
    await page.waitForTimeout(1500);
    await dlgRev.getByTestId("merge-preview-panel").waitFor({ state: "visible", timeout: 20_000 });
    record("rev-override-late-survives-ui",
      (await dlgRev.getByTestId("merge-preview-survivor").getAttribute("data-lead-id")) === revLate.id
      && (await dlgRev.getByTestId("merge-preview-secondary").getAttribute("data-lead-id")) === revEarly.id,
      "RevLate Survives / RevEarly Marked merged");
    await page.screenshot({ path: `${OUT}/shots/reverse-survivor-preview-1280.png`, fullPage: false });
    // Switching survivor alone must not mutate DB
    const { data: revEarlyMid } = await admin.from("leads")
      .select("merged_into_lead_id").eq("id", revEarly.id).single();
    const { data: revLateMid } = await admin.from("leads")
      .select("merged_into_lead_id").eq("id", revLate.id).single();
    record("rev-switch-alone-no-mutation",
      revEarlyMid?.merged_into_lead_id == null && revLateMid?.merged_into_lead_id == null,
      JSON.stringify({ early: revEarlyMid, late: revLateMid }));
    {
      const conflictBoxes = dlgRev.locator('[data-testid^="merge-conflict-"], [data-testid="merge-inquiry-choices"]');
      const conflictCount = await conflictBoxes.count();
      for (let i = 0; i < conflictCount; i++) {
        await conflictBoxes.nth(i).locator("label").first().click({ timeout: 5_000 });
      }
    }
    await dlgRev.getByTestId("merge-continue-to-confirm").click();
    await dlgRev.getByTestId("merge-final-confirm").waitFor({ state: "visible", timeout: 10_000 });
    record("rev-final-confirm-survivor-id",
      (await dlgRev.getByTestId("merge-final-survivor").getAttribute("data-lead-id")) === revLate.id,
      "final confirm names late survivor");
    record("rev-final-confirm-merged-id",
      (await dlgRev.getByTestId("merge-final-merged").getAttribute("data-lead-id")) === revEarly.id,
      "final confirm names early merged");
    await page.screenshot({ path: `${OUT}/shots/reverse-final-confirm-1280.png`, fullPage: false });
    await dlgRev.getByTestId("merge-lead-confirm").click();
    await Promise.race([
      page.waitForURL(
        (u: URL) => u.pathname.includes(`/leads/${revLate.id}`),
        { timeout: 45_000 },
      ).catch(() => null),
      page.locator("[data-sonner-toast], li[data-sonner-toast]")
        .filter({ hasText: /Leads merged|Already merged/i })
        .first()
        .waitFor({ state: "visible", timeout: 45_000 })
        .catch(() => null),
    ]);
    if (!page.url().includes(`/leads/${revLate.id}`)) {
      await page.waitForTimeout(2500);
    }
    if (!page.url().includes(`/leads/${revLate.id}`)) {
      await page.goto(`${APP}/leads/${revEarly.id}`, { waitUntil: "domcontentloaded", timeout: 90_000 });
      await page.waitForTimeout(2000);
    }
    const revToast = await page.locator("[data-sonner-toast], li[data-sonner-toast]").allTextContents().catch(() => [] as string[]);
    record("rev-redirect-to-late-survivor",
      page.url().includes(`/leads/${revLate.id}`),
      `${page.url()} | toast=${JSON.stringify(revToast)}`);
    const { data: revSec } = await admin.from("leads")
      .select("merged_into_lead_id, merged_at, first_name").eq("id", revEarly.id).single();
    const { data: revPrim } = await admin.from("leads")
      .select("merged_into_lead_id, first_name, phone, planned_event_space_id, assigned_staff_id")
      .eq("id", revLate.id).single();
    const { data: revTourAfter } = await admin.from("tour_appointments")
      .select("id, lead_id, status, scheduled_at").eq("id", revTour.id).single();
    record("rev-early-soft-marked",
      revSec?.merged_into_lead_id === revLate.id && !!revSec?.merged_at,
      JSON.stringify(revSec));
    record("rev-late-survives-unmerged",
      revPrim?.merged_into_lead_id == null && revPrim?.first_name === "RevLate",
      JSON.stringify(revPrim));
    record("rev-phone-on-late-survivor", revPrim?.phone === revPhone, revPrim?.phone ?? "");
    record("rev-tour-on-late-survivor",
      revTourAfter?.id === revTour.id
      && revTourAfter?.lead_id === revLate.id
      && revTourAfter?.status === "scheduled"
      && tourAtMs(revTourAfter?.scheduled_at) === tourAtMs(revTourIso),
      JSON.stringify(revTourAfter));
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);
    record("rev-ui-after-reload",
      /RevLate/i.test(await page.locator("body").innerText()) && page.url().includes(revLate.id),
      page.url());
    await page.screenshot({ path: `${OUT}/shots/reverse-survivor-after-merge-1280.png`, fullPage: false });

    // Self-select blocked: searching for current lead's own last name should not list self;
    // Continue stays disabled without a valid other candidate selected.
    await page.goto(`${APP}/leads/${cancelEarly.id}`, { waitUntil: "domcontentloaded", timeout: 90_000 });
    await page.waitForTimeout(2000);
    await page.getByTestId("merge-lead-open").click();
    const dlg3 = page.getByTestId("merge-lead-dialog");
    await dlg3.getByTestId("merge-find-duplicate").fill(cancelEarly.first_name);
    await page.waitForTimeout(1200);
    const selfListed = await dlg3.locator(
      `[data-testid="merge-candidate-row"][data-lead-id="${cancelEarly.id}"]`,
    ).count();
    record("self-merge-blocked", selfListed === 0, `self rows=${selfListed}`);
    record("continue-disabled-without-valid-preview",
      await dlg3.getByTestId("merge-continue-to-confirm").isDisabled(),
      "no bypass");
  } finally {
    await browser.close();
  }

  const pass = checks.every((c) => c.pass);
  const persisted = {
    cancelEarlyId: cancelEarly.id,
    cancelLateId: cancelLate.id,
    mergeEarlyId: mergeEarly.id,
    mergeLateId: mergeLate.id,
    revEarlyId: revEarly.id,
    revLateId: revLate.id,
    tourId: tour.id,
    revTourId: revTour.id,
    mergeEmailRedacted: `merge-ok.…@hellotocheers-test.invalid`,
    phoneTokenRedacted: `555…`,
  };
  writeFileSync(`${OUT}/browser-results.json`, JSON.stringify({
    pass, image, digest, expectedSha: EXPECTED, checks, persisted, at: new Date().toISOString(),
  }, null, 2));
  writeFileSync(`${OUT}/persisted-state.json`, JSON.stringify(persisted, null, 2));
  console.log(pass ? "\nGREEN merge lead discovery" : "\nNOT GREEN merge lead discovery");
  process.exit(pass ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
