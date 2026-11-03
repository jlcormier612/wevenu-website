/**
 * Phase 11D final refinements evidence — natural-height summary + space prefs.
 * Live local only. No DB writes.
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

const OUT =
  "/Users/jensmac/Developer/wevenu-website/docs/qa/staff-light-canvas/phase11d-color-distribution";
const EVID = join(OUT, "evidence-refinements");
const DESK = "/Users/jensmac/Desktop/htc-phase11d-refinements";
mkdirSync(EVID, { recursive: true });
mkdirSync(DESK, { recursive: true });

const APP = process.env.HTC_CAPTURE_BASE ?? "http://127.0.0.1:3000";
const FANCY = "a415ac52-cd74-42a6-8df7-7a8f6e71d080";
const BOOKED = "49aba826-0bd3-4891-ac9f-02a18b2b6962";
const MULTI = "dc2441e7-59e4-4d95-a6c1-b8ff648d92e1";
const CANCELLED = "7810ae0e-3694-473e-890a-2319f034e617";
const LEAD_WITH_PREFS = "20e470d8-ab91-4db1-bbae-d75dad943b69";
const LEAD_HIDDEN_PREFS = "6cf4f9a0-66b8-4e6f-8afa-b5d2e7327b2d";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
if (!url.includes("wvpsldwwjqdannqasrdf")) throw new Error("not sandbox");

const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false },
});
const anon = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
  auth: { persistSession: false },
});
const { data: link } = await admin.auth.admin.generateLink({
  type: "magiclink",
  email: "jennifer@hellotocheers.com",
});
const { data: otp } = await anon.auth.verifyOtp({
  type: "email",
  token_hash: link!.properties!.hashed_token!,
});
const base = {
  domain: new URL(APP).hostname,
  path: "/",
  httpOnly: false,
  secure: APP.startsWith("https"),
  sameSite: "Lax" as const,
};
const cookies = [
  ...ssr
    .createChunks(
      "sb-wvpsldwwjqdannqasrdf-auth-token",
      "base64-" + ssr.stringToBase64URL(JSON.stringify(otp!.session)),
    )
    .map((c: { name: string; value: string }) => ({ ...base, ...c })),
  { ...base, name: "htc_active_venue_id", value: FANCY },
];

function publish(file: string) {
  const name = file.split("/").pop()!;
  if (existsSync(file)) copyFileSync(file, join(DESK, name));
}

function rgbToHex(rgb: string | null | undefined): string | null {
  if (!rgb) return null;
  const m = rgb.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?/i);
  if (!m) return null;
  if (m[4] !== undefined && Number(m[4]) === 0) return "transparent";
  return (
    "#" +
    [m[1], m[2], m[3]]
      .map((n) => Number(n).toString(16).padStart(2, "0"))
      .join("")
      .toUpperCase()
  );
}

const browser = await chromium.launch();
const results: Record<string, unknown>[] = [];

async function shot(opts: {
  label: string;
  path: string;
  vp: { width: number; height: number; label: string };
  probeSelectors: string[];
}) {
  const ctx = await browser.newContext({
    viewport: { width: opts.vp.width, height: opts.vp.height },
  });
  await ctx.addCookies(cookies);
  await ctx.addInitScript(`window.localStorage.setItem("theme","light")`);
  const page = await ctx.newPage();
  await page.goto(`${APP}${opts.path}?cb=${Date.now()}`, {
    waitUntil: "domcontentloaded",
    timeout: 90000,
  });
  await page.waitForTimeout(2200);

  const probe = await page.evaluate(`((sels) => {
    const pick = (sel) => {
      const el = document.querySelector(sel);
      if (!el) return null;
      const cs = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      return {
        sel,
        bg: cs.backgroundColor,
        height: Math.round(r.height),
        top: Math.round(r.top),
      };
    };
    const summary = pick('[data-testid="event-booking-summary"]');
    const region = pick('[data-testid="client-booking-staff-region"]');
    const staffCol = pick('[data-testid="client-staffing-column"]');
    return {
      overflowX: document.documentElement.scrollWidth > window.innerWidth + 1,
      surfaces: sels.map(pick),
      summary,
      region,
      staffCol,
      stretchRatio:
        summary && staffCol && staffCol.height > 0
          ? Number((summary.height / staffCol.height).toFixed(3))
          : null,
    };
  })(${JSON.stringify(opts.probeSelectors)})`);

  const file = join(EVID, `${opts.label}-${opts.vp.label}.png`);
  await page.screenshot({ path: file, fullPage: false });
  publish(file);

  const p = probe as {
    overflowX: boolean;
    surfaces: Array<{ sel: string; bg: string; height: number } | null>;
    summary?: { height: number } | null;
    staffCol?: { height: number } | null;
    stretchRatio: number | null;
  };

  results.push({
    label: opts.label,
    viewport: opts.vp.label,
    path: opts.path,
    file,
    overflowX: p.overflowX,
    stretchRatio: p.stretchRatio,
    summaryHeight: p.summary?.height ?? null,
    staffColHeight: p.staffCol?.height ?? null,
    surfaces: (p.surfaces || []).map((s) =>
      s ? { sel: s.sel, bg: rgbToHex(s.bg), height: s.height } : null,
    ),
  });
  await ctx.close();
}

const viewports = [
  { width: 1440, height: 1100, label: "desktop" },
  { width: 390, height: 844, label: "mobile-390" },
  { width: 375, height: 812, label: "mobile-375" },
];

for (const vp of viewports) {
  await shot({
    label: "booking-normal",
    path: `/clients/${BOOKED}`,
    vp,
    probeSelectors: [
      '[data-testid="event-booking-summary"]',
      '[data-testid="event-staff-assignment"]',
      '[data-testid="client-staffing-column"]',
    ],
  });
  await shot({
    label: "booking-multi-schedule",
    path: `/clients/${MULTI}`,
    vp,
    probeSelectors: [
      '[data-testid="event-booking-summary"]',
      '[data-testid="event-booking-component-schedule"]',
      '[data-testid="client-staffing-column"]',
    ],
  });
  await shot({
    label: "booking-cancelled",
    path: `/clients/${CANCELLED}`,
    vp,
    probeSelectors: [
      '[data-testid="event-booking-summary"]',
      '[data-testid="client-staffing-column"]',
    ],
  });
  await shot({
    label: "lead-space-prefs-visible",
    path: `/leads/${LEAD_WITH_PREFS}`,
    vp,
    probeSelectors: [
      '[data-testid="lead-space-preferences"]',
      '[data-testid="lead-sales-availability"]',
      '[data-testid="lead-contact-card"]',
    ],
  });
  await shot({
    label: "lead-space-prefs-hidden",
    path: `/leads/${LEAD_HIDDEN_PREFS}`,
    vp,
    probeSelectors: [
      '[data-testid="lead-space-preferences"]',
      '[data-testid="lead-sales-availability"]',
    ],
  });
}

writeFileSync(join(OUT, "refinement-results.json"), JSON.stringify(results, null, 2));
copyFileSync(join(OUT, "refinement-results.json"), join(DESK, "refinement-results.json"));
await browser.close();
console.log(JSON.stringify({ ok: true, shots: results.length, evid: EVID }, null, 2));
