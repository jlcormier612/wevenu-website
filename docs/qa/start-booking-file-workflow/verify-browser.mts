/**
 * Sandbox browser + DB proof for Start booking file → Continue setup,
 * multi floor-plan template apply, and multi vendor assign.
 * Fancy disposable lead only. Does not touch Gina. No invites / customer sends.
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
const EXPECTED = (process.env.EXPECTED_SHA ?? "f25c047b82fcd5401e6b4d89b0a4201f2b904d34").slice(0, 40);
const FANCY = "a415ac52-cd74-42a6-8df7-7a8f6e71d080";
const FANCY_EMAIL = "jennifer@hellotocheers.com";
const OUT = "docs/qa/start-booking-file-workflow";
const MARKER = `QA-BF-${Date.now()}`;

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

function noteDeployment(link: string | undefined): string | null {
  if (!link) return null;
  const m = link.match(/dpl=([0-9a-f]{40})/i);
  return m?.[1] ?? null;
}

async function servingImage(): Promise<string> {
  try {
    const { execSync } = await import("node:child_process");
    const taskArn = execSync(
      "aws ecs list-tasks --cluster htc-sandbox --service-name htc-sandbox-venue-app --desired-status RUNNING --query 'taskArns[0]' --output text",
      { encoding: "utf8" },
    ).trim();
    if (!taskArn || taskArn === "None") return "";
    return execSync(
      `aws ecs describe-tasks --cluster htc-sandbox --tasks ${taskArn} --query 'tasks[0].containers[0].image' --output text`,
      { encoding: "utf8" },
    ).trim();
  } catch {
    return "";
  }
}

async function authFor(email: string) {
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

async function createDisposableLead() {
  const stamp = Date.now();
  const { data, error } = await admin
    .from("leads")
    .insert({
      venue_id: FANCY,
      first_name: "Booking",
      last_name: `QA${stamp % 100000}`,
      email: `booking-file-${stamp}@hellotocheers-test.invalid`,
      event_type: "wedding",
      event_date: "2028-06-15",
      sales_stage: "new_inquiry",
      status: "active",
      source: "other",
      inquiry_message: `[qa] ${MARKER} start-booking-file verify — disposable`,
      inquiry_message_origin: "venue",
    })
    .select("id, first_name, last_name, sales_stage, event_date")
    .single();
  if (error || !data) {
    throw new Error(`lead insert failed: ${error?.message ?? "no data"} ${JSON.stringify(error)}`);
  }
  return data;
}

async function clientForLead(leadId: string) {
  const { data, error } = await admin
    .from("clients")
    .select("id, status, lead_id, venue_id")
    .eq("lead_id", leadId)
    .maybeSingle();
  if (error) throw new Error(`clientForLead: ${error.message}`);
  return data;
}

async function clientById(id: string) {
  const { data, error } = await admin
    .from("clients")
    .select("id, status, lead_id, venue_id")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`clientById: ${error.message}`);
  return data;
}

async function leadRow(leadId: string) {
  const { data } = await admin
    .from("leads")
    .select("id, sales_stage, event_date")
    .eq("id", leadId)
    .maybeSingle();
  return data;
}

async function floorPlansForClient(clientId: string) {
  const { data } = await admin
    .from("floor_plans")
    .select("id, name, space_id, source_template_id, client_id, event_id, created_at")
    .eq("client_id", clientId)
    .eq("venue_id", FANCY);
  return data ?? [];
}

async function vendorsForClient(clientId: string) {
  const { data } = await admin
    .from("event_vendor_assignments")
    .select("id, vendor_id, client_id, event_id, arrival_time, setup_location, load_in_notes, notes, created_at")
    .eq("client_id", clientId);
  return data ?? [];
}

async function holdsForLead(leadId: string) {
  const { data } = await admin
    .from("date_holds")
    .select("id")
    .eq("lead_id", leadId)
    .eq("venue_id", FANCY);
  return data ?? [];
}

async function cleanup(leadId: string, clientId: string | null) {
  if (clientId) {
    await admin.from("event_vendor_assignments").delete().eq("client_id", clientId);
    await admin.from("floor_plans").delete().eq("client_id", clientId).eq("venue_id", FANCY);
    await admin.from("clients").delete().eq("id", clientId).eq("venue_id", FANCY);
  }
  await admin.from("date_holds").delete().eq("lead_id", leadId).eq("venue_id", FANCY);
  await admin.from("leads").delete().eq("id", leadId).eq("venue_id", FANCY);
}

mkdirSync(OUT, { recursive: true });

const results: Record<string, unknown> = {
  expectedSha: EXPECTED,
  marker: MARKER,
  observedAt: new Date().toISOString(),
};

let leadId = "";
let clientId: string | null = null;

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
await context.addCookies(await authFor(FANCY_EMAIL));
const page = await context.newPage();

try {
  const head = await page.goto(`${APP}/login`, { waitUntil: "domcontentloaded", timeout: 60_000 });
  const serving = noteDeployment(head?.headers()?.link);
  const image = await servingImage();
  results.servingFromLink = serving;
  results.servingImage = image;
  record(
    "serving_commit",
    Boolean(serving && EXPECTED.startsWith(serving.slice(0, 8))) ||
      String(image).includes(EXPECTED.slice(0, 12)),
    `link=${serving} image=${image}`,
  );

  const { data: templates } = await admin
    .from("floor_plan_templates")
    .select("id, name, space_id, is_archived")
    .eq("venue_id", FANCY)
    .eq("is_archived", false)
    .limit(5);
  const { data: vendorRels } = await admin
    .from("venue_vendor_relationships")
    .select("vendor_id, status, vendors(id, business_name)")
    .eq("venue_id", FANCY)
    .neq("status", "inactive")
    .limit(8);
  const vendors = (vendorRels ?? [])
    .map((r) => {
      const v = r.vendors as { id: string; business_name: string } | null;
      return v ? { id: v.id, business_name: v.business_name } : null;
    })
    .filter((v): v is { id: string; business_name: string } => Boolean(v));
  results.availableTemplates = templates;
  results.availableVendors = vendors;
  record("fixtures_templates", (templates?.length ?? 0) >= 2, `count=${templates?.length ?? 0}`);
  record("fixtures_vendors", vendors.length >= 2, `count=${vendors.length}`);
  if ((templates?.length ?? 0) < 2 || vendors.length < 2) {
    throw new Error("Fancy needs ≥2 floor-plan templates and ≥2 vendors for multi-select proof");
  }

  const lead = await createDisposableLead();
  leadId = lead.id;
  results.leadBefore = lead;
  record("disposable_lead_created", true, leadId);

  await page.goto(`${APP}/leads/${leadId}`, { waitUntil: "networkidle", timeout: 90_000 });
  await page.waitForSelector('[data-testid="start-booking-action"]', { timeout: 45_000 });
  record("start_cta_visible", true, "start-booking-action");
  const continueBefore = await page.getByTestId("continue-booking-setup-action").count();
  record("continue_hidden_before_start", continueBefore === 0, `count=${continueBefore}`);

  await page.getByTestId("start-booking-action").click();
  // Confirm dialog (title "Start booking file?") — avoid matching the header CTA
  const confirmDialog = page.getByLabel("Start booking file?");
  await confirmDialog.waitFor({ timeout: 15_000 });
  await confirmDialog.getByRole("button", { name: "Start booking file", exact: true }).click();
  await page.waitForURL(/\/clients\/[0-9a-f-]+/, { timeout: 60_000 });
  const clientUrl = page.url();
  const clientMatch = clientUrl.match(/\/clients\/([0-9a-f-]+)/);
  clientId = clientMatch?.[1] ?? null;
  results.clientUrlAfterStart = clientUrl;
  record("landed_client_workspace", Boolean(clientId), clientUrl);

  const clientAfterStart = clientId
    ? await clientById(clientId)
    : await clientForLead(leadId);
  results.clientAfterStart = clientAfterStart;
  record(
    "same_client_id_as_url",
    Boolean(clientId && clientAfterStart?.id === clientId),
    `url=${clientId} db=${clientAfterStart?.id}`,
  );
  record(
    "client_status_booking_not_booked",
    clientAfterStart?.status === "booking" || clientAfterStart?.status === "booking_file",
    JSON.stringify(clientAfterStart),
  );
  const leadAfterStart = await leadRow(leadId);
  results.leadAfterStart = leadAfterStart;
  record(
    "lead_not_booked_after_start",
    leadAfterStart?.sales_stage !== "booked",
    String(leadAfterStart?.sales_stage),
  );
  const holdsAfterStart = await holdsForLead(leadId);
  record("no_hold_after_start", holdsAfterStart.length === 0, `holds=${holdsAfterStart.length}`);

  await page.screenshot({ path: `${OUT}/a-client-after-start-1280.png`, fullPage: true });

  // Leave and return to lead
  await page.goto(`${APP}/leads/${leadId}`, { waitUntil: "networkidle", timeout: 90_000 });
  await page.waitForSelector('[data-testid="continue-booking-setup-action"]', { timeout: 45_000 });
  const startGone = await page.getByTestId("start-booking-action").count();
  record("start_hidden_after_convert", startGone === 0, `count=${startGone}`);
  record("continue_visible", true, "continue-booking-setup-action");
  await page.screenshot({ path: `${OUT}/a-lead-continue-cta-1280.png`, fullPage: true });

  await page.getByTestId("continue-booking-setup-action").click();
  await page.waitForURL(new RegExp(`/clients/${clientId}`), { timeout: 60_000 });
  const clientAfterResume = await clientForLead(leadId);
  results.clientAfterResume = clientAfterResume;
  record(
    "resume_same_client",
    clientAfterResume?.id === clientId,
    `before=${clientId} after=${clientAfterResume?.id}`,
  );

  // Second resume must not duplicate client
  await page.goto(`${APP}/leads/${leadId}`, { waitUntil: "networkidle", timeout: 90_000 });
  await page.getByTestId("continue-booking-setup-action").click();
  await page.waitForURL(new RegExp(`/clients/${clientId}`), { timeout: 60_000 });
  const { data: allClients } = await admin
    .from("clients")
    .select("id")
    .eq("lead_id", leadId)
    .eq("venue_id", FANCY);
  record("no_duplicate_client", (allClients?.length ?? 0) === 1, `count=${allClients?.length}`);

  // B — multi floor-plan templates
  await page.goto(`${APP}/clients/${clientId}`, { waitUntil: "networkidle", timeout: 90_000 });
  await page.getByRole("heading", { name: "Floor plans" }).scrollIntoViewIfNeeded();
  await page.getByRole("button", { name: "+ New Floor Plan" }).first().click();
  const startSheet = page.getByLabel("How would you like to start?");
  await startSheet.waitFor({ timeout: 15_000 });
  await startSheet.getByText("Apply Template", { exact: true }).click();
  await page.waitForSelector('[data-testid="floor-plan-apply-templates"]', { timeout: 15_000 });
  const t0 = templates![0];
  const t1 = templates![1];
  await page.getByTestId(`floor-plan-template-${t0.id}`).check();
  await page.getByTestId(`floor-plan-template-${t1.id}`).check();
  await page.screenshot({ path: `${OUT}/b-multi-templates-selected-1280.png` });
  await page.getByRole("button", { name: /Apply 2 templates/i }).click();
  await page.waitForTimeout(4000);
  await page.reload({ waitUntil: "networkidle", timeout: 90_000 });
  const plans = await floorPlansForClient(clientId!);
  results.floorPlans = plans;
  record("multi_plans_created", plans.length >= 2, `count=${plans.length}`);
  const names = new Set(plans.map((p) => p.name));
  record(
    "plans_named_from_templates",
    names.has(t0.name) && names.has(t1.name),
    JSON.stringify([...names]),
  );
  record(
    "plans_independent_ids",
    new Set(plans.map((p) => p.id)).size === plans.length,
    `ids=${plans.map((p) => p.id).join(",")}`,
  );
  await page.screenshot({ path: `${OUT}/b-plans-after-apply-1280.png`, fullPage: true });

  // Blank plan still works
  await page.getByRole("button", { name: "+ New Floor Plan" }).first().click();
  const blankSheet = page.getByLabel("How would you like to start?");
  await blankSheet.waitFor({ timeout: 15_000 });
  await blankSheet.getByText("Blank Floor Plan", { exact: true }).click();
  await blankSheet.getByPlaceholder("Reception").fill(`${MARKER}-Blank`);
  await blankSheet.getByRole("button", { name: "Create Floor Plan" }).click();
  await page.waitForURL(/\/floor-plans\/[0-9a-f-]+/, { timeout: 60_000 });
  await page.goto(`${APP}/clients/${clientId}`, { waitUntil: "networkidle", timeout: 90_000 });
  const plansAfterBlank = await floorPlansForClient(clientId!);
  record(
    "blank_plan_created",
    plansAfterBlank.some((p) => p.name === `${MARKER}-Blank`),
    `count=${plansAfterBlank.length}`,
  );

  // Duplicate existing
  const sourcePlan = plansAfterBlank.find((p) => p.name === t0.name) ?? plansAfterBlank[0];
  await page.getByRole("button", { name: "+ New Floor Plan" }).first().click();
  const dupSheet = page.getByLabel("How would you like to start?");
  await dupSheet.waitFor({ timeout: 15_000 });
  await dupSheet.getByText("Duplicate Existing Floor Plan", { exact: true }).click();
  await dupSheet.getByRole("combobox").first().click();
  await page.getByRole("option", { name: sourcePlan.name }).first().click();
  await dupSheet.getByPlaceholder("Reception").fill(`${MARKER}-Dup`);
  await dupSheet.getByRole("button", { name: "Duplicate" }).click();
  await page.waitForURL(/\/floor-plans\/[0-9a-f-]+/, { timeout: 60_000 });
  await page.goto(`${APP}/clients/${clientId}`, { waitUntil: "networkidle", timeout: 90_000 });
  const plansAfterDup = await floorPlansForClient(clientId!);
  results.floorPlansFinal = plansAfterDup;
  record(
    "duplicate_plan_created",
    plansAfterDup.some((p) => p.name === `${MARKER}-Dup`),
    `count=${plansAfterDup.length}`,
  );

  // C — multi vendors
  await page.getByRole("heading", { name: "Vendors" }).scrollIntoViewIfNeeded();
  await page.getByRole("button", { name: /Assign Vendor/i }).click();
  await page.waitForSelector('[data-testid="event-vendor-multi-assign"]', { timeout: 15_000 });
  const v0 = vendors![0];
  const v1 = vendors![1];
  await page.getByTestId(`assign-vendor-${v0.id}`).check();
  await page.getByTestId(`assign-vendor-${v1.id}`).check();
  await page.locator("#ev-arrival").fill("10:30");
  await page.locator("#ev-location").fill(`${MARKER}-Garden`);
  await page.locator("#ev-loadin").fill(`${MARKER}-use north door`);
  await page.locator("#ev-notes").fill(`${MARKER}-private-note`);
  await page.screenshot({ path: `${OUT}/c-multi-vendors-selected-1280.png` });
  await page.getByTestId("event-vendor-assign-submit").click();
  await page.waitForTimeout(4000);
  await page.reload({ waitUntil: "networkidle", timeout: 90_000 });
  let assignments = await vendorsForClient(clientId!);
  results.vendorAssignments = assignments;
  record("multi_vendors_assigned", assignments.length >= 2, `count=${assignments.length}`);
  record(
    "vendor_details_saved",
    assignments.every(
      (a) =>
        a.setup_location === `${MARKER}-Garden` &&
        (a.load_in_notes ?? "").includes(MARKER) &&
        (a.notes ?? "").includes("private-note"),
    ),
    JSON.stringify(assignments.map((a) => ({ setup: a.setup_location, notes: a.notes }))),
  );

  // Retry same vendors — no duplicates
  await page.getByRole("button", { name: /Assign Vendor/i }).click();
  const stillOffered0 = await page.getByTestId(`assign-vendor-${v0.id}`).count();
  const stillOffered1 = await page.getByTestId(`assign-vendor-${v1.id}`).count();
  record(
    "assigned_vendors_not_relisted",
    stillOffered0 === 0 && stillOffered1 === 0,
    `v0=${stillOffered0} v1=${stillOffered1}`,
  );
  await page.getByRole("button", { name: "Cancel" }).click().catch(() => {});
  assignments = await vendorsForClient(clientId!);
  record(
    "no_duplicate_assignments",
    new Set(assignments.map((a) => a.vendor_id)).size === assignments.length,
    `count=${assignments.length}`,
  );

  // Pre-booking assignVendorToClient must not create invitation rows (event assign would).
  const { data: invites } = await admin
    .from("vendor_invitations")
    .select("id, vendor_id, created_at")
    .in("vendor_id", [v0.id, v1.id])
    .gte("created_at", results.observedAt as string);
  results.vendorInvitesAfterAssign = invites;
  record("no_vendor_invites_created", (invites?.length ?? 0) === 0, `count=${invites?.length ?? 0}`);

  // D — questionnaires unavailable + still not booked
  const body = await page.locator("body").innerText();
  record(
    "questionnaires_unavailable_copy",
    /Questionnaires stay unavailable until this relationship is Booked/i.test(body),
    "copy present",
  );
  const clientFinal = await clientForLead(leadId);
  const leadFinal = await leadRow(leadId);
  results.clientFinal = clientFinal;
  results.leadFinal = leadFinal;
  record(
    "still_not_booked",
    (clientFinal?.status === "booking" || clientFinal?.status === "booking_file") &&
      leadFinal?.sales_stage !== "booked",
    JSON.stringify({ client: clientFinal?.status, lead: leadFinal?.sales_stage }),
  );
  const holdsFinal = await holdsForLead(leadId);
  record("still_no_hold", holdsFinal.length === 0, `holds=${holdsFinal.length}`);
  await page.screenshot({ path: `${OUT}/d-workspace-final-1280.png`, fullPage: true });
} catch (err) {
  const detail =
    err instanceof Error
      ? err.message
      : typeof err === "object" && err && "message" in err
        ? String((err as { message: unknown }).message)
        : JSON.stringify(err);
  record("harness_error", false, detail);
  try {
    await page.screenshot({ path: `${OUT}/error-1280.png`, fullPage: true });
  } catch { /* ignore */ }
} finally {
  await browser.close();
  if (leadId) {
    try {
      await cleanup(leadId, clientId);
      record("cleanup_done", true, `lead=${leadId} client=${clientId}`);
    } catch (e) {
      record("cleanup_done", false, e instanceof Error ? e.message : String(e));
    }
  }
  results.checks = checks;
  results.finishedAt = new Date().toISOString();
  writeFileSync(`${OUT}/browser-results.json`, JSON.stringify(results, null, 2));
  const failed = checks.filter((c) => !c.pass);
  console.log(failed.length ? `FAILED ${failed.length}` : "ALL PASS");
  if (failed.length) process.exitCode = 1;
}
