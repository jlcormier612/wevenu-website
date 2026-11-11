/**
 * Lead workspace polish — identity, Sales & availability, Tour & follow-up.
 * Sandbox only. Read-mostly.
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
const OUT_DIR = "docs/qa/lead-workspace-polish";
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

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  const stamp = Date.now();
  const { data: lead, error: leadErr } = await admin
    .from("leads")
    .insert({
      venue_id: FANCY,
      first_name: "Polish",
      last_name: `Lead${stamp % 10000}`,
      partner_first_name: "Partner",
      partner_last_name: "Name",
      email: `polish-lead-${stamp}@hellotocheers-test.invalid`,
      sales_stage: "new_inquiry",
      status: "active",
      source: "website",
      event_date: "2027-06-12",
      event_type: "wedding",
      guest_count: 120,
      estimated_budget: 15000,
      inquiry_message: "[qa] lead workspace polish",
      inquiry_message_origin: "customer",
    })
    .select("id")
    .single();
  if (leadErr || !lead) throw leadErr ?? new Error("lead");

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  try {
    await page.context().addCookies(await cookiesFor(FANCY_EMAIL));

    for (const width of [390, 1280]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(`${APP}/leads/${lead.id}`, {
        waitUntil: "domcontentloaded",
        timeout: 90000,
      });
      await page.waitForTimeout(2500);
      if (width === 1280) {
        const html = await page.content();
        const dpl =
          html.match(/data-dpl-id="([a-f0-9]+)"/)?.[1]
          || html.match(/[?&]dpl=([a-f0-9]{8,})/)?.[1]
          || "";
        if (EXPECTED_PREFIX) {
          record("deployed_sha_prefix", dpl.startsWith(EXPECTED_PREFIX), `sha=${dpl}`);
        } else {
          record("deployed_sha_prefix", Boolean(dpl), `sha=${dpl || "missing"}`);
        }
      }

      const body = await page.locator("body").innerText();
      record(
        `identity_${width}`,
        /Polish Lead/i.test(body) && /Wedding/i.test(body) && /Jun/i.test(body),
        "name + event metadata",
      );
      record(
        `sales_availability_${width}`,
        (await page.locator('[data-testid="lead-sales-availability"]').count()) === 1
          && /Sales & availability/i.test(body),
        "Sales & availability present",
      );
      record(
        `owner_hold_${width}`,
        (await page.locator('[data-testid="lead-owner-hold-row"]').count()) === 1
          && (await page.locator('[data-testid="lead-staff-assignment"]').count()) === 1,
        "owner + hold row",
      );
      record(
        `tour_followup_title_${width}`,
        (await page.locator('[data-testid="lead-tour-followup-card"]').count()) === 1
          && /Tour & follow-up/i.test(body),
        "Tour & follow-up card",
      );
      record(
        `action_area_${width}`,
        (await page.locator('[data-testid="lead-action-area"]').count()) === 1
          && (await page.getByRole("button", { name: /Schedule Tour/i }).count()) >= 1
          && (await page.getByTestId("start-booking-action").count()) >= 1,
        "Schedule Tour + Start booking",
      );
      record(
        `no_orphan_followup_title_${width}`,
        (await page.locator('[data-slot=card-title]', { hasText: /^Follow-up$/ }).count()) === 0,
        "old Follow-up-only title gone",
      );
      await page.screenshot({ path: `${OUT_DIR}/lead-${width}.png`, fullPage: true });
    }
  } finally {
    await browser.close();
    await admin.from("leads").delete().eq("id", lead.id);
  }

  const pass = checks.every((c) => c.pass);
  const result = { at: new Date().toISOString(), tipPrefix: EXPECTED_PREFIX, pass, checks };
  writeFileSync(`${OUT_DIR}/browser-results.json`, JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
  if (!pass) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
