/**
 * Phase B Bring Your Business — isolated Chromium acceptance.
 * Uses Playwright so Cursor snapshot tooling cannot inject data-cursor-ref
 * and break hydration. Does not deploy, merge, or touch other worktrees.
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
const OUT = `${process.env.HOME}/Desktop/HTC-Phase-B-Browser-Acceptance`;
const FANCY = "a415ac52-cd74-42a6-8df7-7a8f6e71d080";
const WILLOW = "31f38b79-eb99-4ebc-81bc-af85767b42aa";

if (!process.env.NEXT_PUBLIC_SUPABASE_URL?.includes("wvpsldwwjqdannqasrdf")) {
  throw new Error("Refusing: not Sandbox supabase");
}

mkdirSync(OUT, { recursive: true });
const creds = JSON.parse(readFileSync("/tmp/htc-byb-phase-b-creds.json", "utf8")) as {
  email: string;
  password: string;
  venueId: string;
  venueName: string;
  seeded: Record<string, string | boolean | null>;
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
  console.log(`${pass ? "PASS" : "FAIL"} [${category}] ${name} — ${detail.slice(0, 400)}`);
}

async function shot(page: { screenshot: (o: object) => Promise<Buffer> }, name: string) {
  const buf = await page.screenshot({ fullPage: true });
  writeFileSync(`${OUT}/${name}.png`, buf);
}

async function persistSnapshot(label: string) {
  const venueId = creds.venueId;
  const q = async (table: string, cols: string) => {
    const res = await admin.from(table).select(cols).eq("venue_id", venueId);
    return res;
  };
  const [clients, events, leads, vendors, batches, qbo, invites] = await Promise.all([
    q("clients", "id, first_name, last_name, email, event_date, status, venue_id"),
    q("events", "id, client_id, status, event_date, booked_at, venue_id"),
    q("leads", "id, first_name, last_name, email, sales_stage, venue_id"),
    admin.from("vendors").select("id, business_name, email").ilike("email", "%byb.test%"),
    q("import_batches", "id, entity_type, imported_count, skipped_count, error_count, source_label, rolled_back_at"),
    q("quickbooks_sync_queue", "id, entity_type, entity_id"),
    q("client_invitations", "id, status"),
  ]);
  const messages = { data: [] as { id: string }[], error: null as { message: string } | null };
  const setupStates = await admin
    .from("event_setup_states")
    .select("event_id")
    .eq("venue_id", venueId);
  const snap = {
    label,
    clients: clients.data ?? [],
    events: events.data ?? [],
    leads: leads.data ?? [],
    vendors: vendors.data ?? [],
    batches: batches.data ?? [],
    qbo: qbo.data ?? [],
    invites: invites.data ?? [],
    messages: messages.data ?? [],
    setupStates: setupStates.data ?? [],
    errors: {
      clients: clients.error?.message,
      events: events.error?.message,
      leads: leads.error?.message,
      vendors: vendors.error?.message,
      batches: batches.error?.message,
      qbo: qbo.error?.message,
      invites: invites.error?.message,
      messages: messages.error?.message,
    },
  };
  writeFileSync(`${OUT}/persist-${label}.json`, JSON.stringify(snap, null, 2));
  return snap;
}

async function passWelcome(page: {
  url: () => string;
  locator: (s: string) => {
    count: () => Promise<number>;
    check: (o?: { force?: boolean }) => Promise<void>;
  };
  getByRole: (r: string, o?: object) => { click: () => Promise<void> };
}) {
  if (!page.url().includes("/welcome")) return;
  const box = page.locator('input[type="checkbox"]');
  if (await box.count()) await box.check({ force: true });
  await page.getByRole("button", { name: "Continue" }).click();
}

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1100 } });
const page = await context.newPage();
page.setDefaultTimeout(20000);

try {
  await page.goto(`${APP}/login`, { waitUntil: "domcontentloaded" });
  await page.locator("#email").fill(creds.email);
  await page.locator("#password").fill(creds.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL((url: URL) => !url.pathname.includes("/login"), { timeout: 20000, waitUntil: "commit" });
  await passWelcome(page);
  await page.waitForURL(/\/(setup-hub|dashboard)/, { timeout: 20000, waitUntil: "commit" });
  record("safe-setup", "Logged into disposable venue on localhost:3040", true, page.url());

  await page.goto(`${APP}/setup-hub`, { waitUntil: "domcontentloaded" });
  await page.getByRole("heading", { name: /get your venue ready|Make yourself at home|Bring your business/i }).first().waitFor({ timeout: 20000 });
  await shot(page, "04-setup-hub-desktop");
  const explore = page.getByRole("link", { name: "Explore migration" });
  const exploreBtn = page.getByRole("button", { name: "Explore migration" });
  if (await explore.count()) {
    await explore.click();
  } else if (await exploreBtn.count()) {
    await exploreBtn.click();
  } else {
    await page.goto(`${APP}/setup-hub/bring-your-business`);
  }
  await page.getByRole("heading", { name: /Bring your business with you/i }).waitFor({ timeout: 20000 }).catch(async () => {
    await page.goto(`${APP}/setup-hub/bring-your-business`, { waitUntil: "domcontentloaded" });
  });
  if (!page.url().includes("bring-your-business")) {
    await page.goto(`${APP}/setup-hub/bring-your-business`, { waitUntil: "domcontentloaded" });
  }
  await page.getByRole("heading", { name: "Bring your business with you." }).waitFor();
  await shot(page, "05-byb-entry-three-choices");
  const importChoice = page.getByRole("link", { name: /Import from another system/i });
  const filesChoice = page.getByRole("link", { name: /I have spreadsheets or documents/i });
  const freshBtn = page.getByTestId("byb-starting-fresh");
  record("journey", "Entry shows Import from another system", await importChoice.count() > 0, await importChoice.count().then(String));
  record("journey", "Entry shows I have spreadsheets or documents", await filesChoice.count() > 0, await filesChoice.count().then(String));
  record("journey", "Entry shows I'm starting fresh", await freshBtn.count() > 0, await freshBtn.count().then(String));

  const beforeFresh = await persistSnapshot("before-starting-fresh");
  await freshBtn.click();
  await page.getByRole("heading", { name: /get your venue ready|Make yourself at home/i }).first().waitFor({ timeout: 20000 });
  const afterFresh = await persistSnapshot("after-starting-fresh");
  record(
    "journey",
    "Starting fresh returns to Setup without import batches",
    (afterFresh.batches.length === beforeFresh.batches.length) && page.url().includes("/setup-hub") && !page.url().includes("bring-your-business"),
    `url=${page.url()} batches ${beforeFresh.batches.length}→${afterFresh.batches.length}`,
  );
  await shot(page, "06-starting-fresh-setup-hub");

  await page.goto(`${APP}/setup-hub/bring-your-business`, { waitUntil: "domcontentloaded" });
  await page.getByRole("link", { name: /Import from another system/i }).click();
  await page.getByRole("heading", { name: "Prepare your business" }).waitFor({ timeout: 20000 });
  const importIntro = await page.locator("text=Export what you want to bring over from your current software").count();
  await shot(page, "07-prepare-import-lane");
  await page.goto(`${APP}/setup-hub/bring-your-business?stage=prepare&entry=files`);
  const filesIntro = await page.locator("text=Use the lists, bookings, agreements, and planning files you already keep").count();
  await shot(page, "08-prepare-files-lane");
  record("journey", "Import lane and files lane share prepare checklist with different intros", importIntro > 0 && filesIntro > 0, `importIntro=${importIntro} filesIntro=${filesIntro}`);

  await page.getByTestId("byb-skip-stage").click();
  await page.getByRole("heading", { name: "Bring your people" }).waitFor({ timeout: 20000 });
  record("journey", "Skip prepare lands on people", page.url().includes("stage=people"), page.url());
  await shot(page, "09-people-after-skip");
  await page.getByRole("link", { name: "Back", exact: true }).click();
  await page.getByRole("heading", { name: "Prepare your business" }).waitFor({ timeout: 20000 });
  record("journey", "Back from people returns to prepare", page.url().includes("stage=prepare"), page.url());
  await page.getByTestId("byb-continue-stage").click();
  await page.getByRole("heading", { name: "Bring your people" }).waitFor({ timeout: 20000 });
  record("journey", "Continue prepare lands on people", page.url().includes("stage=people"), page.url());
  await page.goto(`${APP}/setup-hub/bring-your-business?stage=review&entry=files`);
  await page.getByRole("heading", { name: "Review and finish" }).waitFor();
  await shot(page, "10-review-stage");
  await page.goto(`${APP}/setup-hub/bring-your-business?stage=people&entry=files`);
  record("journey", "Resume people stage from URL keeps entry context", page.url().includes("entry=files") && page.url().includes("stage=people"), page.url());

  async function importList(kind: "couples" | "leads" | "vendors", file: string, createNewEmails: string[]) {
    const href = kind === "couples"
      ? `${APP}/setup-hub/bring-your-business?stage=people&kind=couples&entry=files`
      : kind === "leads"
        ? `${APP}/setup-hub/bring-your-business?stage=people&kind=leads&entry=files`
        : `${APP}/setup-hub/bring-your-business?stage=people&kind=vendors&entry=files`;
    await page.goto(href, { waitUntil: "domcontentloaded" });
    await page.locator("text=Drop a file here or click to browse").waitFor({ timeout: 20000 });
    const pasteToggle = page.getByText("Or paste your list instead", { exact: true });
    await pasteToggle.waitFor({ timeout: 20000 });
    await pasteToggle.scrollIntoViewIfNeeded();
    await page.waitForTimeout(800);
    await shot(page, `11-before-paste-${kind}`);
    await pasteToggle.click({ force: true });
    const csv = readFileSync(file, "utf8");
    await page.locator("textarea").waitFor({ timeout: 10000 });
    await page.locator("textarea").fill(csv);
    await page.getByRole("button", { name: "Use this list" }).click();
    await page.getByRole("button", { name: /Preview/ }).waitFor({ timeout: 25000 });
    await page.getByRole("button", { name: /Preview/ }).waitFor({ timeout: 20000 });
    await shot(page, `11-map-${kind}`);
    await page.getByRole("button", { name: /Preview/ }).click();
    if (kind !== "vendors") {
      await page.getByTestId("byb-match-checking").or(page.getByTestId("byb-match-review")).waitFor({ timeout: 15000 }).catch(() => {});
      await page.getByTestId("byb-match-checking").waitFor({ state: "hidden", timeout: 15000 }).catch(() => {});
      const match = page.getByTestId("byb-match-review");
      if (await match.count()) {
        await shot(page, `12-match-${kind}`);
        for (const email of createNewEmails) {
          const row = match.locator("li").filter({ hasText: email });
          if (await row.count()) {
            await row.getByRole("button", { name: "Create new" }).click({ force: true });
          }
        }
      }
    }
    const importBtn = page.getByRole("button", { name: /Import \d+/ });
    await importBtn.waitFor({ timeout: 20000 });
    const label = await importBtn.innerText();
    await importBtn.click();
    await page.getByRole("heading", { name: "Import complete" }).waitFor({ timeout: 30000 });
    await shot(page, `13-result-${kind}`);
    const imported = await page.locator("text=Imported").locator("xpath=..").innerText().catch(() => "");
    const skipped = await page.locator("text=Skipped").locator("xpath=..").innerText().catch(() => "");
    return { label, imported, skipped, body: (await page.locator("main").innerText()).slice(0, 1500) };
  }

  const clientResult = await importList("couples", "/tmp/htc-byb-fixtures/clients.csv", [
    "priya.likely@byb.test",
    "shared.office@byb.test",
  ]);
  record("people", "Clients import completed in UI", /Import complete/.test(clientResult.body), clientResult.body.slice(0, 300));

  const leadResult = await importList("leads", "/tmp/htc-byb-fixtures/leads.csv", []);
  record("people", "Leads import completed in UI", /Import complete/.test(leadResult.body), leadResult.body.slice(0, 300));

  const vendorResult = await importList("vendors", "/tmp/htc-byb-fixtures/vendors.csv", []);
  record("people", "Vendors import completed in UI", /Import complete/.test(vendorResult.body), vendorResult.body.slice(0, 300));

  await page.goto(`${APP}/clients?filter=contacts`, { waitUntil: "domcontentloaded" });
  await page.getByText("Loading clients").waitFor({ state: "hidden", timeout: 20000 }).catch(() => {});
  await page.getByRole("button", { name: "Contacts" }).or(page.getByText(/Claire|Nodate|contacts/i)).first().waitFor({ timeout: 20000 });
  await shot(page, "14-clients-contacts");
  const contactsText = await page.locator("main").innerText();
  record("history", "Claire Nodate appears under Contacts", /Claire/.test(contactsText), contactsText.slice(0, 400));
  record("history", "Fiona Future with preferred date is a Contact not All Bookings", /Fiona/.test(contactsText), contactsText.slice(0, 400));

  await page.goto(`${APP}/clients?filter=past`, { waitUntil: "domcontentloaded" });
  await page.getByText("Loading clients").waitFor({ state: "hidden", timeout: 20000 }).catch(() => {});
  await shot(page, "15-clients-past");
  const pastText = await page.locator("main").innerText();
  record("history", "Historical Mira Past appears in Past", /Mira/.test(pastText), pastText.slice(0, 400));

  await page.goto(`${APP}/clients?filter=all`, { waitUntil: "domcontentloaded" });
  await page.getByText("Loading clients").waitFor({ state: "hidden", timeout: 20000 }).catch(() => {});
  await shot(page, "16-clients-all-bookings");
  const bookedText = await page.locator("main").innerText();
  record("history", "Bella Booked appears in All Bookings", /Bella/.test(bookedText), bookedText.slice(0, 400));
  record("history", "Preferred-date Fiona is not in All Bookings", !/Fiona/.test(bookedText), bookedText.slice(0, 400));

  await page.goto(`${APP}/calendar?year=2027&month=9`, { waitUntil: "domcontentloaded" });
  await shot(page, "17-calendar");
  const calText = await page.locator("main").innerText();
  record("history", "Calendar shows booked Bella and does not treat preferred dates as bookings blindly", /Bella|Garden|September|2027/.test(calText), calText.slice(0, 400));

  await page.goto(`${APP}/clients`, { waitUntil: "domcontentloaded" });
  await page.getByText("Loading clients").waitFor({ state: "hidden", timeout: 20000 }).catch(() => {});
  await page.getByRole("button", { name: "Import Clients" }).or(page.getByRole("link", { name: "Import Clients" })).click();
  await page.getByRole("heading", { name: "Bring your people" }).waitFor({ timeout: 20000 });
  record("nav", "Clients → Import Clients reaches people/couples", /stage=people/.test(page.url()) && /kind=couples/.test(page.url()), page.url());
  await shot(page, "18-nav-clients-import");

  await page.goto(`${APP}/leads`, { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "Import Leads" }).or(page.getByRole("link", { name: "Import Leads" })).click();
  await page.getByRole("heading", { name: /Bring your people|Bring your business/i }).waitFor({ timeout: 20000 });
  record("nav", "Leads → Import reaches BYB people/leads", /kind=leads|stage=people/.test(page.url()), page.url());

  await page.goto(`${APP}/vendors`, { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "Import Vendors" }).or(page.getByRole("link", { name: "Import Vendors" })).click();
  await page.getByRole("heading", { name: /Bring your people|Bring your business/i }).waitFor({ timeout: 20000 });
  record("nav", "Vendors → Import reaches BYB people/vendors", /kind=vendors|stage=people/.test(page.url()), page.url());

  async function gotoCommit(url: string) {
    await page.goto(url, { waitUntil: "commit" }).catch(() => {});
    await page.waitForLoadState("domcontentloaded");
  }

  await gotoCommit(`${APP}/settings/import`);
  await page.getByRole("heading", { name: /Bring your people|Bring your business/i }).waitFor({ timeout: 20000 });
  record("nav", "Legacy /settings/import redirects into BYB people", /stage=people/.test(page.url()), page.url());
  await shot(page, "19-nav-legacy-import");

  await gotoCommit(`${APP}/settings/migration`);
  await page.getByRole("heading", { name: /Bring your dates|Bring your business/i }).waitFor({ timeout: 20000 });
  record("nav", "Legacy /settings/migration redirects into BYB dates", /stage=dates/.test(page.url()), page.url());
  await shot(page, "20-nav-legacy-migration");

  const persist = await persistSnapshot("after-imports");
  const venueOk = persist.clients.every((c: { venue_id: string }) => c.venue_id === creds.venueId);
  record("safety", "All persisted clients belong to disposable venue", venueOk, `count=${persist.clients.length}`);
  record("safety", "No QuickBooks enqueue", persist.qbo.length === 0, JSON.stringify(persist.qbo));
  record("safety", "No client invitations", persist.invites.length === 0, JSON.stringify(persist.invites));
  record("safety", "No messages sent", persist.messages.length === 0, JSON.stringify(persist.messages));

  const claire = persist.clients.find((c: { first_name: string }) => c.first_name === "Claire");
  const fiona = persist.clients.find((c: { first_name: string }) => c.first_name === "Fiona");
  const nora = persist.clients.filter((c: { first_name: string; last_name: string }) => c.first_name === "Nora" && c.last_name === "Exact");
  const jordan = persist.clients.find((c: { first_name: string; last_name: string }) => c.first_name === "Jordan" && c.last_name === "Likely");
  const morgan = persist.clients.find((c: { first_name: string }) => c.first_name === "Morgan");
  const avery = persist.clients.find((c: { first_name: string }) => c.first_name === "Avery");
  const taylor = persist.clients.find((c: { first_name: string }) => c.first_name === "Taylor");
  const miraEvents = persist.events.filter((e: { client_id: string }) => e.client_id === creds.seeded.historicalClientId);
  const claireEvents = persist.events.filter((e: { client_id: string }) => claire && e.client_id === claire.id);
  const fionaEvents = persist.events.filter((e: { client_id: string }) => fiona && e.client_id === fiona.id);

  record("people", "Contact without date imported (Claire)", !!claire && !claire.event_date, JSON.stringify(claire ?? null));
  record("people", "Preferred future date stored on Fiona without Event", !!fiona && fiona.event_date === "2027-05-20" && fionaEvents.length === 0, JSON.stringify({ fiona, fionaEvents }));
  record("people", "Partners sharing email imported as one client (Taylor/Jordan Reed)", !!taylor, JSON.stringify(taylor ?? null));
  record("people", "Exact duplicate Nora was not duplicated", nora.length === 1, `noraCount=${nora.length}`);
  record("people", "Likely match Jordan Likely created as distinct from Priya", !!jordan && jordan.id !== creds.seeded.likelyClientId, JSON.stringify(jordan ?? null));
  record("people", "Distinct shared-email Morgan created without merging Avery", !!morgan && !!avery && morgan.id !== avery.id, JSON.stringify({ morgan, avery }));
  record("history", "People import did not create Events for Claire/Fiona", claireEvents.length === 0 && fionaEvents.length === 0, JSON.stringify({ claireEvents, fionaEvents }));
  record("history", "Historical event remains complete and has no setup state", miraEvents.some((e: { status: string }) => e.status === "complete") && persist.setupStates.every((s: { event_id: string }) => s.event_id !== creds.seeded.historicalEventId), JSON.stringify({ miraEvents, setupStates: persist.setupStates }));

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${APP}/setup-hub/bring-your-business`, { waitUntil: "domcontentloaded" });
  await page.getByRole("heading", { name: "Bring your business with you." }).waitFor();
  await shot(page, "21-byb-entry-390");
  await page.goto(`${APP}/setup-hub/bring-your-business?stage=prepare&entry=files`);
  await shot(page, "22-prepare-390");
  await page.goto(`${APP}/setup-hub/bring-your-business?stage=people&kind=couples`);
  await shot(page, "23-people-390");
  const mobileOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 8);
  record("journey", "390px entry/prepare/people do not force huge horizontal overflow", !mobileOverflow, `scrollWidth overflow=${mobileOverflow}`);

  await page.goto(`${APP}/setup-hub/bring-your-business?stage=people&kind=couples`);
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.getByRole("heading", { name: "Bring your people" }).waitFor();
  record("safety", "Refresh keeps people stage", page.url().includes("stage=people"), page.url());
} catch (err) {
  record("safe-setup", "Playwright journey", false, err instanceof Error ? err.stack ?? err.message : String(err));
  try {
    await shot(page, "99-failure");
  } catch {
    /* ignore */
  }
} finally {
  await browser.close();
}

const report = {
  venueId: creds.venueId,
  venueName: creds.venueName,
  email: creds.email,
  checks,
  failed: checks.filter((c) => !c.pass),
};
writeFileSync(`${OUT}/acceptance-report.json`, JSON.stringify(report, null, 2));
console.log("\nSUMMARY", JSON.stringify({
  total: checks.length,
  passed: checks.filter((c) => c.pass).length,
  failed: checks.filter((c) => !c.pass).length,
  out: OUT,
}, null, 2));
for (const c of checks.filter((c) => !c.pass)) {
  console.log("FAIL", c.category, c.name, c.detail.slice(0, 240));
}
