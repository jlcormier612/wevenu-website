/**
 * Phase B.1 trust & usability — isolated Chromium acceptance.
 * Does not deploy, merge, or touch other worktrees.
 */
import { createRequire } from "node:module";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

config({ path: ".env.local", quiet: true });

const require = createRequire("/Users/jensmac/Developer/wevenu-website/marketing/package.json");
const { chromium } = require("playwright");

const APP = "http://localhost:3040";
const OUT = `${process.env.HOME}/Desktop/HTC-Phase-B1-Trust-Usability`;
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
};
if (creds.venueId === FANCY || creds.venueId === WILLOW) {
  throw new Error("Refusing protected venue");
}

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false },
});

type Check = { category: string; name: string; pass: boolean; detail: string };
const checks: Check[] = [];
function rec(category: string, name: string, pass: boolean, detail: string) {
  checks.push({ category, name, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"} [${category}] ${name} — ${detail.slice(0, 280)}`);
}

async function shot(page: { screenshot: (o: object) => Promise<Buffer> }, name: string) {
  writeFileSync(`${OUT}/${name}.png`, await page.screenshot({ fullPage: true }));
}

async function gotoCommit(page: { goto: Function; waitForLoadState: Function }, url: string) {
  await page.goto(url, { waitUntil: "commit" }).catch(() => {});
  await page.waitForLoadState("domcontentloaded");
}

async function pasteList(page: {
  getByTestId: Function;
  waitForFunction: Function;
}, text: string) {
  const btn = page.getByTestId("byb-use-paste");
  await btn.waitFor();
  await page.waitForFunction(() => {
    const form = document.querySelector('[data-testid="byb-paste-entry"]');
    const el = document.querySelector('[data-testid="byb-use-paste"]') as HTMLButtonElement | null;
    return form?.getAttribute("data-hydrated") === "true" && !!el && !el.disabled;
  });
  const box = page.getByTestId("byb-paste-textarea");
  await box.click();
  await box.fill(text);
  const value = await box.inputValue();
  if (!value.includes(text.slice(0, 24))) {
    await box.evaluate((el: HTMLTextAreaElement, next: string) => {
      el.focus();
      const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value")?.set;
      setter?.call(el, next);
      el.dispatchEvent(new InputEvent("input", { bubbles: true, cancelable: true, inputType: "insertFromPaste", data: next }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
    }, text);
  }
  await btn.click();
}

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1100 } });
const page = await context.newPage();
page.setDefaultTimeout(25000);

try {
  await gotoCommit(page, `${APP}/login`);
  await page.locator("#email").fill(creds.email);
  await page.locator("#password").fill(creds.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL((url: URL) => !url.pathname.includes("/login"), { timeout: 20000, waitUntil: "commit" });

  await gotoCommit(page, `${APP}/setup-hub`);
  await page.getByText("Bring your business over").waitFor();
  await shot(page, "01-hub-after-existing-imports");
  const hub1 = await page.locator("main").innerText();
  rec("hub", "Hub does not say Nothing to bring over after people imports", !/Nothing to bring over/.test(hub1), hub1.slice(hub1.indexOf("Bring your business over"), hub1.indexOf("Bring your business over") + 400));
  rec("hub", "Hub CTA is Continue bringing your business over", /Continue bringing your business over/.test(hub1), hub1.slice(hub1.indexOf("03"), hub1.indexOf("03") + 350));

  await gotoCommit(page, `${APP}/setup-hub/bring-your-business`);
  await page.getByRole("heading", { name: "Bring your business with you." }).waitFor();
  await shot(page, "02-entry-after-imports");
  const entry = await page.locator("main").innerText();
  rec("fresh", "After imports, starting fresh is not presented as if nothing happened", /Continue setup without importing more/.test(entry), entry.slice(0, 500));
  rec("fresh", "Starting-fresh heading is not duplicated as the button", (entry.match(/I'm starting fresh/g) ?? []).length === 0, entry.slice(0, 400));

  await page.getByTestId("byb-starting-fresh").click();
  await page.waitForURL((url: URL) => url.pathname === "/setup-hub", { timeout: 20000, waitUntil: "commit" }).catch(async () => {
    await gotoCommit(page, `${APP}/setup-hub`);
  });
  await page.getByText("Bring your business over").waitFor({ timeout: 20000 });
  await shot(page, "03-hub-after-continue-without-more");
  const hub2 = await page.locator("main").innerText();
  rec("hub", "Starting fresh after imports still shows imported activity on Hub", /Continue bringing your business over/.test(hub2) && !/Nothing to bring over/.test(hub2), hub2.slice(hub2.indexOf("Bring your business over"), hub2.indexOf("Bring your business over") + 400));

  await page.reload({ waitUntil: "commit" }).catch(() => {});
  await page.waitForLoadState("domcontentloaded");
  await page.getByText("Bring your business over").waitFor();
  await shot(page, "04-hub-after-refresh");
  const hub3 = await page.locator("main").innerText();
  rec("hub", "Refresh keeps imported Hub status", /Continue bringing your business over/.test(hub3) && !/Nothing to bring over/.test(hub3), hub3.slice(hub3.indexOf("03"), hub3.indexOf("03") + 350));

  await gotoCommit(page, `${APP}/setup-hub/bring-your-business?stage=people&kind=couples`);
  await page.getByRole("heading", { name: "Bring your people" }).waitFor();
  await shot(page, "05-people-upload-first-desktop");
  rec("mobile-prep", "Paste entry is visible without a toggle", await page.getByTestId("byb-paste-entry").count() > 0, "paste entry");
  rec("nav", "Stage rail uses compact labels", /1\. Prepare/.test(await page.locator('[data-testid="byb-stage-rail"]').innerText()), await page.locator('[data-testid="byb-stage-rail"]').innerText());

  const ragged = `Partner 1 First Name,Partner 1 Last Name,Email,Event Date (YYYY-MM-DD)
B1,Ragged,b1.ragged@byb.test,
B1,Review,b1.review@byb.test,2027-10-01,`;
  await pasteList(page, ragged);
  await page.getByRole("heading", { name: "Map your columns" }).waitFor();
  await shot(page, "06-mapping-ragged-csv");
  const mapText = await page.locator("main").innerText();
  rec("mapping", "Ragged spreadsheet did not dump every column to Skip", await page.getByTestId("byb-mapping-needs-review").count() === 0 && /Partner 1 First Name/.test(mapText), mapText.slice(0, 400));
  rec("mapping", "Required fields mapped from ragged CSV headers", await page.getByRole("button", { name: "Preview" }).isEnabled(), "preview enabled");

  await page.getByRole("button", { name: "Preview" }).click();
  await page.getByTestId("byb-match-review").waitFor({ timeout: 20000 });
  await page.getByTestId("byb-match-review").scrollIntoViewIfNeeded();
  await shot(page, "07-unified-match-review");
  const matchText = await page.getByTestId("byb-match-review").innerText();
  rec("match", "Unified review shows incoming and existing columns", /incoming/i.test(matchText) && /already in hello to cheers/i.test(matchText), matchText.slice(0, 500));
  const confirmLabel = await page.getByTestId("byb-import-confirm").innerText();
  rec("counts", "Confirm label does not say Import N Clients for mixed rows", !/Import \d+ Clients/.test(confirmLabel) && /Create/.test(confirmLabel) && /use 1 existing/.test(confirmLabel), confirmLabel);
  rec("match", "Import stays gated until matches are ready", await page.getByTestId("byb-import-confirm").isEnabled(), "confirm enabled after matches loaded");
  rec("match", "Exact name+email defaults to Use existing, email is not enough alone", /use existing/i.test(matchText) && /exact match/i.test(matchText), matchText.slice(0, 400));

  await page.getByTestId("byb-import-confirm").click();
  await page.getByRole("heading", { name: "Import complete" }).waitFor({ timeout: 25000 });
  await page.getByRole("heading", { name: "Import complete" }).scrollIntoViewIfNeeded();
  await shot(page, "08-import-complete-specific-reasons");
  const result = await page.locator("main").innerText();
  rec("counts", "Result does not say already active", !/already active/i.test(result) && !/already-active/i.test(result), result.slice(0, 500));

  await gotoCommit(page, `${APP}/setup-hub/bring-your-business?stage=people&kind=couples`);
  await page.getByRole("heading", { name: "Bring your people" }).waitFor();
  await page.getByTestId("byb-people-secondary").scrollIntoViewIfNeeded();
  await shot(page, "12-import-history-after-b1");
  const history = await page.locator('[data-testid="byb-people-secondary"]').innerText();
  rec("history", "Import history remains visible and distinct from live totals", /Import history/.test(history) && /In Hello to Cheers now/.test(history), history.slice(0, 500));

  const unmapped = `Old System Name,Contact Email,Wedding Notes
Someone Important,someone@byb.test,Loved the garden`;
  await pasteList(page, unmapped);
  await page.getByRole("heading", { name: "Map your columns" }).waitFor();
  await shot(page, "11-mapping-needs-review");
  rec("mapping", "Unrecognized headers require mapping review before continue", await page.getByTestId("byb-mapping-needs-review").count() > 0 && !(await page.getByRole("button", { name: "Preview" }).isEnabled()), "preview disabled until required columns are chosen");

  await page.setViewportSize({ width: 390, height: 844 });
  await gotoCommit(page, `${APP}/setup-hub/bring-your-business`);
  await page.getByRole("heading", { name: "Bring your business with you." }).waitFor();
  await shot(page, "09-entry-390");
  await page.getByTestId("byb-starting-fresh").scrollIntoViewIfNeeded();
  await shot(page, "09b-entry-390-continue-without-more");
  await gotoCommit(page, `${APP}/setup-hub/bring-your-business?stage=people&kind=couples`);
  await page.getByRole("heading", { name: "Bring your people" }).waitFor();
  await shot(page, "10-people-upload-390");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 8);
  rec("mobile", "390px people stage has no large horizontal overflow", !overflow, `overflow=${overflow}`);
  rec("mobile", "Upload/paste is above import history on people", (await page.getByTestId("byb-paste-entry").boundingBox())!.y < (await page.getByTestId("byb-people-secondary").boundingBox())!.y, "paste above health");
  rec("mobile", "Paste list is visible alongside upload at 390px", await page.getByTestId("byb-paste-entry").isVisible(), "paste visible");

  await gotoCommit(page, `${APP}/setup-hub/bring-your-business?stage=review`);
  await page.getByTestId("byb-readiness").waitFor();
  await shot(page, "13-readiness-review");
  const ready = await page.getByTestId("byb-readiness").innerText();
  rec("history", "Readiness review shows imported history not only live totals", /Imported:/.test(ready) && /Needs attention:/.test(ready), ready.slice(0, 400));

  const persist = await admin.from("clients").select("id, first_name, last_name, email, event_date, status, venue_id").eq("venue_id", creds.venueId);
  const events = await admin.from("events").select("id, status, event_date").eq("venue_id", creds.venueId);
  const qbo = await admin.from("quickbooks_sync_queue").select("id").eq("venue_id", creds.venueId);
  const invites = await admin.from("client_invitations").select("id").eq("venue_id", creds.venueId);
  const stripe = await admin.from("stripe_webhook_events").select("id").eq("venue_id", creds.venueId);
  const messages = await admin.from("messages").select("id").eq("venue_id", creds.venueId);
  const batches = await admin.from("import_batches").select("imported_count, skipped_count, error_count, entity_type, rolled_back_at, migration_session_id").eq("venue_id", creds.venueId);
  const clients = persist.data ?? [];
  rec("safety", "All clients still belong to disposable venue", clients.every((c) => c.venue_id === creds.venueId), `n=${clients.length}`);
  rec("safety", "People import still created no extra booked events", (events.data ?? []).length === 2, JSON.stringify(events.data));
  rec("safety", "No QBO / invites / stripe / messages", (qbo.data ?? []).length === 0 && (invites.data ?? []).length === 0 && (stripe.data ?? []).length === 0 && (messages.data ?? []).length === 0, "");
  rec("safety", "B1 Ragged imported as a contact not a booking", clients.some((c) => c.first_name === "B1" && c.last_name === "Ragged" && c.status !== "confirmed"), JSON.stringify(clients.filter((c) => c.first_name === "B1")));
  rec("safety", "Use existing did not duplicate B1 Ragged", clients.filter((c) => c.email === "b1.ragged@byb.test").length === 1, String(clients.filter((c) => c.email === "b1.ragged@byb.test").length));
  rec("safety", "B1 Even preferred date stays on the person", clients.some((c) => c.first_name === "B1" && c.last_name === "Even" && String(c.event_date ?? "").startsWith("2027-08-01")) && !(events.data ?? []).some((e) => String(e.event_date ?? "").startsWith("2027-08-01")), JSON.stringify({ even: clients.filter((c) => c.last_name === "Even"), events: events.data }));
  rec("safety", "B1 Review created as a contact, not a booking", clients.some((c) => c.first_name === "B1" && c.last_name === "Review" && c.status !== "confirmed") && !(events.data ?? []).some((e) => String(e.event_date ?? "").startsWith("2027-10-01")), JSON.stringify(clients.filter((c) => c.last_name === "Review")));
  writeFileSync(`${OUT}/persist.json`, JSON.stringify({ clients, events: events.data, batches: batches.data, qbo: qbo.data, invites: invites.data }, null, 2));
} catch (err) {
  rec("run", "Playwright journey", false, err instanceof Error ? err.stack ?? err.message : String(err));
  try { await shot(page, "99-failure"); } catch { /* ignore */ }
} finally {
  await browser.close();
}

writeFileSync(`${OUT}/acceptance-report.json`, JSON.stringify({ checks, failed: checks.filter((c) => !c.pass) }, null, 2));
console.log("SUMMARY", JSON.stringify({
  total: checks.length,
  passed: checks.filter((c) => c.pass).length,
  failed: checks.filter((c) => !c.pass).length,
  out: OUT,
}, null, 2));
for (const c of checks.filter((c) => !c.pass)) {
  console.log("FAIL", c.category, c.name, c.detail.slice(0, 240));
}
