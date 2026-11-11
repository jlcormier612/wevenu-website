/**
 * Sandbox browser + API: existing-lead tour SMS consent checked → Opted in.
 * Disposable records only. Production untouched.
 */
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
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
const EXPECTED = process.env.EXPECT_SHA ?? "c7bb386ac5850d30a967488989216d4b07bf7376";
const FANCY_EMAIL = "jennifer@hellotocheers.com";
const FANCY = "a415ac52-cd74-42a6-8df7-7a8f6e71d080";
const OUT_DIR = resolve("docs/qa/tour-sms-consent-opt-in");
mkdirSync(OUT_DIR, { recursive: true });

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
const deploymentIds = new Set<string>();

function record(name: string, pass: boolean, detail: string) {
  checks.push({ name, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"} ${name} — ${detail}`);
}

function noteDeployment(linkHeader: string | undefined) {
  const match = linkHeader?.match(/dpl=([0-9a-f]{40})/);
  if (match) deploymentIds.add(match[1]);
  return match?.[1] ?? null;
}

function isOptedInLabel(text: string): boolean {
  // Product label for communication_permissions.status=opted_in is "Allowed".
  return text.trim().toLowerCase() === "allowed";
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
  return ssrUtils.createChunks(cookieName, encoded).map(
    (c: { name: string; value: string }) => ({
      name: c.name,
      value: c.value,
      domain: "app.sandbox.hellotocheers.com",
      path: "/",
      httpOnly: false,
      secure: true,
      sameSite: "Lax" as const,
    }),
  );
}

function normalizeKey(phone: string): string {
  const d = phone.replace(/\D/g, "");
  return d.length === 10 ? `1${d}` : d;
}

async function main() {
  const stamp = Date.now();
  const phoneChecked = `(978) 555-${String(stamp).slice(-4)}`;
  const phoneUnchecked = `(978) 554-${String(stamp).slice(-4)}`;
  const emailChecked = `sms-consent-checked-${stamp}@example.test`;
  const emailUnchecked = `sms-consent-unchecked-${stamp}@example.test`;
  const createdLeadIds: string[] = [];
  const addressKeys: string[] = [];
  const appointmentIds: string[] = [];

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    permissions: ["clipboard-read", "clipboard-write"],
  });
  await context.addCookies(await cookiesFor(FANCY_EMAIL));
  const page = await context.newPage();

  const login = await page.goto(APP + "/leads", { waitUntil: "domcontentloaded", timeout: 90_000 });
  const serving = noteDeployment(login?.headers()["link"]);
  record("serving_tip", serving === EXPECTED, `serving=${serving} expected=${EXPECTED}`);

  const { data: venue } = await admin.from("venues")
    .select("id, name, tour_embed_key, tour_scheduling_enabled")
    .eq("id", FANCY).single();
  if (!venue?.tour_embed_key || !venue.tour_scheduling_enabled) {
    throw new Error("Fancy tour scheduling not enabled");
  }
  const embedKey = venue.tour_embed_key as string;

  async function createLead(email: string, phone: string) {
    const { data, error } = await admin.rpc("ingest_lead", {
      p_venue_id: FANCY,
      p_source: "website",
      p_input: {
        firstName: "SmsConsent",
        lastName: `Browser${String(stamp).slice(-4)}`,
        email,
        phone,
        eventType: "wedding",
        eventDate: "2027-09-12",
        guestCount: 80,
        inquiryMessage: "Disposable SMS consent browser fixture",
        inquiryMessageOrigin: "staff",
      },
    });
    if (error || !(data as { ok?: boolean })?.ok) {
      throw new Error(`ingest_lead: ${error?.message ?? JSON.stringify(data)}`);
    }
    const leadId = (data as { leadId: string }).leadId;
    createdLeadIds.push(leadId);
    addressKeys.push(normalizeKey(phone));
    return leadId;
  }

  async function personalTourUrl(leadId: string): Promise<string> {
    await page.goto(`${APP}/leads/${leadId}`, { waitUntil: "domcontentloaded", timeout: 90_000 });
    noteDeployment((await page.reload({ waitUntil: "domcontentloaded" })).headers()["link"]);
    await page.waitForTimeout(2000);
    const btn = page.getByTestId("lead-copy-scheduling-link");
    if (!(await btn.count())) throw new Error("copy scheduling link button missing");
    await btn.click();
    await page.waitForTimeout(1500);
    const clip = await page.evaluate(() => navigator.clipboard.readText());
    if (!clip.includes("/book/") || !clip.includes("o=")) {
      throw new Error(`clipboard missing personal link: ${clip.slice(0, 120)}`);
    }
    return clip.trim();
  }

  async function firstSlot(originQuery: string): Promise<string> {
    const start = new Date();
    start.setUTCDate(start.getUTCDate() + 2);
    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + 45);
    const startS = start.toISOString().slice(0, 10);
    const endS = end.toISOString().slice(0, 10);
    const res = await fetch(
      `${APP}/api/tours/slots?key=${encodeURIComponent(embedKey)}&start=${startS}&end=${endS}`,
    );
    const data = (await res.json()) as { slots?: Array<{ start: string }> };
    const slot = data.slots?.[0]?.start;
    if (!slot) throw new Error(`no slots ${startS}..${endS} (${originQuery})`);
    return slot;
  }

  async function bookViaApi(opts: {
    tourUrl: string;
    phone: string;
    email: string;
    firstName: string;
    lastName: string;
    smsPermissionGranted: boolean;
    clearFormPhone: boolean;
  }) {
    const u = new URL(opts.tourUrl);
    const originToken = u.searchParams.get("o");
    const slotStart = await firstSlot(originToken ?? "");
    const body = {
      key: embedKey,
      slotStart,
      firstName: opts.firstName,
      lastName: opts.lastName,
      partnerName: "",
      email: opts.email,
      phone: opts.clearFormPhone ? "" : opts.phone,
      eventType: "wedding",
      eventDate: "",
      guestCount: 80,
      notes: "SMS consent QA",
      originToken,
      preferredCommunicationChannels: opts.smsPermissionGranted ? ["email", "sms"] : ["email"],
      smsPermissionGranted: opts.smsPermissionGranted,
    };
    const res = await fetch(`${APP}/api/tours/book`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = await res.json();
    if (json.appointmentId) appointmentIds.push(json.appointmentId);
    return json as {
      ok: boolean;
      appointmentId?: string;
      leadId?: string;
      error?: string;
      checkoutUrl?: string;
    };
  }

  const leadChecked = await createLead(emailChecked, phoneChecked);
  const leadUnchecked = await createLead(emailUnchecked, phoneUnchecked);

  let tourChecked = "";
  let tourUnchecked = "";
  try {
    tourChecked = await personalTourUrl(leadChecked);
    tourUnchecked = await personalTourUrl(leadUnchecked);
    record("personal_links", true, tourChecked.slice(0, 100));
  } catch (e) {
    record("personal_links", false, String(e));
  }

  // Public page: phone prefilled + consent visible (checked path screenshot)
  if (tourChecked) {
    const pub = await context.newPage();
    const resp = await pub.goto(tourChecked, { waitUntil: "domcontentloaded", timeout: 90_000 });
    noteDeployment(resp?.headers()["link"]);
    await pub.waitForTimeout(2500);
    const phoneVal = await pub.locator('input[type="tel"]').first().inputValue().catch(() => "");
    record("phone_prefilled_on_personal_link", normalizeKey(phoneVal) === normalizeKey(phoneChecked), phoneVal);
    const consentVisible = await pub.getByText(/receive text messages from/i).count();
    record("consent_checkbox_visible", consentVisible > 0, `count=${consentVisible}`);
    await pub.screenshot({ path: resolve(OUT_DIR, "public-personal-link-1280.png"), fullPage: true });
    await pub.setViewportSize({ width: 390, height: 844 });
    await pub.reload({ waitUntil: "domcontentloaded" });
    await pub.waitForTimeout(1500);
    await pub.screenshot({ path: resolve(OUT_DIR, "public-personal-link-390.png"), fullPage: true });
    await pub.close();
  }

  let bookChecked: Awaited<ReturnType<typeof bookViaApi>> | null = null;
  let bookUnchecked: Awaited<ReturnType<typeof bookViaApi>> | null = null;
  if (tourChecked) {
    // Critical: empty form phone + checkbox true → server uses on-file phone
    bookChecked = await bookViaApi({
      tourUrl: tourChecked,
      phone: phoneChecked,
      email: emailChecked,
      firstName: "SmsConsent",
      lastName: `Browser${String(stamp).slice(-4)}`,
      smsPermissionGranted: true,
      clearFormPhone: true,
    });
    record("book_checked_ok", bookChecked.ok === true && !!bookChecked.appointmentId,
      JSON.stringify({ ok: bookChecked.ok, appointmentId: bookChecked.appointmentId, error: bookChecked.error, checkout: !!bookChecked.checkoutUrl }));
  }
  if (tourUnchecked) {
    bookUnchecked = await bookViaApi({
      tourUrl: tourUnchecked,
      phone: phoneUnchecked,
      email: emailUnchecked,
      firstName: "SmsConsent",
      lastName: `Unchk${String(stamp).slice(-4)}`,
      smsPermissionGranted: false,
      clearFormPhone: false,
    });
    record("book_unchecked_ok", bookUnchecked.ok === true && !!bookUnchecked.appointmentId,
      JSON.stringify({ ok: bookUnchecked.ok, error: bookUnchecked.error }));
  }

  // Allow consent write to finish
  await new Promise((r) => setTimeout(r, 2000));

  const keyChecked = normalizeKey(phoneChecked);
  const keyUnchecked = normalizeKey(phoneUnchecked);
  const { data: permChecked } = await admin.from("communication_permissions")
    .select("status, source, evidence")
    .eq("venue_id", FANCY).eq("channel", "sms").eq("address_key", keyChecked).maybeSingle();
  const { data: permUnchecked } = await admin.from("communication_permissions")
    .select("status, source")
    .eq("venue_id", FANCY).eq("channel", "sms").eq("address_key", keyUnchecked).maybeSingle();

  record(
    "checked_db_opted_in",
    permChecked?.status === "opted_in" && permChecked?.source === "tour_form"
      && (permChecked.evidence as { leadId?: string } | null)?.leadId === leadChecked,
    JSON.stringify(permChecked),
  );
  record(
    "unchecked_db_no_consent",
    permUnchecked == null || permUnchecked.status !== "opted_in",
    JSON.stringify(permUnchecked),
  );

  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(`${APP}/leads/${leadChecked}`, { waitUntil: "domcontentloaded", timeout: 90_000 });
  await page.waitForTimeout(2000);
  const toggle = page.getByTestId("communication-preferences-toggle");
  if (await toggle.count()) await toggle.click();
  await page.waitForTimeout(500);
  const statusText = await page.getByTestId("communication-preferences-status").innerText().catch(() => "");
  record("checked_ui_opted_in", isOptedInLabel(statusText), statusText);
  await page.screenshot({ path: resolve(OUT_DIR, "lead-checked-contact-1280.png"), fullPage: true });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1500);
  if (await toggle.count()) await toggle.click().catch(() => {});
  await page.screenshot({ path: resolve(OUT_DIR, "lead-checked-contact-390.png"), fullPage: true });
  const statusMobile = await page.getByTestId("communication-preferences-status").innerText().catch(() => "");
  record("checked_ui_opted_in_390", isOptedInLabel(statusMobile), statusMobile);

  // Texting unconfigured notice can coexist — do not require texting setup
  const bodyText = await page.locator("body").innerText();
  record(
    "texting_setup_independent",
    isOptedInLabel(statusMobile) || isOptedInLabel(statusText),
    bodyText.includes("Texting isn't set up")
      ? "opted-in label with setup notice present or not — consent label authoritative"
      : "no setup notice; consent label authoritative",
  );

  // Cleanup disposable
  for (const appt of appointmentIds) {
    await admin.from("tour_appointments").delete().eq("id", appt);
  }
  for (const key of addressKeys) {
    await admin.from("communication_permissions").delete().eq("venue_id", FANCY).eq("address_key", key);
  }
  for (const id of createdLeadIds) {
    await admin.from("tour_appointments").delete().eq("lead_id", id);
    await admin.from("leads").delete().eq("id", id).eq("venue_id", FANCY);
  }

  const out = {
    expectedSha: EXPECTED,
    deploymentIds: [...deploymentIds],
    serving,
    checks,
    pass: checks.every((c) => c.pass),
    leadChecked,
    leadUnchecked,
    phoneChecked,
    phoneUnchecked,
    bookChecked,
    bookUnchecked,
  };
  writeFileSync(resolve(OUT_DIR, "browser-results.json"), JSON.stringify(out, null, 2));
  console.log(JSON.stringify({ pass: out.pass, serving, failed: checks.filter((c) => !c.pass) }, null, 2));
  await browser.close();
  if (!out.pass) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
