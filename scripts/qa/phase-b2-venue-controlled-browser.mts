/**
 * Phase B.2 Final Acceptance — venue-controlled duplicate review and
 * same-file relationship reuse.
 *
 * Identity policy: a shared email is not a person. Riley Prospect and
 * Other Office both use riley.prospect@byb.test after the venue confirmed
 * they are different people. Persist assertions group by confirmed
 * first+last name, then compare relationship IDs. They must not count
 * every row on Riley's email as Riley's person.
 *
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
const OUT = `${process.env.HOME}/Desktop/HTC-Phase-B2-Final-Acceptance`;
const FANCY = "a415ac52-cd74-42a6-8df7-7a8f6e71d080";
const WILLOW = "31f38b79-eb99-4ebc-81bc-af85767b42aa";
const FIX = "/tmp/htc-byb-b2-venue-controlled-fixtures";

if (!process.env.NEXT_PUBLIC_SUPABASE_URL?.includes("wvpsldwwjqdannqasrdf")) {
  throw new Error("Refusing: not Sandbox supabase");
}
mkdirSync(OUT, { recursive: true });

const creds = JSON.parse(readFileSync("/tmp/htc-byb-b2-venue-controlled-creds.json", "utf8")) as {
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
    q("leads", "id, first_name, last_name, email, partner_first_name, partner_last_name, event_date, event_type, guest_count, estimated_budget, source, sales_stage, follow_up_date, next_action_text, inquiry_message, source_data, venue_id, relationship_id, is_historical_import"),
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

type Decision = "same" | "same-person" | "different" | "skip" | null;
type ImportOutcome = {
  imported: string;
  errors: string;
  body: string;
  plan: string;
  match: string;
  held: string;
  confirmDisabled: boolean;
};

async function applyDecisions(page: {
  locator: (s: string) => {
    count: () => Promise<number>;
    nth: (i: number) => { getByTestId: (id: string) => { click: () => Promise<void>; count: () => Promise<number> } };
  };
}, decisions: Decision[]) {
  const rows = page.locator('[data-testid^="byb-match-row-"]');
  const count = await rows.count();
  for (let i = 0; i < Math.min(count, decisions.length); i++) {
    const choice = decisions[i];
    if (!choice) continue;
    const testId = choice === "same"
      ? "byb-match-choice-same"
      : choice === "same-person"
        ? "byb-match-choice-same-person"
        : choice === "different"
          ? "byb-match-choice-different"
          : "byb-match-choice-skip";
    const btn = rows.nth(i).getByTestId(testId);
    if (await btn.count()) await btn.click();
  }
}

async function finishImport(
  page: {
    locator: (s: string) => {
      count: () => Promise<number>;
      waitFor: (o?: object) => Promise<void>;
      innerText: () => Promise<string>;
      isDisabled: () => Promise<boolean>;
      nth: (i: number) => { getByTestId: (id: string) => { click: () => Promise<void>; count: () => Promise<number> } };
    };
    getByTestId: (s: string) => {
      count: () => Promise<number>;
      waitFor: (o?: object) => Promise<void>;
      click: () => Promise<void>;
      innerText: () => Promise<string>;
      isDisabled: () => Promise<boolean>;
    };
    getByRole: (r: string, o?: object) => { waitFor: (o?: object) => Promise<void>; click: () => Promise<void> };
  },
  shotPrefix: string,
  decisions?: Decision[],
): Promise<ImportOutcome> {
  const previewBtn = page.getByRole("button", { name: /^Preview/ });
  await previewBtn.waitFor({ timeout: 25000 });
  await shot(page, `${shotPrefix}-map`);
  await previewBtn.click();
  const reachedPreview = await page.getByTestId("byb-import-confirm").waitFor({ timeout: 25000 }).then(() => true).catch(() => false);
  if (!reachedPreview) {
    await shot(page, `${shotPrefix}-preview-miss`);
    if (await previewBtn.count()) await previewBtn.click();
    await page.getByTestId("byb-import-confirm").waitFor({ timeout: 40000 });
  }
  await page.getByTestId("byb-match-checking").waitFor({ state: "hidden", timeout: 20000 }).catch(() => {});
  if (await page.getByTestId("byb-match-review").count()) await shot(page, `${shotPrefix}-match-before`);
  if (decisions) await applyDecisions(page, decisions);
  const plan = await page.getByTestId("byb-import-plan").innerText().catch(() => "");
  const match = await page.getByTestId("byb-match-review").innerText().catch(() => "");
  const held = await page.getByTestId("byb-held-count").innerText().catch(() => "");
  if (await page.getByTestId("byb-match-review").count()) await shot(page, `${shotPrefix}-match`);
  const importBtn = page.getByTestId("byb-import-confirm");
  const confirmDisabled = await importBtn.isDisabled();
  if (!confirmDisabled) {
    await importBtn.click();
    await page.getByRole("heading", { name: "Import complete" }).waitFor({ timeout: 40000 });
    await shot(page, `${shotPrefix}-result`);
  } else {
    await shot(page, `${shotPrefix}-confirm-disabled`);
  }
  const imported = await page.locator("text=Imported").locator("xpath=..").innerText().catch(() => "");
  const errors = await page.locator("text=Errors").locator("xpath=..").innerText().catch(() => "");
  const body = (await page.locator("main").innerText()).slice(0, 2500);
  return { imported, errors, body, plan, match, held, confirmDisabled };
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
      nth: (i: number) => { getByTestId: (id: string) => { click: () => Promise<void>; count: () => Promise<number> } };
    };
    getByRole: (r: string, o?: object) => { waitFor: (o?: object) => Promise<void>; click: () => Promise<void> };
  },
  stage: "leads" | "clients",
  file: string,
  shotPrefix: string,
  decisions?: Decision[],
): Promise<ImportOutcome> {
  await page.goto(`${APP}/setup-hub/bring-your-business?stage=${stage}&entry=files`, { waitUntil: "domcontentloaded" });
  await page.getByTestId("byb-paste-textarea").waitFor({ timeout: 20000 });
  await page.locator('[data-testid="byb-use-paste"][data-hydrated="true"]').waitFor({ timeout: 15000 });
  await page.getByTestId("byb-paste-textarea").fill(readFileSync(file, "utf8"));
  await page.getByTestId("byb-use-paste").click();
  return finishImport(page, shotPrefix, decisions);
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
      nth: (i: number) => { getByTestId: (id: string) => { click: () => Promise<void>; count: () => Promise<number> } };
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
  decisions?: Decision[],
): Promise<ImportOutcome> {
  await openHqEntity(page, entity);
  await page.locator('[data-testid="byb-use-paste"][data-hydrated="true"]').waitFor({ timeout: 15000 });
  await page.getByTestId("byb-paste-textarea").fill(readFileSync(file, "utf8"));
  await page.getByTestId("byb-use-paste").click();
  const result = await finishImport(page, shotPrefix, decisions);
  if (await page.getByText("Import more").count()) {
    await page.getByText("Import more").click();
    await page.locator('[data-testid="byb-entity-select"][data-hydrated="true"]').waitFor({ timeout: 20000 });
  }
  return result;
}

function leadFacts(snap: { leads: Array<Record<string, unknown>> }, email: string) {
  return snap.leads.filter((l) => String(l.email) === email);
}

function confirmedPersonLeads(
  snap: { leads: Array<Record<string, unknown>> },
  firstName: string,
  lastName: string,
) {
  return snap.leads.filter(
    (l) => String(l.first_name) === firstName && String(l.last_name) === lastName,
  );
}

function relationshipIds(leads: Array<Record<string, unknown>>): string[] {
  return [...new Set(leads.map((l) => String(l.relationship_id ?? "")).filter((id) => id.length > 0))];
}

function namedDate(leads: Array<Record<string, unknown>>, date: string) {
  return leads.filter((l) => String(l.event_date ?? "").startsWith(date));
}

function namedBlanks(leads: Array<Record<string, unknown>>) {
  return leads.filter((l) => !String(l.event_date ?? "").slice(0, 10));
}

async function runLeadJourney(
  label: "ss" | "hq",
  importFn: (stage: "leads" | "clients", file: string, shotPrefix: string, decisions?: Decision[]) => Promise<ImportOutcome>,
) {
  const twoDates = await importFn("leads", `${FIX}/leads-two-dates.csv`, `${label}-01-two-dates`, [null, "same-person"]);
  record(`${label}-2`, "Both file rows were visible for review", /Row 1|Riley/.test(twoDates.match) && /Row 2|May|2028|this person|possible match/i.test(twoDates.match), twoDates.match.slice(0, 1200));
  record(`${label}-2`, "Venue confirmed a separate inquiry for the same person and imported both dates", /Import complete/.test(twoDates.body) && !twoDates.confirmDisabled, `${twoDates.plan}\n${twoDates.body.slice(0, 500)}`);

  const retry = await importFn("leads", `${FIX}/leads-two-dates.csv`, `${label}-07-retry`);
  record(`${label}-7`, "Reimport of the accepted file was recognized as already imported", /already imported|already in Hello to Cheers|exact repeat/i.test(`${retry.plan}\n${retry.match}\n${retry.body}`), `${retry.plan}\n${retry.body.slice(0, 500)}`);

  const sameDate = await importFn("leads", `${FIX}/leads-same-date-notes.csv`, `${label}-01-same-date`, ["same"]);
  record(`${label}-1`, "Same person/email/date was flagged and Same record kept existing data", /possible|match|Same record|already|Differences|Budget/i.test(`${sameDate.plan}\n${sameDate.match}`) && /Import complete|Left out|used the record|Nothing was overwritten/i.test(sameDate.body), `${sameDate.plan}\n${sameDate.match.slice(0, 800)}\n${sameDate.body.slice(0, 400)}`);

  const avery = await importFn("leads", `${FIX}/leads-avery.csv`, `${label}-05a-avery`);
  record(`${label}-5`, "Avery source-ID row imported", /Import complete/.test(avery.body), avery.body.slice(0, 400));
  const averyUpdate = await importFn("leads", `${FIX}/leads-avery-update.csv`, `${label}-05b-avery-update`, ["same"]);
  record(`${label}-5`, "Changed source-ID record showed differences and did not auto-create a second Lead", /changed|Differences|Budget|Same record/i.test(`${averyUpdate.plan}\n${averyUpdate.match}`) && /Nothing was overwritten|used the record|already/i.test(averyUpdate.body), `${averyUpdate.plan}\n${averyUpdate.match.slice(0, 800)}\n${averyUpdate.body.slice(0, 400)}`);

  const blank = await importFn("leads", `${FIX}/leads-blank.csv`, `${label}-04-blank`, ["same-person", "same-person"]);
  record(`${label}-4`, "Blank-date inquiries were reviewable and kept as more inquiries for this person", /Import complete/.test(blank.body), `${blank.plan}\n${blank.match.slice(0, 800)}`);

  const laterFile = await importFn("leads", `${FIX}/leads-riley-later-file.csv`, `${label}-02-later-file`, ["same-person"]);
  record(`${label}-2b`, "A later file Riley inquiry was reviewable as the same person", /this person|Riley|2029|possible/i.test(`${laterFile.plan}\n${laterFile.match}`), `${laterFile.plan}\n${laterFile.match.slice(0, 800)}`);
  record(`${label}-2b`, "Venue confirmed the later-file Riley inquiry for this person", /Import complete/.test(laterFile.body) && !laterFile.confirmDisabled, laterFile.body.slice(0, 500));

  const emailOnly = await importFn("leads", `${FIX}/leads-email-only.csv`, `${label}-03-email-only`, ["different"]);
  record(`${label}-3`, "Same email different names was warned, not auto-merged", /possible match|Same email|different person|likely/i.test(emailOnly.match), emailOnly.match.slice(0, 800));
  record(`${label}-3b`, "Venue chose a different person for the shared-email office inquiry", /Import complete/.test(emailOnly.body) && !emailOnly.confirmDisabled, `${emailOnly.plan}\n${emailOnly.body.slice(0, 500)}`);

  const morganClient = await importFn("clients", `${FIX}/clients-morgan.csv`, `${label}-08a-morgan-booked`);
  record(`${label}-8`, "Morgan booked Client imported", /Import complete/.test(morganClient.body), morganClient.body.slice(0, 400));
  const morganLead = await importFn("leads", `${FIX}/leads-morgan-inquiry.csv`, `${label}-08b-morgan-inquiry`, ["same-person"]);
  record(`${label}-8`, "New unbooked Morgan inquiry imported as another inquiry for this person", /Import complete/.test(morganLead.body), `${morganLead.plan}\n${morganLead.body.slice(0, 400)}`);

  const held = await importFn("leads", `${FIX}/leads-held.csv`, `${label}-09-held`, [null]);
  record(`${label}-9`, "Unresolved potential match stayed held while the unambiguous row imported", /need review|Held|held/i.test(`${held.plan}\n${held.held}\n${held.body}`) && /Import complete/.test(held.body), `${held.plan}\n${held.held}\n${held.body.slice(0, 500)}`);

  const skipped = await importFn("leads", `${FIX}/leads-dont-import.csv`, `${label}-10-dont-import`, ["skip"]);
  record(`${label}-10`, "Don't import left the explicit skip row out", /Don't import|Left out|skip/i.test(`${skipped.plan}\n${skipped.match}\n${skipped.body}`) && /Import complete/.test(skipped.body), `${skipped.plan}\n${skipped.body.slice(0, 500)}`);
}

const browser = await chromium.launch({ headless: true });

try {
  let ssPersist: Awaited<ReturnType<typeof persistSnapshot>> = {
    label: "self-service",
    venueId: creds.ssVenueId,
    clients: [],
    events: [],
    leads: [],
    batches: [],
    qbo: [],
    invites: [],
    setupStates: [],
    contracts: [],
    payments: [],
    messages: [],
    sms: [],
    scheduled: [],
    errors: {},
  };

  if (!process.env.SKIP_SS) {
  const ssContext = await browser.newContext({ viewport: { width: 1440, height: 1100 } });
  await ssContext.addCookies(await cookiesFor(creds.ssEmail));
  const page = await ssContext.newPage();
  page.setDefaultTimeout(40000);

  await page.goto(`${APP}/setup-hub/bring-your-business?stage=leads&entry=files`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await passWelcome(page);
  if (!page.url().includes("bring-your-business")) {
    await page.goto(`${APP}/setup-hub/bring-your-business?stage=leads&entry=files`, { waitUntil: "domcontentloaded", timeout: 60000 });
  }
  await page.getByTestId("byb-paste-textarea").waitFor({ timeout: 25000 });
  await shot(page, "ss-00-leads-entry");
  record("ss", "Self-service venue reached Bring Your Business on localhost:3040", page.url().includes("bring-your-business"), page.url());

  await runLeadJourney("ss", (stage, file, shotPrefix, decisions) => importSelfService(page, stage, file, shotPrefix, decisions));

  await page.goto(`${APP}/leads`, { waitUntil: "commit", timeout: 60000 }).catch(() => {});
  await page.getByText("Riley").first().waitFor({ timeout: 20000 }).catch(() => {});
  await shot(page, "ss-13-leads-list");

  ssPersist = await persistSnapshot("self-service", creds.ssVenueId);
  const riley = confirmedPersonLeads(ssPersist, "Riley", "Prospect");
  const rileyRels = relationshipIds(riley);
  const rileyJune = namedDate(riley, "2027-06-12");
  const rileyMay = namedDate(riley, "2028-05-03");
  const rileyLater = namedDate(riley, "2029-04-18");
  const rileyBlank = namedBlanks(riley);
  const other = confirmedPersonLeads(ssPersist, "Other", "Office");
  const otherRel = relationshipIds(other)[0] ?? "";
  const casey = leadFacts(ssPersist, "casey.clear@byb.test");
  const avery = leadFacts(ssPersist, "avery.source@byb.test");
  const dana = confirmedPersonLeads(ssPersist, "Dana", "Skip");
  const morganLeads = leadFacts(ssPersist, "morgan.booked@byb.test");
  const morganClients = ssPersist.clients.filter((c) => String(c.email) === "morgan.booked@byb.test");
  const morganEvents = ssPersist.events.filter((e) => morganClients.some((c) => c.id === e.client_id) && String(e.status) !== "cancelled");
  const isolationOk = [...ssPersist.clients, ...ssPersist.events, ...ssPersist.leads].every((row) => row.venue_id === creds.ssVenueId);
  const juneNotes = String(rileyJune[0]?.inquiry_message ?? "");
  const averyBudget = avery[0]?.estimated_budget;
  const averyNotes = String(avery[0]?.inquiry_message ?? "");
  const averySource = (avery[0]?.source_data ?? {}) as Record<string, unknown>;
  const morganClientRel = String(morganClients[0]?.relationship_id ?? "");
  const morganInquiry = morganLeads.find((l) => String(l.sales_stage) !== "booked" && String(l.event_date ?? "").startsWith("2028-02-02"));

  record("ss-2", "Riley Prospect persisted as 5 inquiries on 1 relationship", riley.length === 5 && rileyRels.length === 1, JSON.stringify(riley.map((l) => ({ id: l.id, name: `${l.first_name} ${l.last_name}`, date: l.event_date, rel: l.relationship_id, notes: l.inquiry_message }))));
  record("ss-2", "Same-file Riley June and May share that confirmed person relationship", rileyJune.length === 1 && rileyMay.length === 1 && String(rileyJune[0]?.relationship_id) === rileyRels[0] && String(rileyMay[0]?.relationship_id) === rileyRels[0], JSON.stringify({ rileyRels, june: rileyJune[0]?.id, may: rileyMay[0]?.id }));
  record("ss-2b", "Later-file Riley inquiry reused that same relationship", rileyLater.length === 1 && String(rileyLater[0]?.relationship_id) === rileyRels[0], JSON.stringify(rileyLater.map((l) => ({ id: l.id, date: l.event_date, rel: l.relationship_id }))));
  record("ss-7", "Riley dated inquiries were not duplicated on reimport", rileyJune.length === 1 && rileyMay.length === 1 && rileyLater.length === 1, JSON.stringify(riley.map((l) => l.event_date)));
  record("ss-1", "Updated June notes/budget did not overwrite the existing Lead", rileyJune.length === 1 && /Preferred June date/.test(juneNotes) && !/do not overwrite/i.test(juneNotes), juneNotes);
  record("ss-5", "Avery remains one Lead with original budget/notes and source record ID", avery.length === 1 && Number(averyBudget) === 18000 && /Original Avery/.test(averyNotes) && averySource.source_record_id === "SRC-AVERY-1", JSON.stringify({ avery, source: averySource }));
  record("ss-4", "Distinguishable blank-date Riley inquiries persisted on the same person", rileyBlank.length === 2 && rileyBlank.every((l) => String(l.relationship_id) === rileyRels[0]), JSON.stringify(rileyBlank.map((l) => ({ id: l.id, source: l.source, notes: l.inquiry_message, rel: l.relationship_id }))));
  record("ss-3", "Other Office is a different person on a separate relationship despite Riley's email", other.length === 1 && otherRel !== "" && otherRel !== rileyRels[0] && String(other[0]?.email) === "riley.prospect@byb.test", JSON.stringify(other.map((l) => ({ id: l.id, name: `${l.first_name} ${l.last_name}`, rel: l.relationship_id, email: l.email }))));
  record("ss-9", "Casey imported while the unresolved Riley row stayed out", casey.length === 1, JSON.stringify(casey.map((l) => ({ id: l.id, date: l.event_date }))));
  record("ss-10", "Don't import did not create Dana Skip", dana.length === 0, JSON.stringify(dana));
  record("ss-8", "Morgan booking unchanged as a single Event", morganClients.length === 1 && morganEvents.length === 1 && String(morganEvents[0]?.event_date).startsWith("2027-09-12"), JSON.stringify({ clients: morganClients, events: morganEvents }));
  record("ss-8", "Morgan unbooked inquiry persisted as a Lead on the booked client's relationship", Boolean(morganInquiry) && morganEvents.length === 1 && morganClientRel !== "" && String(morganInquiry?.relationship_id) === morganClientRel, JSON.stringify({ clientRel: morganClientRel, events: morganEvents, leads: morganLeads.map((l) => ({ id: l.id, date: l.event_date, stage: l.sales_stage, rel: l.relationship_id })) }));
  record("safety", "Self-service venue isolated", isolationOk, creds.ssVenueId);
  record("safety", "No QBO / invites / contracts / payments / messages on self-service", ssPersist.qbo.length === 0 && ssPersist.invites.length === 0 && ssPersist.contracts.length === 0 && ssPersist.payments.length === 0 && ssPersist.messages.length === 0 && ssPersist.sms.length === 0 && ssPersist.scheduled.length === 0, JSON.stringify({ qbo: ssPersist.qbo, invites: ssPersist.invites }));
  await ssContext.close();
  }

  const hqContext = await browser.newContext({ viewport: { width: 1440, height: 1100 } });
  await hqContext.addCookies(await cookiesFor(creds.hqEmail));
  const hqPage = await hqContext.newPage();
  hqPage.setDefaultTimeout(40000);
  await hqPage.goto(`${APP}/admin/onboarding/${creds.hqVenueId}`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await hqPage.getByText(/Import data for/i).waitFor({ timeout: 25000 });
  await shot(hqPage, "hq-00-onboarding");
  record("hq", "HQ admin reached White-Glove onboarding import", hqPage.url().includes(creds.hqVenueId), hqPage.url());

  await runLeadJourney("hq", (stage, file, shotPrefix, decisions) => importHq(hqPage, stage === "clients" ? "couples" : "leads", file, shotPrefix, decisions));

  const hqPersist = await persistSnapshot("hq-white-glove", creds.hqVenueId);
  const hqRiley = confirmedPersonLeads(hqPersist, "Riley", "Prospect");
  const hqRileyRels = relationshipIds(hqRiley);
  const hqRileyJune = namedDate(hqRiley, "2027-06-12");
  const hqRileyMay = namedDate(hqRiley, "2028-05-03");
  const hqRileyLater = namedDate(hqRiley, "2029-04-18");
  const hqRileyBlank = namedBlanks(hqRiley);
  const hqOther = confirmedPersonLeads(hqPersist, "Other", "Office");
  const hqOtherRel = relationshipIds(hqOther)[0] ?? "";
  const hqCasey = leadFacts(hqPersist, "casey.clear@byb.test");
  const hqAvery = leadFacts(hqPersist, "avery.source@byb.test");
  const hqDana = confirmedPersonLeads(hqPersist, "Dana", "Skip");
  const hqMorganLeads = leadFacts(hqPersist, "morgan.booked@byb.test");
  const hqMorganClients = hqPersist.clients.filter((c) => String(c.email) === "morgan.booked@byb.test");
  const hqMorganEvents = hqPersist.events.filter((e) => hqMorganClients.some((c) => c.id === e.client_id) && String(e.status) !== "cancelled");
  const hqIsolation = [...hqPersist.clients, ...hqPersist.events, ...hqPersist.leads].every((row) => row.venue_id === creds.hqVenueId);
  const hqAverySource = (hqAvery[0]?.source_data ?? {}) as Record<string, unknown>;
  const hqMorganClientRel = String(hqMorganClients[0]?.relationship_id ?? "");
  const hqMorganInquiry = hqMorganLeads.find((l) => String(l.sales_stage) !== "booked" && String(l.event_date ?? "").startsWith("2028-02-02"));

  record("hq-2", "HQ Riley Prospect persisted as 5 inquiries on 1 relationship", hqRiley.length === 5 && hqRileyRels.length === 1, JSON.stringify(hqRiley.map((l) => ({ id: l.id, name: `${l.first_name} ${l.last_name}`, date: l.event_date, rel: l.relationship_id, notes: l.inquiry_message }))));
  record("hq-2", "HQ same-file Riley June and May share that confirmed person relationship", hqRileyJune.length === 1 && hqRileyMay.length === 1 && String(hqRileyJune[0]?.relationship_id) === hqRileyRels[0] && String(hqRileyMay[0]?.relationship_id) === hqRileyRels[0], JSON.stringify({ hqRileyRels, june: hqRileyJune[0]?.id, may: hqRileyMay[0]?.id }));
  record("hq-2b", "HQ later-file Riley inquiry reused that same relationship", hqRileyLater.length === 1 && String(hqRileyLater[0]?.relationship_id) === hqRileyRels[0], JSON.stringify(hqRileyLater.map((l) => ({ id: l.id, date: l.event_date, rel: l.relationship_id }))));
  record("hq-7", "HQ retry did not duplicate dated Riley inquiries", hqRileyJune.length === 1 && hqRileyMay.length === 1 && hqRileyLater.length === 1, JSON.stringify(hqRiley.map((l) => l.event_date)));
  record("hq-1", "HQ Same record did not overwrite June notes", hqRileyJune.length === 1 && /Preferred June date/.test(String(hqRileyJune[0]?.inquiry_message ?? "")), String(hqRileyJune[0]?.inquiry_message ?? ""));
  record("hq-5", "HQ Avery remains one Lead with original budget and source ID", hqAvery.length === 1 && Number(hqAvery[0]?.estimated_budget) === 18000 && hqAverySource.source_record_id === "SRC-AVERY-1", JSON.stringify({ hqAvery, source: hqAverySource }));
  record("hq-4", "HQ persisted two distinguishable blank-date Riley inquiries on the same person", hqRileyBlank.length === 2 && hqRileyBlank.every((l) => String(l.relationship_id) === hqRileyRels[0]), JSON.stringify(hqRileyBlank.map((l) => ({ id: l.id, source: l.source, notes: l.inquiry_message, rel: l.relationship_id }))));
  record("hq-3", "HQ Other Office is a different person on a separate relationship despite Riley's email", hqOther.length === 1 && hqOtherRel !== "" && hqOtherRel !== hqRileyRels[0] && String(hqOther[0]?.email) === "riley.prospect@byb.test", JSON.stringify(hqOther.map((l) => ({ id: l.id, rel: l.relationship_id, email: l.email }))));
  record("hq-9", "HQ Casey imported while unresolved Riley stayed out", hqCasey.length === 1, JSON.stringify(hqCasey));
  record("hq-10", "HQ Don't import did not create Dana Skip", hqDana.length === 0, JSON.stringify(hqDana));
  record("hq-8", "HQ Morgan booking unchanged and inquiry is an unbooked Lead on that client relationship", hqMorganClients.length === 1 && hqMorganEvents.length === 1 && Boolean(hqMorganInquiry) && hqMorganClientRel !== "" && String(hqMorganInquiry?.relationship_id) === hqMorganClientRel, JSON.stringify({ clientRel: hqMorganClientRel, events: hqMorganEvents, leads: hqMorganLeads.map((l) => ({ id: l.id, date: l.event_date, stage: l.sales_stage, rel: l.relationship_id })) }));
  record("safety", "HQ venue isolated", hqIsolation, creds.hqVenueId);
  record("safety", "No QBO / invites / contracts / payments / messages on HQ venue", hqPersist.qbo.length === 0 && hqPersist.invites.length === 0 && hqPersist.contracts.length === 0 && hqPersist.payments.length === 0 && hqPersist.messages.length === 0 && hqPersist.sms.length === 0 && hqPersist.scheduled.length === 0, JSON.stringify({ qbo: hqPersist.qbo, invites: hqPersist.invites }));
  record("safety", "Lead imports did not create booked Riley Events", !ssPersist.clients.some((c) => String(c.first_name) === "Riley") && !hqPersist.clients.some((c) => String(c.first_name) === "Riley"), "ok");
  if (ssPersist.leads.length > 0) {
    const ssRiley = confirmedPersonLeads(ssPersist, "Riley", "Prospect");
    const ssRileyRels = relationshipIds(ssRiley);
    const ssOther = confirmedPersonLeads(ssPersist, "Other", "Office");
    const ssMorganClients = ssPersist.clients.filter((c) => String(c.email) === "morgan.booked@byb.test");
    const ssMorganEvents = ssPersist.events.filter((e) => ssMorganClients.some((c) => c.id === e.client_id) && String(e.status) !== "cancelled");
    const ssMorganInquiry = leadFacts(ssPersist, "morgan.booked@byb.test").some((l) => String(l.sales_stage) !== "booked" && String(l.event_date ?? "").startsWith("2028-02-02"));
    record(
      "parity",
      "HQ and self-service persisted equivalent confirmed identities",
      ssRiley.length === 5
        && hqRiley.length === 5
        && ssRileyRels.length === 1
        && hqRileyRels.length === 1
        && ssOther.length === 1
        && hqOther.length === 1
        && relationshipIds(ssOther)[0] !== ssRileyRels[0]
        && hqOtherRel !== hqRileyRels[0]
        && ssMorganClients.length === 1
        && hqMorganClients.length === 1
        && ssMorganEvents.length === 1
        && hqMorganEvents.length === 1
        && ssMorganInquiry
        && Boolean(hqMorganInquiry),
      JSON.stringify({
        ssRiley: ssRiley.length,
        hqRiley: hqRiley.length,
        ssRileyRel: ssRileyRels,
        hqRileyRel: hqRileyRels,
        ssOtherRel: relationshipIds(ssOther),
        hqOtherRel: [hqOtherRel],
        ssMorganEvent: ssMorganEvents[0]?.event_date,
        hqMorganEvent: hqMorganEvents[0]?.event_date,
      }),
    );
  }
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
  const repoCopy = "/Users/jensmac/Developer/wevenu-website/.worktrees/bring-your-business-unified/docs/qa/phase-b2-final-acceptance";
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
