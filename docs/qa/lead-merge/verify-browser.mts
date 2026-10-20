/**
 * Sandbox browser: Merge lead dialog + confirm on disposable Fancy leads.
 * No customer emails. Production untouched.
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
const EXPECTED = (process.env.EXPECTED_SHA ?? "14bf79a6f04ad43a7dbd89c7a1e3d67b37918919").slice(0, 40);
const FANCY = "a415ac52-cd74-42a6-8df7-7a8f6e71d080";
const FANCY_EMAIL = "jennifer@hellotocheers.com";
const OUT = "docs/qa/lead-merge";
mkdirSync(OUT, { recursive: true });

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
  console.log(`${pass ? "PASS" : "FAIL"} ${name} — ${detail.slice(0, 280)}`);
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

async function main() {
  const stamp = Date.now();
  // Same identity fields so only phone is a fill — avoids unresolved conflict radios.
  const sharedName = { first_name: "MergeQA", last_name: `Dup${stamp}` };
  const { data: leadA } = await admin.from("leads").insert({
    venue_id: FANCY,
    ...sharedName,
    email: `merge-qa.${stamp}@example.invalid`,
    phone: null,
    sales_stage: "new_inquiry",
    inquiry_message: `QA merge primary ${stamp}`,
    exclude_from_business_reporting: true,
  }).select("id").single();
  await new Promise((r) => setTimeout(r, 80));
  const { data: leadB } = await admin.from("leads").insert({
    venue_id: FANCY,
    ...sharedName,
    email: `merge-qa.${stamp}@example.invalid`,
    phone: "555-0188",
    sales_stage: "new_inquiry",
    inquiry_message: `QA merge secondary ${stamp}`,
    exclude_from_business_reporting: true,
  }).select("id").single();
  record("fixtures_created", !!leadA && !!leadB, `A=${leadA?.id} B=${leadB?.id}`);

  const cookies = await authFor(FANCY_EMAIL);
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  await context.addCookies(cookies);
  const page = await context.newPage();

  try {
    await page.goto(`${APP}/leads/${leadB!.id}`, { waitUntil: "domcontentloaded", timeout: 90000 });
    await page.waitForTimeout(2500);
    const mergeBtn = page.getByTestId("merge-lead-open");
    const visible = await mergeBtn.isVisible().catch(() => false);
    record("merge_button_visible", visible, visible ? "ok" : "missing Merge lead control");
    if (!visible) {
      await page.screenshot({ path: `${OUT}/browser-no-merge.png`, fullPage: true });
      throw new Error("Merge button not visible — serving build may lack UI");
    }
    await mergeBtn.click();
    await page.waitForTimeout(600);
    const dialog = page.getByTestId("merge-lead-dialog");
    record("merge_dialog_open", await dialog.isVisible().catch(() => false), "dialog");
    await page.getByTestId("merge-other-lead-id").fill(leadA!.id);
    await page.getByRole("button", { name: "Preview" }).click();
    await page.waitForTimeout(2000);
    const survives = await page.getByText("Survives (primary)").isVisible().catch(() => false);
    record("preview_shows_primary", survives, "Survives label");
    await page.screenshot({ path: `${OUT}/merge-preview-1280.png`, fullPage: true });
    // Resolve any remaining conflict radios by keeping primary values
    const conflictRadios = page.locator('input[type="radio"][name^="merge-field-"]');
    const radioCount = await conflictRadios.count();
    for (let i = 0; i < radioCount; i++) {
      const radio = conflictRadios.nth(i);
      const name = await radio.getAttribute("name");
      // First radio in each name group = keep primary
      const already = await page.locator(`input[name="${name}"]:checked`).count();
      if (already === 0 && (await radio.evaluate((el: HTMLInputElement) =>
        el === document.querySelector(`input[name="${el.name}"]`)))) {
        await radio.check({ force: true });
      }
    }
    const confirmBtn = page.getByTestId("merge-lead-confirm");
    const disabled = await confirmBtn.isDisabled().catch(() => true);
    record("confirm_enabled", !disabled, disabled ? "disabled" : "enabled");
    await confirmBtn.click();
    await Promise.race([
      page.waitForURL((u: URL) => u.pathname.includes(`/leads/${leadA!.id}`), { timeout: 20000 }).catch(() => null),
      page.waitForTimeout(10000),
    ]);
    await page.waitForTimeout(1500);
    const toastText = await page.locator("[data-sonner-toast], li[data-sonner-toast]").allTextContents().catch(() => []);
    const urlAfter = page.url();
    record("redirected_to_primary", urlAfter.includes(`/leads/${leadA!.id}`),
      `${urlAfter} | toast=${JSON.stringify(toastText)}`);

    const { data: secondary } = await admin.from("leads")
      .select("merged_into_lead_id,merged_at,phone").eq("id", leadB!.id).single();
    const { data: primary } = await admin.from("leads")
      .select("phone,merged_into_lead_id").eq("id", leadA!.id).single();
    record("db_secondary_soft_marked",
      secondary?.merged_into_lead_id === leadA!.id && !!secondary?.merged_at,
      JSON.stringify(secondary));
    record("db_phone_filled",
      primary?.phone === "555-0188" && primary?.merged_into_lead_id == null,
      JSON.stringify(primary));

    // Opening secondary should redirect
    await page.goto(`${APP}/leads/${leadB!.id}`, { waitUntil: "domcontentloaded", timeout: 90000 });
    await page.waitForTimeout(2500);
    record("secondary_page_redirects",
      page.url().includes(`/leads/${leadA!.id}`),
      page.url());
    await page.screenshot({ path: `${OUT}/after-merge-primary-1280.png`, fullPage: true });
  } catch (e) {
    record("browser_error", false, e instanceof Error ? e.message : String(e));
    await page.screenshot({ path: `${OUT}/browser-error.png`, fullPage: true }).catch(() => {});
  } finally {
    await browser.close();
  }

  const summary = {
    expectedSha: EXPECTED,
    fancy: FANCY,
    primaryId: leadA?.id,
    secondaryId: leadB?.id,
    pass: checks.filter((c) => c.pass).length,
    fail: checks.filter((c) => !c.pass).length,
    checks,
  };
  writeFileSync(`${OUT}/browser-results.json`, JSON.stringify(summary, null, 2));
  console.log(`\nSUMMARY pass=${summary.pass} fail=${summary.fail}`);
  if (summary.fail) process.exitCode = 1;
}

main().catch((e) => { console.error(e); process.exit(1); });
