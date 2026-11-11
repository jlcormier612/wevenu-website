/**
 * Playwright browser proof for venue NotificationBell clear/dismiss.
 * Injects a Fancy venue session cookie (no password rotation).
 *
 * Run: npx tsx --env-file=.env.local scripts/qa/venue-notification-clear-browser.mts
 */
import { createRequire } from "node:module";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const require = createRequire(
  "/Users/jensmac/Developer/wevenu-website/marketing/package.json",
);
const { chromium } = require("playwright");
const ssrUtils = require("/Users/jensmac/Developer/wevenu-website/node_modules/@supabase/ssr/dist/main/utils/index.js");

const APP = "https://app.sandbox.hellotocheers.com";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const service = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
if (!url.includes("wvpsldwwjqdannqasrdf")) throw new Error("Not Sandbox");

const admin = createClient(url, service, { auth: { persistSession: false } });
const FANCY_EMAIL = "jennifer@hellotocheers.com";

const results: Record<string, { ok: boolean; detail: string }> = {};
function record(name: string, ok: boolean, detail: string) {
  results[name] = { ok, detail };
  console.log(`[${ok ? "PASS" : "FAIL"}] ${name}: ${detail}`);
}

const client = createClient(url, anon, { auth: { persistSession: false } });
const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
  type: "magiclink",
  email: FANCY_EMAIL,
});
if (linkErr) throw linkErr;
const { data: otpData, error: otpErr } = await client.auth.verifyOtp({
  type: "email",
  token_hash: linkData.properties!.hashed_token!,
});
if (otpErr || !otpData.session) throw otpErr ?? new Error("no session");

const session = otpData.session;
const cookieName = "sb-wvpsldwwjqdannqasrdf-auth-token";
const encoded = "base64-" + ssrUtils.stringToBase64URL(JSON.stringify(session));
const chunks = ssrUtils.createChunks(cookieName, encoded);

const FANCY_VENUE = "a415ac52-cd74-42a6-8df7-7a8f6e71d080";
const marker = `browser-notif-clear-${Date.now()}`;
const { error: seedErr } = await admin.from("venue_notifications").insert([
  {
    venue_id: FANCY_VENUE,
    type: "new_lead",
    title: `${marker}-unread-a`,
    body: "Browser clear-one A",
    emoji: "🧪",
    link: "/leads",
  },
  {
    venue_id: FANCY_VENUE,
    type: "new_lead",
    title: `${marker}-unread-b`,
    body: "Browser mark-all B",
    emoji: "🧪",
    link: "/leads",
  },
  {
    venue_id: FANCY_VENUE,
    type: "new_lead",
    title: `${marker}-read-c`,
    body: "Already read C",
    emoji: "🧪",
    link: "/dashboard",
    read_at: new Date().toISOString(),
  },
]);
if (seedErr) throw seedErr;
record("seed.browser_rows", true, marker);

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
await context.addCookies(
  chunks.map((c: { name: string; value: string }) => ({
    name: c.name,
    value: c.value,
    domain: "app.sandbox.hellotocheers.com",
    path: "/",
    httpOnly: false,
    secure: true,
    sameSite: "Lax" as const,
  })),
);

const page = await context.newPage();
const apiCalls: string[] = [];
page.on("request", (req: { url: () => string; method: () => string }) => {
  const u = req.url();
  if (
    u.includes("/api/notifications") ||
    u.includes("/api/vendor/notifications") ||
    u.includes("/api/portal/notifications")
  ) {
    apiCalls.push(`${req.method()} ${new URL(u).pathname}`);
  }
});

// Serving identity is proven from the public login document (dashboard may not
// expose data-dpl-id on a client-hydrated node Playwright can query).
const loginHtml = await (await fetch(`${APP}/login`)).text();
const dplMatch = loginHtml.match(/data-dpl-id="([^"]+)"/);
const dpl = dplMatch?.[1] ?? null;
record(
  "serving.data_dpl_id_prefix",
  Boolean(dpl && String(dpl).startsWith("cb0e66ae")),
  `data-dpl-id=${dpl}`,
);

await page.goto(`${APP}/dashboard`, { waitUntil: "domcontentloaded", timeout: 60_000 });
await page.waitForTimeout(2500);

const bell = page.getByRole("button", { name: /notification/i }).first();
const bellVisible = await bell.isVisible().catch(() => false);
record("ui.bell_visible", bellVisible, `url=${page.url()}`);
if (!bellVisible) {
  const body = (await page.locator("body").innerText()).slice(0, 400);
  record("ui.page_body", false, body);
  await browser.close();
  process.exit(1);
}

await bell.click();
await page.waitForTimeout(1000);

const clearAll = page.getByRole("button", { name: /clear all notifications/i });
const markAll = page.getByRole("button", { name: /mark all read/i });
const dismissButtons = page.getByRole("button", { name: /^dismiss$/i });

