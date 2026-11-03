/**
 * Booking detail mobile action acceptance — local, non-destructive.
 */
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync, copyFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

config({ path: "/Users/jensmac/Developer/wevenu-website/.env.local", quiet: true });
const require = createRequire("/Users/jensmac/Developer/wevenu-website/marketing/package.json");
const { chromium } = require("playwright");
const ssr = require("/Users/jensmac/Developer/wevenu-website/node_modules/@supabase/ssr/dist/main/utils/index.js");

const APP = process.env.HTC_CAPTURE_BASE ?? "http://127.0.0.1:3000";
const FANCY = "a415ac52-cd74-42a6-8df7-7a8f6e71d080";
const BOOKED = "49aba826-0bd3-4891-ac9f-02a18b2b6962";
const CANCELLED = "7810ae0e-3694-473e-890a-2319f034e617";
const OUT =
  "/Users/jensmac/Developer/wevenu-website/docs/qa/staff-light-canvas/phase12-surface-balance/final-acceptance";
const EVID = join(OUT, "booking-actions");
const DESK = "/Users/jensmac/Desktop/htc-phase12-final/booking-actions";
mkdirSync(EVID, { recursive: true });
mkdirSync(DESK, { recursive: true });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
if (!url.includes("wvpsldwwjqdannqasrdf")) throw new Error("not sandbox");
const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const anon = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } });
const { data: link } = await admin.auth.admin.generateLink({ type: "magiclink", email: "jennifer@hellotocheers.com" });
const { data: otp } = await anon.auth.verifyOtp({ type: "email", token_hash: link!.properties!.hashed_token! });
const base = { domain: new URL(APP).hostname, path: "/", httpOnly: false, secure: APP.startsWith("https"), sameSite: "Lax" as const };
const cookies = [
  ...ssr.createChunks("sb-wvpsldwwjqdannqasrdf-auth-token", "base64-" + ssr.stringToBase64URL(JSON.stringify(otp!.session))).map((c: { name: string; value: string }) => ({ ...base, ...c })),
  { ...base, name: "htc_active_venue_id", value: FANCY },
];

const VP = [
  { width: 375, height: 812, label: "mobile-375" },
  { width: 390, height: 844, label: "mobile-390" },
  { width: 430, height: 932, label: "mobile-430" },
  { width: 1440, height: 1100, label: "desktop" },
];

const browser = await chromium.launch({ headless: true });
const results: unknown[] = [];

async function capture(id: string, path: string, openMore: boolean) {
  for (const vp of VP) {
    const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
    await ctx.addCookies(cookies);
    await ctx.addInitScript(`window.localStorage.setItem("theme","light")`);
    const page = await ctx.newPage();
    await page.goto(`${APP}${path}?cb=${Date.now()}`, { waitUntil: "domcontentloaded", timeout: 120000 });
    await page.waitForTimeout(2600);

    const probe = await page.evaluate(`(() => {
      const actions = document.querySelector('[data-testid="event-header-actions"]');
      const edit = document.querySelector('[data-testid="event-action-edit"]');
      const day = document.querySelector('[data-testid="event-action-day-sheet"]');
      const more = document.querySelector('[data-testid="event-action-more"]');
      const cancelDesktop = document.querySelector('[data-testid="event-action-cancel"]');
      const box = (el) => {
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return { top: Math.round(r.top), left: Math.round(r.left), right: Math.round(r.right), bottom: Math.round(r.bottom), width: Math.round(r.width), height: Math.round(r.height), text: (el.textContent||"").replace(/\\s+/g," ").trim() };
      };
      const vw = window.innerWidth;
      const dayBox = box(day);
      const editBox = box(edit);
      const clipped = (b) => !b ? null : b.right > vw + 1 || b.left < -1;
      return {
        overflowX: document.documentElement.scrollWidth > vw + 1,
        actions: box(actions),
        edit: editBox,
        daySheet: dayBox,
        more: box(more),
        cancelDesktop: box(cancelDesktop),
        dayClipped: clipped(dayBox),
        editClipped: clipped(editBox),
        dayFullyVisible: dayBox ? dayBox.right <= vw + 1 && /Day-of Sheet/i.test(dayBox.text) : false,
      };
    })()`);

    const closedFile = join(EVID, `${id}-${vp.label}.png`);
    await page.screenshot({ path: closedFile, fullPage: false });
    if (existsSync(closedFile)) copyFileSync(closedFile, join(DESK, `${id}-${vp.label}.png`));
    results.push({ id, viewport: vp.label, file: closedFile, ...probe, menuItems: null });

    if (openMore && vp.width < 640) {
      const more = page.locator('[data-testid="event-action-more"]');
      if (await more.count()) {
        await more.click();
        await page.waitForTimeout(500);
        const menuItems = await page.evaluate(`(() => {
          return [...document.querySelectorAll('[data-slot="dropdown-menu-item"]')].map(el => (el.textContent||"").trim());
        })()`);
        const openFile = join(EVID, `${id}-${vp.label}-more-open.png`);
        await page.screenshot({ path: openFile, fullPage: false });
        if (existsSync(openFile)) copyFileSync(openFile, join(DESK, `${id}-${vp.label}-more-open.png`));
        results.push({ id, viewport: `${vp.label}-more-open`, file: openFile, ...probe, menuItems });
      }
    }

    await ctx.close();
  }
}

await capture("booking-booked", `/clients/${BOOKED}`, true);
await capture("booking-cancelled", `/clients/${CANCELLED}`, true);

writeFileSync(join(OUT, "booking-actions-results.json"), JSON.stringify(results, null, 2));
copyFileSync(join(OUT, "booking-actions-results.json"), join(DESK, "booking-actions-results.json"));
await browser.close();

const fails = (results as Array<{ overflowX: boolean; dayClipped: boolean | null; dayFullyVisible: boolean; viewport: string }>).filter(
  (r) => r.overflowX || r.dayClipped || (!String(r.viewport).includes("more-open") && !r.dayFullyVisible),
);
console.log(JSON.stringify({ ok: fails.length === 0, shots: results.length, fails }, null, 2));
if (fails.length) process.exit(1);
