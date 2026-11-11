/**
 * Phase 12 AFTER evidence from local (implementation under review).
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
  "/Users/jensmac/Developer/wevenu-website/docs/qa/staff-light-canvas/phase12-surface-balance";
const EVID = join(OUT, "evidence-after");
const DESK = "/Users/jensmac/Desktop/htc-phase12-after";
mkdirSync(EVID, { recursive: true });
mkdirSync(DESK, { recursive: true });

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

const routes = [
  {
    id: "dashboard",
    path: "/dashboard",
    probes: ['[class*="htc-surface-working"]', "main"],
  },
  {
    id: "automations",
    path: "/communication/series",
    probes: [
      ".htc-hospitality-intro",
      "section.htc-automations-help",
      ".htc-group-shell",
      ".htc-badge-active",
    ],
  },
  { id: "tours", path: "/tours", probes: [".htc-tours-workspace", "main"] },
  { id: "requests", path: "/requests", probes: [".htc-hospitality-intro", "main"] },
  { id: "tasks", path: "/tasks", probes: [".htc-hospitality-intro", "main"] },
  { id: "setup-hub", path: "/setup-hub", probes: [".htc-setup-hub-welcome", "main"] },
  { id: "settings", path: "/settings", probes: [".htc-settings-directory-icon", "main"] },
  { id: "library", path: "/library", probes: ["main"] },
  { id: "inventory", path: "/library/inventory", probes: ["main"] },
  {
    id: "lead-detail",
    path: `/leads/${LEAD}`,
    probes: [
      '[data-testid="lead-sales-availability"]',
      '[data-testid="lead-space-preferences"]',
      '[data-testid="lead-contact-card"]',
    ],
  },
  {
    id: "booking-detail",
    path: `/clients/${BOOKED}`,
    probes: [
      '[data-testid="event-booking-summary"]',
      '[data-testid="event-staff-assignment"]',
      '[data-testid="client-staffing-column"]',
    ],
  },
  { id: "reporting", path: "/reporting", probes: ["main"] },
  { id: "contracts", path: "/contracts", probes: [".htc-hospitality-intro", "main"] },
  { id: "payments", path: "/payments", probes: [".htc-hospitality-intro", "main"] },
  { id: "vendors", path: "/vendors", probes: ["main"] },
];

const viewports = [
  { width: 1440, height: 1100, label: "desktop" },
  { width: 390, height: 844, label: "mobile-390" },
  { width: 375, height: 812, label: "mobile-375" },
];

const browser = await chromium.launch({ headless: true });
const results: unknown[] = [];

for (const route of routes) {
  for (const vp of viewports) {
    // Capture mobile-375 only for key changed surfaces to keep evidence focused
    if (vp.label === "mobile-375" && !["dashboard", "automations", "lead-detail", "booking-detail", "requests", "tasks"].includes(route.id)) {
      continue;
    }
    const ctx = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
    });
    await ctx.addCookies(cookies);
    await ctx.addInitScript(`window.localStorage.setItem("theme","light")`);
    const page = await ctx.newPage();
    await page.goto(`${APP}${route.path}?cb=${Date.now()}`, {
      waitUntil: "domcontentloaded",
      timeout: 120000,
    });
    await page.waitForTimeout(2600);

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
          text: (el.textContent || "").replace(/\\s+/g, " ").trim().slice(0, 100),
        };
      };
      return {
        overflowX: document.documentElement.scrollWidth > window.innerWidth + 1,
        surfaces: sels.map(pick),
        title: document.title,
      };
    })(${JSON.stringify(route.probes)})`);

    const file = join(EVID, `${route.id}-${vp.label}.png`);
    await page.screenshot({ path: file, fullPage: false });
    if (existsSync(file)) copyFileSync(file, join(DESK, `${route.id}-${vp.label}.png`));

    const surfaces = ((probe as { surfaces: Array<{ bg: string; height: number; sel: string } | null> })
      .surfaces || []).map((s) =>
      s ? { sel: s.sel, bg: rgbToHex(s.bg), height: s.height } : null,
    );

    results.push({
      id: route.id,
      viewport: vp.label,
      file,
      overflowX: (probe as { overflowX: boolean }).overflowX,
      surfaces,
    });
    await ctx.close();
  }
}

writeFileSync(join(OUT, "after-results.json"), JSON.stringify(results, null, 2));
copyFileSync(join(OUT, "after-results.json"), join(DESK, "after-results.json"));
await browser.close();
console.log(JSON.stringify({ ok: true, shots: results.length, evid: EVID }, null, 2));
