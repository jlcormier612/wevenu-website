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

  // Cancel pair — preview must not mutate
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
  });

  // Confirm pair — actual merge
  const mergeEarly = await insertLead({
    first_name: "MergeEarly",
    last_name: `Ok${stamp}`,
    email: mergeEmail,
    phone: null,
    partner_first_name: "Sam",
    partner_last_name: "Partner",
    partner_email: `sam.partner.${stamp}@hellotocheers-test.invalid`,
    event_date: "2027-08-15",
    inquiry_message: `merge-early ${stamp}`,
  });
  await new Promise((r) => setTimeout(r, 60));
  const mergeLate = await insertLead({
    first_name: "MergeLate",
    last_name: `Ok${stamp}`,
    email: mergeEmail,
    phone: `1${phoneToken}`,
    inquiry_message: `merge-late ${stamp}`,
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

  const tourIso = "2028-11-14T16:00:00.000Z";
  const { data: tour, error: tourErr } = await admin
    .from("tour_appointments")
    .insert({
      venue_id: FANCY,
      lead_id: mergeLate.id,
      status: "scheduled",
      scheduled_at: tourIso,
      duration_minutes: 60,
      contact_name: `MergeLate Ok${stamp}`,
      contact_email: mergeEmail,
      origin: "scheduled",
    })
    .select("id, lead_id, status, scheduled_at")
    .single();
  record("fixtures", !!cancelEarly && !!cancelLate && !!mergeEarly && !!mergeLate && !!decoy && !!tour && !tourErr,
    JSON.stringify({
      cancelEarly: cancelEarly.id,
      cancelLate: cancelLate.id,
      mergeEarly: mergeEarly.id,
      mergeLate: mergeLate.id,
      decoy: decoy.id,
      tour: tour?.id,
      tourErr: tourErr?.message,
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
    record("dialog-no-uuid-required",
      !(await dlg.getByText("Paste the duplicate lead’s ID").isVisible().catch(() => false)),
      "uuid-first gone");

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

    // Search by email of late
    await dlg.getByTestId("merge-find-duplicate").fill(`alt-${cancelEmail}`);
    await page.waitForTimeout(1200);
    const emailRow = dlg.locator(`[data-testid="merge-candidate-row"][data-lead-id="${cancelLate.id}"]`);
    await emailRow.waitFor({ state: "visible", timeout: 15_000 });
    record("search-by-email", await emailRow.isVisible(), cancelLate.id);

    await emailRow.click();
    await dlg.getByTestId("merge-selected-candidate").waitFor({ state: "visible" });
    await page.screenshot({ path: `${OUT}/shots/search-selected-1280.png`, fullPage: false });
    await dlg.getByTestId("merge-preview").click();
    await dlg.getByTestId("merge-preview-panel").waitFor({ state: "visible", timeout: 20_000 });
    const previewText = await dlg.innerText();
    record("preview-survivor-earliest",
      /CancelEarly/i.test(previewText) && /Survives \(primary\)/i.test(previewText),
      "earliest default");
    record("preview-survivor-reason", await dlg.getByTestId("merge-survivor-reason").isVisible(), "reason");
    await page.screenshot({ path: `${OUT}/shots/preview-cancel-pair-1280.png`, fullPage: false });

    // Cancel dialog — no mutation
    await dlg.getByRole("button", { name: "Cancel" }).click();
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
    record("cancel-updated-at-unchanged",
      cEarlyAfter?.updated_at === cancelEarly.updated_at
      && cLateAfter?.updated_at === cancelLate.updated_at,
      `early ${cEarlyAfter?.updated_at} vs ${cancelEarly.updated_at}; late ${cLateAfter?.updated_at}`);

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
    await dlg2.getByTestId("merge-preview").click();
    await dlg2.getByTestId("merge-preview-panel").waitFor({ state: "visible", timeout: 20_000 });

    // Resolve any conflicts by selecting first radio in each group
    const radios = dlg2.locator('input[type="radio"][name^="merge-field-"]');
    const n = await radios.count();
    const seen = new Set<string>();
    for (let i = 0; i < n; i++) {
      const radio = radios.nth(i);
      const name = await radio.getAttribute("name");
      if (!name || seen.has(name)) continue;
      seen.add(name);
      await radio.check({ force: true });
    }

    const { data: preTour } = await admin.from("tour_appointments")
      .select("id, lead_id, status, scheduled_at").eq("id", tour!.id).single();
    record("pre-merge-tour-on-secondary",
      preTour?.lead_id === mergeLate.id && preTour?.status === "scheduled",
      JSON.stringify(preTour));

    await page.screenshot({ path: `${OUT}/shots/preview-before-confirm-1280.png`, fullPage: false });
    await dlg2.getByTestId("merge-lead-confirm").click();
    await Promise.race([
      page.waitForURL((u: URL) => u.pathname.includes(`/leads/${mergeEarly.id}`), { timeout: 25_000 }).catch(() => null),
      page.waitForTimeout(15_000),
    ]);
    await page.waitForTimeout(1500);
    record("redirect-to-survivor", page.url().includes(`/leads/${mergeEarly.id}`), page.url());

    const { data: sec } = await admin.from("leads")
      .select("merged_into_lead_id, merged_at, first_name, email").eq("id", mergeLate.id).single();
    const { data: prim } = await admin.from("leads")
      .select("merged_into_lead_id, first_name, phone, partner_email, email")
      .eq("id", mergeEarly.id).single();
    const { data: tourAfter } = await admin.from("tour_appointments")
      .select("id, lead_id, status, scheduled_at").eq("id", tour!.id).single();

    record("secondary-soft-marked",
      sec?.merged_into_lead_id === mergeEarly.id && !!sec?.merged_at,
      JSON.stringify(sec));
    record("primary-not-merged", prim?.merged_into_lead_id == null, JSON.stringify(prim));
    record("phone-filled-on-survivor", prim?.phone === `1${phoneToken}`, JSON.stringify(prim));
    record("partner-email-kept-on-survivor",
      prim?.partner_email === `sam.partner.${stamp}@hellotocheers-test.invalid`,
      prim?.partner_email ?? "");
    record("tour-reassociated-same-row",
      tourAfter?.id === tour!.id
      && tourAfter?.lead_id === mergeEarly.id
      && tourAfter?.status === "scheduled"
      && tourAfter?.scheduled_at === tourIso,
      JSON.stringify(tourAfter));

    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);
    const body = await page.locator("body").innerText();
    record("ui-after-reload-survivor",
      /MergeEarly/i.test(body) && page.url().includes(mergeEarly.id),
      page.url());
    await page.screenshot({ path: `${OUT}/shots/survivor-after-merge-1280.png`, fullPage: false });

    // Stale / invalid candidate via advanced ID
    await page.goto(`${APP}/leads/${cancelEarly.id}`, { waitUntil: "domcontentloaded", timeout: 90_000 });
    await page.waitForTimeout(2000);
    await page.getByTestId("merge-lead-open").click();
    const dlg3 = page.getByTestId("merge-lead-dialog");
    await dlg3.getByTestId("merge-advanced-id-toggle").click();
    await dlg3.getByTestId("merge-other-lead-id").fill(cancelEarly.id);
    await dlg3.getByRole("button", { name: "Preview" }).click();
    await page.waitForTimeout(2000);
    // toast or no preview panel
    const selfBlocked = !(await dlg3.getByTestId("merge-preview-panel").isVisible().catch(() => false));
    record("self-merge-blocked", selfBlocked, "preview not shown for same id");

    await dlg3.getByTestId("merge-other-lead-id").fill("00000000-0000-4000-8000-000000000099");
    await dlg3.getByRole("button", { name: "Preview" }).click();
    await page.waitForTimeout(2000);
    const missingBlocked = !(await dlg3.getByTestId("merge-preview-panel").isVisible().catch(() => false));
    record("missing-id-handled", missingBlocked, "no preview for missing id");
  } finally {
    await browser.close();
  }

  const pass = checks.every((c) => c.pass);
  const persisted = {
    cancelEarlyId: cancelEarly.id,
    cancelLateId: cancelLate.id,
    mergeEarlyId: mergeEarly.id,
    mergeLateId: mergeLate.id,
    tourId: tour?.id ?? null,
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
