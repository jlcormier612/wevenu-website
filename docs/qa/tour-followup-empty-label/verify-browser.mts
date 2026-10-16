/**
 * Sandbox proof: empty Tour & follow-up action reads "Add tour/follow-up details"
 * and still opens the existing editor. Schedule Tour stays separate.
 * Fancy disposable lead. No customer sends.
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
const EXPECTED = (process.env.EXPECTED_SHA ?? "4ab44e5245ecebdf2590477f2004a80414b4a15e").slice(0, 40);
const FANCY = "a415ac52-cd74-42a6-8df7-7a8f6e71d080";
const FANCY_EMAIL = "jennifer@hellotocheers.com";
const OUT = "docs/qa/tour-followup-empty-label";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
if (!url.includes("wvpsldwwjqdannqasrdf")) throw new Error("refusing non-sandbox");

const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const anon = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } });

const checks: { name: string; pass: boolean; detail: string }[] = [];
function record(name: string, pass: boolean, detail: string) {
  checks.push({ name, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"} ${name} — ${detail}`);
}

async function cookies() {
  const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({ type: "magiclink", email: FANCY_EMAIL });
  if (linkErr) throw linkErr;
  const { data: otpData, error: otpErr } = await anon.auth.verifyOtp({
    type: "email",
    token_hash: linkData.properties!.hashed_token!,
  });
  if (otpErr || !otpData.session) throw otpErr ?? new Error("no session");
  const cookieName = "sb-wvpsldwwjqdannqasrdf-auth-token";
  const encoded = "base64-" + ssrUtils.stringToBase64URL(JSON.stringify(otpData.session));
  return [
    ...ssrUtils.createChunks(cookieName, encoded).map((c: { name: string; value: string }) => ({
      name: c.name, value: c.value, domain: "app.sandbox.hellotocheers.com", path: "/",
      httpOnly: false, secure: true, sameSite: "Lax" as const,
    })),
    { name: "htc_active_venue_id", value: FANCY, domain: "app.sandbox.hellotocheers.com", path: "/", httpOnly: false, secure: true, sameSite: "Lax" as const },
  ];
}

mkdirSync(OUT, { recursive: true });
const stamp = Date.now();
const { data: lead, error: leadErr } = await admin.from("leads").insert({
  venue_id: FANCY,
  first_name: "Empty",
  last_name: `TourFU${stamp % 100000}`,
  email: `empty-tourfu-${stamp}@hellotocheers-test.invalid`,
  sales_stage: "new_inquiry",
  status: "active",
  source: "other",
  inquiry_message: "[qa] empty tour follow-up label",
  inquiry_message_origin: "venue",
}).select("id").single();
if (leadErr || !lead) throw new Error(leadErr?.message ?? "lead");

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
try {
  await page.context().addCookies(await cookies());
  const head = await page.goto(`${APP}/leads/${lead.id}`, { waitUntil: "networkidle", timeout: 90_000 });
  const dpl = head?.headers()?.link?.match(/dpl=([0-9a-f]{40})/i)?.[1] ?? "";
  record("serving_commit", dpl.startsWith(EXPECTED.slice(0, 12)), dpl);

  const edit = page.getByTestId("tour-followup-edit");
  await edit.waitFor({ timeout: 45_000 });
  const label = (await edit.innerText()).replace(/\s+/g, " ").trim();
  record("empty_label", label === "Add tour/follow-up details", label);
  record("old_label_absent", !(await page.getByRole("button", { name: "Add follow-up details", exact: true }).count()), "exact old button");

  const schedule = page.getByRole("button", { name: "Schedule Tour" });
  record("schedule_tour_present", (await schedule.count()) >= 1, `count=${await schedule.count()}`);

  await edit.scrollIntoViewIfNeeded();
  await edit.click();
  const card = page.getByTestId("lead-tour-followup-card");
  await card.getByText("Follow-up date", { exact: true }).waitFor({ timeout: 15_000 });
  record("editor_opens", true, "Follow-up date field");
  record(
    "tour_fields_in_editor",
    (await card.getByText("Tour date", { exact: true }).count()) > 0,
    "Tour date field",
  );
  record("schedule_tour_still_present", (await schedule.count()) >= 1, "unchanged after open");
  await page.screenshot({ path: `${OUT}/empty-editor-1280.png`, fullPage: false });
} finally {
  await browser.close();
  await admin.from("leads").delete().eq("id", lead.id).eq("venue_id", FANCY);
  writeFileSync(`${OUT}/browser-results.json`, JSON.stringify({ checks, leadId: lead.id, expected: EXPECTED }, null, 2));
  if (checks.some((c) => !c.pass)) process.exitCode = 1;
}
