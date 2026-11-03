/**
 * Step 2 local browser acceptance — Phases 1–9 release candidate only.
 * Targets the isolated worktree server. No DB writes. No Production.
 */
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

const WT = "/Users/jensmac/Developer/htc-visual-p1-9-release";
config({ path: `${WT}/.env.local`, quiet: true });
const require = createRequire(`${WT}/marketing/package.json`);
const { chromium } = require("playwright");
const ssr = require(`${WT}/node_modules/@supabase/ssr/dist/main/utils/index.js`);

const OUT = `${WT}/docs/qa/staff-light-canvas/sandbox-release-phases1-9/step2-candidate`;
const EVID = join(OUT, "evidence");
mkdirSync(EVID, { recursive: true });

const APP = process.env.HTC_CAPTURE_BASE ?? "http://127.0.0.1:3019";
const FANCY = "a415ac52-cd74-42a6-8df7-7a8f6e71d080";
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
  const m = rgb.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
  if (!m) return null;
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

type Shot = {
  label: string;
  path: string;
  selectors?: string[];
  expectAbsent?: string[];
};

const routes: Shot[] = [
  { label: "library", path: "/library", selectors: [".htc-library-guidance-calm"] },
  { label: "messaging-inbox", path: "/messaging", selectors: [".htc-inbox-no-selection"] },
  {
    label: "messaging-health",
    path: "/messaging/health",
    selectors: [".htc-communication-health-guidance"],
  },
  {
    label: "automations",
    path: "/communication/series",
    selectors: ["section.htc-automations-help"],
  },
  {
    label: "setup-hub",
    path: "/setup-hub",
    selectors: [".htc-setup-hub-welcome", ".htc-setup-stage-section-label"],
  },
  { label: "settings", path: "/settings", selectors: [".htc-settings-directory-icon"] },
  {
    label: "settings-availability",
    path: "/settings/availability",
    selectors: [".htc-availability-settings-guidance"],
  },
  {
    label: "settings-migration",
    path: "/settings/migration",
    selectors: [".htc-migration-guidance"],
  },
  {
    label: "settings-import",
    path: "/settings/import",
    selectors: [".htc-import-cutover-pointer"],
  },
  { label: "guide", path: "/guide", selectors: [".htc-venue-guide-orientation"] },
  {
    label: "contracts-templates",
    path: "/contracts/templates/new",
    selectors: [".htc-contract-template-disclaimer"],
  },
  {
    label: "contracts",
    path: "/contracts",
    selectors: [".htc-hospitality-intro", ".htc-hospitality-toolbar", ".htc-hospitality-table"],
    expectAbsent: [".htc-hospitality-intro-accent", ".htc-hospitality-filter"],
  },
  {
    label: "payments",
    path: "/payments",
    selectors: [".htc-hospitality-intro", ".htc-hospitality-toolbar", ".htc-hospitality-table"],
    expectAbsent: [".htc-hospitality-intro-accent", ".htc-hospitality-filter"],
  },
  {
    label: "reporting-absence",
    path: "/reporting",
    expectAbsent: [
      ".htc-hospitality-intro-accent",
      ".htc-hospitality-filter",
      "[data-htc-phase10]",
    ],
  },
  {
    label: "documents-absence",
    path: "/documents",
    expectAbsent: [
      ".htc-hospitality-intro-accent",
      ".htc-hospitality-section-label",
      "[data-htc-phase10]",
    ],
  },
  {
    label: "library-documents-absence",
    path: "/library/documents",
    expectAbsent: [".htc-hospitality-intro-accent", "[data-htc-phase10]"],
  },
];

async function shot(route: Shot, vp: { width: number; height: number; tag: string }) {
  const ctx = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
  });
  await ctx.addCookies(cookies);
  await ctx.addInitScript(`window.localStorage.setItem("theme","light")`);
  const page = await ctx.newPage();
  const res = await page.goto(`${APP}${route.path}`, {
    waitUntil: "domcontentloaded",
    timeout: 90000,
  });
  await page.waitForTimeout(1800);

  // String evaluate avoids tsx/playwright `__name` ReferenceError.
  const probe = await page.evaluate(`(() => {
    const selectors = ${JSON.stringify(route.selectors || [])};
    const expectAbsent = ${JSON.stringify(route.expectAbsent || [])};
    const pick = (sel) => {
      const el = document.querySelector(sel);
      if (!el) return null;
      const cs = getComputedStyle(el);
      return {
        sel,
        bg: cs.backgroundColor,
        color: cs.color,
        borderLeft: cs.borderLeftColor,
        text: (el.textContent || "").replace(/\\s+/g, " ").trim().slice(0, 100),
      };
    };
    return {
      h1: document.querySelector("h1")?.textContent?.trim() || null,
      url: location.pathname + location.search,
      overflowX: document.documentElement.scrollWidth > window.innerWidth + 2,
      present: selectors.map(pick),
      absent: expectAbsent.map((sel) => ({
        sel,
        count: document.querySelectorAll(sel).length,
      })),
      phase10Markers: document.querySelectorAll(
        ".htc-hospitality-intro-accent, .htc-hospitality-filter, .htc-hospitality-section-label, [data-htc-phase10]",
      ).length,
    };
  })()`);

  const file = join(EVID, `${route.label}-${vp.tag}.png`);
  await page.screenshot({ path: file, fullPage: false });
  results.push({
    label: route.label,
    viewport: vp.tag,
    status: res?.status() ?? null,
    file,
    ...probe,
    presentHex: (probe.present as Array<{ bg: string } | null>).map((p) =>
      p ? { ...p, bgHex: rgbToHex(p.bg), colorHex: rgbToHex((p as { color: string }).color) } : null,
    ),
  });
  await ctx.close();
  console.log(JSON.stringify(results[results.length - 1]));
}

try {
  for (const route of routes) {
    await shot(route, { width: 1440, height: 900, tag: "desktop" });
    await shot(route, { width: 390, height: 844, tag: "mobile" });
  }
} finally {
  await browser.close();
}

writeFileSync(join(OUT, "browser-results.json"), JSON.stringify(results, null, 2));
console.log(`Wrote ${results.length} shots to ${OUT}/browser-results.json`);
