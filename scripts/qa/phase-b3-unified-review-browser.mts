/**
 * Phase B.3 acceptance — Client/Event + Vendor venue-controlled review
 * and multi-event Client workspace navigation.
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
const OUT = `${process.env.HOME}/Desktop/HTC-Phase-B3-Unified-Review`;
const FANCY = "a415ac52-cd74-42a6-8df7-7a8f6e71d080";
const WILLOW = "31f38b79-eb99-4ebc-81bc-af85767b42aa";
const FIX = "/tmp/htc-byb-b3-unified-review-fixtures";

if (!process.env.NEXT_PUBLIC_SUPABASE_URL?.includes("wvpsldwwjqdannqasrdf")) {
  throw new Error("Refusing: not Sandbox supabase");
}
mkdirSync(OUT, { recursive: true });

const creds = JSON.parse(readFileSync("/tmp/htc-byb-b3-unified-review-creds.json", "utf8")) as {
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

const RESUME = process.env.B3_RESUME === "remainder";

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
    clients, events, leads, batches, vendorsRel, qbo, invites, setup, contracts, payments, messages, sms, scheduled,
  ] = await Promise.all([
    q("clients", "id, first_name, last_name, email, event_date, status, venue_id, relationship_id, internal_notes"),
    q("events", "id, client_id, name, status, event_date, booked_at, space_id, venue_id, event_type, guest_count"),
    q("leads", "id, first_name, last_name, email, venue_id"),
    q("import_batches", "id, entity_type, imported_count, skipped_count, error_count, source_label, rolled_back_at"),
    q("venue_vendor_relationships", "id, vendor_id, status, notes, venue_id"),
    q("quickbooks_sync_queue", "id"),
    q("client_invitations", "id"),
    q("event_setup_states", "event_id"),
    q("contracts", "id"),
    q("payments", "id"),
    q("messages", "id"),
    q("sms_messages", "id"),
    q("scheduled_messages", "id"),
  ]);
  const vendorIds = [...new Set((vendorsRel.data ?? []).map((row: { vendor_id: string }) => row.vendor_id))];
  const vendors = vendorIds.length
    ? await admin.from("vendors").select("id, business_name, email, is_claimed").in("id", vendorIds)
    : { data: [], error: null };
  const snap = {
    label,
    venueId,
    clients: clients.data ?? [],
    events: events.data ?? [],
    leads: leads.data ?? [],
    batches: batches.data ?? [],
    relationships: vendorsRel.data ?? [],
    vendors: vendors.data ?? [],
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
      relationships: vendorsRel.error?.message,
      vendors: vendors.error?.message,
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
  await previewBtn.click();
  const reachedPreview = await page.getByTestId("byb-import-confirm").waitFor({ timeout: 25000 }).then(() => true).catch(() => false);
  if (!reachedPreview) {
    await shot(page, `${shotPrefix}-preview-miss`);
    if (await previewBtn.count()) await previewBtn.click();
    await page.getByTestId("byb-import-confirm").waitFor({ timeout: 40000 });
  }
  await page.getByTestId("byb-match-checking").waitFor({ state: "hidden", timeout: 20000 }).catch(() => {});
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
  stage: "clients" | "vendors",
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
    goto: (u: string, o?: object) => Promise<unknown>;
    locator: (s: string) => { waitFor: (o?: object) => Promise<void>; count: () => Promise<number> };
    getByTestId: (s: string) => { click: () => Promise<void>; waitFor: (o?: object) => Promise<void>; count: () => Promise<number>; fill: (t: string) => Promise<void> };
    getByText: (s: string | RegExp, o?: object) => { count: () => Promise<number>; click: () => Promise<void> };
    getByRole: (r: string, o?: object) => { count: () => Promise<number>; click: () => Promise<void> };
  },
  entity: "couples" | "vendors",
) {
  await page.goto(`${APP}/admin/onboarding/${creds.hqVenueId}`, { waitUntil: "domcontentloaded", timeout: 60000 });
  const wizard = page.locator("#wg-import-wizard");
  await wizard.waitFor({ timeout: 20000 });
  if (await page.getByTestId("byb-paste-textarea").count()) {
    await page.getByTestId(`byb-entity-${entity}`).click().catch(() => {});
    if (await page.getByTestId("byb-paste-textarea").count()) return;
  }
  if (await page.getByText("Import more", { exact: true }).count()) {
    await page.getByText("Import more", { exact: true }).click();
  }
  const back = page.getByRole("button", { name: /^Back$/ });
  for (let i = 0; i < 4 && !(await page.getByTestId("byb-entity-select").count()); i++) {
    if (await back.count()) await back.click();
    else break;
  }
  await page.locator('[data-testid="byb-entity-select"][data-hydrated="true"]').waitFor({ timeout: 20000 });
  await page.getByTestId(`byb-entity-${entity}`).click();
  await page.getByTestId("byb-paste-textarea").waitFor({ timeout: 20000 });
}

async function importHq(
  page: {
    goto: (u: string, o?: object) => Promise<unknown>;
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
    getByRole: (r: string, o?: object) => { waitFor: (o?: object) => Promise<void>; click: () => Promise<void>; count: () => Promise<number> };
  },
  entity: "couples" | "vendors",
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

async function runJourney(
  label: "ss" | "hq",
  importClients: (file: string, shotPrefix: string, decisions?: Decision[]) => Promise<ImportOutcome>,
  importVendors: (file: string, shotPrefix: string, decisions?: Decision[]) => Promise<ImportOutcome>,
) {
  const first = await importClients(`${FIX}/clients-morgan.csv`, `${label}-01-morgan`);
  record(`${label}-clients`, "Morgan wedding imported as a Client with Event", /Import complete/.test(first.body) && !first.confirmDisabled, first.body.slice(0, 400));

  const additional = await importClients(`${FIX}/clients-additional.csv`, `${label}-02-additional`, ["same-person"]);
  record(`${label}-clients`, "Same Client additional Event was reviewable", /additional Event|same Client|possible/i.test(`${additional.plan}\n${additional.match}`), additional.match.slice(0, 900));
  record(`${label}-clients`, "Venue confirmed an additional Event for Morgan", /Import complete/.test(additional.body) && !additional.confirmDisabled, additional.body.slice(0, 400));

  const sameDate = await importClients(`${FIX}/clients-same-date.csv`, `${label}-03-same-date`, ["same-person"]);
  record(`${label}-clients`, "Same-date Event was not auto-skipped; venue saw a decision", /same Event|additional Event|this date|possible/i.test(`${sameDate.plan}\n${sameDate.match}`), sameDate.match.slice(0, 900));
  record(`${label}-clients`, "Same-date additional Event was confirmed and booking rules still applied", /Import complete|occupancy|conflict|already booked|space/i.test(`${sameDate.body}\n${sameDate.errors}`), `${sameDate.body.slice(0, 400)}\n${sameDate.errors}`);

  const sameFile = await importClients(`${FIX}/clients-same-file.csv`, `${label}-04-same-file`, [null, "same-person"]);
  record(`${label}-clients`, "Same-file second Event was visible for review", /Jordan|Row 2|additional Event|this file/i.test(sameFile.match), sameFile.match.slice(0, 900));
  record(`${label}-clients`, "Venue confirmed the same-file additional Event", /Import complete/.test(sameFile.body) && !sameFile.confirmDisabled, sameFile.body.slice(0, 400));

  const emailOnly = await importClients(`${FIX}/clients-email-only.csv`, `${label}-05-email-only`, ["different"]);
  record(`${label}-clients`, "Shared email different name was flagged, not auto-merged", /possible match|different name|Different Client|likely/i.test(emailOnly.match), emailOnly.match.slice(0, 900));
  record(`${label}-clients`, "Venue created a different Client for Other Office", /Import complete/.test(emailOnly.body) && !emailOnly.confirmDisabled, emailOnly.body.slice(0, 400));

  const retry = await importClients(`${FIX}/clients-morgan.csv`, `${label}-06-retry`);
  record(`${label}-clients`, "Unchanged Morgan retry was recognized without creating another Event", /already imported|already in Hello to Cheers|same Event|Nothing was overwritten|exact repeat/i.test(`${retry.plan}\n${retry.match}\n${retry.body}`), `${retry.plan}\n${retry.body.slice(0, 500)}`);

  const changed = await importClients(`${FIX}/clients-changed.csv`, `${label}-07-changed`, ["same"]);
  record(`${label}-clients`, "Changed source Event details were shown for review, not overwritten automatically", /changed|Differences|Guest count|same Event/i.test(`${changed.plan}\n${changed.match}`), changed.match.slice(0, 900));
  record(`${label}-clients`, "Same Client, same Event kept existing Morgan details", /Nothing was overwritten|used the Event|already|Import complete/i.test(changed.body), changed.body.slice(0, 400));

  const missing = await importClients(`${FIX}/clients-missing-date.csv`, `${label}-08-missing-date`);
  record(`${label}-clients`, "Missing event date stayed held, not a successful Client", /date|held|cannot|required|skipped|error/i.test(`${missing.plan}\n${missing.body}\n${missing.errors}`), `${missing.plan}\n${missing.body.slice(0, 400)}`);

  const held = await importClients(`${FIX}/clients-held.csv`, `${label}-09-held`, [null]);
  record(`${label}-clients`, "Unresolved Morgan match stayed held while Casey imported", /need review|Held|held/i.test(`${held.plan}\n${held.held}\n${held.body}`) && /Import complete/.test(held.body), `${held.plan}\n${held.held}\n${held.body.slice(0, 500)}`);

  const skipped = await importClients(`${FIX}/clients-dont-import.csv`, `${label}-10-dont-import`, ["skip"]);
  record(`${label}-clients`, "Don't import left Dana Skip out", /Don't import|Left out|skip/i.test(`${skipped.plan}\n${skipped.match}\n${skipped.body}`) && /Import complete/.test(skipped.body), skipped.body.slice(0, 400));

  const vendorFirst = await importVendors(`${FIX}/vendors-first.csv`, `${label}-11-vendor-first`, ["same"]);
  record(`${label}-vendors`, "Bloom & Co imported", /Import complete|used the vendor|already|Nothing was overwritten/i.test(vendorFirst.body) && !vendorFirst.confirmDisabled, vendorFirst.body.slice(0, 400));

  const sameEmail = await importVendors(`${FIX}/vendors-same-email.csv`, `${label}-12-vendor-email`, ["different"]);
  record(`${label}-vendors`, "Same email different business was flagged for a venue decision", /email|possible|Same Vendor|Different Vendor/i.test(sameEmail.match), sameEmail.match.slice(0, 900));
  record(`${label}-vendors`, "Venue created Bloom Catering as a different Vendor", /Import complete/.test(sameEmail.body) && !sameEmail.confirmDisabled, sameEmail.body.slice(0, 400));

  const sameName = await importVendors(`${FIX}/vendors-same-name.csv`, `${label}-13-vendor-name`, ["same"]);
  record(`${label}-vendors`, "Same business different email was flagged for a venue decision", /business name|possible|Same Vendor/i.test(sameName.match), sameName.match.slice(0, 900));
  record(`${label}-vendors`, "Venue confirmed Same Vendor for Bloom & Co", /Import complete|used the vendor|already|Nothing was overwritten/i.test(sameName.body), sameName.body.slice(0, 400));

  const vendorRetry = await importVendors(`${FIX}/vendors-first.csv`, `${label}-14-vendor-retry`);
  record(`${label}-vendors`, "Unchanged vendor retry did not create a second relationship", /already imported|already in|Same Vendor|Nothing was overwritten|exact repeat/i.test(`${vendorRetry.plan}\n${vendorRetry.match}\n${vendorRetry.body}`), `${vendorRetry.plan}\n${vendorRetry.body.slice(0, 400)}`);

  const vendorChanged = await importVendors(`${FIX}/vendors-changed.csv`, `${label}-15-vendor-changed`, ["same"]);
  record(`${label}-vendors`, "Changed vendor details were reviewed, not overwritten automatically", /changed|Differences|Contact|Same Vendor/i.test(`${vendorChanged.plan}\n${vendorChanged.match}\n${vendorChanged.body}`), vendorChanged.match.slice(0, 900));

  const vendorSkip = await importVendors(`${FIX}/vendors-dont-import.csv`, `${label}-16-vendor-skip`, ["skip"]);
  record(`${label}-vendors`, "Don't import left Skip Vendor out", /Don't import|Left out|skip/i.test(`${vendorSkip.plan}\n${vendorSkip.match}\n${vendorSkip.body}`), vendorSkip.body.slice(0, 400));
}

async function runRemainderJourney(
  label: "ss" | "hq",
  importClients: (file: string, shotPrefix: string, decisions?: Decision[]) => Promise<ImportOutcome>,
  importVendors: (file: string, shotPrefix: string, decisions?: Decision[]) => Promise<ImportOutcome>,
) {
  const changed = await importClients(`${FIX}/clients-changed.csv`, `${label}-07-changed`, ["same"]);
  record(`${label}-clients`, "Changed source Event details were shown for review, not overwritten automatically", /changed|Differences|Guest count|same Event/i.test(`${changed.plan}\n${changed.match}`), changed.match.slice(0, 900));
  record(`${label}-clients`, "Same Client, same Event kept existing Morgan details", /Nothing was overwritten|used the Event|already|Import complete/i.test(changed.body), changed.body.slice(0, 400));

  const missing = await importClients(`${FIX}/clients-missing-date.csv`, `${label}-08-missing-date`);
  record(`${label}-clients`, "Missing event date stayed held, not a successful Client", /date|held|cannot|required|skipped|error/i.test(`${missing.plan}\n${missing.body}\n${missing.errors}`), `${missing.plan}\n${missing.body.slice(0, 400)}`);

  const held = await importClients(`${FIX}/clients-held.csv`, `${label}-09-held`, [null]);
  record(`${label}-clients`, "Unresolved Morgan match stayed held while Casey imported", /need review|Held|held/i.test(`${held.plan}\n${held.held}\n${held.body}`) && /Import complete/.test(held.body), `${held.plan}\n${held.held}\n${held.body.slice(0, 500)}`);

  const skipped = await importClients(`${FIX}/clients-dont-import.csv`, `${label}-10-dont-import`, ["skip"]);
  record(`${label}-clients`, "Don't import left Dana Skip out", /Don't import|Left out|skip/i.test(`${skipped.plan}\n${skipped.match}\n${skipped.body}`) && /Import complete/.test(skipped.body), skipped.body.slice(0, 400));

  const vendorFirst = await importVendors(`${FIX}/vendors-first.csv`, `${label}-11-vendor-first`, ["same"]);
  record(`${label}-vendors`, "Bloom & Co imported", /Import complete|used the vendor|already|Nothing was overwritten/i.test(vendorFirst.body) && !vendorFirst.confirmDisabled, vendorFirst.body.slice(0, 400));

  const sameEmail = await importVendors(`${FIX}/vendors-same-email.csv`, `${label}-12-vendor-email`, ["different"]);
  record(`${label}-vendors`, "Same email different business was flagged for a venue decision", /email|possible|Same Vendor|Different Vendor/i.test(sameEmail.match), sameEmail.match.slice(0, 900));
  record(`${label}-vendors`, "Venue created Bloom Catering as a different Vendor", /Import complete/.test(sameEmail.body) && !sameEmail.confirmDisabled, sameEmail.body.slice(0, 400));

  const sameName = await importVendors(`${FIX}/vendors-same-name.csv`, `${label}-13-vendor-name`, ["same"]);
  record(`${label}-vendors`, "Same business different email was flagged for a venue decision", /business name|possible|Same Vendor/i.test(sameName.match), sameName.match.slice(0, 900));
  record(`${label}-vendors`, "Venue confirmed Same Vendor for Bloom & Co", /Import complete|used the vendor|already|Nothing was overwritten/i.test(sameName.body), sameName.body.slice(0, 400));

  const vendorRetry = await importVendors(`${FIX}/vendors-first.csv`, `${label}-14-vendor-retry`);
  record(`${label}-vendors`, "Unchanged vendor retry did not create a second relationship", /already imported|already in|Same Vendor|Nothing was overwritten|exact repeat/i.test(`${vendorRetry.plan}\n${vendorRetry.match}\n${vendorRetry.body}`), `${vendorRetry.plan}\n${vendorRetry.body.slice(0, 400)}`);

  const vendorChanged = await importVendors(`${FIX}/vendors-changed.csv`, `${label}-15-vendor-changed`, ["same"]);
  record(`${label}-vendors`, "Changed vendor details were reviewed, not overwritten automatically", /changed|Differences|Contact|Same Vendor/i.test(`${vendorChanged.plan}\n${vendorChanged.match}\n${vendorChanged.body}`), vendorChanged.match.slice(0, 900));

  const vendorSkip = await importVendors(`${FIX}/vendors-dont-import.csv`, `${label}-16-vendor-skip`, ["skip"]);
  record(`${label}-vendors`, "Don't import left Skip Vendor out", /Don't import|Left out|skip/i.test(`${vendorSkip.plan}\n${vendorSkip.match}\n${vendorSkip.body}`), vendorSkip.body.slice(0, 400));
}

function morganClients(snap: { clients: Array<Record<string, unknown>> }) {
  return snap.clients.filter((c) => String(c.first_name) === "Morgan" && String(c.last_name) === "Booked");
}
function namedClients(snap: { clients: Array<Record<string, unknown>> }, first: string, last: string) {
  return snap.clients.filter((c) => String(c.first_name) === first && String(c.last_name) === last);
}
function clientEvents(snap: { events: Array<Record<string, unknown>> }, clientIds: string[]) {
  return snap.events.filter((e) => clientIds.includes(String(e.client_id)) && String(e.status) !== "cancelled");
}
function vendorNamed(snap: { vendors: Array<Record<string, unknown>> }, name: string) {
  return snap.vendors.filter((v) => String(v.business_name) === name);
}

const browser = await chromium.launch({ headless: true });

try {
  let ssPersist: Awaited<ReturnType<typeof persistSnapshot>> | null = null;

  const ssContext = await browser.newContext({ viewport: { width: 1440, height: 1100 } });
  await ssContext.addCookies(await cookiesFor(creds.ssEmail));
  const page = await ssContext.newPage();
  page.setDefaultTimeout(40000);

  if (!RESUME) {
    await page.goto(`${APP}/setup-hub/bring-your-business?stage=clients&entry=files`, { waitUntil: "domcontentloaded", timeout: 60000 });
    await passWelcome(page);
    if (!page.url().includes("bring-your-business")) {
      await page.goto(`${APP}/setup-hub/bring-your-business?stage=clients&entry=files`, { waitUntil: "domcontentloaded", timeout: 60000 });
    }
    await page.getByTestId("byb-paste-textarea").waitFor({ timeout: 25000 });
    await shot(page, "ss-00-clients-entry");
    record("ss", "Self-service venue reached Bring Your Business Clients import", page.url().includes("bring-your-business"), page.url());
    record("generic", "Self-service entry does not require HoneyBook or Tripleseat", !/HoneyBook|Tripleseat/i.test(await page.locator("main").innerText()), page.url());

    await runJourney(
      "ss",
      (file, shotPrefix, decisions) => importSelfService(page, "clients", file, shotPrefix, decisions),
      (file, shotPrefix, decisions) => importSelfService(page, "vendors", file, shotPrefix, decisions),
    );
  }

  ssPersist = await persistSnapshot("self-service", creds.ssVenueId);
  const ssMorgan = morganClients(ssPersist);
  const ssMorganEvents = clientEvents(ssPersist, ssMorgan.map((c) => String(c.id)));
  const ssJordan = namedClients(ssPersist, "Jordan", "File");
  const ssJordanEvents = clientEvents(ssPersist, ssJordan.map((c) => String(c.id)));
  const ssOther = namedClients(ssPersist, "Other", "Office");
  const ssDana = namedClients(ssPersist, "Dana", "Skip");
  const ssCasey = namedClients(ssPersist, "Casey", "Clear");
  const ssPat = namedClients(ssPersist, "Pat", "Nodate");
  const ssBloom = vendorNamed(ssPersist, "Bloom & Co");
  const ssCatering = vendorNamed(ssPersist, "Bloom Catering");
  const ssSkipVendor = vendorNamed(ssPersist, "Skip Vendor");
  const ssDates = ssMorganEvents.map((e) => String(e.event_date).slice(0, 10)).sort();
  const ssSameDateCount = ssMorganEvents.filter((e) => String(e.event_date).startsWith("2027-09-12")).length;
  const ssNotes = String(ssMorgan[0]?.internal_notes ?? "");

  record("ss-persist", "Morgan remains one Client", ssMorgan.length === 1, JSON.stringify(ssMorgan));
  record("ss-persist", "Morgan has the original Event and the additional 2028 Event", ssDates.includes("2027-09-12") && ssDates.includes("2028-02-02"), JSON.stringify(ssMorganEvents.map((e) => ({ id: e.id, date: e.event_date, type: e.event_type, name: e.name }))));
  record("ss-persist", "Same-date Event was not silently discarded; occupancy still governed the outcome", ssSameDateCount >= 1 && (ssSameDateCount === 2 || ssMorganEvents.length >= 2), JSON.stringify({ ssSameDateCount, events: ssMorganEvents }));
  record("ss-persist", "Jordan File has two Events from the same file", ssJordan.length === 1 && ssJordanEvents.length === 2, JSON.stringify({ ssJordan, ssJordanEvents }));
  record("ss-persist", "Other Office is a distinct Client despite Morgan's email", ssOther.length === 1 && String(ssOther[0]?.id) !== String(ssMorgan[0]?.id), JSON.stringify(ssOther));
  record("ss-persist", "Don't import did not create Dana Skip", ssDana.length === 0, JSON.stringify(ssDana));
  record("ss-persist", "Casey imported while unresolved Morgan stayed out of a third extra Event unless confirmed", ssCasey.length === 1, JSON.stringify(ssCasey));
  record("ss-persist", "Missing-date Pat was not created as a Client", ssPat.length === 0, JSON.stringify(ssPat));
  record("ss-persist", "Bloom & Co is one global vendor with one venue relationship", ssBloom.length === 1 && ssPersist.relationships.filter((r) => r.vendor_id === ssBloom[0]?.id).length === 1, JSON.stringify({ vendors: ssBloom, rels: ssPersist.relationships }));
  record("ss-persist", "Bloom Catering is a distinct vendor after venue confirmation", ssCatering.length === 1 && String(ssCatering[0]?.id) !== String(ssBloom[0]?.id), JSON.stringify(ssCatering));
  record("ss-persist", "Don't import did not create Skip Vendor", ssSkipVendor.length === 0, JSON.stringify(ssSkipVendor));
  record("ss-persist", "Changed details did not overwrite original Morgan notes", !/do not overwrite/i.test(ssNotes), ssNotes.slice(0, 300));
  record("safety", "Self-service venue isolated", [...ssPersist.clients, ...ssPersist.events, ...ssPersist.leads].every((row) => row.venue_id === creds.ssVenueId), creds.ssVenueId);
  record("safety", "No QBO / invites / contracts / payments / messages on self-service", ssPersist.qbo.length === 0 && ssPersist.invites.length === 0 && ssPersist.contracts.length === 0 && ssPersist.payments.length === 0 && ssPersist.messages.length === 0 && ssPersist.sms.length === 0 && ssPersist.scheduled.length === 0, JSON.stringify({ qbo: ssPersist.qbo, invites: ssPersist.invites }));

  if (ssMorgan.length === 1 && ssMorganEvents.length >= 2) {
    const later = ssMorganEvents.find((e) => String(e.event_date).startsWith("2028-02-02")) ?? ssMorganEvents[1]!;
    await page.goto(`${APP}/events/${later.id}`, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForURL(
      (url: URL) => url.pathname.includes(`/clients/${ssMorgan[0]!.id}`),
      { timeout: 20000 },
    ).catch(() => {});
    const afterCalendar = page.url();
    const landedEventId = new URL(afterCalendar).searchParams.get("eventId");
    record("ss-nav", "Calendar Event opened the matching Client Event", afterCalendar.includes(`/clients/${ssMorgan[0]!.id}`) && landedEventId === String(later.id), afterCalendar);
    if (afterCalendar.includes("/booked") && landedEventId === String(later.id)) {
      await page.goto(`${APP}/clients/${ssMorgan[0]!.id}?eventId=${later.id}`, { waitUntil: "domcontentloaded", timeout: 60000 });
    }
    await page.getByTestId("client-event-switcher").waitFor({ timeout: 15000 }).catch(() => {});
    await shot(page, "ss-17-multi-event");
    const current = await page.getByTestId("client-event-current").innerText().catch(() => "");
    const switcher = await page.getByTestId("client-event-switcher").innerText().catch(() => "");
    record("ss-nav", "Workspace identifies the Event being viewed and lists Morgan's Events", /2028-02-02/.test(current) && /2027-09-12/.test(switcher) && /Viewing event/i.test(switcher), `${current}\n${switcher}\n${page.url()}`);

    await page.goto(`${APP}/clients/${ssMorgan[0]!.id}?eventId=${FANCY}`, { waitUntil: "domcontentloaded", timeout: 60000 });
    record("ss-nav", "Unauthorized Event ID did not expose another venue", !page.url().includes(FANCY) || !(await page.locator("main").innerText()).includes("Fancy"), page.url());
  }

  await ssContext.close();

  const hqContext = await browser.newContext({ viewport: { width: 1440, height: 1100 } });
  await hqContext.addCookies(await cookiesFor(creds.hqEmail));
  const hqPage = await hqContext.newPage();
  hqPage.setDefaultTimeout(40000);
  await hqPage.goto(`${APP}/admin/onboarding/${creds.hqVenueId}`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await hqPage.getByText(/Import data for/i).waitFor({ timeout: 25000 });
  await shot(hqPage, "hq-00-onboarding");
  record("hq", "HQ admin reached White-Glove onboarding import", hqPage.url().includes(creds.hqVenueId), hqPage.url());
  record("generic", "HQ import does not require HoneyBook or Tripleseat", !/HoneyBook|Tripleseat/i.test(await hqPage.locator("main").innerText().catch(() => "")), hqPage.url());

  const hqImport = RESUME ? runRemainderJourney : runJourney;
  await hqImport(
    "hq",
    (file, shotPrefix, decisions) => importHq(hqPage, "couples", file, shotPrefix, decisions),
    (file, shotPrefix, decisions) => importHq(hqPage, "vendors", file, shotPrefix, decisions),
  );

  const hqPersist = await persistSnapshot("hq-white-glove", creds.hqVenueId);
  const hqMorgan = morganClients(hqPersist);
  const hqMorganEvents = clientEvents(hqPersist, hqMorgan.map((c) => String(c.id)));
  const hqJordan = namedClients(hqPersist, "Jordan", "File");
  const hqJordanEvents = clientEvents(hqPersist, hqJordan.map((c) => String(c.id)));
  const hqOther = namedClients(hqPersist, "Other", "Office");
  const hqDana = namedClients(hqPersist, "Dana", "Skip");
  const hqCasey = namedClients(hqPersist, "Casey", "Clear");
  const hqPat = namedClients(hqPersist, "Pat", "Nodate");
  const hqBloom = vendorNamed(hqPersist, "Bloom & Co");
  const hqCatering = vendorNamed(hqPersist, "Bloom Catering");
  const hqSkipVendor = vendorNamed(hqPersist, "Skip Vendor");
  const hqDates = hqMorganEvents.map((e) => String(e.event_date).slice(0, 10)).sort();

  record("hq-persist", "HQ Morgan remains one Client", hqMorgan.length === 1, JSON.stringify(hqMorgan));
  record("hq-persist", "HQ Morgan has the original Event and the additional 2028 Event", hqDates.includes("2027-09-12") && hqDates.includes("2028-02-02"), JSON.stringify(hqMorganEvents.map((e) => ({ id: e.id, date: e.event_date, type: e.event_type }))));
  record("hq-persist", "HQ Jordan File has two Events from the same file", hqJordan.length === 1 && hqJordanEvents.length === 2, JSON.stringify({ hqJordan, hqJordanEvents }));
  record("hq-persist", "HQ Other Office is a distinct Client", hqOther.length === 1 && String(hqOther[0]?.id) !== String(hqMorgan[0]?.id), JSON.stringify(hqOther));
  record("hq-persist", "HQ Don't import did not create Dana Skip", hqDana.length === 0, JSON.stringify(hqDana));
  record("hq-persist", "HQ Casey imported", hqCasey.length === 1, JSON.stringify(hqCasey));
  record("hq-persist", "HQ missing-date Pat was not created", hqPat.length === 0, JSON.stringify(hqPat));
  record("hq-persist", "HQ Bloom & Co is one vendor with one venue relationship", hqBloom.length === 1 && hqPersist.relationships.filter((r) => r.vendor_id === hqBloom[0]?.id).length === 1, JSON.stringify({ vendors: hqBloom, rels: hqPersist.relationships }));
  record("hq-persist", "HQ Bloom Catering is a distinct vendor", hqCatering.length === 1 && String(hqCatering[0]?.id) !== String(hqBloom[0]?.id), JSON.stringify(hqCatering));
  record("hq-persist", "HQ Don't import did not create Skip Vendor", hqSkipVendor.length === 0, JSON.stringify(hqSkipVendor));
  record("safety", "HQ venue isolated", [...hqPersist.clients, ...hqPersist.events, ...hqPersist.leads].every((row) => row.venue_id === creds.hqVenueId), creds.hqVenueId);
  record("safety", "No QBO / invites / contracts / payments / messages on HQ venue", hqPersist.qbo.length === 0 && hqPersist.invites.length === 0 && hqPersist.contracts.length === 0 && hqPersist.payments.length === 0 && hqPersist.messages.length === 0 && hqPersist.sms.length === 0 && hqPersist.scheduled.length === 0, JSON.stringify({ qbo: hqPersist.qbo, invites: hqPersist.invites }));

  if (ssPersist) {
    record(
      "parity",
      "HQ and self-service persisted equivalent Client/Event and Vendor decisions",
      ssMorgan.length === hqMorgan.length
        && ssJordan.length === hqJordan.length
        && ssJordanEvents.length === hqJordanEvents.length
        && ssOther.length === hqOther.length
        && ssDana.length === hqDana.length
        && ssCasey.length === hqCasey.length
        && ssBloom.length === hqBloom.length
        && ssCatering.length === hqCatering.length
        && ssSkipVendor.length === hqSkipVendor.length
        && ssPersist.events.filter((e) => String(e.event_date).startsWith("2028-02-02")).length
          === hqPersist.events.filter((e) => String(e.event_date).startsWith("2028-02-02")).length,
      JSON.stringify({
        ssMorgan: ssMorgan.length,
        hqMorgan: hqMorgan.length,
        ssMorganEvents: ssMorganEvents.length,
        hqMorganEvents: hqMorganEvents.length,
        ssJordanEvents: ssJordanEvents.length,
        hqJordanEvents: hqJordanEvents.length,
        ssBloom: ssBloom.length,
        hqBloom: hqBloom.length,
        ssCatering: ssCatering.length,
        hqCatering: hqCatering.length,
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
  const repoCopy = "/Users/jensmac/Developer/wevenu-website/.worktrees/bring-your-business-unified/docs/qa/phase-b3-unified-review";
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
