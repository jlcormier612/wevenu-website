/**
 * HQ White-Glove extra-event parity — isolated Chromium on localhost:3040.
 */
import { createRequire } from "node:module";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

config({ path: ".env.local", quiet: true });
const require = createRequire("/Users/jensmac/Developer/wevenu-website/marketing/package.json");
const { chromium } = require("playwright");
const ssrUtils = require("/Users/jensmac/Developer/wevenu-website/node_modules/@supabase/ssr/dist/main/utils/index.js");

const APP = "http://localhost:3040";
const OUT = `${process.env.HOME}/Desktop/HTC-Phase-B-HQ-Parity-Acceptance`;
const FANCY = "a415ac52-cd74-42a6-8df7-7a8f6e71d080";
const WILLOW = "31f38b79-eb99-4ebc-81bc-af85767b42aa";
if (!process.env.NEXT_PUBLIC_SUPABASE_URL?.includes("wvpsldwwjqdannqasrdf")) {
  throw new Error("Refusing: not Sandbox supabase");
}
mkdirSync(OUT, { recursive: true });

const creds = JSON.parse(readFileSync("/tmp/htc-byb-hq-parity-creds.json", "utf8")) as {
  venueEmail: string;
  venuePassword: string;
  hqEmail: string;
  hqPassword: string;
  venueId: string;
  venueName: string;
  spaceId: string;
};
if (creds.venueId === FANCY || creds.venueId === WILLOW) throw new Error("Refusing protected venue");

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
);
const anon = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  { auth: { persistSession: false } },
);

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
  if (otpErr || !otpData.session) throw otpErr ?? new Error(`no session for ${email}`);
  const encoded = "base64-" + ssrUtils.stringToBase64URL(JSON.stringify(otpData.session));
  return ssrUtils.createChunks("sb-wvpsldwwjqdannqasrdf-auth-token", encoded).map(
    (c: { name: string; value: string }) => ({
      name: c.name,
      value: c.value,
      domain: "localhost",
      path: "/",
      httpOnly: false,
      secure: false,
      sameSite: "Lax" as const,
    }),
  );
}

