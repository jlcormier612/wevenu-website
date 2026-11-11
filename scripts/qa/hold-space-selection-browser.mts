/**
 * Sandbox: Hold form Whole venue ↔ individual space mutual exclusion.
 * Fancy Venue disposable lead. Opens form only — cancels without placing a Hold.
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
const OUT = "docs/qa/hold-space-selection";
const EXPECTED_PREFIX = process.env.EXPECTED_TIP_PREFIX ?? "";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
if (!url.includes("wvpsldwwjqdannqasrdf")) throw new Error("refusing non-sandbox");

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
  mkdirSync(OUT, { recursive: true });
  const tipRes = await fetch(`${APP}/login`);
  const tipHtml = await tipRes.text();
  const tip =
    (tipRes.headers.get("link")?.match(/dpl=([a-f0-9]{40})/) || [])[1]
    || (tipHtml.match(/data-dpl-id="([a-f0-9]+)/) || [])[1]
    || "unknown";
  record("serving_tip", !EXPECTED_PREFIX || tip.startsWith(EXPECTED_PREFIX), tip);

  const stamp = Date.now();
  const { data: spaces } = await admin
    .from("venue_spaces")
    .select("id,name,is_active")
    .eq("venue_id", FANCY)
    .eq("is_active", true)
    .order("name")
    .limit(3);
  if (!spaces || spaces.length < 2) throw new Error("need ≥2 active spaces");
  const [a, b] = spaces;

  const { data: lead, error: leadErr } = await admin
    .from("leads")
    .insert({
      venue_id: FANCY,
      first_name: "HoldSel",
      last_name: `QA${stamp % 100000}`,
      email: `hold-sel-${stamp}@hellotocheers-test.invalid`,
      sales_stage: "new_inquiry",
      status: "active",
      source: "other",
      event_date: "2031-06-15",
      event_type: "wedding",
      inquiry_message: "[qa] hold space selection — do not place hold",
    })
    .select("id")
    .single();
  if (leadErr || !lead) throw leadErr ?? new Error("lead");

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  try {
    await page.context().addCookies(await cookiesFor(FANCY_EMAIL));
    await page.goto(`${APP}/leads/${lead.id}`, { waitUntil: "domcontentloaded", timeout: 90000 });
    await page.waitForSelector('[data-testid="date-hold-place"]', { timeout: 30000 });
    await page.click('[data-testid="date-hold-place"]');
    await page.waitForSelector('[data-testid="date-hold-whole-venue"]', { timeout: 15000 });

    const whole = () => page.locator('[data-testid="date-hold-whole-venue"]');
    const space = (id: string) => page.locator(`[data-testid="date-hold-space-${id}"]`);

    // Start: often Whole venue default when no prefs — force Whole venue
    if (!(await whole().isChecked())) await whole().check();
    record("whole_checked", await whole().isChecked(), "Whole venue on");
    record("spaces_unchecked_under_whole", !(await space(a.id).isChecked()) && !(await space(b.id).isChecked()), "spaces off");

    // Click individual space while Whole venue on — must clear Whole venue
    await space(a.id).click();
    record("space_clears_whole", !(await whole().isChecked()) && (await space(a.id).isChecked()), "A on, whole off");

    // Second space
    await space(b.id).click();
    record(
      "multi_space",
      (await space(a.id).isChecked()) && (await space(b.id).isChecked()) && !(await whole().isChecked()),
      "A+B on, whole off",
    );

    // Whole venue clears individuals
    await whole().check();
    record(
      "whole_clears_spaces",
      (await whole().isChecked()) && !(await space(a.id).isChecked()) && !(await space(b.id).isChecked()),
      "whole on, spaces off",
    );

    // Space again, then uncheck one
    await space(a.id).click();
    await space(b.id).click();
    await space(a.id).click(); // uncheck A
    record(
      "uncheck_one_keeps_other",
      !(await space(a.id).isChecked()) && (await space(b.id).isChecked()) && !(await whole().isChecked()),
      "only B",
    );

    // Uncheck last — no silent Whole venue
    await space(b.id).click();
    record(
      "last_uncheck_empty",
      !(await whole().isChecked()) && !(await space(a.id).isChecked()) && !(await space(b.id).isChecked()),
      "empty selection",
    );
    const submitDisabled = await page.locator('[data-testid="date-hold-place-submit"]').isDisabled();
    record("empty_blocks_submit", submitDisabled, `submit disabled=${submitDisabled}`);

    await page.screenshot({ path: `${OUT}/selection-1280.png`, fullPage: true });
    // Cancel — never place a Hold
    await page.getByRole("button", { name: "Cancel" }).click();
  } finally {
    await browser.close();
    await admin.from("leads").delete().eq("id", lead.id).eq("venue_id", FANCY);
  }

  const payload = {
    observedAt: new Date().toISOString(),
    tip,
    leadId: lead.id,
    spaces: spaces.map((s) => ({ id: s.id, name: s.name })),
    checks,
    passCount: checks.filter((c) => c.pass).length,
    failCount: checks.filter((c) => !c.pass).length,
  };
  writeFileSync(`${OUT}/browser-results.json`, JSON.stringify(payload, null, 2));
  console.log(JSON.stringify({ pass: payload.passCount, fail: payload.failCount, tip }, null, 2));
  if (payload.failCount > 0) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
