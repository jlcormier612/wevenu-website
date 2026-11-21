/**
 * Step 0 — NAV speed baseline for ALL primary sidebar labels.
 * Local-first: APP_URL defaults to http://127.0.0.1:3000
 * Measurement only. No product mutations.
 */
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

config({ path: ".env.local", quiet: true });

const require = createRequire(
  join(process.cwd(), "marketing/package.json"),
);
const { chromium } = require("playwright");
const ssrUtils = require(
  join(process.cwd(), "node_modules/@supabase/ssr/dist/main/utils/index.js"),
);

const APP = process.env.APP_URL ?? "http://127.0.0.1:3000";
const EMAIL = "jennifer@hellotocheers.com";
const FANCY = "a415ac52-cd74-42a6-8df7-7a8f6e71d080";
const WARM_CYCLES = Number(process.env.WARM_CYCLES ?? "3");
const OUT = join(process.env.HOME!, "Desktop/HTC-NAV-SPEED-LOCAL");

/** Primary sidebar labels (owner-visible), in nav order. */
const SIDEBAR: { title: string; pathPrefix: string }[] = [
  { title: "Dashboard", pathPrefix: "/dashboard" },
  { title: "Leads", pathPrefix: "/leads" },
  { title: "Clients", pathPrefix: "/clients" },
  { title: "Vendors", pathPrefix: "/vendors" },
  { title: "Calendar", pathPrefix: "/calendar" },
  { title: "Tours", pathPrefix: "/tours" },
  { title: "Inbox", pathPrefix: "/messaging" },
  { title: "Automations", pathPrefix: "/communication/series" },
  { title: "Templates", pathPrefix: "/library" },
  { title: "Documents", pathPrefix: "/library/documents" },
  { title: "Contracts", pathPrefix: "/contracts" },
  { title: "Payments", pathPrefix: "/payments" },
  { title: "Task Center", pathPrefix: "/tasks" },
  { title: "Requests", pathPrefix: "/requests" },
  { title: "Setup", pathPrefix: "/setup-hub" },
  { title: "Settings", pathPrefix: "/settings" },
  { title: "Guidance", pathPrefix: "/help" },
  { title: "Venue Guide", pathPrefix: "/guide" },
  { title: "Reports", pathPrefix: "/reporting" },
  { title: "Help & Feedback", pathPrefix: "/feedback" },
];

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
if (!url.includes("wvpsldwwjqdannqasrdf")) {
  throw new Error("refusing non-sandbox supabase");
}

const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false },
});
const anon = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
  auth: { persistSession: false },
});

async function cookiesFor(email: string) {
  const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
  });
  if (linkErr) throw linkErr;
  const { data: otpData, error: otpErr } = await anon.auth.verifyOtp({
    type: "email",
    token_hash: linkData.properties!.hashed_token!,
  });
  if (otpErr || !otpData.session) throw otpErr ?? new Error("no session");
  const cookieName = "sb-wvpsldwwjqdannqasrdf-auth-token";
  const encoded =
    "base64-" + ssrUtils.stringToBase64URL(JSON.stringify(otpData.session));
  const domain = new URL(APP).hostname;
  return [
    ...ssrUtils.createChunks(cookieName, encoded).map(
      (c: { name: string; value: string }) => ({
        name: c.name,
        value: c.value,
        domain,
        path: "/",
        httpOnly: false,
        secure: APP.startsWith("https"),
        sameSite: "Lax" as const,
      }),
    ),
    {
      name: "htc_active_venue_id",
      value: FANCY,
      domain,
      path: "/",
      httpOnly: false,
      secure: APP.startsWith("https"),
      sameSite: "Lax" as const,
    },
  ];
}

function pathMatches(pathname: string, prefix: string): boolean {
  if (prefix === "/library") {
    // Templates owns /library but not /library/documents
    return (
      pathname === "/library" ||
      (pathname.startsWith("/library/") && !pathname.startsWith("/library/documents"))
    );
  }
  return pathname === prefix || pathname.startsWith(`${prefix}/`) || pathname.startsWith(`${prefix}?`);
}

type HopResult = {
  cycle: number;
  from: string;
  title: string;
  pathPrefix: string;
  clickToPathMs: number | null;
  clickToUsefulMs: number | null;
  overlayPresentMs: number;
  blankUncoveredMs: number;
  finalPath: string;
  finalTextLen: number;
  error?: string;
};