type Check = { name: string; pass: boolean; detail: string; category: string };
const checks: Check[] = [];
function record(category: string, name: string, pass: boolean, detail: string) {
  checks.push({ category, name, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"} [${category}] ${name} — ${detail.slice(0, 500)}`);
}

async function shot(page: { screenshot: (o: object) => Promise<Buffer> }, name: string) {
  writeFileSync(`${OUT}/${name}.png`, await page.screenshot({ fullPage: true }));
}

async function persistSnapshot(label: string) {
  const venueId = creds.venueId;
  const q = (table: string, cols: string) => admin.from(table).select(cols).eq("venue_id", venueId);
  const [clients, events, leads, qbo, invites, setup, contracts, payments, messages, sms, scheduled] = await Promise.all([
    q("clients", "id, first_name, last_name, email, event_date, status, venue_id"),
    q("events", "id, client_id, name, status, event_date, booked_at, space_id, venue_id"),
    q("leads", "id, first_name, email, sales_stage, venue_id, source_data"),
    q("quickbooks_sync_queue", "id"),
    q("client_invitations", "id"),
    q("event_setup_states", "event_id"),
    q("contracts", "id"),
    q("payments", "id"),
    q("messages", "id"),
    q("sms_messages", "id"),
    q("scheduled_messages", "id"),
  ]);
  const snap = {
    label,
    clients: clients.data ?? [],
    events: events.data ?? [],
    leads: leads.data ?? [],
    qbo: qbo.data ?? [],
    invites: invites.data ?? [],
    setupStates: setup.data ?? [],
    contracts: contracts.data ?? [],
    payments: payments.data ?? [],
    messages: messages.data ?? [],
    sms: sms.data ?? [],
    scheduled: scheduled.data ?? [],
    errors: {
      clients: clients.error?.message,
      events: events.error?.message,
    },
  };
  writeFileSync(`${OUT}/persist-${label}.json`, JSON.stringify(snap, null, 2));
  return snap;
}

async function passWelcome(page: {
  url: () => string;
  locator: (s: string) => { count: () => Promise<number>; waitFor: (o?: object) => Promise<void>; check: (o?: object) => Promise<void> };
  getByRole: (r: string, o?: object) => { click: () => Promise<void> };
  waitForURL: (u: (url: URL) => boolean, o?: object) => Promise<void>;
}) {
  if (!page.url().includes("/welcome")) return;
  const box = page.locator("#welcome-experience-agree");
  await box.waitFor({ timeout: 8000 }).catch(() => {});
  if (await box.count()) await box.check({ force: true });
  await page.getByRole("button", { name: "Continue" }).click();
  await page.waitForURL((url: URL) => !url.pathname.includes("/welcome"), { timeout: 20000, waitUntil: "commit" }).catch(() => {});
}

const browser = await chromium.launch({ headless: true });
const hqContext = await browser.newContext({ viewport: { width: 1440, height: 1100 } });
await hqContext.addCookies(await cookiesFor(creds.hqEmail));
const page = await hqContext.newPage();
page.setDefaultTimeout(25000);

async function openClientsUpload() {
  const wizard = page.locator("#wg-import-wizard");
  await wizard.waitFor({ timeout: 20000 });
  if (await page.getByTestId("byb-paste-textarea").count()) return;
  if (await page.getByText("Import more", { exact: true }).count()) {
    await page.getByText("Import more", { exact: true }).click();
  }
  await page.locator('[data-testid="byb-entity-select"][data-hydrated="true"]').waitFor({ timeout: 20000 });
  await wizard.getByTestId("byb-entity-couples").click();
  await page.getByTestId("byb-paste-textarea").waitFor({ timeout: 20000 });
}

async function importHqCsv(file: string, shotPrefix: string) {
  await openClientsUpload();
  await page.locator('[data-testid="byb-use-paste"][data-hydrated="true"]').waitFor({ timeout: 15000 });
  await page.getByTestId("byb-paste-textarea").fill(readFileSync(file, "utf8"));
  await page.getByTestId("byb-use-paste").click();
  const previewBtn = page.getByRole("button", { name: /Preview/ });
  await previewBtn.waitFor({ timeout: 25000 });
  await shot(page, `${shotPrefix}-map`);
  await previewBtn.click();
  await page.getByTestId("byb-match-checking").waitFor({ state: "hidden", timeout: 20000 }).catch(() => {});
  if (await page.getByTestId("byb-match-review").count()) await shot(page, `${shotPrefix}-match`);
  const importBtn = page.getByTestId("byb-import-confirm");
  await page.locator('[data-testid="byb-import-confirm"]:not([disabled])').waitFor({ timeout: 20000 });
  await importBtn.click();
  await page.getByRole("heading", { name: "Import complete" }).waitFor({ timeout: 40000 });
  await shot(page, `${shotPrefix}-result`);
  const body = (await page.locator("main").innerText()).slice(0, 2200);
  await page.getByText("Import more").click();
  await page.locator('[data-testid="byb-entity-select"][data-hydrated="true"]').waitFor({ timeout: 20000 });
  return body;
}

try {
  await page.goto(`${APP}/admin/onboarding/${creds.venueId}`, { waitUntil: "domcontentloaded" });
  await page.getByText(/Import data for/i).waitFor({ timeout: 25000 });
  await shot(page, "01-hq-onboarding");
  record("hq", "HQ admin reached White-Glove onboarding import", page.url().includes(creds.venueId), page.url());

  const upcoming = await importHqCsv("/tmp/htc-byb-hq-parity-fixtures/upcoming.csv", "02-upcoming");
  record("hq", "First upcoming Client+Event imported", /Imported\s*\n?\s*1/.test(upcoming) || /Imported\s+1/.test(upcoming), upcoming.slice(0, 400));

  const second = await importHqCsv("/tmp/htc-byb-hq-parity-fixtures/second-event.csv", "03-second");
  record("hq", "Second distinct Event attached to same Client", /Imported\s*\n?\s*1/.test(second) || /Imported\s+1/.test(second), second.slice(0, 500));

  const retry = await importHqCsv("/tmp/htc-byb-hq-parity-fixtures/retry.csv", "04-retry");
  record("hq", "Retry of same event date skipped", /already in Hello to Cheers|Left out|not imported/i.test(retry), retry.slice(0, 500));

  const historical = await importHqCsv("/tmp/htc-byb-hq-parity-fixtures/historical.csv", "05-historical");
  record("hq", "Historical Client+Event imported", /Imported\s*\n?\s*1/.test(historical) || /Imported\s+1/.test(historical), historical.slice(0, 400));

  const missing = await importHqCsv("/tmp/htc-byb-hq-parity-fixtures/missing-date.csv", "06-missing-date");
  record("hold", "Missing date held", /confirmed event date|Errors/i.test(missing), missing.slice(0, 400));

  const badSpace = await importHqCsv("/tmp/htc-byb-hq-parity-fixtures/bad-space.csv", "07-bad-space");
  record("hold", "Invalid space held", /space|Errors|not imported/i.test(badSpace), badSpace.slice(0, 400));

  const clash = await importHqCsv("/tmp/htc-byb-hq-parity-fixtures/clash.csv", "08-clash");
  record("hold", "Occupancy clash held", /already booked|overlap|Errors|not imported/i.test(clash), clash.slice(0, 500));

  const emailOnly = await importHqCsv("/tmp/htc-byb-hq-parity-fixtures/email-only.csv", "09-email-only");
  record("hq", "Email-only likely match did not merge", /Left out|already in Hello to Cheers|different name|not imported/i.test(emailOnly), emailOnly.slice(0, 500));

  const persist = await persistSnapshot("after-hq-imports");
  const clients = persist.clients as Array<Record<string, unknown>>;
  const events = persist.events as Array<Record<string, unknown>>;
  const dana = clients.filter((c) => String(c.email) === "dana.booked@byb.test");
  const owen = clients.filter((c) => String(c.email) === "owen.past@byb.test");
  const nodate = clients.filter((c) => String(c.email) === "hold.nodate@byb.test");
  const bad = clients.filter((c) => String(c.email) === "hold.badspace@byb.test");
  const clashRow = clients.filter((c) => String(c.email) === "clash.hq@byb.test");
  const other = clients.filter((c) => String(c.first_name) === "Other");
  const danaEvents = events.filter((e) => dana.some((c) => c.id === e.client_id) && String(e.status) !== "cancelled");
  const owenEvents = events.filter((e) => owen.some((c) => c.id === e.client_id));
  const isolationOk = [...clients, ...events].every((row) => row.venue_id === creds.venueId);

  record("persist", "Dana Client exists once", dana.length === 1, JSON.stringify(dana));
  record("persist", "Dana has two distinct Events", danaEvents.length >= 2, JSON.stringify(danaEvents.map((e) => e.event_date)));
  record("persist", "Retry did not duplicate 2027-10-10", danaEvents.filter((e) => String(e.event_date).startsWith("2027-10-10")).length === 1, JSON.stringify(danaEvents));
  record("persist", "Owen historical complete Event", owen.length === 1 && owenEvents.some((e) => String(e.status) === "complete"), JSON.stringify(owenEvents));
  record("persist", "No orphan for missing date", nodate.length === 0, `n=${nodate.length}`);
  record("persist", "No orphan for invalid space", bad.length === 0, `n=${bad.length}`);
  record("persist", "No orphan for occupancy clash", clashRow.length === 0, `n=${clashRow.length}`);
  record("persist", "Email-only Other person not created", other.length === 0, `n=${other.length}`);
  record("safety", "No QBO / invites / contracts / payments", persist.qbo.length === 0 && persist.invites.length === 0 && persist.contracts.length === 0 && persist.payments.length === 0, JSON.stringify({ qbo: persist.qbo, invites: persist.invites }));
  record("safety", "No email, SMS, or scheduled messages", persist.messages.length === 0 && persist.sms.length === 0 && persist.scheduled.length === 0, JSON.stringify({ messages: persist.messages, sms: persist.sms, scheduled: persist.scheduled }));
  record("safety", "Historical Owen did not inherit Setup Profile", !owenEvents.some((e) => persist.setupStates.some((s: { event_id: string }) => s.event_id === e.id)), JSON.stringify(persist.setupStates));
  record("safety", "All rows isolated to disposable venue", isolationOk, creds.venueId);

  await hqContext.close();
  const venueContext = await browser.newContext({ viewport: { width: 1440, height: 1100 } });
  await venueContext.addCookies(await cookiesFor(creds.venueEmail));
  const venuePage = await venueContext.newPage();
  venuePage.setDefaultTimeout(25000);
  await venuePage.goto(`${APP}/clients`, { waitUntil: "domcontentloaded" });
  await passWelcome(venuePage);
  if (!venuePage.url().includes("/clients")) {
    await venuePage.goto(`${APP}/clients`, { waitUntil: "domcontentloaded" });
  }
  await venuePage.getByText("Loading clients").waitFor({ state: "hidden", timeout: 20000 }).catch(() => {});
  await shot(venuePage, "10-venue-all-bookings");
  const bookings = await venuePage.locator("main").innerText();
  record("discover", "Dana appears under All Bookings", /Dana/.test(bookings), bookings.slice(0, 300));

  await venuePage.goto(`${APP}/clients?filter=past`, { waitUntil: "domcontentloaded" });
  await venuePage.getByText("Loading clients").waitFor({ state: "hidden", timeout: 20000 }).catch(() => {});
  await shot(venuePage, "11-venue-past");
  record("discover", "Owen appears under Past", /Owen/.test(await venuePage.locator("main").innerText()), "");

  if (dana[0]?.id) {
    await venuePage.goto(`${APP}/clients/${dana[0].id}`, { waitUntil: "domcontentloaded" });
    await venuePage.getByText("Loading booking workspace").waitFor({ state: "hidden", timeout: 30000 }).catch(() => {});
    await venuePage.getByText(/Dana/i).waitFor({ timeout: 20000 }).catch(() => {});
    await shot(venuePage, "12-dana-workspace");
    const workspace = await venuePage.locator("main").innerText();
    record("discover", "Dana client record opens a booked workspace", /Dana|Wedding|2027|2028/i.test(workspace), workspace.slice(0, 400));
  }
  await venuePage.goto(`${APP}/calendar?year=2027&month=10`, { waitUntil: "domcontentloaded" });
  await venuePage.getByText(/October|1 Event|Dana/i).waitFor({ timeout: 25000 }).catch(() => {});
  await shot(venuePage, "13-calendar-2027-10");
  const oct = await venuePage.locator("main").innerText();
  record("discover", "October 2027 calendar shows occupying Event", /1 Event|Dana|Wedding/i.test(oct), oct.slice(0, 400));
  await venuePage.goto(`${APP}/calendar?year=2028&month=3`, { waitUntil: "domcontentloaded" });
  await venuePage.getByText(/March|1 Event|Dana/i).waitFor({ timeout: 25000 }).catch(() => {});
  await shot(venuePage, "14-calendar-2028-03");
  const mar = await venuePage.locator("main").innerText();
  record("discover", "March 2028 calendar shows second Event", /1 Event|Dana|Wedding/i.test(mar), mar.slice(0, 400));

  let priorNotes: unknown = [];
  try {
    const prior = JSON.parse(readFileSync("/tmp/htc-byb-corrected-creds.json", "utf8")) as { venueId?: string };
    if (prior.venueId) {
      const { data: riley } = await admin.from("leads")
        .select("id, source_data, inquiry_message")
        .eq("venue_id", prior.venueId)
        .eq("email", "riley.prospect@byb.test");
      const ids = (riley ?? []).map((r: { id: string }) => r.id);
      const { data: notes } = ids.length
        ? await admin.from("lead_notes").select("lead_id, body").in("lead_id", ids)
        : { data: [] };
      priorNotes = { leads: riley, notes };
      writeFileSync(`${OUT}/date-flexibility-prior-venue.json`, JSON.stringify(priorNotes, null, 2));
      const hasFlex = (riley ?? []).some((r: { source_data?: { date_flexibility?: string } }) => r.source_data?.date_flexibility)
        && (notes ?? []).some((n: { body?: string }) => /Date flexibility:/i.test(n.body ?? ""));
      record("limits", "Date flexibility remains in source_data and a readable lead note", hasFlex, JSON.stringify(priorNotes).slice(0, 600));
    } else {
      record("limits", "Date flexibility prior venue creds missing", false, "no prior venue");
    }
  } catch (err) {
    record("limits", "Date flexibility prior venue lookup", false, err instanceof Error ? err.message : String(err));
  }

  await venueContext.close();
} catch (err) {
  record("runtime", "Browser script error", false, err instanceof Error ? err.stack ?? err.message : String(err));
  await shot(page, "99-error").catch(() => {});
} finally {
  const grouped = new Map<string, Check[]>();
  for (const c of checks) grouped.set(c.category, [...(grouped.get(c.category) ?? []), c]);
  const verdicts: Record<string, string> = {};
  for (const [cat, items] of grouped) {
    verdicts[cat] = items.every((i) => i.pass) ? "GREEN" : items.some((i) => i.pass) ? "YELLOW" : "RED";
  }
  writeFileSync(`${OUT}/report.json`, JSON.stringify({ venueId: creds.venueId, hqEmail: creds.hqEmail, verdicts, checks }, null, 2));
  console.log("\n=== VERDICTS ===");
  console.log(JSON.stringify(verdicts, null, 2));
  console.log(`Wrote ${OUT}`);
  await browser.close();
}
