/**
 * Phase 12 final acceptance — after refinements (local).
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
const LEAD = "20e470d8-ab91-4db1-bbae-d75dad943b69";
const OUT =
  "/Users/jensmac/Developer/wevenu-website/docs/qa/staff-light-canvas/phase12-surface-balance/final-acceptance";
const EVID = join(OUT, "after");
const DESK = "/Users/jensmac/Desktop/htc-phase12-final/after";
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

function rgbToHex(rgb: string | null | undefined): string | null {
  if (!rgb) return null;
  const m = rgb.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?/i);
  if (!m) return null;
  if (m[4] !== undefined && Number(m[4]) === 0) return "transparent";
  return "#" + [m[1], m[2], m[3]].map((n) => Number(n).toString(16).padStart(2, "0")).join("").toUpperCase();
}

const VP = {
  desktop: { width: 1440, height: 1100 },
  "mobile-390": { width: 390, height: 844 },
  "mobile-375": { width: 375, height: 812 },
} as const;

type Shot = {
  id: string;
  path: string;
  vps: (keyof typeof VP)[];
  probes?: string[];
  evaluate?: string;
};

const shots: Shot[] = [
  { id: "tasks-header", path: "/tasks", vps: ["mobile-375", "mobile-390", "desktop"], probes: ['[data-testid="task-center-intro"]', '[data-testid="task-center-intro-counts"]'] },
  { id: "tasks-overdue", path: "/tasks", vps: ["desktop", "mobile-390"], probes: [".htc-task-overdue-banner", ".htc-task-overdue-ink", ".htc-task-overdue-count"] },
  { id: "lead-hold", path: `/leads/${LEAD}`, vps: ["mobile-375", "mobile-390", "desktop"], probes: ['[data-testid="lead-owner-hold-row"]', '[data-testid="date-hold-compact-band"]', '[data-testid="date-hold-place"]'] },
  { id: "automations-list", path: "/communication/series", vps: ["desktop", "mobile-390"], probes: [".htc-hospitality-intro", "section.htc-automations-help", ".htc-group-shell", ".htc-badge-active"] },
  { id: "automations-new", path: "/communication/series/new", vps: ["desktop", "mobile-390"], probes: [".htc-hospitality-intro", "section.htc-automations-help"] },
  { id: "dashboard", path: "/dashboard", vps: ["desktop", "mobile-390"], probes: [".htc-surface-working", "main"] },
  { id: "lead-detail", path: `/leads/${LEAD}`, vps: ["desktop", "mobile-390"] },
  { id: "booking-detail", path: `/clients/${BOOKED}`, vps: ["desktop", "mobile-390"] },
  { id: "vendors", path: "/vendors", vps: ["desktop", "mobile-390"] },
  { id: "contracts", path: "/contracts", vps: ["desktop", "mobile-390"] },
  { id: "payments", path: "/payments", vps: ["desktop", "mobile-390"] },
  { id: "reporting", path: "/reporting", vps: ["desktop", "mobile-390"] },
  { id: "templates", path: "/library", vps: ["desktop", "mobile-390"] },
  { id: "settings", path: "/settings", vps: ["desktop", "mobile-390"] },
  { id: "setup-hub", path: "/setup-hub", vps: ["desktop", "mobile-390"] },
];

const browser = await chromium.launch({ headless: true });
const results: unknown[] = [];

for (const shot of shots) {
  for (const label of shot.vps) {
    const vp = VP[label];
    const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
    await ctx.addCookies(cookies);
    await ctx.addInitScript(`window.localStorage.setItem("theme","light")`);
    const page = await ctx.newPage();
    await page.goto(`${APP}${shot.path}?cb=${Date.now()}`, { waitUntil: "domcontentloaded", timeout: 120000 });
    await page.waitForTimeout(2600);

    const probe = await page.evaluate(`((sels) => {
      const pick = (sel) => {
        const el = document.querySelector(sel);
        if (!el) return null;
        const cs = getComputedStyle(el);
        const r = el.getBoundingClientRect();
        return { sel, bg: cs.backgroundColor, color: cs.color, top: Math.round(r.top), left: Math.round(r.left), width: Math.round(r.width), height: Math.round(r.height), bottom: Math.round(r.bottom), right: Math.round(r.right) };
      };
      const intro = pick('[data-testid="task-center-intro"]');
      const counts = pick('[data-testid="task-center-intro-counts"]');
      const holdBand = pick('[data-testid="date-hold-compact-band"]');
      const place = pick('[data-testid="date-hold-place"]');
      const status = pick('[data-testid="date-hold-protection-headline"], [data-testid="date-hold-active"]');
      let overlap = false;
      if (place && status) {
        overlap = !(place.right <= status.left || place.left >= status.right || place.bottom <= status.top || place.top >= status.bottom);
      }
      return {
        overflowX: document.documentElement.scrollWidth > window.innerWidth + 1,
        surfaces: (sels || []).map(pick),
        introCountsStacked: intro && counts ? counts.top >= intro.top + 40 : null,
        holdOverlap: overlap,
        holdPlaceFullWidth: place ? place.width >= window.innerWidth * 0.7 : null,
      };
    })(${JSON.stringify(shot.probes || [])})`);

    const file = join(EVID, `${shot.id}-${label}.png`);
    await page.screenshot({ path: file, fullPage: false });
    if (existsSync(file)) copyFileSync(file, join(DESK, `${shot.id}-${label}.png`));

    const surfaces = ((probe as { surfaces: Array<{ bg: string; color: string } | null> }).surfaces || []).map((s) =>
      s ? { ...s, bg: rgbToHex(s.bg), color: rgbToHex(s.color) } : null,
    );

    results.push({
      id: shot.id,
      viewport: label,
      file,
      overflowX: (probe as { overflowX: boolean }).overflowX,
      introCountsStacked: (probe as { introCountsStacked: boolean | null }).introCountsStacked,
      holdOverlap: (probe as { holdOverlap: boolean }).holdOverlap,
      holdPlaceFullWidth: (probe as { holdPlaceFullWidth: boolean | null }).holdPlaceFullWidth,
      surfaces,
    });
    await ctx.close();
  }
}

writeFileSync(join(OUT, "after-results.json"), JSON.stringify(results, null, 2));
copyFileSync(join(OUT, "after-results.json"), join(DESK, "after-results.json"));
await browser.close();

const fails = (results as Array<{ id: string; viewport: string; overflowX: boolean; holdOverlap?: boolean }>).filter(
  (r) => r.overflowX || (r.id === "lead-hold" && r.viewport.startsWith("mobile") && r.holdOverlap),
);
console.log(JSON.stringify({ ok: fails.length === 0, shots: results.length, fails }, null, 2));
if (fails.length) process.exit(1);