async function measureHop(
  page: import("playwright").Page,
  cycle: number,
  item: { title: string; pathPrefix: string },
): Promise<HopResult> {
  const from = new URL(page.url()).pathname;
  const link = page
    .locator("nav a, aside a")
    .filter({ hasText: new RegExp(`^\\s*${item.title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*$`, "i") })
    .first();

  try {
    await link.waitFor({ state: "visible", timeout: 20000 });
  } catch (e: any) {
    return {
      cycle,
      from,
      title: item.title,
      pathPrefix: item.pathPrefix,
      clickToPathMs: null,
      clickToUsefulMs: null,
      overlayPresentMs: 0,
      blankUncoveredMs: 0,
      finalPath: from,
      finalTextLen: 0,
      error: `link not visible: ${e?.message ?? e}`,
    };
  }

  // Already on this destination — skip (would no-op begin)
  if (pathMatches(from, item.pathPrefix)) {
    return {
      cycle,
      from,
      title: item.title,
      pathPrefix: item.pathPrefix,
      clickToPathMs: 0,
      clickToUsefulMs: 0,
      overlayPresentMs: 0,
      blankUncoveredMs: 0,
      finalPath: from,
      finalTextLen: await page.evaluate(
        () => (document.querySelector("[data-workspace-main]")?.textContent || "").replace(/\s+/g, " ").trim().length,
      ),
      error: "skipped_already_on_route",
    };
  }

  let clickToPathMs: number | null = null;
  let clickToUsefulMs: number | null = null;
  let overlayPresentMs = 0;
  let blankUncoveredMs = 0;
  const t0 = Date.now();
  await link.click({ timeout: 10000 });

  const deadline = t0 + 20000;
  while (Date.now() < deadline) {
    const snap = await page.evaluate(() => {
      const pathname = location.pathname;
      const overlay = document.querySelector('[data-testid="navigation-pending-main"]');
      const pageSlot = document.querySelector(
        "[data-workspace-main] > div:not([data-testid='navigation-pending-main'])",
      );
      const slotText = (pageSlot?.textContent || "").replace(/\s+/g, " ").trim();
      const overlayText = (overlay?.textContent || "").replace(/\s+/g, " ").trim();
      return {
        pathname,
        overlay: !!overlay,
        slotTextLen: slotText.length,
        overlayTextLen: overlayText.length,
        isSnapshot: overlay?.getAttribute("data-nav-snapshot") === "true",
      };
    });
    const ms = Date.now() - t0;
    if (snap.overlay) overlayPresentMs += 50;
    const covered =
      snap.overlay && (snap.isSnapshot ? snap.overlayTextLen >= 48 : true);
    if (snap.slotTextLen < 40 && !covered) blankUncoveredMs += 50;

    if (clickToPathMs == null && pathMatches(snap.pathname, item.pathPrefix)) {
      clickToPathMs = ms;
    }
    if (
      clickToUsefulMs == null &&
      pathMatches(snap.pathname, item.pathPrefix) &&
      snap.slotTextLen >= 80 &&
      !snap.overlay
    ) {
      clickToUsefulMs = ms;
      break;
    }
    await page.waitForTimeout(50);
  }

  const finalPath = new URL(page.url()).pathname;
  const finalTextLen = await page.evaluate(
    () => (document.querySelector("[data-workspace-main]")?.textContent || "").replace(/\s+/g, " ").trim().length,
  );

  return {
    cycle,
    from,
    title: item.title,
    pathPrefix: item.pathPrefix,
    clickToPathMs,
    clickToUsefulMs,
    overlayPresentMs,
    blankUncoveredMs,
    finalPath,
    finalTextLen,
    error:
      clickToUsefulMs == null
        ? `timeout path=${finalPath} text=${finalTextLen}`
        : undefined,
  };
}

