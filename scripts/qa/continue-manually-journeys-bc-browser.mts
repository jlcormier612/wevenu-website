/**
 * Journey B: direct-to-contract with venue selection, no proposal.
 * Journey C: withdrawn proposal + existing venue selection → Create contract primary.
 * Sandbox disposable only.
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
const PKG = "8832b4e1-c9f0-45e2-85e4-72b29598028e"; // Garden Package
const OUT_DIR = "docs/qa/continue-manually-direct-contract";
const EXPECTED_PREFIX = process.env.EXPECTED_TIP_PREFIX ?? "";

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

async function insertLead(label: string) {
  const stamp = Date.now();
  const { data: lead, error } = await admin
    .from("leads")
    .insert({
      venue_id: FANCY,
      first_name: label,
      last_name: `Bc${stamp % 10000}`,
      email: `${label.toLowerCase()}-${stamp}@hellotocheers-test.invalid`,
      sales_stage: "new_inquiry",
      status: "active",
      source: "website",
      event_date: "2027-09-20",
      inquiry_message: `[qa] continue-manually ${label}`,
      inquiry_message_origin: "customer",
    })
    .select("id")
    .single();
  if (error || !lead) throw error ?? new Error("lead");
  return lead.id as string;
}

async function insertVenueSelection(leadId: string) {
  const { data: sel, error } = await admin
    .from("commercial_selections")
    .insert({
      venue_id: FANCY,
      lead_id: leadId,
      source_package_id: PKG,
      name: "Garden Package",
      status: "draft",
      proposal_id: null,
      total_amount: 12000,
      package_amount: 12000,
      deposit_amount: 3000,
      included_items: [],
    })
    .select("id,proposal_id,status,total_amount")
    .single();
  if (error || !sel) throw error ?? new Error("selection");
  return sel;
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });
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

  const leadB = await insertLead("DirectB");
  const leadC = await insertLead("WithdrC");
  const selB = await insertVenueSelection(leadB);
  const selC = await insertVenueSelection(leadC);
  const { data: propC, error: propErr } = await admin
    .from("commercial_proposals")
    .insert({
      venue_id: FANCY,
      lead_id: leadC,
      status: "withdrawn",
      accept_token: crypto.randomUUID().replace(/-/g, ""),
      offered_at: new Date().toISOString(),
    })
    .select("id,status")
    .single();
  if (propErr || !propC) throw propErr ?? new Error("propC");

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  try {
    await page.context().addCookies(await cookiesFor(FANCY_EMAIL));

    await page.goto(`${APP}/leads/${leadB}`, {
      waitUntil: "domcontentloaded",
      timeout: 90000,
    });
    await page.waitForTimeout(2500);
    const htmlB = await page.content();
    const dpl =
      htmlB.match(/data-dpl-id="([a-f0-9]+)"/)?.[1]
      || htmlB.match(/[?&]dpl=([a-f0-9]{8,})/)?.[1]
      || "";
    if (EXPECTED_PREFIX) {
      record("deployed_sha_prefix", dpl.startsWith(EXPECTED_PREFIX), `sha=${dpl}`);
    } else {
      record("deployed_sha_prefix", Boolean(dpl), `sha=${dpl || "missing"}`);
    }
    record(
      "journey_b_selection_proposal_id_null",
      selB.proposal_id == null,
      JSON.stringify(selB),
    );
    const createB = page.getByRole("button", { name: /^Create contract$/i });
    const countB = await createB.count();
    record("journey_b_create_contract_visible", countB > 0, `count=${countB}`);
    await page.screenshot({ path: `${OUT_DIR}/journey-b.png`, fullPage: true });
    if (countB > 0) {
      await createB.first().click();
      await page.waitForTimeout(5000);
      const urlB = page.url();
      const okB =
        /\/contracts\//.test(urlB) && urlB.includes(`selectionId=${selB.id}`);
      record("journey_b_navigates_direct", okB, urlB);
      // No fabricated acceptance
      const { data: propsB } = await admin
        .from("commercial_proposals")
        .select("id,status")
        .eq("lead_id", leadB);
      record(
        "journey_b_no_proposal_fabricated",
        !propsB?.length,
        JSON.stringify(propsB),
      );
    }

    await page.goto(`${APP}/leads/${leadC}`, {
      waitUntil: "domcontentloaded",
      timeout: 90000,
    });
    await page.waitForTimeout(2500);
    const bodyC = await page.locator("body").innerText();
    const createC = page.getByRole("button", { name: /^Create contract$/i });
    const countC = await createC.count();
    record("journey_c_create_contract_visible", countC > 0, `count=${countC}`);
    record(
      "journey_c_no_continue_manually_as_primary_need",
      !/Continue manually/i.test(bodyC) || countC > 0,
      "Create contract available with withdrawn+selection",
    );
    await page.screenshot({ path: `${OUT_DIR}/journey-c.png`, fullPage: true });
    if (countC > 0) {
      await createC.first().click();
      await page.waitForTimeout(5000);
      const urlC = page.url();
      record(
        "journey_c_navigates",
        /\/contracts\//.test(urlC) && urlC.includes(`selectionId=${selC.id}`),
        urlC,
      );
    }
    const { data: hist } = await admin
      .from("commercial_proposals")
      .select("id,status")
      .eq("id", propC.id)
      .maybeSingle();
    record(
      "journey_c_withdrawn_not_reactivated",
      hist?.status === "withdrawn",
      JSON.stringify(hist),
    );
  } finally {
    await browser.close();
    await admin.from("commercial_selections").delete().eq("lead_id", leadB);
    await admin.from("commercial_selections").delete().eq("lead_id", leadC);
    await admin.from("commercial_proposals").delete().eq("id", propC.id);
    await admin.from("leads").delete().eq("id", leadB);
    await admin.from("leads").delete().eq("id", leadC);
    await admin.from("venues").update({ commercial_booking_prefs: backup }).eq("id", FANCY);
  }

  const pass = checks.every((c) => c.pass);
  const result = { at: new Date().toISOString(), tipPrefix: EXPECTED_PREFIX, pass, checks };
  writeFileSync(`${OUT_DIR}/journeys-bc-results.json`, JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
  if (!pass) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
