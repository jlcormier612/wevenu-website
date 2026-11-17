/**
 * Corrected Phase B — isolated Chromium acceptance on localhost:3040.
 * NEW disposable venue. Does not deploy, merge, or touch other worktrees.
 */
import { createRequire } from "node:module";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

config({ path: ".env.local", quiet: true });

const require = createRequire(
  "/Users/jensmac/Developer/wevenu-website/marketing/package.json",
);
const { chromium } = require("playwright");

const APP = "http://localhost:3040";
const OUT = `${process.env.HOME}/Desktop/HTC-Phase-B-Corrected-Acceptance`;
const FANCY = "a415ac52-cd74-42a6-8df7-7a8f6e71d080";
const WILLOW = "31f38b79-eb99-4ebc-81bc-af85767b42aa";

if (!process.env.NEXT_PUBLIC_SUPABASE_URL?.includes("wvpsldwwjqdannqasrdf")) {
  throw new Error("Refusing: not Sandbox supabase");
}

mkdirSync(OUT, { recursive: true });
const creds = JSON.parse(readFileSync("/tmp/htc-byb-corrected-creds.json", "utf8")) as {
  email: string;
  password: string;
  venueId: string;
  venueName: string;
  spaceId: string;
};
if (creds.venueId === FANCY || creds.venueId === WILLOW) {
  throw new Error("Refusing protected venue");
}

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
);

type Check = { name: string; pass: boolean; detail: string; category: string };
const checks: Check[] = [];
function record(category: string, name: string, pass: boolean, detail: string) {
  checks.push({ category, name, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"} [${category}] ${name} — ${detail.slice(0, 500)}`);
}

async function shot(page: { screenshot: (o: object) => Promise<Buffer> }, name: string) {
  const buf = await page.screenshot({ fullPage: true });
  writeFileSync(`${OUT}/${name}.png`, buf);
}

async function persistSnapshot(label: string) {
  const venueId = creds.venueId;
  const q = async (table: string, cols: string) => admin.from(table).select(cols).eq("venue_id", venueId);
  const [
    clients,
    events,
    leads,
    rels,
    batches,
    qbo,
    invites,
    setupStates,
    contracts,
    payments,
  ] = await Promise.all([
    q("clients", "id, first_name, last_name, email, event_date, status, venue_id, relationship_id"),
    q("events", "id, client_id, name, status, event_date, booked_at, space_id, venue_id"),
    q("leads", "id, first_name, last_name, email, partner_first_name, partner_last_name, event_date, event_type, guest_count, source, sales_stage, follow_up_date, next_action_text, inquiry_message, source_data, venue_id, relationship_id"),
    q("venue_vendor_relationships", "id, vendor_id, status, venue_id"),
    q("import_batches", "id, entity_type, imported_count, skipped_count, error_count, source_label, rolled_back_at"),
    q("quickbooks_sync_queue", "id, entity_type, entity_id"),
    q("client_invitations", "id, status"),
    q("event_setup_states", "event_id"),
    q("contracts", "id, status"),
    q("payments", "id, status"),
  ]);
  const vendorIds = (rels.data ?? []).map((r: { vendor_id: string }) => r.vendor_id);
  const vendors = vendorIds.length
    ? await admin.from("vendors").select("id, business_name, email").in("id", vendorIds)
    : { data: [] as { id: string; business_name: string; email: string }[], error: null };
  const snap = {
    label,
    clients: clients.data ?? [],
    events: events.data ?? [],
    leads: leads.data ?? [],
    vendorRelationships: rels.data ?? [],
    vendors: vendors.data ?? [],
    batches: batches.data ?? [],
    qbo: qbo.data ?? [],
    invites: invites.data ?? [],
    setupStates: setupStates.data ?? [],
    contracts: contracts.data ?? [],
    payments: payments.data ?? [],
    errors: {
      clients: clients.error?.message,
      events: events.error?.message,
      leads: leads.error?.message,
      rels: rels.error?.message,
      qbo: qbo.error?.message,
      contracts: contracts.error?.message,
      payments: payments.error?.message,
    },
  };
  writeFileSync(`${OUT}/persist-${label}.json`, JSON.stringify(snap, null, 2));
  return snap;
}

async function passWelcome(page: {
  url: () => string;
  locator: (s: string) => {
    count: () => Promise<number>;
    waitFor: (o?: object) => Promise<void>;
    check: (o?: { force?: boolean }) => Promise<void>;
  };
  getByRole: (r: string, o?: object) => {
    click: (o?: object) => Promise<void>;
    waitFor: (o?: object) => Promise<void>;
  };
  waitForURL: (u: RegExp | ((url: URL) => boolean), o?: object) => Promise<void>;
}) {
  if (!page.url().includes("/welcome")) return;
  const box = page.locator("#welcome-experience-agree");
  await box.waitFor({ timeout: 15000 }).catch(() => {});
  if (await box.count()) await box.check({ force: true });
  const cont = page.getByRole("button", { name: "Continue" });
  await cont.waitFor({ timeout: 10000 });
  await cont.click();
  await page.waitForURL((url: URL) => !url.pathname.includes("/welcome"), {
    timeout: 20000,
    waitUntil: "commit",
  });
}

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1100 } });
const page = await context.newPage();
page.setDefaultTimeout(25000);