function summarize(hops: HopResult[]) {
  const byTitle: Record<
    string,
    { n: number; usefulMs: number[]; pathMs: number[]; blankMs: number[]; errors: number }
  > = {};
  for (const h of hops) {
    if (h.error === "skipped_already_on_route") continue;
    const b = (byTitle[h.title] ??= {
      n: 0,
      usefulMs: [],
      pathMs: [],
      blankMs: [],
      errors: 0,
    });
    b.n += 1;
    if (h.error) b.errors += 1;
    if (h.clickToUsefulMs != null) b.usefulMs.push(h.clickToUsefulMs);
    if (h.clickToPathMs != null) b.pathMs.push(h.clickToPathMs);
    b.blankMs.push(h.blankUncoveredMs);
  }
  const median = (xs: number[]) => {
    if (!xs.length) return null;
    const s = [...xs].sort((a, b) => a - b);
    const m = Math.floor(s.length / 2);
    return s.length % 2 ? s[m]! : Math.round((s[m - 1]! + s[m]!) / 2);
  };
  return Object.fromEntries(
    Object.entries(byTitle).map(([title, b]) => [
      title,
      {
        samples: b.n,
        errors: b.errors,
        usefulMedianMs: median(b.usefulMs),
        usefulMaxMs: b.usefulMs.length ? Math.max(...b.usefulMs) : null,
        pathMedianMs: median(b.pathMs),
        blankMedianMs: median(b.blankMs),
        usefulAllMs: b.usefulMs,
      },
    ]),
  );
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  const health = await fetch(`${APP}/api/health`)
    .then(async (r) => ({ ok: r.ok, status: r.status, body: await r.text() }))
    .catch((e) => ({ ok: false, status: 0, body: String(e) }));
  if (!health.ok) {
    throw new Error(
      `Local app not healthy at ${APP} (${health.status}): ${health.body}. Start next in this worktree first.`,
    );
  }

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  await page.context().addCookies(await cookiesFor(EMAIL));
  await page.goto(`${APP}/leads`, { waitUntil: "domcontentloaded", timeout: 120000 });
  await page.waitForTimeout(2500);
  const landed = page.url();
  if (/login/i.test(landed)) throw new Error(`still on login: ${landed}`);
  await page.screenshot({ path: join(OUT, "00-start-leads.png"), fullPage: false });

  // Cold pass once through all labels (not counted in warm summary, saved separately)
  const cold: HopResult[] = [];
  for (const item of SIDEBAR) {
    const hop = await measureHop(page, 0, item);
    cold.push(hop);
    console.log(
      `COLD ${item.title}: useful=${hop.clickToUsefulMs ?? "FAIL"} path=${hop.clickToPathMs ?? "-"} ${hop.error ?? ""}`,
    );
    await page.waitForTimeout(200);
  }
  await page.screenshot({ path: join(OUT, "01-after-cold-pass.png"), fullPage: false });

  // Warm cycles: walk full sidebar each cycle
  const warm: HopResult[] = [];
  for (let cycle = 1; cycle <= WARM_CYCLES; cycle++) {
    for (const item of SIDEBAR) {
      const hop = await measureHop(page, cycle, item);
      warm.push(hop);
      console.log(
        `WARM${cycle} ${item.title}: useful=${hop.clickToUsefulMs ?? "FAIL"} path=${hop.clickToPathMs ?? "-"} blank=${hop.blankUncoveredMs} ${hop.error ?? ""}`,
      );
      await page.waitForTimeout(150);
    }
  }

  const summary = {
    step: 0,
    measuredAt: new Date().toISOString(),
    app: APP,
    venue: "Jen's Fancy Venue",
    email: EMAIL,
    shaHint: process.env.EXPECTED_SHA_PREFIX ?? "local",
    warmCycles: WARM_CYCLES,
    sidebarLabelCount: SIDEBAR.length,
    health,
    warmByTitle: summarize(warm),
    coldByTitle: summarize(cold),
    warmHops: warm,
    coldHops: cold,
  };

  writeFileSync(join(OUT, "BASELINE.json"), JSON.stringify(summary, null, 2));

  // Compact markdown table for humans
  const lines = [
    "# NAV speed Step 0 baseline (local)",
    "",
    `- App: \`${APP}\``,
    `- Warm cycles: ${WARM_CYCLES}`,
    `- Labels: ${SIDEBAR.length}`,
    "",
    "| Label | useful median (ms) | useful max | path median | blank median | errors |",
    "|---|---:|---:|---:|---:|---:|",
  ];
  for (const item of SIDEBAR) {
    const row = (summary.warmByTitle as any)[item.title];
    if (!row) {
      lines.push(`| ${item.title} | — | — | — | — | — |`);
      continue;
    }
    lines.push(
      `| ${item.title} | ${row.usefulMedianMs ?? "FAIL"} | ${row.usefulMaxMs ?? "—"} | ${row.pathMedianMs ?? "—"} | ${row.blankMedianMs ?? "—"} | ${row.errors} |`,
    );
  }
  writeFileSync(join(OUT, "BASELINE.md"), lines.join("\n") + "\n");

  console.log("\n" + lines.join("\n"));
  console.log(`\nWrote ${join(OUT, "BASELINE.json")}`);
  await browser.close();

  const failed = warm.filter(
    (h) => h.error && h.error !== "skipped_already_on_route",
  );
  if (failed.length > warm.length * 0.25) {
    process.exit(2);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
