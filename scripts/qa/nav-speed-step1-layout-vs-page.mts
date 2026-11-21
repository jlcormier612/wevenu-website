/**
 * Step 1 — layout vs page split for sidebar hops (local measurement).
 * Requires next dev with HTC_LAYOUT_FB_FILE set (layout NDJSON sink).
 */
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync, readFileSync, existsSync, truncateSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

config({ path: ".env.local", quiet: true });

const require = createRequire(join(process.cwd(), "marketing/package.json"));
const { chromium } = require("playwright");
const ssrUtils = require(
  join(process.cwd(), "node_modules/@supabase/ssr/dist/main/utils/index.js"),
);

const APP = process.env.APP_URL ?? "http://127.0.0.1:3010";
const EMAIL = "jennifer@hellotocheers.com";
const FANCY = "a415ac52-cd74-42a6-8df7-7a8f6e71d080";
const LAYOUT_FB_FILE =
  process.env.HTC_LAYOUT_FB_FILE ??
  join(process.env.HOME!, "Desktop/HTC-NAV-SPEED-LOCAL/layout-fb.ndjson");
const OUT = join(process.env.HOME!, "Desktop/HTC-NAV-SPEED-LOCAL");
const WARM = Number(process.env.WARM_CYCLES ?? "3");

/** All primary labels — same set as Step 0. */
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
if (!url.includes("wvpsldwwjqdannqasrdf")) throw new Error("refusing non-sandbox supabase");

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
    return (
      pathname === "/library" ||
      (pathname.startsWith("/library/") && !pathname.startsWith("/library/documents"))
    );
  }
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

function readLayoutEventsAfter(byteOffset: number): {
  events: any[];
  newOffset: number;
} {
  if (!existsSync(LAYOUT_FB_FILE)) return { events: [], newOffset: 0 };
  const buf = readFileSync(LAYOUT_FB_FILE);
  const slice = buf.subarray(byteOffset).toString("utf8");
  const events = slice
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => {
      try {
        return JSON.parse(l);
      } catch {
        return null;
      }
    })
    .filter(Boolean);
  return { events, newOffset: buf.length };
}

function median(xs: number[]): number | null {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m]! : Math.round((s[m - 1]! + s[m]!) / 2);
}

type Hop = {
  cycle: number;
  title: string;
  from: string;
  usefulMs: number | null;
  pathMs: number | null;
  rscTtfbMs: number | null;
  rscUrl: string | null;
  layoutTotalMs: number | null;
  layoutBootstrapMs: number | null;
  layoutGatesMs: number | null;
  /** Max(0, rscTtfb - layoutTotal) — page work before first RSC byte */
  pageBeforeByteMs: number | null;
  /** Max(0, useful - rscTtfb) — after first byte until useful paint */
  afterByteMs: number | null;
  error?: string;
};

