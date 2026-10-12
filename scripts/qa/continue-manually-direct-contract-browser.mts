/**
 * Continue manually → withdraw → Select package → Create contract (offer-only Fancy).
 * Sandbox disposable only. No Production. No real customer email.
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
const FANCY_EMAIL = "jennifer@hellotocheers.com";
const FANCY = "a415ac52-cd74-42a6-8df7-7a8f6e71d080";
const OUT_DIR = "docs/qa/continue-manually-direct-contract";

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

async function cookiesFor(email: string) {
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
  mkdirSync(OUT_DIR, { recursive: true });
  const stamp = Date.now();
  const { data: venue } = await admin
    .from("venues")
    .select("commercial_booking_prefs")
    .eq("id", FANCY)
    .single();
  const backup = venue?.commercial_booking_prefs ?? {};
  await admin
    .from("venues")
    .update({
      commercial_booking_prefs: {
        ...(typeof backup === "object" && backup ? backup : {}),
        agreementMethod: "offer",
        useDiscounts: true,
        useTaxes: true,
      },
    })
    .eq("id", FANCY);

  const { data: lead, error: leadErr } = await admin
    .from("leads")
    .insert({
      venue_id: FANCY,
      first_name: "Manual",
      last_name: `Take${stamp % 10000}`,
      email: `manual-take-${stamp}@hellotocheers-test.invalid`,
      sales_stage: "new_inquiry",
      status: "active",
      source: "website",
      event_date: "2027-08-15",
      inquiry_message: "[qa] continue manually direct contract",
      inquiry_message_origin: "customer",
    })
    .select("id")
    .single();
  if (leadErr || !lead) throw leadErr ?? new Error("lead");

  const { data: prop, error: propErr } = await admin
    .from("commercial_proposals")
    .insert({
      venue_id: FANCY,
      lead_id: lead.id,
      status: "sent",
      accept_token: crypto.randomUUID().replace(/-/g, ""),
      offered_at: new Date().toISOString(),
    })
    .select("id,status")
    .single();
  if (propErr || !prop) throw propErr ?? new Error("proposal");

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  try {
    await page.context().addCookies(await cookiesFor(FANCY_EMAIL));
    await page.goto(`${APP}/leads/${lead.id}`, {
      waitUntil: "domcontentloaded",
      timeout: 90000,
    });
    await page.waitForTimeout(2500);
    const body1 = await page.locator("body").innerText();
    record("sent_shows_continue_manually", /Continue manually/i.test(body1), "visible");
    record(
      "sent_hides_create_contract",
      !page.getByRole("button", { name: /^Create contract$/i }).first()
        || (await page.getByRole("button", { name: /^Create contract$/i }).count()) === 0,
      "no Create contract while waiting",
    );
    await page.screenshot({ path: `${OUT_DIR}/01-sent-waiting.png`, fullPage: true });

    const cont = page.getByRole("button", { name: /Continue manually/i }).first();
    if (await cont.count()) {
      await cont.click();
      await page.waitForTimeout(400);
      await page.getByRole("button", { name: /Withdraw proposal & continue manually/i }).click();
      await page.waitForTimeout(3500);
    } else {
      record("withdraw_clicked", false, "Continue manually missing");
    }

    const { data: propAfter } = await admin
      .from("commercial_proposals")
      .select("status")
      .eq("id", prop.id)
      .maybeSingle();
    record("proposal_withdrawn_persisted", propAfter?.status === "withdrawn", `status=${propAfter?.status}`);
    await page.screenshot({ path: `${OUT_DIR}/02-after-withdraw.png`, fullPage: true });

    const selBtn = page.getByRole("button", { name: /^Select package$/i }).first();
    record("select_package_after_withdraw", (await selBtn.count()) > 0, `count=${await selBtn.count()}`);
    if (await selBtn.count()) {
      await selBtn.click();
      await page.waitForTimeout(1000);
      const sheet = page.locator("[data-slot='sheet-content'], [role='dialog']").last();
      const pkgCard = sheet
        .getByRole("button", { name: /Essential Wedding|Weekend Wedding|Full Service|Garden/i })
        .first();
      if (await pkgCard.count()) await pkgCard.click();
      await page.waitForTimeout(400);
      const save = sheet.getByRole("button", { name: /Save selected package/i });
      if (await save.isEnabled().catch(() => false)) {
        await save.click();
        await page.waitForTimeout(3500);
        record("package_saved", true, "Save selected package");
      } else {
        record("package_saved", false, "Save disabled");
      }
    }

    await page.goto(`${APP}/leads/${lead.id}`, {
      waitUntil: "domcontentloaded",
      timeout: 90000,
    });
    await page.waitForTimeout(2500);
    await page.screenshot({ path: `${OUT_DIR}/03-after-package.png`, fullPage: true });

    const { data: sel } = await admin
      .from("commercial_selections")
      .select("id,status,proposal_id,total_amount,package_amount")
      .eq("lead_id", lead.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    record(
      "selection_proposal_id_null",
      !!sel?.id && sel.proposal_id == null,
      JSON.stringify(sel),
    );

    const createBtn = page.getByRole("button", { name: /^Create contract$/i }).first();
    const createCount = await createBtn.count();
    record("create_contract_visible", createCount > 0, `count=${createCount}`);
    if (createCount > 0) {
      await createBtn.click();
      await page.waitForTimeout(5000);
      const onContract = /\/contracts\//.test(page.url());
      record("create_contract_navigates", onContract, page.url());
      await page.screenshot({ path: `${OUT_DIR}/04-contract.png`, fullPage: true });
    }

    // History: withdrawn proposal still exists, not accepted
    const { data: hist } = await admin
      .from("commercial_proposals")
      .select("id,status")
      .eq("id", prop.id)
      .maybeSingle();
    record(
      "withdrawn_history_intact",
      hist?.status === "withdrawn",
      JSON.stringify(hist),
    );
  } finally {
    await browser.close();
    await admin.from("commercial_selections").delete().eq("lead_id", lead.id);
    await admin.from("commercial_proposals").delete().eq("id", prop.id);
    await admin.from("leads").delete().eq("id", lead.id);
    await admin.from("venues").update({ commercial_booking_prefs: backup }).eq("id", FANCY);
  }

  const pass = checks.every((c) => c.pass);
  const result = { at: new Date().toISOString(), pass, checks };
  writeFileSync(`${OUT_DIR}/browser-results.json`, JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
  if (!pass) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