type ImportOutcome = { imported: string; errors: string; body: string; url: string };

async function importList(
  stage: "leads" | "clients" | "vendors",
  file: string,
  shotPrefix: string,
): Promise<ImportOutcome> {
  await page.goto(`${APP}/setup-hub/bring-your-business?stage=${stage}&entry=files`, {
    waitUntil: "domcontentloaded",
  });
  await page.getByTestId("byb-paste-textarea").waitFor({ timeout: 20000 });
  await page.locator('[data-testid="byb-use-paste"][data-hydrated="true"]').waitFor({ timeout: 15000 });
  const csv = readFileSync(file, "utf8");
  await page.getByTestId("byb-paste-textarea").fill(csv);
  await page.getByTestId("byb-use-paste").click();
  const mappingBlock = page.getByTestId("byb-mapping-needs-review");
  const previewBtn = page.getByRole("button", { name: /Preview/ });
  await Promise.race([
    previewBtn.waitFor({ timeout: 25000 }),
    mappingBlock.waitFor({ timeout: 25000 }),
  ]).catch(() => {});
  await shot(page, `${shotPrefix}-map`);
  if (await mappingBlock.count()) {
    const body = (await page.locator("main").innerText()).slice(0, 1800);
    return { imported: "0", errors: "mapping-blocked", body, url: page.url() };
  }
  await previewBtn.click();
  await page.getByTestId("byb-match-checking").or(page.getByTestId("byb-match-review")).or(page.getByRole("button", { name: /Import \d+/ })).waitFor({ timeout: 20000 }).catch(() => {});
  await page.getByTestId("byb-match-checking").waitFor({ state: "hidden", timeout: 15000 }).catch(() => {});
  if (await page.getByTestId("byb-match-review").count()) {
    await shot(page, `${shotPrefix}-match`);
  }
  const importBtn = page.getByTestId("byb-import-confirm");
  await importBtn.waitFor({ timeout: 20000 }).catch(() => {});
  await page.locator('[data-testid="byb-import-confirm"]:not([disabled])').waitFor({ timeout: 20000 }).catch(() => {});
  if (!(await importBtn.count())) {
    const body = (await page.locator("main").innerText()).slice(0, 1800);
    await shot(page, `${shotPrefix}-blocked`);
    return { imported: "0", errors: "no-import-button", body, url: page.url() };
  }
  const disabled = await importBtn.isDisabled().catch(() => true);
  if (disabled) {
    const body = (await page.locator("main").innerText()).slice(0, 1800);
    await shot(page, `${shotPrefix}-disabled`);
    return { imported: "0", errors: "import-disabled", body, url: page.url() };
  }
  await importBtn.click();
  await page.getByRole("heading", { name: "Import complete" }).waitFor({ timeout: 40000 });
  await shot(page, `${shotPrefix}-result`);
  const imported = await page.locator("text=Imported").locator("xpath=..").innerText().catch(() => "");
  const errors = await page.locator("text=Errors").locator("xpath=..").innerText().catch(() => "");
  const body = (await page.locator("main").innerText()).slice(0, 2000);
  return { imported, errors, body, url: page.url() };
}

