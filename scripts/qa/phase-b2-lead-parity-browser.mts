/**
 * Corrected Phase B.2 — Lead HQ parity + preview classification.
 * Isolated Chromium on localhost:3040 against NEW disposable venues.
 */
import { createRequire } from "node:module";
import { mkdirSync, readFileSync, writeFileSync, copyFileSync, readdirSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

config({ path: ".env.local", quiet: true });
const require = createRequire("/Users/jensmac/Developer/wevenu-website/marketing/package.json");
const { chromium } = require("playwright");
const ssrUtils = require("/Users/jensmac/Developer/wevenu-website/node_modules/@supabase/ssr/dist/main/utils/index.js");

const APP = "http://localhost:3040";
const OUT = `${process.env.HOME}/Desktop/HTC-Phase-B2-Lead-Parity-Acceptance`;
const FANCY = "a415ac52-cd74-42a6-8df7-7a8f6e71d080";
const WILLOW = "31f38b79-eb99-4ebc-81bc-af85767b42aa";
const FIX = "/tmp/htc-byb-b2-lead-parity-fixtures";

if (!process.env.NEXT_PUBLIC_SUPABASE_URL?.includes("wvpsldwwjqdannqasrdf")) {
  throw new Error("Refusing: not Sandbox supabase");
}
mkdirSync(OUT, { recursive: true });

const creds = JSON.parse(readFileSync("/tmp/htc-byb-b2-lead-parity-creds.json", "utf8")) as {
  ssEmail: string;
  ssVenueId: string;
  ssVenueName: string;
  hqEmail: string;
  hqVenueId: string;
  hqVenueName: string;
};
if (creds.ssVenueId === FANCY || creds.ssVenueId === WILLOW || creds.hqVenueId === FANCY || creds.hqVenueId === WILLOW) {
  throw new Error("Refusing protected venue");
}

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

async function persistSnapshot(label: string, venueId: string) {
  const q = (table: string, cols: string) => admin.from(table).select(cols).eq("venue_id", venueId);
  const [
    clients, events, leads, batches, qbo, invites, setup, contracts, payments, messages, sms, scheduled,
  ] = await Promise.all([
    q("clients", "id, first_name, last_name, email, event_date, status, venue_id, relationship_id"),
    q("events", "id, client_id, name, status, event_date, booked_at, space_id, venue_id"),
    q("leads", "id, first_name, last_name, email, partner_first_name, partner_last_name, event_date, event_type, guest_count, source, sales_stage, follow_up_date, next_action_text, inquiry_message, source_data, venue_id, relationship_id, is_historical_import"),
    q("import_batches", "id, entity_type, imported_count, skipped_count, error_count, source_label, rolled_back_at"),
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
    venueId,
    clients: clients.data ?? [],
    events: events.data ?? [],
    leads: leads.data ?? [],
    batches: batches.data ?? [],
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
      leads: leads.error?.message,
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

type ImportOutcome = { imported: string; errors: string; body: string; plan: string; match: string };

async function finishImport(page: {
  locator: (s: string) => {
    count: () => Promise<number>;
    waitFor: (o?: object) => Promise<void>;
    innerText: () => Promise<string>;
    isDisabled: () => Promise<boolean>;
  };
  getByTestId: (s: string) => {
    count: () => Promise<number>;
    waitFor: (o?: object) => Promise<void>;
    click: () => Promise<void>;
    innerText: () => Promise<string>;
    isDisabled: () => Promise<boolean>;
  };
  getByRole: (r: string, o?: object) => { waitFor: (o?: object) => Promise<void>; click: () => Promise<void> };
}, shotPrefix: string): Promise<ImportOutcome> {
  const previewBtn = page.getByRole("button", { name: /Preview/ });
  await previewBtn.waitFor({ timeout: 25000 });
  await shot(page, `${shotPrefix}-map`);
  await previewBtn.click();
  await page.getByTestId("byb-match-checking").waitFor({ state: "hidden", timeout: 20000 }).catch(() => {});
  const plan = await page.getByTestId("byb-import-plan").innerText().catch(() => "");
  const match = await page.getByTestId("byb-match-review").innerText().catch(() => "");
  if (await page.getByTestId("byb-match-review").count()) await shot(page, `${shotPrefix}-match`);
  const importBtn = page.getByTestId("byb-import-confirm");
  await page.locator('[data-testid="byb-import-confirm"]:not([disabled])').waitFor({ timeout: 20000 });
  await importBtn.click();
  await page.getByRole("heading", { name: "Import complete" }).waitFor({ timeout: 40000 });
  await shot(page, `${shotPrefix}-result`);
  const imported = await page.locator("text=Imported").locator("xpath=..").innerText().catch(() => "");
  const errors = await page.locator("text=Errors").locator("xpath=..").innerText().catch(() => "");
  const body = (await page.locator("main").innerText()).slice(0, 2500);
  return { imported, errors, body, plan, match };
}

async function importSelfService(
  page: {
    goto: (u: string, o?: object) => Promise<unknown>;
    getByTestId: (s: string) => {
      waitFor: (o?: object) => Promise<void>;
      fill: (t: string) => Promise<void>;
      click: () => Promise<void>;
      count: () => Promise<number>;
      innerText: () => Promise<string>;
      isDisabled: () => Promise<boolean>;
    };
    locator: (s: string) => {
      waitFor: (o?: object) => Promise<void>;
      count: () => Promise<number>;
      innerText: () => Promise<string>;
      isDisabled: () => Promise<boolean>;
    };
    getByRole: (r: string, o?: object) => { waitFor: (o?: object) => Promise<void>; click: () => Promise<void> };
  },
  stage: "leads" | "clients",
  file: string,
  shotPrefix: string,
): Promise<ImportOutcome> {
  await page.goto(`${APP}/setup-hub/bring-your-business?stage=${stage}&entry=files`, { waitUntil: "domcontentloaded" });
  await page.getByTestId("byb-paste-textarea").waitFor({ timeout: 20000 });
  await page.locator('[data-testid="byb-use-paste"][data-hydrated="true"]').waitFor({ timeout: 15000 });
  await page.getByTestId("byb-paste-textarea").fill(readFileSync(file, "utf8"));
  await page.getByTestId("byb-use-paste").click();
  return finishImport(page, shotPrefix);
}

async function openHqEntity(
  page: {
    locator: (s: string) => { waitFor: (o?: object) => Promise<void>; count: () => Promise<number> };
    getByTestId: (s: string) => { click: () => Promise<void>; waitFor: (o?: object) => Promise<void>; count: () => Promise<number>; fill: (t: string) => Promise<void> };
    getByText: (s: string | RegExp, o?: object) => { count: () => Promise<number>; click: () => Promise<void> };
  },
  entity: "leads" | "couples",
) {
  const wizard = page.locator("#wg-import-wizard");
  await wizard.waitFor({ timeout: 20000 });
  if (await page.getByTestId("byb-paste-textarea").count()) return;
  if (await page.getByText("Import more", { exact: true }).count()) {
    await page.getByText("Import more", { exact: true }).click();
  }
  await page.locator('[data-testid="byb-entity-select"][data-hydrated="true"]').waitFor({ timeout: 20000 });
  await page.getByTestId(`byb-entity-${entity}`).click();
  await page.getByTestId("byb-paste-textarea").waitFor({ timeout: 20000 });
}

async function importHq(
  page: {
    locator: (s: string) => {
      waitFor: (o?: object) => Promise<void>;
      count: () => Promise<number>;
      innerText: () => Promise<string>;
      isDisabled: () => Promise<boolean>;
    };
    getByTestId: (s: string) => {
      click: () => Promise<void>;
      waitFor: (o?: object) => Promise<void>;
      count: () => Promise<number>;
      fill: (t: string) => Promise<void>;
      innerText: () => Promise<string>;
      isDisabled: () => Promise<boolean>;
    };
    getByText: (s: string | RegExp, o?: object) => { count: () => Promise<number>; click: () => Promise<void> };
    getByRole: (r: string, o?: object) => { waitFor: (o?: object) => Promise<void>; click: () => Promise<void> };
  },
  entity: "leads" | "couples",
  file: string,
  shotPrefix: string,
): Promise<ImportOutcome> {
  await openHqEntity(page, entity);
  await page.locator('[data-testid="byb-use-paste"][data-hydrated="true"]').waitFor({ timeout: 15000 });
  await page.getByTestId("byb-paste-textarea").fill(readFileSync(file, "utf8"));
  await page.getByTestId("byb-use-paste").click();
  const result = await finishImport(page, shotPrefix);
  if (await page.getByText("Import more").count()) {
    await page.getByText("Import more").click();
    await page.locator('[data-testid="byb-entity-select"][data-hydrated="true"]').waitFor({ timeout: 20000 });
  }
  return result;
}

function leadFacts(snap: { leads: Array<Record<string, unknown>> }, email: string) {
  return snap.leads.filter((l) => String(l.email) === email);
}

const browser = await chromium.launch({ headless: true });

try {
  const ssContext = await browser.newContext({ viewport: { width: 1440, height: 1100 } });
  await ssContext.addCookies(await cookiesFor(creds.ssEmail));
  const page = await ssContext.newPage();
  page.setDefaultTimeout(25000);

  await page.goto(`${APP}/setup-hub/bring-your-business?stage=leads&entry=files`, { waitUntil: "domcontentloaded" });
  await passWelcome(page);
  if (!page.url().includes("bring-your-business")) {
    await page.goto(`${APP}/setup-hub/bring-your-business?stage=leads&entry=files`, { waitUntil: "domcontentloaded" });
  }
  await page.getByTestId("byb-paste-textarea").waitFor({ timeout: 25000 });
  await shot(page, "ss-01-leads-entry");
  record("ss", "Self-service venue reached Bring Your Business on localhost:3040", page.url().includes("bring-your-business"), page.url());

  const twoDates = await importSelfService(page, "leads", `${FIX}/leads-riley.csv`, "ss-02-riley-two-dates");
  record("ss-A", "Preview did not call the second Riley date a duplicate", !/same email|Skip — duplicate/i.test(twoDates.match + twoDates.plan), `${twoDates.plan}\n${twoDates.match.slice(0, 800)}`);
  record("ss-A", "Preview counts two new inquiries", /2 new/i.test(twoDates.plan), twoDates.plan);
  record("ss-A", "First Riley file imported two inquiries", /Imported/.test(twoDates.body) && /2/.test(twoDates.imported + twoDates.body), twoDates.body.slice(0, 500));

  const retry = await importSelfService(page, "leads", `${FIX}/leads-riley.csv`, "ss-03-riley-retry");
  record("ss-B", "Retry preview identifies inquiries already present", /already in Hello to Cheers|will be left out|skip 2/i.test(`${retry.plan}\n${retry.match}\n${retry.body}`), `${retry.plan}\n${retry.body.slice(0, 500)}`);
  record("ss-B", "Retry did not import new Riley inquiries", !/Imported\s*\n?\s*[12]/.test(retry.body) || /Imported\s*\n?\s*0/.test(retry.body) || /not imported|Left out|already/i.test(retry.body), retry.body.slice(0, 500));

  const emailOnly = await importSelfService(page, "leads", `${FIX}/leads-email-only.csv`, "ss-04-email-only");
  record("ss-C", "Email-only preview defaults to Skip / likely match", /likely|left out|Skip/i.test(`${emailOnly.plan}\n${emailOnly.match}\n${emailOnly.body}`), `${emailOnly.plan}\n${emailOnly.match.slice(0, 600)}`);
  record("ss-C", "Email-only Other Office was not imported", /Left out|not imported|already/i.test(emailOnly.body) && !/Imported\n1/.test(emailOnly.body.replace(/\s+/g, "\n")), emailOnly.body.slice(0, 500));

  const blank = await importSelfService(page, "leads", `${FIX}/leads-blank.csv`, "ss-05-blank");
  record("ss-D", "Blank-date preview keeps distinguishable rows importable", /2 new|Create 2/i.test(blank.plan) || /additional inquiry|New person/i.test(blank.match), `${blank.plan}\n${blank.match.slice(0, 800)}`);
  record("ss-D", "Blank-date import completed", /Import complete/.test(blank.body), blank.body.slice(0, 400));

  const morganClient = await importSelfService(page, "clients", `${FIX}/clients-morgan.csv`, "ss-06-morgan-booked");
  record("ss-E", "Morgan booked Client imported", /Import complete/.test(morganClient.body), morganClient.body.slice(0, 400));
  const morganLead = await importSelfService(page, "leads", `${FIX}/leads-morgan-inquiry.csv`, "ss-07-morgan-inquiry");
  record("ss-E", "Morgan unbooked inquiry imported as a Lead", /Import complete/.test(morganLead.body), morganLead.body.slice(0, 400));

  const bella = await importSelfService(page, "clients", `${FIX}/clients-bella.csv`, "ss-08-bella");
  record("regression", "Bella booked Client imported", /Import complete/.test(bella.body), bella.body.slice(0, 400));
  const bellaSecond = await importSelfService(page, "clients", `${FIX}/clients-bella-second.csv`, "ss-09-bella-second");
  record("regression", "Bella extra Event imported", /Import complete/.test(bellaSecond.body), bellaSecond.body.slice(0, 400));
  const bellaRetry = await importSelfService(page, "clients", `${FIX}/clients-bella-retry.csv`, "ss-10-bella-retry");
  record("regression", "Bella same-date retry skipped", /already in Hello to Cheers|Left out|not imported/i.test(bellaRetry.body), bellaRetry.body.slice(0, 500));
  const mira = await importSelfService(page, "clients", `${FIX}/clients-mira.csv`, "ss-11-mira");
  record("regression", "Historical Mira imported", /Import complete/.test(mira.body), mira.body.slice(0, 400));
  const hold = await importSelfService(page, "clients", `${FIX}/clients-hold.csv`, "ss-12-hold");
  record("regression", "Missing date held", /confirmed event date|Errors|not imported/i.test(hold.body), hold.body.slice(0, 400));

  await page.goto(`${APP}/leads`, { waitUntil: "domcontentloaded" });
  await page.getByText("Riley").first().waitFor({ timeout: 20000 }).catch(() => {});
  await shot(page, "ss-13-leads-list");
  const leadsList = await page.locator("main").innerText();
  record("ss-A", "Riley appears on Leads", /Riley/.test(leadsList), leadsList.slice(0, 400));

  const ssPersist = await persistSnapshot("self-service", creds.ssVenueId);
  const riley = leadFacts(ssPersist, "riley.prospect@byb.test");
  const rileyDates = riley.map((l) => String(l.event_date ?? "").slice(0, 10)).sort();
  const rileyBlank = riley.filter((l) => !String(l.event_date ?? "").slice(0, 10));
  const other = ssPersist.leads.filter((l) => String(l.first_name) === "Other");
  const morganLeads = leadFacts(ssPersist, "morgan.booked@byb.test");
  const morganClients = ssPersist.clients.filter((c) => String(c.email) === "morgan.booked@byb.test");
  const morganEvents = ssPersist.events.filter((e) => morganClients.some((c) => c.id === e.client_id) && String(e.status) !== "cancelled");
  const bellaClients = ssPersist.clients.filter((c) => String(c.email) === "bella.upcoming@byb.test");
  const bellaEvents = ssPersist.events.filter((e) => bellaClients.some((c) => c.id === e.client_id) && String(e.status) !== "cancelled");
  const miraClients = ssPersist.clients.filter((c) => String(c.email) === "mira.historical@byb.test");
  const miraEvents = ssPersist.events.filter((e) => miraClients.some((c) => c.id === e.client_id));
  const nodate = ssPersist.clients.filter((c) => String(c.email) === "hold.nodate@byb.test");
  const isolationOk = [...ssPersist.clients, ...ssPersist.events, ...ssPersist.leads].every((row) => row.venue_id === creds.ssVenueId);

  record("ss-A", "Persisted distinct Riley inquiries for 2027-06-12 and 2028-05-03", rileyDates.includes("2027-06-12") && rileyDates.includes("2028-05-03"), JSON.stringify(riley.map((l) => ({ id: l.id, date: l.event_date, stage: l.sales_stage, source: l.source, partner: l.partner_first_name, guests: l.guest_count, follow: l.follow_up_date, next: l.next_action_text, notes: l.inquiry_message, flex: l.source_data }))));
  record("ss-B", "Riley dated inquiries were not duplicated on retry", riley.filter((l) => String(l.event_date ?? "").startsWith("2027-06-12")).length === 1 && riley.filter((l) => String(l.event_date ?? "").startsWith("2028-05-03")).length === 1, JSON.stringify(rileyDates));
  record("ss-C", "Other Office was not created from Riley's email", other.length === 0, `other=${other.length}`);
  record("ss-D", "Distinguishable blank-date Riley inquiries persisted", rileyBlank.length >= 2, JSON.stringify(rileyBlank.map((l) => ({ id: l.id, source: l.source, notes: l.inquiry_message, sourceData: l.source_data }))));
  record("ss-D", "Identical blank-date retry did not add a third blank inquiry", rileyBlank.length === 2, `blank=${rileyBlank.length}`);
  record("ss-E", "Morgan booking unchanged as a single Event", morganClients.length === 1 && morganEvents.length === 1 && String(morganEvents[0]?.event_date).startsWith("2027-09-12"), JSON.stringify({ clients: morganClients, events: morganEvents }));
  record("ss-E", "Morgan unbooked inquiry persisted as a Lead, not a second booking", morganLeads.some((l) => String(l.sales_stage) !== "booked" && String(l.event_date ?? "").startsWith("2028-02-02")) && morganEvents.length === 1, JSON.stringify(morganLeads.map((l) => ({ id: l.id, date: l.event_date, stage: l.sales_stage }))));
  record("regression", "Bella has two distinct Events and same-date retry stayed one 2027-10-10", bellaClients.length === 1 && bellaEvents.length >= 2 && bellaEvents.filter((e) => String(e.event_date).startsWith("2027-10-10")).length === 1, JSON.stringify(bellaEvents.map((e) => e.event_date)));
  record("regression", "Mira historical Event is complete", miraClients.length === 1 && miraEvents.some((e) => String(e.status) === "complete"), JSON.stringify(miraEvents));
  record("regression", "Hold prevented a missing-date booking", nodate.length === 0, `nodate=${nodate.length}`);
  record("safety", "Self-service venue isolated", isolationOk, creds.ssVenueId);
  record("safety", "No QBO / invites / contracts / payments / messages on self-service", ssPersist.qbo.length === 0 && ssPersist.invites.length === 0 && ssPersist.contracts.length === 0 && ssPersist.payments.length === 0 && ssPersist.messages.length === 0 && ssPersist.sms.length === 0 && ssPersist.scheduled.length === 0, JSON.stringify({ qbo: ssPersist.qbo, invites: ssPersist.invites, messages: ssPersist.messages, sms: ssPersist.sms }));
  await ssContext.close();

  const hqContext = await browser.newContext({ viewport: { width: 1440, height: 1100 } });
  await hqContext.addCookies(await cookiesFor(creds.hqEmail));
  const hqPage = await hqContext.newPage();
  hqPage.setDefaultTimeout(25000);
  await hqPage.goto(`${APP}/admin/onboarding/${creds.hqVenueId}`, { waitUntil: "domcontentloaded" });
  await hqPage.getByText(/Import data for/i).waitFor({ timeout: 25000 });
  await shot(hqPage, "hq-01-onboarding");
  record("hq", "HQ admin reached White-Glove onboarding import", hqPage.url().includes(creds.hqVenueId), hqPage.url());

  const hqTwo = await importHq(hqPage, "leads", `${FIX}/leads-riley.csv`, "hq-02-riley-two-dates");
  record("hq-A", "HQ preview did not call the second Riley date a duplicate", !/same email|Skip — duplicate/i.test(hqTwo.match + hqTwo.plan), `${hqTwo.plan}\n${hqTwo.match.slice(0, 800)}`);
  record("hq-A", "HQ preview counts two new inquiries", /2 new/i.test(hqTwo.plan), hqTwo.plan);
  record("hq-A", "HQ imported two Riley inquiries", /Imported/.test(hqTwo.body) && /2/.test(hqTwo.imported + hqTwo.body), hqTwo.body.slice(0, 500));

  const hqRetry = await importHq(hqPage, "leads", `${FIX}/leads-riley.csv`, "hq-03-riley-retry");
  record("hq-B", "HQ retry did not duplicate Riley inquiries", /already in Hello to Cheers|Left out|not imported|skip/i.test(`${hqRetry.plan}\n${hqRetry.body}`), hqRetry.body.slice(0, 500));

  const hqEmail = await importHq(hqPage, "leads", `${FIX}/leads-email-only.csv`, "hq-04-email-only");
  record("hq-C", "HQ email-only defaulted to Skip", /likely|Left out|Skip/i.test(`${hqEmail.plan}\n${hqEmail.match}\n${hqEmail.body}`), `${hqEmail.plan}\n${hqEmail.body.slice(0, 500)}`);

  const hqBlank = await importHq(hqPage, "leads", `${FIX}/leads-blank.csv`, "hq-05-blank");
  record("hq-D", "HQ blank-date distinguishable inquiries imported", /Import complete/.test(hqBlank.body), hqBlank.body.slice(0, 400));

  const hqMorganClient = await importHq(hqPage, "couples", `${FIX}/clients-morgan.csv`, "hq-06-morgan-booked");
  record("hq-E", "HQ imported Morgan booked Client", /Import complete/.test(hqMorganClient.body), hqMorganClient.body.slice(0, 400));
  const hqMorganLead = await importHq(hqPage, "leads", `${FIX}/leads-morgan-inquiry.csv`, "hq-07-morgan-inquiry");
  record("hq-E", "HQ imported Morgan unbooked inquiry", /Import complete/.test(hqMorganLead.body), hqMorganLead.body.slice(0, 400));

  const hqBella = await importHq(hqPage, "couples", `${FIX}/clients-bella.csv`, "hq-08-bella");
  record("hq-regression", "HQ Bella booked Client imported", /Import complete/.test(hqBella.body), hqBella.body.slice(0, 400));
  const hqBellaSecond = await importHq(hqPage, "couples", `${FIX}/clients-bella-second.csv`, "hq-09-bella-second");
  record("hq-regression", "HQ Bella extra Event imported", /Import complete/.test(hqBellaSecond.body), hqBellaSecond.body.slice(0, 400));
  const hqBellaRetry = await importHq(hqPage, "couples", `${FIX}/clients-bella-retry.csv`, "hq-10-bella-retry");
  record("hq-regression", "HQ Bella same-date retry skipped", /already in Hello to Cheers|Left out|not imported/i.test(hqBellaRetry.body), hqBellaRetry.body.slice(0, 500));

  const hqPersist = await persistSnapshot("hq-white-glove", creds.hqVenueId);
  const hqRiley = leadFacts(hqPersist, "riley.prospect@byb.test");
  const hqRileyDates = hqRiley.map((l) => String(l.event_date ?? "").slice(0, 10)).sort();
  const hqRileyBlank = hqRiley.filter((l) => !String(l.event_date ?? "").slice(0, 10));
  const hqOther = hqPersist.leads.filter((l) => String(l.first_name) === "Other");
  const hqMorganLeads = leadFacts(hqPersist, "morgan.booked@byb.test");
  const hqMorganClients = hqPersist.clients.filter((c) => String(c.email) === "morgan.booked@byb.test");
  const hqMorganEvents = hqPersist.events.filter((e) => hqMorganClients.some((c) => c.id === e.client_id) && String(e.status) !== "cancelled");
  const hqBellaClients = hqPersist.clients.filter((c) => String(c.email) === "bella.upcoming@byb.test");
  const hqBellaEvents = hqPersist.events.filter((e) => hqBellaClients.some((c) => c.id === e.client_id) && String(e.status) !== "cancelled");
  const hqIsolation = [...hqPersist.clients, ...hqPersist.events, ...hqPersist.leads].every((row) => row.venue_id === creds.hqVenueId);

  record("hq-A", "HQ persisted distinct Riley inquiries for both dates", hqRileyDates.includes("2027-06-12") && hqRileyDates.includes("2028-05-03"), JSON.stringify(hqRiley.map((l) => ({ id: l.id, date: l.event_date, stage: l.sales_stage, source: l.source, partner: l.partner_first_name, guests: l.guest_count, notes: l.inquiry_message, flex: l.source_data }))));
  record("hq-B", "HQ retry did not duplicate dated Riley inquiries", hqRiley.filter((l) => String(l.event_date ?? "").startsWith("2027-06-12")).length === 1 && hqRiley.filter((l) => String(l.event_date ?? "").startsWith("2028-05-03")).length === 1, JSON.stringify(hqRileyDates));
  record("hq-C", "HQ did not create Other Office from Riley's email", hqOther.length === 0, `other=${hqOther.length}`);
  record("hq-D", "HQ persisted two distinguishable blank-date Riley inquiries", hqRileyBlank.length === 2, JSON.stringify(hqRileyBlank.map((l) => ({ id: l.id, source: l.source, notes: l.inquiry_message, sourceData: l.source_data }))));
  record("hq-E", "HQ Morgan booking unchanged and inquiry is an unbooked Lead", hqMorganClients.length === 1 && hqMorganEvents.length === 1 && hqMorganLeads.some((l) => String(l.sales_stage) !== "booked" && String(l.event_date ?? "").startsWith("2028-02-02")), JSON.stringify({ events: hqMorganEvents, leads: hqMorganLeads.map((l) => ({ id: l.id, date: l.event_date, stage: l.sales_stage })) }));
  record("hq-regression", "HQ Bella extra Event attached and same-date retry skipped", hqBellaClients.length === 1 && hqBellaEvents.length >= 2 && hqBellaEvents.filter((e) => String(e.event_date).startsWith("2027-10-10")).length === 1, JSON.stringify(hqBellaEvents.map((e) => e.event_date)));
  record("safety", "HQ venue isolated", hqIsolation, creds.hqVenueId);
  record("safety", "No QBO / invites / contracts / payments / messages on HQ venue", hqPersist.qbo.length === 0 && hqPersist.invites.length === 0 && hqPersist.contracts.length === 0 && hqPersist.payments.length === 0 && hqPersist.messages.length === 0 && hqPersist.sms.length === 0 && hqPersist.scheduled.length === 0, JSON.stringify({ qbo: hqPersist.qbo, invites: hqPersist.invites, messages: hqPersist.messages }));
  record("safety", "Lead imports did not create booked Riley Events", !ssPersist.clients.some((c) => String(c.email) === "riley.prospect@byb.test") && !hqPersist.clients.some((c) => String(c.email) === "riley.prospect@byb.test"), JSON.stringify({ ssRileyClients: ssPersist.clients.filter((c) => String(c.email) === "riley.prospect@byb.test"), hqRileyClients: hqPersist.clients.filter((c) => String(c.email) === "riley.prospect@byb.test") }));
  await hqContext.close();
} catch (err) {
  record("runtime", "Browser script error", false, err instanceof Error ? err.stack ?? err.message : String(err));
} finally {
  const grouped = new Map<string, Check[]>();
  for (const c of checks) {
    grouped.set(c.category, [...(grouped.get(c.category) ?? []), c]);
  }
  const verdicts: Record<string, string> = {};
  for (const [cat, items] of grouped) {
    if (items.every((i) => i.pass)) verdicts[cat] = "GREEN";
    else if (items.some((i) => i.pass)) verdicts[cat] = "YELLOW";
    else verdicts[cat] = "RED";
  }
  const report = {
    ssVenueId: creds.ssVenueId,
    ssVenueName: creds.ssVenueName,
    hqVenueId: creds.hqVenueId,
    hqVenueName: creds.hqVenueName,
    verdicts,
    checks,
  };
  writeFileSync(`${OUT}/report.json`, JSON.stringify(report, null, 2));
  const repoCopy = "/Users/jensmac/Developer/wevenu-website/.worktrees/bring-your-business-unified/docs/qa/phase-b2-lead-parity";
  mkdirSync(repoCopy, { recursive: true });
  writeFileSync(`${repoCopy}/report.json`, JSON.stringify(report, null, 2));
  for (const name of readdirSync(OUT)) {
    if (name.endsWith(".png") || name.endsWith(".json")) {
      copyFileSync(`${OUT}/${name}`, `${repoCopy}/${name}`);
    }
  }
  console.log("\n=== VERDICTS ===");
  console.log(JSON.stringify(verdicts, null, 2));
  console.log(`Wrote ${OUT}`);
  await browser.close();
}
