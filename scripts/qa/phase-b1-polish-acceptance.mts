/**
 * Phase B.1 polish — singular labels, live totals, review groups, mobile rail cue.
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

  await gotoCommit(page, `${APP}/setup-hub/bring-your-business?stage=people&kind=couples`);
  await page.getByRole("heading", { name: "Bring your people" }).waitFor();
  const liveBefore = Number(await page.getByTestId("byb-live-clients").getAttribute("data-count"));
  rec("totals", "Live client count is present before import", Number.isFinite(liveBefore) && liveBefore > 0, `before=${liveBefore}`);

  const polish = `Partner 1 First Name,Partner 1 Last Name,Email
B1,Rail,b1.rail@byb.test`;
  await pasteList(page, polish);
  await page.getByRole("heading", { name: "Map your columns" }).waitFor();
  await page.getByRole("button", { name: "Preview" }).click();
  await page.getByTestId("byb-match-review").waitFor({ timeout: 20000 });
  const confirmLabel = await page.getByTestId("byb-import-confirm").innerText();
  rec("plural", "Singular confirm label for one new client", confirmLabel === "Create 1 new client", confirmLabel);
  await shot(page, "14-confirm-one-new-client");

  await page.getByTestId("byb-import-confirm").click();
  await page.getByRole("heading", { name: "Import complete" }).waitFor({ timeout: 25000 });
  await page.waitForFunction((expected) => {
    const el = document.querySelector('[data-testid="byb-live-clients"]');
    return Number(el?.getAttribute("data-count")) === expected;
  }, liveBefore + 1, { timeout: 15000 });
  const liveAfter = Number(await page.getByTestId("byb-live-clients").getAttribute("data-count"));
  rec("totals", "Live totals refresh without navigation", liveAfter === liveBefore + 1, `before=${liveBefore} after=${liveAfter}`);
  await page.getByTestId("byb-live-totals").scrollIntoViewIfNeeded();
  await shot(page, "15-live-totals-after-import");

  const persist = await admin.from("clients").select("id, first_name, last_name, email, event_date, status, venue_id").eq("venue_id", creds.venueId);
  const events = await admin.from("events").select("id, status, event_date").eq("venue_id", creds.venueId);
  const qbo = await admin.from("quickbooks_sync_queue").select("id").eq("venue_id", creds.venueId);
  const invites = await admin.from("client_invitations").select("id").eq("venue_id", creds.venueId);
  const stripe = await admin.from("stripe_webhook_events").select("id").eq("venue_id", creds.venueId);
  const messages = await admin.from("messages").select("id").eq("venue_id", creds.venueId);
  const clients = persist.data ?? [];
  rec("totals", "Live count matches persisted clients", liveAfter === clients.length, `ui=${liveAfter} db=${clients.length}`);
  rec("safety", "B1 Rail persisted as a contact", clients.some((c) => c.email === "b1.rail@byb.test" && c.status !== "confirmed"), JSON.stringify(clients.filter((c) => c.last_name === "Rail")));
  rec("safety", "No extra events / QBO / invites / stripe / messages",
    (events.data ?? []).length === 2
    && (qbo.data ?? []).length === 0
    && (invites.data ?? []).length === 0
    && (stripe.data ?? []).length === 0
    && (messages.data ?? []).length === 0,
    JSON.stringify({ events: events.data, qbo: qbo.data, invites: invites.data }));

  await gotoCommit(page, `${APP}/setup-hub/bring-your-business?stage=review`);
  await page.getByTestId("byb-readiness").waitFor();
  await shot(page, "16-review-grouped");
  const brought = await page.getByTestId("byb-review-brought-over").innerText();
  const skipped = await page.getByTestId("byb-review-skipped").innerText();
  const attention = await page.getByTestId("byb-review-attention").innerText();
  rec("review", "Brought over is distinct from skipped stages", /Brought over/.test(brought) && /People/.test(brought) && !/Business readiness/.test(brought), brought.slice(0, 400));
  rec("review", "Intentionally skipped categories are not labeled as failures", /Skipped for now/.test(skipped) && /Dates and bookings/.test(skipped) && !/failure/i.test(skipped), skipped.slice(0, 400));
  rec("review", "Review does not claim the business is fully ready", /does not mean your bookings/.test(attention), attention.slice(0, 400));

  await page.setViewportSize({ width: 390, height: 844 });
  await gotoCommit(page, `${APP}/setup-hub/bring-your-business?stage=people&kind=couples`);
  await page.getByRole("heading", { name: "Bring your people" }).waitFor();
  await shot(page, "17-stage-rail-390");
  await page.waitForFunction(() => {
    const rail = document.querySelector('[data-testid="byb-stage-rail"]');
    return rail?.getAttribute("data-overflow") === "true" || !!document.querySelector('[data-testid="byb-stage-rail-more"]');
  }, { timeout: 5000 });
  rec("rail", "Mobile rail shows a more-stages cue", await page.getByTestId("byb-stage-rail-more").count() > 0 || (await page.getByTestId("byb-stage-rail").getAttribute("data-overflow")) === "true", "cue present");
  rec("rail", "Current People step remains marked", /2\. People/.test(await page.locator('[data-testid="byb-stage-rail"]').innerText()), await page.locator('[data-testid="byb-stage-rail"]').innerText());
  rec("mobile", "390px still has no page overflow", !(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 8)), "");

  await gotoCommit(page, `${APP}/setup-hub/bring-your-business?stage=review`);
  await page.getByTestId("byb-readiness").waitFor();
  await shot(page, "18-review-390");
} catch (err) {
  rec("run", "Playwright polish journey", false, err instanceof Error ? err.stack ?? err.message : String(err));
  try { await shot(page, "99-polish-failure"); } catch { /* ignore */ }
} finally {
  await browser.close();
}

writeFileSync(`${OUT}/polish-acceptance.json`, JSON.stringify({ checks, failed: checks.filter((c) => !c.pass) }, null, 2));
console.log("SUMMARY", JSON.stringify({
  total: checks.length,
  passed: checks.filter((c) => c.pass).length,
  failed: checks.filter((c) => c.pass === false).length,
  out: OUT,
}, null, 2));
for (const c of checks.filter((c) => !c.pass)) {
  console.log("FAIL", c.category, c.name, c.detail.slice(0, 240));
}