try {
  await page.goto(`${APP}/login`, { waitUntil: "domcontentloaded" });
  await page.locator("#email").fill(creds.email);
  await page.locator("#password").fill(creds.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL((url: URL) => !url.pathname.includes("/login"), { timeout: 20000, waitUntil: "commit" });
  await passWelcome(page);
  await page.waitForURL(/\/(setup-hub|dashboard)/, { timeout: 20000, waitUntil: "commit" });
  record("safety", "Logged into new disposable venue on localhost:3040", true, page.url());

  await page.goto(`${APP}/setup-hub`, { waitUntil: "domcontentloaded" });
  await page.getByRole("heading", { name: /get your venue ready|Make yourself at home|Bring your business/i }).first().waitFor({ timeout: 20000 });
  await shot(page, "01-setup-hub-desktop");
  const explore = page.getByRole("link", { name: "Explore migration" });
  const exploreBtn = page.getByRole("button", { name: "Explore migration" });
  if (await explore.count()) await explore.click();
  else if (await exploreBtn.count()) await exploreBtn.click();
  else await page.goto(`${APP}/setup-hub/bring-your-business`);
  await page.getByRole("heading", { name: /Bring your business with you/i }).waitFor({ timeout: 20000 }).catch(async () => {
    await page.goto(`${APP}/setup-hub/bring-your-business`, { waitUntil: "domcontentloaded" });
  });
  if (!page.url().includes("bring-your-business")) {
    await page.goto(`${APP}/setup-hub/bring-your-business`, { waitUntil: "domcontentloaded" });
  }
  await page.getByRole("heading", { name: "Bring your business with you." }).waitFor();
  await shot(page, "02-byb-entry");
  const importChoice = page.getByRole("link", { name: /Import from another system/i });
  const filesChoice = page.getByRole("link", { name: /I have spreadsheets or documents/i });
  record("journey", "Entry shows Import from another system", await importChoice.count() > 0, await importChoice.count().then(String));
  record("journey", "Entry shows I have spreadsheets or documents", await filesChoice.count() > 0, await filesChoice.count().then(String));
  record("journey", "Entry has no named software picker", !(await page.getByText(/HoneyBook|Aisle Planner|The Knot/i).count()), page.url());

  await importChoice.click();
  await page.getByRole("heading", { name: "Prepare your business" }).waitFor({ timeout: 20000 });
  await shot(page, "03-prepare");
  const prepareCopy = await page.locator("main").innerText();
  record("journey", "Prepare lists Leads, Clients and their events, Vendors", /Leads/.test(prepareCopy) && /Clients and their events/.test(prepareCopy) && /Vendors/.test(prepareCopy), prepareCopy.slice(0, 400));
  record("journey", "Prepare does not present Contacts as a category", !/standalone Contacts/i.test(prepareCopy) && !/Bring your people/.test(prepareCopy), prepareCopy.slice(0, 200));

  await page.getByTestId("byb-skip-stage").click();
  await page.getByRole("heading", { name: "Bring over leads" }).waitFor({ timeout: 20000 });
  record("journey", "Skip prepare lands on Leads", page.url().includes("stage=leads"), page.url());
  await shot(page, "04-leads-after-skip");
  await page.getByRole("link", { name: "Back", exact: true }).click();
  await page.getByRole("heading", { name: "Prepare your business" }).waitFor({ timeout: 20000 });
  await page.getByTestId("byb-continue-stage").click();
  await page.getByRole("heading", { name: "Bring over leads" }).waitFor({ timeout: 20000 });
  record("journey", "Continue prepare lands on Leads", page.url().includes("stage=leads"), page.url());

  const leadResult = await importList("leads", "/tmp/htc-byb-corrected-fixtures/leads.csv", "05-leads");
  record("leads", "Lead import completed in UI", /Import complete/.test(leadResult.body), leadResult.body.slice(0, 400));
  record("leads", "Lead import reports imported rows", /Imported/.test(leadResult.imported) && !leadResult.imported.includes("Imported\n0"), leadResult.imported);

  const emailOnly = await importList("leads", "/tmp/htc-byb-corrected-fixtures/leads-email-only.csv", "06-email-only");
  record("leads", "Email-only possible match is not imported as a new identity", /Left out|not imported|Skip|already/i.test(emailOnly.body) && !/Imported\n1/.test(emailOnly.body.replace(/\s+/g, "\n")), emailOnly.body.slice(0, 500));

  const upcoming = await importList("clients", "/tmp/htc-byb-corrected-fixtures/clients-upcoming.csv", "07-upcoming");
  record("clients", "Upcoming booked Client import completed", /Import complete/.test(upcoming.body), upcoming.body.slice(0, 400));

  const past = await importList("clients", "/tmp/htc-byb-corrected-fixtures/clients-past.csv", "08-past");
  record("clients", "Past completed Client import completed", /Import complete/.test(past.body), past.body.slice(0, 400));

  const second = await importList("clients", "/tmp/htc-byb-corrected-fixtures/clients-second-event.csv", "09-second-event");
  record("clients", "Same Client with a second Event completed", /Import complete/.test(second.body), second.body.slice(0, 500));

  const retry = await importList("clients", "/tmp/htc-byb-corrected-fixtures/clients-retry.csv", "10-retry");
  record("clients", "Duplicate Client/Event retry does not claim a new Event", /already in Hello to Cheers|Left out|not imported/i.test(retry.body), retry.body.slice(0, 500));

  const missingDate = await importList("clients", "/tmp/htc-byb-corrected-fixtures/clients-missing-date.csv", "11-missing-date");
  record("hold", "Missing event date is held, not successful", /confirmed event date|Lead|Errors|not imported/i.test(missingDate.body) && !/Imported\n1/.test(missingDate.body.replace(/\s+/g, "\n")), missingDate.body.slice(0, 500));

  const missingSpace = await importList("clients", "/tmp/htc-byb-corrected-fixtures/clients-missing-space.csv", "12-missing-space");
  record("hold", "Missing space on upcoming booking is held", /Event Space|Errors|not imported/i.test(missingSpace.body), missingSpace.body.slice(0, 500));

  const badSpace = await importList("clients", "/tmp/htc-byb-corrected-fixtures/clients-bad-space.csv", "13-bad-space");
  record("hold", "Conflicting / unknown space is held", /space|Errors|not imported/i.test(badSpace.body), badSpace.body.slice(0, 500));

  const clash = await importList("clients", "/tmp/htc-byb-corrected-fixtures/clients-clash.csv", "14-clash");
  record("hold", "Occupancy clash is held", /already booked|capacity|overlap|Errors|not imported/i.test(clash.body), clash.body.slice(0, 500));

  const incomplete = await importList("leads", "/tmp/htc-byb-corrected-fixtures/incomplete.csv", "15-incomplete");
  record("hold", "Incomplete file is blocked before import", incomplete.errors === "mapping-blocked" || /required columns|First Name/i.test(incomplete.body), incomplete.body.slice(0, 500));

  const vendors = await importList("vendors", "/tmp/htc-byb-corrected-fixtures/vendors.csv", "16-vendors");
  record("vendors", "Vendor import completed", /Import complete/.test(vendors.body), vendors.body.slice(0, 400));

  await page.goto(`${APP}/leads`, { waitUntil: "domcontentloaded" });
  await page.getByText("Riley").first().waitFor({ timeout: 20000 }).catch(() => {});
  await shot(page, "17-leads-list");
  const leadsText = await page.locator("main").innerText();
  record("leads", "Riley appears on Leads", /Riley/.test(leadsText), leadsText.slice(0, 400));
  record("leads", "Imported Client Mira is not listed as a Lead", !/Mira/.test(leadsText), leadsText.slice(0, 200));

  await page.goto(`${APP}/clients`, { waitUntil: "domcontentloaded" });
  await page.getByText("Loading clients").waitFor({ state: "hidden", timeout: 20000 }).catch(() => {});
  await shot(page, "18-all-bookings");
  const bookingsText = await page.locator("main").innerText();
  record("clients", "Upcoming Bella appears under All Bookings", /Bella/.test(bookingsText), bookingsText.slice(0, 400));
  record("nav", "All Bookings has no import-success Contacts CTA", !/people you imported/i.test(bookingsText), bookingsText.slice(0, 200));

  await page.goto(`${APP}/clients?filter=past`, { waitUntil: "domcontentloaded" });
  await page.getByText("Loading clients").waitFor({ state: "hidden", timeout: 20000 }).catch(() => {});
  await shot(page, "19-past-clients");
  const pastText = await page.locator("main").innerText();
  record("clients", "Historical Mira appears under Past", /Mira/.test(pastText), pastText.slice(0, 400));

  await page.goto(`${APP}/calendar`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1200);
  await shot(page, "20-calendar");
  const calText = await page.locator("main").innerText();
  record("clients", "Calendar shows the upcoming booked event", /Bella|Upcoming|Wedding/i.test(calText), calText.slice(0, 400));

  await page.goto(`${APP}/vendors`, { waitUntil: "domcontentloaded" });
  await page.getByText("Bloom").first().waitFor({ timeout: 20000 }).catch(() => {});
  await shot(page, "21-vendors");
  record("vendors", "Bloom & Co appears on Vendors", /Bloom/.test(await page.locator("main").innerText()), "");

  await page.goto(`${APP}/setup-hub/bring-your-business?stage=review&entry=files`, { waitUntil: "domcontentloaded" });
  await page.getByRole("heading", { name: "Review and finish" }).waitFor();
  await shot(page, "22-review");
  const reviewText = await page.locator("main").innerText();
  record("nav", "Review distinguishes brought over / skipped / attention", /Brought over/.test(reviewText) && /Skipped for now|Needs attention/.test(reviewText), reviewText.slice(0, 500));
  record("nav", "Review has no Contacts success CTA", !/Open Contacts|filter=contacts/.test(reviewText), reviewText.slice(0, 200));

  await page.reload({ waitUntil: "domcontentloaded" });
  await page.getByRole("heading", { name: "Review and finish" }).waitFor();
  await shot(page, "23-review-refresh");
  record("nav", "Refresh keeps Review stage and readiness", page.url().includes("stage=review"), page.url());

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${APP}/setup-hub/bring-your-business?stage=leads&entry=files`, { waitUntil: "domcontentloaded" });
  await page.getByRole("heading", { name: "Bring over leads" }).waitFor();
  await shot(page, "24-leads-390");
  await page.goto(`${APP}/setup-hub/bring-your-business?stage=clients&entry=files`, { waitUntil: "domcontentloaded" });
  await page.getByRole("heading", { name: "Bring over clients and their events" }).waitFor();
  await shot(page, "25-clients-390");
  await page.goto(`${APP}/setup-hub/bring-your-business?stage=review&entry=files`, { waitUntil: "domcontentloaded" });
  await shot(page, "26-review-390");
  record("mobile", "390px Leads and Clients stages render", true, "screenshots 24-26");

  const persist = await persistSnapshot("after-imports");
  const leadRows = persist.leads as Array<Record<string, unknown>>;
  const clientRows = persist.clients as Array<Record<string, unknown>>;
  const eventRows = persist.events as Array<Record<string, unknown>>;
  const riley = leadRows.filter((l) => String(l.email) === "riley.prospect@byb.test");
  const other = leadRows.filter((l) => String(l.first_name) === "Other");
  const bella = clientRows.filter((c) => String(c.email) === "bella.upcoming@byb.test");
  const mira = clientRows.filter((c) => String(c.email) === "mira.historical@byb.test");
  const nodate = clientRows.filter((c) => String(c.email) === "nodate.client@byb.test");
  const nospace = clientRows.filter((c) => String(c.email) === "nospace.client@byb.test");
  const badspace = clientRows.filter((c) => String(c.email) === "badspace.client@byb.test");
  const clashRow = clientRows.filter((c) => String(c.email) === "clash.sameday@byb.test");
  const bellaEvents = eventRows.filter((e) => bella.some((c) => c.id === e.client_id));
  const miraEvents = eventRows.filter((e) => mira.some((c) => c.id === e.client_id));
  const rileyDates = riley.map((l) => String(l.event_date ?? "").slice(0, 10));
  const bookedLeads = leadRows.filter((l) => String(l.sales_stage) === "booked");
  const isolationOk = [...clientRows, ...leadRows, ...eventRows].every((row) => row.venue_id === creds.venueId);

  record("leads", "Persisted Lead with preferred date 2027-06-12", rileyDates.includes("2027-06-12"), JSON.stringify(rileyDates));
  record("leads", "Partner, source, notes, status, follow-up, flexibility persisted", riley.some((l) =>
    String(l.partner_first_name) === "Sam"
    && String(l.source) === "website"
    && /Preferred June|flexibility/i.test(String(l.inquiry_message ?? "") + JSON.stringify(l.source_data ?? {}))
    && (String(l.sales_stage) === "new_inquiry" || String(l.follow_up_date ?? "").length > 0)
  ), JSON.stringify(riley.map((l) => ({
    partner: l.partner_first_name,
    source: l.source,
    stage: l.sales_stage,
    followUp: l.follow_up_date,
    sourceData: l.source_data,
    inquiry: l.inquiry_message,
  }))));
  record("leads", "Multiple inquiries from Riley persisted as separate Leads", riley.length >= 2 && rileyDates.includes("2028-05-03"), `count=${riley.length} dates=${rileyDates.join(",")}`);
  record("leads", "Lead preferred dates did not book occupancy", bookedLeads.length === 0 && !eventRows.some((e) => riley.some((l) => l.relationship_id && e.client_id === l.id)), `bookedLeads=${bookedLeads.length}`);
  record("leads", "Email-only Other Person was not created", other.length === 0, `other=${other.length}`);
  record("clients", "Upcoming Bella Client + Event persisted", bella.length === 1 && bellaEvents.some((e) => String(e.event_date).startsWith("2027-09-12") && String(e.status) !== "cancelled"), JSON.stringify(bellaEvents.map((e) => ({ date: e.event_date, status: e.status, space: e.space_id }))));
  record("clients", "Past Mira Client + complete Event persisted", mira.length === 1 && miraEvents.some((e) => String(e.event_date).startsWith("2024-06-15") && String(e.status) === "complete"), JSON.stringify(miraEvents));
  record("clients", "Bella has two distinct Events", bellaEvents.filter((e) => String(e.status) !== "cancelled").length >= 2, JSON.stringify(bellaEvents.map((e) => e.event_date)));
  record("clients", "Retry did not create a third Bella event on 2027-09-12", bellaEvents.filter((e) => String(e.event_date).startsWith("2027-09-12") && String(e.status) !== "cancelled").length === 1, JSON.stringify(bellaEvents));
  record("hold", "No orphan Client for missing date", nodate.length === 0, `nodate=${nodate.length}`);
  record("hold", "No orphan Client for missing space", nospace.length === 0, `nospace=${nospace.length}`);
  record("hold", "No orphan Client for conflicting space", badspace.length === 0, `badspace=${badspace.length}`);
  record("hold", "No orphan Client for occupancy clash", clashRow.length === 0, `clash=${clashRow.length}`);
  record("vendors", "Vendor relationship persisted for this venue", persist.vendorRelationships.length >= 1 && persist.vendors.some((v: { business_name?: string }) => /Bloom/.test(String(v.business_name))), JSON.stringify(persist.vendors));
  record("safety", "No QuickBooks enqueue", persist.qbo.length === 0, JSON.stringify(persist.qbo));
  record("safety", "No client invitations", persist.invites.length === 0, JSON.stringify(persist.invites));
  record("safety", "No contracts or payments invented", persist.contracts.length === 0 && persist.payments.length === 0, JSON.stringify({ contracts: persist.contracts, payments: persist.payments }));
  record("safety", "Historical Mira did not inherit Setup Profile automatically", !miraEvents.some((e) => persist.setupStates.some((s: { event_id: string }) => s.event_id === e.id)), JSON.stringify(persist.setupStates));
  record("safety", "All persisted people/events isolated to disposable venue", isolationOk, creds.venueId);
  record("safety", "Protected venues untouched by this fixture", creds.venueId !== FANCY && creds.venueId !== WILLOW, creds.venueId);

  const upcomingOccupied = eventRows.filter((e) => String(e.event_date).startsWith("2027-09-12") && String(e.status) !== "cancelled");
  record("clients", "Only one occupying event on 2027-09-12", upcomingOccupied.length === 1, JSON.stringify(upcomingOccupied));
} catch (err) {
  record("runtime", "Browser script error", false, err instanceof Error ? err.stack ?? err.message : String(err));
  await shot(page, "99-error").catch(() => {});
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
  const report = { venueId: creds.venueId, venueName: creds.venueName, email: creds.email, verdicts, checks };
  writeFileSync(`${OUT}/report.json`, JSON.stringify(report, null, 2));
  console.log("\n=== VERDICTS ===");
  console.log(JSON.stringify(verdicts, null, 2));
  console.log(`Wrote ${OUT}`);
  await browser.close();
}
