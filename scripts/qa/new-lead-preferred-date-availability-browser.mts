/**
 * Sandbox: New Lead preferred-date live conflict + soft override.
 * Fancy Venue only. Creates a disposable lead; cleans it up.
 * No customer communications.
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
const OUT_DIR = "docs/qa/new-lead-preferred-date-availability";
const AVAILABLE_DATE = "2027-03-15";
const CONFLICT_DATE = "2027-12-25"; // Fancy Christmas blocked date
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
let createdLeadId: string | null = null;

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

async function cleanupLead(leadId: string) {
  await admin.from("date_holds").delete().eq("lead_id", leadId).eq("venue_id", FANCY);
  await admin.from("leads").delete().eq("id", leadId).eq("venue_id", FANCY);
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  const stamp = Date.now();
  const tipHtml = await fetch(`${APP}/login`).then(async (r) => ({
    text: await r.text(),
    link: r.headers.get("link") ?? "",
  }));
  const tip =
    (tipHtml.link.match(/dpl=([a-f0-9]{40})/) || [])[1]
    || (tipHtml.text.match(/data-dpl-id="([a-f0-9]+)/) || [])[1]
    || "unknown";
  if (EXPECTED_PREFIX && !tip.startsWith(EXPECTED_PREFIX)) {
    record("serving_tip", false, `expected ${EXPECTED_PREFIX}… got ${tip}`);
  } else {
    record("serving_tip", true, tip);
  }

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  try {
    await page.context().addCookies(await cookiesFor(FANCY_EMAIL));
    await page.goto(`${APP}/leads/new`, { waitUntil: "domcontentloaded", timeout: 90000 });
    await page.waitForSelector("#eventDate", { timeout: 30000 });

    const labelText = await page.locator("label[for='eventDate']").innerText();
    record("label_preferred_event_date", /Preferred event date/i.test(labelText), labelText.trim());

    const hint = await page.locator("label[for='eventDate']").locator("xpath=..").locator("p").innerText().catch(() => "");
    record(
      "helper_does_not_reserve",
      /does not reserve or book the date/i.test(hint),
      hint.slice(0, 200),
    );

    // Available date — no conflict panel
    await page.fill("#eventDate", AVAILABLE_DATE);
    await page.waitForTimeout(800);
    const checkingGone = await page.locator('[data-testid="preferred-date-checking"]').count() === 0
      || await page.waitForSelector('[data-testid="preferred-date-checking"]', { state: "detached", timeout: 15000 }).then(() => true).catch(() => false);
    await page.waitForTimeout(400);
    const conflictOnAvailable = await page.locator('[data-testid="preferred-date-conflict"]').count();
    record("available_date_no_conflict", checkingGone && conflictOnAvailable === 0, `conflicts=${conflictOnAvailable}`);
    await page.screenshot({ path: `${OUT_DIR}/available-1280.png`, fullPage: true });

    // Conflicted Christmas — inline warning
    await page.fill("#eventDate", CONFLICT_DATE);
    await page.waitForSelector('[data-testid="preferred-date-conflict"]', { timeout: 20000 });
    const conflictText = await page.locator('[data-testid="preferred-date-conflict"]').innerText();
    record(
      "conflict_inline_warning",
      /unavailable|blocked|booked|hold/i.test(conflictText),
      conflictText.replace(/\s+/g, " ").slice(0, 240),
    );
    record(
      "conflict_actions_visible",
      (await page.locator('[data-testid="preferred-date-keep"]').count()) === 1
        && (await page.locator('[data-testid="preferred-date-choose-another"]').count()) === 1,
      "keep + choose another",
    );
    await page.screenshot({ path: `${OUT_DIR}/conflict-1280.png`, fullPage: true });

    // Change date clears / updates — back to available
    await page.fill("#eventDate", AVAILABLE_DATE);
    await page.waitForTimeout(1200);
    const cleared = await page.locator('[data-testid="preferred-date-conflict"]').count() === 0;
    record("date_change_clears_conflict", cleared, `after ${AVAILABLE_DATE}`);
    await page.screenshot({ path: `${OUT_DIR}/cleared-1280.png`, fullPage: true });

    // Conflict again + keep + save
    await page.fill("#eventDate", CONFLICT_DATE);
    await page.waitForSelector('[data-testid="preferred-date-conflict"]', { timeout: 20000 });
    await page.click('[data-testid="preferred-date-keep"]');
    await page.waitForSelector('[data-testid="preferred-date-kept"]', { timeout: 5000 });
    record("keep_acknowledged", true, "preferred-date-kept visible");

    const last = `PrefDate${stamp % 100000}`;
    await page.fill("#firstName", "QA");
    await page.fill("#lastName", last);
    // Event type — pick first option if empty
    const typeVal = await page.locator("#eventType").innerText().catch(() => "");
    if (!typeVal || /select/i.test(typeVal)) {
      await page.click("#eventType");
      await page.keyboard.press("ArrowDown");
      await page.keyboard.press("Enter");
    }

    await page.getByRole("button", { name: "Save inquiry" }).click();
    await page.waitForURL(/\/leads\/[0-9a-f-]{36}/, { timeout: 60000 });
    const leadUrl = page.url();
    const leadId = (leadUrl.match(/\/leads\/([0-9a-f-]{36})/) || [])[1] ?? null;
    createdLeadId = leadId;
    record("override_save_navigated", !!leadId, leadUrl);

    if (leadId) {
      const { data: lead } = await admin
        .from("leads")
        .select("id, event_date, venue_id")
        .eq("id", leadId)
        .maybeSingle();
      record(
        "db_preferred_date_persisted",
        lead?.event_date === CONFLICT_DATE && lead?.venue_id === FANCY,
        JSON.stringify(lead),
      );

      const { count: holdCount } = await admin
        .from("date_holds")
        .select("id", { count: "exact", head: true })
        .eq("lead_id", leadId);
      const { count: eventCount } = await admin
        .from("events")
        .select("id", { count: "exact", head: true })
        .eq("venue_id", FANCY)
        .eq("lead_id", leadId);
      // events may not have lead_id — also check via clients
      const { data: clients } = await admin.from("clients").select("id").eq("lead_id", leadId);
      let eventsViaClient = 0;
      for (const c of clients ?? []) {
        const { count } = await admin.from("events").select("id", { count: "exact", head: true }).eq("client_id", c.id);
        eventsViaClient += count ?? 0;
      }
      record(
        "db_no_hold_created",
        (holdCount ?? 0) === 0,
        `holds=${holdCount}`,
      );
      record(
        "db_no_booked_event_created",
        (eventCount ?? 0) === 0 && eventsViaClient === 0,
        `events_lead=${eventCount} events_client=${eventsViaClient}`,
      );
      await page.screenshot({ path: `${OUT_DIR}/saved-1280.png`, fullPage: true });
    }
  } finally {
    await browser.close();
    if (createdLeadId) {
      await cleanupLead(createdLeadId).catch((e) => console.warn("cleanup", e));
    }
  }

  const payload = {
    observedAt: new Date().toISOString(),
    tip,
    availableDate: AVAILABLE_DATE,
    conflictDate: CONFLICT_DATE,
    createdLeadId,
    cleanedUp: !!createdLeadId,
    checks,
    passCount: checks.filter((c) => c.pass).length,
    failCount: checks.filter((c) => !c.pass).length,
  };
  writeFileSync(`${OUT_DIR}/browser-results.json`, JSON.stringify(payload, null, 2));
  console.log(JSON.stringify({ pass: payload.passCount, fail: payload.failCount, tip }, null, 2));
  if (payload.failCount > 0) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