async function main() {
  mkdirSync(OUT, { recursive: true });
  // Reset sink so we only see this run
  writeFileSync(LAYOUT_FB_FILE, "");

  const health = await fetch(`${APP}/api/health`).then(async (r) => ({
    ok: r.ok,
    status: r.status,
    body: await r.text(),
  }));
  if (!health.ok) throw new Error(`app unhealthy ${APP}: ${health.status} ${health.body}`);

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  await page.context().addCookies(await cookiesFor(EMAIL));

  let layoutOffset = 0;
  const pendingRsc: {
    url: string;
    ttfbMs: number;
    start: number;
  }[] = [];

  page.on("request", (req: any) => {
    const u = req.url() as string;
    const headers = req.headers();
    const isRsc =
      u.includes("_rsc=") ||
      headers["rsc"] === "1" ||
      (headers["next-router-state-tree"] && req.method() === "GET");
    if (!isRsc && req.resourceType() !== "document") return;
    (req as any).__htcStart = Date.now();
  });

  page.on("response", async (res: any) => {
    try {
      const req = res.request();
      const u = req.url() as string;
      const headers = req.headers();
      const isRsc =
        u.includes("_rsc=") ||
        headers["rsc"] === "1" ||
        Boolean(headers["next-router-state-tree"]);
      if (!isRsc && req.resourceType() !== "document") return;
      const start = (req as any).__htcStart as number | undefined;
      if (!start) return;
      // responseStart approx: when headers arrive
      const ttfbMs = Date.now() - start;
      pendingRsc.push({ url: u, ttfbMs, start });
    } catch {
      /* ignore */
    }
  });

  await page.goto(`${APP}/leads`, { waitUntil: "domcontentloaded", timeout: 120000 });
  await page.waitForTimeout(2000);
  // Drain cold layout events
  layoutOffset = readLayoutEventsAfter(0).newOffset;
  pendingRsc.length = 0;

  const hops: Hop[] = [];

  for (let cycle = 1; cycle <= WARM; cycle++) {
    for (const item of SIDEBAR) {
      const from = new URL(page.url()).pathname;
      if (pathMatches(from, item.pathPrefix)) {
        hops.push({
          cycle,
          title: item.title,
          from,
          usefulMs: 0,
          pathMs: 0,
          rscTtfbMs: null,
          rscUrl: null,
          layoutTotalMs: null,
          layoutBootstrapMs: null,
          layoutGatesMs: null,
          pageBeforeByteMs: null,
          afterByteMs: null,
          error: "skipped_already_on_route",
        });
        continue;
      }

      const link = page
        .locator("nav a, aside a")
        .filter({
          hasText: new RegExp(
            `^\\s*${item.title.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\$&")}\\s*$`,
            "i",
          ),
        })
        .first();

      pendingRsc.length = 0;
      const layoutBefore = layoutOffset;
      const t0 = Date.now();
      await link.click({ timeout: 15000 });

      let pathMs: number | null = null;
      let usefulMs: number | null = null;
      const deadline = t0 + 20000;
      while (Date.now() < deadline) {
        const snap = await page.evaluate(() => {
          const overlay = document.querySelector('[data-testid="navigation-pending-main"]');
          const pageSlot = document.querySelector(
            "[data-workspace-main] > div:not([data-testid='navigation-pending-main'])",
          );
          const slotText = (pageSlot?.textContent || "").replace(/\s+/g, " ").trim();
          return {
            pathname: location.pathname,
            slotTextLen: slotText.length,
            overlay: !!overlay,
          };
        });
        const ms = Date.now() - t0;
        if (pathMs == null && pathMatches(snap.pathname, item.pathPrefix)) pathMs = ms;
        if (
          usefulMs == null &&
          pathMatches(snap.pathname, item.pathPrefix) &&
          snap.slotTextLen >= 80 &&
          !snap.overlay
        ) {
          usefulMs = ms;
          break;
        }
        await page.waitForTimeout(40);
      }

      // Allow layout emit to flush
      await page.waitForTimeout(150);
      const { events, newOffset } = readLayoutEventsAfter(layoutBefore);
      layoutOffset = newOffset;

      const layoutEvent =
        events.filter((e) => e.event === "layout_first_byte_timing").at(-1) ?? null;
      const layoutTotalMs =
        typeof layoutEvent?.total_ms === "number" ? layoutEvent.total_ms : null;
      const d = layoutEvent?.durations_ms ?? {};
      const layoutBootstrapMs =
        typeof d.layout_bootstrap === "number" ? d.layout_bootstrap : null;
      const layoutGatesMs =
        typeof d.layout_gates_parallel === "number" ? d.layout_gates_parallel : null;

      // Prefer RSC fetch that started at/after click
      const rsc = [...pendingRsc].reverse().find((r) => r.start >= t0 - 20) ?? null;

      const rscTtfbMs = rsc?.ttfbMs ?? null;
      const pageBeforeByteMs =
        rscTtfbMs != null && layoutTotalMs != null
          ? Math.max(0, rscTtfbMs - layoutTotalMs)
          : null;
      const afterByteMs =
        usefulMs != null && rscTtfbMs != null ? Math.max(0, usefulMs - rscTtfbMs) : null;

      const hop: Hop = {
        cycle,
        title: item.title,
        from,
        usefulMs,
        pathMs,
        rscTtfbMs,
        rscUrl: rsc?.url ?? null,
        layoutTotalMs,
        layoutBootstrapMs,
        layoutGatesMs,
        pageBeforeByteMs,
        afterByteMs,
        error: usefulMs == null ? "timeout" : undefined,
      };
      hops.push(hop);
      console.log(
        `WARM${cycle} ${item.title}: useful=${usefulMs} layout=${layoutTotalMs} rscTtfb=${rscTtfbMs} pageBeforeByte=${pageBeforeByteMs} afterByte=${afterByteMs}`,
      );
      await page.waitForTimeout(120);
    }
  }

  await browser.close();

  const byTitle: Record<string, Hop[]> = {};
  for (const h of hops) {
    if (h.error === "skipped_already_on_route") continue;
    (byTitle[h.title] ??= []).push(h);
  }

  const summaryRows = Object.entries(byTitle).map(([title, list]) => {
    const useful = list.map((h) => h.usefulMs).filter((x): x is number => x != null);
    const layout = list.map((h) => h.layoutTotalMs).filter((x): x is number => x != null);
    const rsc = list.map((h) => h.rscTtfbMs).filter((x): x is number => x != null);
    const pageBefore = list
      .map((h) => h.pageBeforeByteMs)
      .filter((x): x is number => x != null);
    const after = list.map((h) => h.afterByteMs).filter((x): x is number => x != null);
    const layoutMed = median(layout);
    const usefulMed = median(useful);
    const pageBeforeMed = median(pageBefore);
    const afterMed = median(after);
    const rscMed = median(rsc);
    let dominant: "layout" | "page_before_byte" | "after_byte" | "unknown" = "unknown";
    const parts = [
      { k: "layout" as const, v: layoutMed ?? 0 },
      { k: "page_before_byte" as const, v: pageBeforeMed ?? 0 },
      { k: "after_byte" as const, v: afterMed ?? 0 },
    ].sort((a, b) => b.v - a.v);
    if (usefulMed && parts[0] && parts[0].v >= usefulMed * 0.4) {
      dominant = parts[0].k;
    } else if (parts[0] && parts[0].v > 0) {
      dominant = parts[0].k;
    }
    return {
      title,
      samples: list.length,
      usefulMedianMs: usefulMed,
      layoutMedianMs: layoutMed,
      rscTtfbMedianMs: rscMed,
      pageBeforeByteMedianMs: pageBeforeMed,
      afterByteMedianMs: afterMed,
      dominant,
      layoutShareOfUseful:
        usefulMed && layoutMed != null ? Math.round((layoutMed / usefulMed) * 100) : null,
    };
  });

  summaryRows.sort((a, b) => (b.usefulMedianMs ?? 0) - (a.usefulMedianMs ?? 0));

  const withLayout = summaryRows.filter((r) => r.layoutMedianMs != null);
  const layoutHeavy = withLayout.filter(
    (r) => (r.layoutShareOfUseful ?? 0) >= 50 || r.dominant === "layout",
  );
  const pageHeavy = withLayout.filter(
    (r) =>
      r.dominant === "page_before_byte" ||
      ((r.pageBeforeByteMedianMs ?? 0) > (r.layoutMedianMs ?? 0) &&
        (r.pageBeforeByteMedianMs ?? 0) >= (r.usefulMedianMs ?? 1) * 0.4),
  );
  const afterHeavy = withLayout.filter((r) => r.dominant === "after_byte");

  const avgLayout = median(
    withLayout.map((r) => r.layoutMedianMs!).filter(Boolean),
  );
  const avgPageBefore = median(
    withLayout
      .map((r) => r.pageBeforeByteMedianMs)
      .filter((x): x is number => x != null),
  );

  let attack: "layout_first_shared" | "page_first_paint_shared" | "both_layout_first";
  let rationale: string;
  if (avgLayout != null && avgPageBefore != null && avgLayout >= avgPageBefore) {
    attack = pageHeavy.length > layoutHeavy.length ? "both_layout_first" : "layout_first_shared";
    rationale =
      "Shared layout cost is present on every hop and is at least as large as typical page-before-byte; attack shared layout first so all labels benefit, then page first-paint.";
  } else if (avgPageBefore != null && avgLayout != null && avgPageBefore > avgLayout * 1.2) {
    attack = "both_layout_first";
    rationale =
      "Page-before-byte often exceeds layout, but layout still runs on every sidebar hop — cut shared layout first (all labels), then apply the same first-paint pattern across destinations.";
  } else {
    attack = "both_layout_first";
    rationale =
      "Mixed; default to shared layout first (every label pays it), then destination first-paint for remaining gap.";
  }

  // Stronger rule from plan: shared fix for all labels → layout first if layout is material on most hops
  const layoutMaterialCount = withLayout.filter(
    (r) => (r.layoutMedianMs ?? 0) >= 200 || (r.layoutShareOfUseful ?? 0) >= 30,
  ).length;
  if (layoutMaterialCount >= withLayout.length * 0.6) {
    attack = avgPageBefore != null && avgPageBefore > (avgLayout ?? 0) * 1.5
      ? "both_layout_first"
      : "layout_first_shared";
    rationale = `Layout is material on ${layoutMaterialCount}/${withLayout.length} labels (median layout≈${avgLayout}ms). Attack shared layout path first for all sidebar labels` +
      (attack === "both_layout_first"
        ? `, then page first-paint (page-before-byte median≈${avgPageBefore}ms).`
        : ".");
  }

  const verdict = {
    step: 1,
    status: "COMPLETE",
    measuredAt: new Date().toISOString(),
    app: APP,
    layoutFbFile: LAYOUT_FB_FILE,
    warmCycles: WARM,
    attack,
    rationale,
    aggregates: {
      labelsWithLayoutSamples: withLayout.length,
      layoutMedianAcrossLabelsMs: avgLayout,
      pageBeforeByteMedianAcrossLabelsMs: avgPageBefore,
      layoutMaterialLabelCount: layoutMaterialCount,
      layoutHeavyLabels: layoutHeavy.map((r) => r.title),
      pageHeavyLabels: pageHeavy.map((r) => r.title),
      afterByteHeavyLabels: afterHeavy.map((r) => r.title),
    },
    byTitle: summaryRows,
    hops,
    noSpeedCodeYet: true,
  };

  writeFileSync(join(OUT, "STEP1-LAYOUT-VS-PAGE.json"), JSON.stringify(verdict, null, 2));

  const md = [
    "# Step 1 — layout vs page (local)",
    "",
    `**Attack:** \`${attack}\``,
    "",
    rationale,
    "",
    "| Label | useful | layout | RSC TTFB | page-before-byte | after-byte | dominant |",
    "|---|---:|---:|---:|---:|---:|---|",
    ...summaryRows.map(
      (r) =>
        `| ${r.title} | ${r.usefulMedianMs ?? "—"} | ${r.layoutMedianMs ?? "—"} | ${r.rscTtfbMedianMs ?? "—"} | ${r.pageBeforeByteMedianMs ?? "—"} | ${r.afterByteMedianMs ?? "—"} | ${r.dominant} |`,
    ),
    "",
  ];
  writeFileSync(join(OUT, "STEP1-LAYOUT-VS-PAGE.md"), md.join("\n"));
  console.log("\n" + md.join("\n"));
  console.log(`\nATTACK=${attack}`);
  console.log(`Wrote ${join(OUT, "STEP1-LAYOUT-VS-PAGE.json")}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
