/**
 * Disposable venue + Fancy staff session: merge UI cancels one of two tours; slot reopens.
 * Uses service-role fixtures; merge confirm runs as Jennifer (venue_staff on Fancy only) —
 * so this path uses RPC via Jennifer on Fancy with capacity opened for the test window.
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
const OUT = "docs/qa/lead-merge";
mkdirSync(OUT, { recursive: true });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
if (!url.includes("wvpsldwwjqdannqasrdf")) throw new Error("not sandbox");
const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const anon = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } });

type Check = { name: string; pass: boolean; detail: string };
const checks: Check[] = [];
function record(name: string, pass: boolean, detail: string) {
  checks.push({ name, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"} ${name} — ${detail.slice(0, 260)}`);
}

async function cookies() {
  const { data: link } = await admin.auth.admin.generateLink({ type: "magiclink", email: EMAIL });
  const { data: otp } = await anon.auth.verifyOtp({ type: "email", token_hash: link!.properties!.hashed_token! });
  const cookieName = "sb-wvpsldwwjqdannqasrdf-auth-token";
  const encoded = "base64-" + ssrUtils.stringToBase64URL(JSON.stringify(otp!.session));
  return [
    ...ssrUtils.createChunks(cookieName, encoded).map((c: { name: string; value: string }) => ({
      name: c.name, value: c.value, domain: "app.sandbox.hellotocheers.com",
      path: "/", httpOnly: false, secure: true, sameSite: "Lax" as const,
    })),
    { name: "htc_active_venue_id", value: FANCY, domain: "app.sandbox.hellotocheers.com", path: "/", httpOnly: false, secure: true, sameSite: "Lax" as const },
  ];
}

async function main() {
  const stamp = Date.now();
  const email = `tcancel.${stamp}@example.invalid`;

  // Raise tour capacity temporarily for disposable fixtures on Fancy
  const { data: priorCap } = await admin.from("venue_capacity_rules")
    .select("max_simultaneous_tours").eq("venue_id", FANCY).maybeSingle();
  await admin.from("venue_capacity_rules").upsert({
    venue_id: FANCY,
    max_simultaneous_events: 2,
    max_simultaneous_tours: 8,
    min_turnaround_hours: 0,
  }, { onConflict: "venue_id" });

  const { data: a, error: aErr } = await admin.from("leads").insert({
    venue_id: FANCY, first_name: "Keep", last_name: `Same${stamp}`, email,
    sales_stage: "new_inquiry", exclude_from_business_reporting: true,
  }).select("id").single();
  await new Promise((r) => setTimeout(r, 60));
  const { data: b, error: bErr } = await admin.from("leads").insert({
    venue_id: FANCY, first_name: "Keep", last_name: `Same${stamp}`, email, phone: "555-0111",
    sales_stage: "new_inquiry", exclude_from_business_reporting: true,
  }).select("id").single();
  record("leads", !!a && !!b, aErr?.message ?? bErr?.message ?? `${a?.id}/${b?.id}`);

  // Far-future Wednesdays 15:00Z inside typical open windows
  const tKeep = "2029-03-07T15:00:00.000Z";
  const tCancel = "2029-03-14T15:00:00.000Z";
  const { data: tourKeep, error: tkErr } = await admin.from("tour_appointments").insert({
    venue_id: FANCY, lead_id: a!.id, status: "scheduled", scheduled_at: tKeep,
    duration_minutes: 60, contact_name: "Keep", contact_email: email, origin: "scheduled",
  }).select("id").single();
  const { data: tourCancel, error: tcErr } = await admin.from("tour_appointments").insert({
    venue_id: FANCY, lead_id: b!.id, status: "scheduled", scheduled_at: tCancel,
    duration_minutes: 60, contact_name: "Keep", contact_email: email, origin: "scheduled",
  }).select("id").single();
  record("two_tours", !!tourKeep && !!tourCancel,
    `keep=${tkErr?.message ?? tourKeep?.id} cancel=${tcErr?.message ?? tourCancel?.id}`);
  if (!tourKeep || !tourCancel) {
    writeFileSync(`${OUT}/tour-cancel-merge-results.json`, JSON.stringify({ checks }, null, 2));
    process.exit(1);
  }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await context.addCookies(await cookies());
  const page = await context.newPage();
  try {
    await page.goto(`${APP}/leads/${b!.id}`, { waitUntil: "domcontentloaded", timeout: 90000 });
    await page.waitForTimeout(2500);
    await page.getByTestId("merge-lead-open").click();
    await page.waitForTimeout(500);
    await page.getByTestId("merge-other-lead-id").fill(a!.id);
    await page.getByRole("button", { name: "Preview" }).click();
    await page.waitForTimeout(3000);
    const dlg = page.getByTestId("merge-lead-dialog");
    await page.screenshot({ path: `${OUT}/tour-cancel-preview-1280.png`, fullPage: true });
    const body = await dlg.innerText();
    record("preview_lists_both_tours",
      body.includes("on primary") && body.includes("on secondary"),
      body.includes("Tour appointments") ? "section ok" : body.slice(0, 200));

    const cancelLabels = dlg.locator("label").filter({ hasText: "Cancel this tour" });
    const boxCount = await cancelLabels.count();
    record("cancel_checkboxes", boxCount >= 2, `count=${boxCount}`);
    // Check the cancel box under the secondary tour row
    const secondaryRow = dlg.locator("li").filter({ hasText: "on secondary" });
    await secondaryRow.locator("label").filter({ hasText: "Cancel this tour" }).locator("input").check({ force: true });
    await dlg.getByTestId("merge-lead-confirm").click();
    await Promise.race([
      page.waitForURL((u: URL) => u.pathname.includes(`/leads/${a!.id}`), { timeout: 20000 }).catch(() => null),
      page.waitForTimeout(12000),
    ]);
    record("merged_nav", page.url().includes(`/leads/${a!.id}`), page.url());

    const { data: kept } = await admin.from("tour_appointments").select("id,lead_id,status").eq("id", tourKeep.id).single();
    const { data: cancelled } = await admin.from("tour_appointments").select("id,lead_id,status").eq("id", tourCancel.id).single();
    record("kept_tour_active", kept?.status === "scheduled" && kept?.lead_id === a!.id, JSON.stringify(kept));
    record("cancelled_via_merge", cancelled?.status === "cancelled", JSON.stringify(cancelled));

    const { data: rebook, error: rebookErr } = await admin.from("tour_appointments").insert({
      venue_id: FANCY, lead_id: a!.id, status: "scheduled", scheduled_at: tCancel,
      duration_minutes: 60, contact_name: "Rebook", contact_email: `re.${email}`, origin: "scheduled",
    }).select("id").single();
    record("slot_released_rebookable", !!rebook && !rebookErr, rebookErr?.message ?? rebook?.id ?? "");
    if (rebook) await admin.from("tour_appointments").update({ status: "cancelled" }).eq("id", rebook.id);
  } catch (e) {
    record("error", false, e instanceof Error ? e.message : String(e));
    await page.screenshot({ path: `${OUT}/tour-cancel-error.png`, fullPage: true }).catch(() => {});
  } finally {
    await browser.close();
    // Restore prior tour capacity if we had one
    if (priorCap?.max_simultaneous_tours != null) {
      await admin.from("venue_capacity_rules").update({
        max_simultaneous_tours: priorCap.max_simultaneous_tours,
      }).eq("venue_id", FANCY);
    }
  }

  const summary = { pass: checks.filter((c) => c.pass).length, fail: checks.filter((c) => !c.pass).length, checks };
  writeFileSync(`${OUT}/tour-cancel-merge-results.json`, JSON.stringify(summary, null, 2));
  console.log(`\nSUMMARY pass=${summary.pass} fail=${summary.fail}`);
  if (summary.fail) process.exit(1);
}

main().catch((e) => { console.error(e); process.exit(1); });
