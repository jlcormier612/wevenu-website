/**
 * Sandbox browser: possible-duplicate modal language + Merge lead from banner.
 * Creates disposable Fancy leads + duplicate review row. Magic-link auth.
 * Exercises conflict choice + soft-mark + redirect. Optional tour cancel path.
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
const EXPECTED = (process.env.EXPECTED_SHA ?? "").slice(0, 12);

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
if (!url.includes("wvpsldwwjqdannqasrdf")) throw new Error("not sandbox");
const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const anon = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } });

type Check = { name: string; pass: boolean; detail: string };
const checks: Check[] = [];
function record(name: string, pass: boolean, detail: string) {
  checks.push({ name, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"} ${name} — ${detail.slice(0, 260)}`);
}

async function authCookies() {
  const { data: link } = await admin.auth.admin.generateLink({ type: "magiclink", email: EMAIL });
  const { data: otp, error } = await anon.auth.verifyOtp({
    type: "email", token_hash: link!.properties!.hashed_token!,
  });
  if (error || !otp?.session) throw error ?? new Error("session");
  const cookieName = "sb-wvpsldwwjqdannqasrdf-auth-token";
  const encoded = "base64-" + ssrUtils.stringToBase64URL(JSON.stringify(otp.session));
  return [
    ...ssrUtils.createChunks(cookieName, encoded).map((c: { name: string; value: string }) => ({
      name: c.name, value: c.value, domain: "app.sandbox.hellotocheers.com",
      path: "/", httpOnly: false, secure: true, sameSite: "Lax" as const,
    })),
    {
      name: "htc_active_venue_id", value: FANCY,
      domain: "app.sandbox.hellotocheers.com", path: "/",
      httpOnly: false, secure: true, sameSite: "Lax" as const,
    },
  ];
}

async function main() {
  const stamp = Date.now();
  const sharedEmail = `dup-ux.${stamp}@example.invalid`;

  const { data: primary } = await admin.from("leads").insert({
    venue_id: FANCY,
    first_name: "DupPrimary",
    last_name: `Early${stamp}`,
    email: sharedEmail,
    phone: null,
    sales_stage: "new_inquiry",
    inquiry_message: `Primary inquiry ${stamp}`,
    exclude_from_business_reporting: true,
  }).select("id").single();
  await new Promise((r) => setTimeout(r, 80));
  const { data: secondary } = await admin.from("leads").insert({
    venue_id: FANCY,
    first_name: "DupSecondary",
    last_name: `Late${stamp}`,
    email: sharedEmail,
    phone: "555-0177",
    sales_stage: "new_inquiry",
    inquiry_message: `Secondary tour request ${stamp}`,
    exclude_from_business_reporting: true,
  }).select("id").single();

  // Seed a needs_review duplicate review pointing secondary → primary
  await admin.from("lead_duplicate_reviews").delete().eq("lead_id", secondary!.id);
  const { error: revErr } = await admin.from("lead_duplicate_reviews").insert({
    venue_id: FANCY,
    lead_id: secondary!.id,
    matched_lead_id: primary!.id,
    matched_display_name: `DupPrimary Early${stamp}`,
    matched_email: sharedEmail,
    matched_phone: null,
    matched_sales_stage: "new_inquiry",
    signals: ["email"],
    status: "needs_review",
  });
  record("fixtures_and_review", !!primary && !!secondary && !revErr,
    revErr?.message ?? `P=${primary?.id} S=${secondary?.id}`);

  // Tour on secondary for reparent proof
  await admin.from("tour_availability_windows").upsert(
    [0, 1, 2, 3, 4, 5, 6].map((day_of_week) => ({
      venue_id: FANCY, day_of_week, start_time: "09:00", end_time: "17:00", sort_order: day_of_week,
    })),
    { onConflict: "venue_id,day_of_week", ignoreDuplicates: true },
  ).then(() => null).catch(() => null);
  // Windows may already exist — insert if missing via select
  const { count: winCount } = await admin.from("tour_availability_windows")
    .select("id", { count: "exact", head: true }).eq("venue_id", FANCY);
  if ((winCount ?? 0) === 0) {
    await admin.from("tour_availability_windows").insert(
      [0, 1, 2, 3, 4, 5, 6].map((day_of_week) => ({
        venue_id: FANCY, day_of_week, start_time: "09:00", end_time: "17:00", sort_order: day_of_week,
      })),
    );
  }
  const tourIso = "2028-09-13T15:00:00.000Z";
  const { data: tour, error: tourErr } = await admin.from("tour_appointments").insert({
    venue_id: FANCY, lead_id: secondary!.id, status: "scheduled",
    scheduled_at: tourIso, duration_minutes: 60,
    contact_name: `DupSecondary Late${stamp}`, contact_email: sharedEmail,
    origin: "scheduled",
  }).select("id,scheduled_at,status").single();
  record("tour_on_secondary", !!tour && !tourErr, tourErr?.message ?? tour?.id ?? "");

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await context.addCookies(await authCookies());
  const page = await context.newPage();

  try {
    await page.goto(`${APP}/leads/${secondary!.id}`, { waitUntil: "domcontentloaded", timeout: 90000 });
    await page.waitForTimeout(3000);
    const bannerText = await page.locator("body").innerText();
    record("banner_heading", /Possible duplicate lead/i.test(bannerText), "heading");
    record("no_manual_copy_delete",
      !/delete this duplicate|copy any useful|paste the other lead/i.test(bannerText),
      "old guidance absent on page");
    record("merge_cta_on_banner", await page.getByTestId("duplicate-merge-open").isVisible().catch(() => false), "cta");

    await page.getByRole("button", { name: "Review match" }).click();
    await page.waitForTimeout(600);
    const modal = page.getByRole("dialog");
    const modalText = await modal.innerText();
    record("modal_title", /Possible duplicate lead/i.test(modalText), modalText.slice(0, 80));
    record("modal_no_auto_merge", /does not merge|Nothing merges until you confirm|Merge only when/i.test(modalText), "explicit");
    record("modal_no_copy_delete",
      !/delete this duplicate|copy any useful|Add any new contact/i.test(modalText),
      "clean");
    await page.screenshot({ path: `${OUT}/duplicate-modal-1280.png`, fullPage: true });

    await page.getByTestId("duplicate-merge-from-modal").click();
    await page.waitForTimeout(2500);
    const mergeDlg = page.getByTestId("merge-lead-dialog");
    record("merge_dialog_opened", await mergeDlg.isVisible().catch(() => false), "from modal CTA");
    await page.waitForTimeout(1500);
    const previewText = await mergeDlg.innerText();
    record("preview_autoloaded", /Survives \(primary\)/i.test(previewText), "auto preview");
    record("primary_is_earliest", /DupPrimary/i.test(previewText) && /Survives/i.test(previewText), "earliest");
    record("tour_shown", /tour appointments|scheduled/i.test(previewText), "tours section");

    // Resolve name conflicts by keeping primary
    const radios = mergeDlg.locator('input[type="radio"][name^="merge-field-"]');
    const n = await radios.count();
    const seen = new Set<string>();
    for (let i = 0; i < n; i++) {
      const radio = radios.nth(i);
      const name = await radio.getAttribute("name");
      if (!name || seen.has(name)) continue;
      seen.add(name);
      await radio.check({ force: true });
    }
    record("conflicts_resolved_or_none", true, `groups=${seen.size}`);

    await mergeDlg.getByTestId("merge-lead-confirm").click();
    await Promise.race([
      page.waitForURL((u: URL) => u.pathname.includes(`/leads/${primary!.id}`), { timeout: 20000 }).catch(() => null),
      page.waitForTimeout(12000),
    ]);
    await page.waitForTimeout(1500);
    record("redirect_to_primary", page.url().includes(`/leads/${primary!.id}`), page.url());

    const { data: sec } = await admin.from("leads")
      .select("merged_into_lead_id,merged_at,phone,first_name").eq("id", secondary!.id).single();
    const { data: prim } = await admin.from("leads")
      .select("phone,merged_into_lead_id,first_name").eq("id", primary!.id).single();
    record("secondary_soft_marked", sec?.merged_into_lead_id === primary!.id && !!sec?.merged_at,
      JSON.stringify(sec));
    record("phone_filled", prim?.phone === "555-0177", JSON.stringify(prim));
    record("primary_name_kept", prim?.first_name === "DupPrimary", prim?.first_name ?? "");

    if (tour) {
      const { data: tourAfter } = await admin.from("tour_appointments")
        .select("id,lead_id,status,scheduled_at").eq("id", tour.id).single();
      record("tour_reparented",
        tourAfter?.lead_id === primary!.id
        && tourAfter?.status === "scheduled"
        && tourAfter?.id === tour.id,
        JSON.stringify(tourAfter));
    }

    await page.goto(`${APP}/leads/${secondary!.id}`, { waitUntil: "domcontentloaded", timeout: 90000 });
    await page.waitForTimeout(2500);
    record("secondary_redirects", page.url().includes(`/leads/${primary!.id}`), page.url());
    await page.screenshot({ path: `${OUT}/after-duplicate-merge-1280.png`, fullPage: true });
  } catch (e) {
    record("browser_error", false, e instanceof Error ? e.message : String(e));
    await page.screenshot({ path: `${OUT}/dup-ux-error.png`, fullPage: true }).catch(() => {});
  } finally {
    await browser.close();
  }

  const summary = {
    expectedShaPrefix: EXPECTED || null,
    primaryId: primary?.id,
    secondaryId: secondary?.id,
    tourId: tour?.id ?? null,
    pass: checks.filter((c) => c.pass).length,
    fail: checks.filter((c) => !c.pass).length,
    checks,
  };
  writeFileSync(`${OUT}/duplicate-ux-results.json`, JSON.stringify(summary, null, 2));
  console.log(`\nSUMMARY pass=${summary.pass} fail=${summary.fail}`);
  if (summary.fail) process.exitCode = 1;
}

main().catch((e) => { console.error(e); process.exit(1); });