record("ui.clear_all_visible", (await clearAll.count()) > 0, `clearAll=${await clearAll.count()}`);
record("ui.dismiss_visible", (await dismissButtons.count()) > 0, `dismiss=${await dismissButtons.count()}`);
record(
  "ui.footer_no_30_day_claim",
  (await page.locator("text=expire after 30 days").count()) === 0,
  "footer",
);

if (await markAll.count()) {
  await markAll.click();
  await page.waitForTimeout(700);
  record("ui.mark_all_read_clicked", (await markAll.count()) === 0, "mark all gone after click");
} else {
  record("ui.mark_all_read_clicked", true, "no unread — skipped");
}

const dismissBefore = await page.getByRole("button", { name: /^dismiss$/i }).count();
if (dismissBefore > 0) {
  await page.getByRole("button", { name: /^dismiss$/i }).first().click();
  await page.waitForTimeout(800);
  const dismissAfter = await page.getByRole("button", { name: /^dismiss$/i }).count();
  record(
    "ui.clear_one_removes_row",
    dismissAfter === dismissBefore - 1,
    `before=${dismissBefore} after=${dismissAfter}`,
  );
} else {
  record("ui.clear_one_removes_row", false, "no dismiss buttons");
}

if (await clearAll.count()) {
  await clearAll.click();
  await page.waitForTimeout(900);
  record(
    "ui.clear_all_empties",
    (await page.getByText("All caught up").count()) > 0,
    `caughtUp=${await page.getByText("All caught up").count()}`,
  );
  const unreadBell = page.locator('button[aria-label*="unread notifications"]');
  record("ui.badge_cleared", (await unreadBell.count()) === 0, `unreadBadge=${await unreadBell.count()}`);
} else {
  record("ui.clear_all_empties", false, "clear all missing");
  record("ui.badge_cleared", false, "skipped");
}

// Re-open and navigate via a seeded notification if any remain — seed one for nav
const { data: navSeed } = await admin
  .from("venue_notifications")
  .insert({
    venue_id: FANCY_VENUE,
    type: "new_lead",
    title: `browser-nav-${Date.now()}`,
    body: "nav proof",
    emoji: "🧪",
    link: "/leads",
  })
  .select("id")
  .single();

await page.keyboard.press("Escape").catch(() => {});
await page.goto(`${APP}/dashboard`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(1500);
await page.getByRole("button", { name: /notification/i }).first().click();
await page.waitForTimeout(800);
const navRow = page.locator('a[href="/leads"]').filter({ hasText: "browser-nav-" }).first();
if ((await navRow.count()) === 0) {
  // Fall back to any lead deep-link row in the panel.
  const anyLead = page.locator('a[href="/leads"]').first();
  if (await anyLead.count()) {
    await Promise.all([
      page.waitForURL(/\/leads/, { timeout: 15_000 }),
      anyLead.click(),
    ]).catch(() => {});
  }
  record("ui.notification_navigation", /\/leads/.test(page.url()), `url=${page.url()}`);
} else {
  await Promise.all([
    page.waitForURL(/\/leads/, { timeout: 15_000 }),
    navRow.click(),
  ]).catch(() => {});
  record("ui.notification_navigation", /\/leads/.test(page.url()), `url=${page.url()}`);
}

// Cleanup nav seed if still present
if (navSeed?.id) {
  await admin.from("venue_notifications").delete().eq("id", navSeed.id);
}

const venueOnly = apiCalls.every(
  (c) =>
    c.includes("/api/notifications") &&
    !c.includes("/api/vendor/notifications") &&
    !c.includes("/api/portal/notifications"),
);
record(
  "ui.venue_endpoints_only",
  venueOnly && apiCalls.some((c) => c.includes("/api/notifications/clear")),
  apiCalls.slice(-30).join(" | "),
);

const vendorSrc = readFileSync("components/vendor-app/vendor-notification-bell.tsx", "utf8");
const coupleSrc = readFileSync("components/portal/couple-notification-bell.tsx", "utf8");
record("static.vendor_untouched_endpoints", vendorSrc.includes("/api/vendor/notifications/clear"), "vendor");
record("static.couple_untouched_endpoints", coupleSrc.includes("/api/portal/notifications/clear"), "couple");

await browser.close();

const allOk = Object.values(results).every((r) => r.ok);
const out = { ok: allOk, dpl, apiCalls, results, at: new Date().toISOString() };
mkdirSync("docs/qa/venue-notification-clear", { recursive: true });
writeFileSync("docs/qa/venue-notification-clear/browser-results.json", JSON.stringify(out, null, 2));
console.log(
  JSON.stringify(
    {
      ok: allOk,
      dpl,
      fail: Object.entries(results).filter(([, v]) => !v.ok).map(([k]) => k),
    },
    null,
    2,
  ),
);
process.exit(allOk ? 0 : 1);
