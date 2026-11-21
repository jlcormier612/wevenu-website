/**
 * Measure Clients list → open client (booking workspace) hop.
 * Measurement only. No mutations.
 *
 * APP_URL=https://app.sandbox.hellotocheers.com npx tsx scripts/qa/nav-speed-client-open.mts
 */
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

config({ path: ".env.local", quiet: true });

const require = createRequire(join(process.cwd(), "marketing/package.json"));
const { chromium } = require("playwright");
const ssrUtils = require(
  join(process.cwd(), "node_modules/@supabase/ssr/dist/main/utils/index.js"),
);

const APP = process.env.APP_URL ?? "http://127.0.0.1:3000";
const EMAIL = "jennifer@hellotocheers.com";
const FANCY = "a415ac52-cd74-42a6-8df7-7a8f6e71d080";
const CYCLES = Number(process.env.OPEN_CYCLES ?? "5");
const OUT = join(process.env.HOME!, "Desktop/HTC-NAV-SPEED-SANDBOX");

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

function median(xs: number[]): number | null {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)]!;
}

type Hop = {
  cycle: number;
  clientId: string;
  clickToPathMs: number | null;
  /** Optimistic chrome overlay (list name) — perceived first paint */
  clickToOptimisticMs: number | null;
  /** Identity shell: heading / booking fallback visible, overlay cleared */
  clickToIdentityMs: number | null;
  /** Richer: substantial workspace body beyond identity */
  clickToWorkspaceMs: number | null;
  blankUncoveredMs: number;
  finalPath: string;
  identitySignal: string | null;
  error?: string;
};

async function measureOpen(
  page: import("playwright").Page,
  cycle: number,
): Promise<Hop> {
  await page.goto(`${APP}/clients`, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page
    .locator('[data-testid="clients-streaming-root"], .htc-hospitality-heading')
    .first()
    .waitFor({ state: "visible", timeout: 30_000 });
  // Wait for at least one real row (Suspense list body)
  const rowLink = page.locator('a.htc-record-link[href^="/clients/"]').first();
  await rowLink.waitFor({ state: "visible", timeout: 45_000 });
  // Stabilize list before click (avoids mid-stream navigation races)
  await page.waitForTimeout(250);
  const href = (await rowLink.getAttribute("href")) || "";
  const clientId = href.split("/clients/")[1]?.split(/[?#]/)[0] ?? "unknown";

  let clickToPathMs: number | null = null;
  let clickToOptimisticMs: number | null = null;
  let clickToIdentityMs: number | null = null;
  let clickToWorkspaceMs: number | null = null;
  let blankUncoveredMs = 0;
  let identitySignal: string | null = null;
  const t0 = Date.now();
  await rowLink.click({ timeout: 10_000 });

  const deadline = t0 + 30_000;
  while (Date.now() < deadline) {
    let snap: {
      pathname: string;
      onClient: boolean;
      overlay: boolean;
      isSnapshot: boolean;
      isOptimistic: boolean;
      slotTextLen: number;
      overlayTextLen: number;
      hasHeading: boolean;
      hasNameFb: boolean;
      hasBookingFb: boolean;
      hasBookedRoot: boolean;
      headingText: string;
    } | null = null;
    try {
      snap = await page.evaluate((expectedId) => {
        const pathname = location.pathname;
        const overlay = document.querySelector('[data-testid="navigation-pending-main"]');
        const pageSlot = document.querySelector(
          "[data-workspace-main] > div:not([data-testid='navigation-pending-main'])",
        );
        const slotText = (pageSlot?.textContent || "").replace(/\s+/g, " ").trim();
        const overlayText = (overlay?.textContent || "").replace(/\s+/g, " ").trim();
        const heading = document.querySelector(
          ".htc-hospitality-heading, h1.font-heading, h1.text-heading",
        );
        const nameFb = document.querySelector('[data-testid="booking-client-name-fallback"]');
        const bookingFb = document.querySelector(
          '[data-testid="booking-identity-fallback"], [data-testid="booking-workspace-identity"]',
        );
        const bookedRoot = document.querySelector(
          '[data-testid="booked-workspace-detail"], [data-testid="client-booking-staff-region"], [data-testid="booking-workspace-deferred-pending"]',
        );
        const onClient =
          pathname === `/clients/${expectedId}` ||
          pathname.startsWith(`/clients/${expectedId}/`);
        return {
          pathname,
          onClient,
          overlay: !!overlay,
          isSnapshot: overlay?.getAttribute("data-nav-snapshot") === "true",
          isOptimistic: overlay?.getAttribute("data-nav-optimistic") === "true",
          slotTextLen: slotText.length,
          overlayTextLen: overlayText.length,
          hasHeading: !!heading && (heading.textContent || "").trim().length >= 2,
          hasNameFb: !!nameFb,
          hasBookingFb: !!bookingFb,
          hasBookedRoot: !!bookedRoot,
          headingText: (heading?.textContent || "").trim().slice(0, 80),
        };
      }, clientId);
    } catch {
      await page.waitForTimeout(50);
      continue;
    }

    const ms = Date.now() - t0;
    const covered =
      snap.overlay &&
      (snap.isOptimistic || (snap.isSnapshot ? snap.overlayTextLen >= 48 : true));
    if (snap.slotTextLen < 40 && !covered) blankUncoveredMs += 50;

    if (clickToPathMs == null && snap.onClient) clickToPathMs = ms;
    if (clickToOptimisticMs == null && snap.isOptimistic) clickToOptimisticMs = ms;

    if (
      clickToIdentityMs == null &&
      snap.onClient &&
      !snap.overlay &&
      (snap.hasNameFb || snap.hasHeading || snap.hasBookingFb || snap.slotTextLen >= 80)
    ) {
      clickToIdentityMs = ms;
      identitySignal = snap.hasBookingFb
        ? "booking_identity"
        : snap.hasNameFb
          ? "name_fallback"
          : snap.hasHeading
            ? `heading:${snap.headingText}`
            : `slot_len:${snap.slotTextLen}`;
    }

    if (
      clickToWorkspaceMs == null &&
      snap.onClient &&
      !snap.overlay &&
      (snap.hasBookedRoot || snap.slotTextLen >= 400)
    ) {
      clickToWorkspaceMs = ms;
      break;
    }

    // Identity alone is enough to stop if workspace never densifies (edge)
    if (clickToIdentityMs != null && Date.now() - t0 > 8000 && clickToWorkspaceMs == null) {
      break;
    }

    await page.waitForTimeout(50);
  }

  return {
    cycle,
    clientId,
    clickToPathMs,
    clickToOptimisticMs,
    clickToIdentityMs,
    clickToWorkspaceMs,
    blankUncoveredMs,
    finalPath: new URL(page.url()).pathname,
    identitySignal,
    error:
      clickToIdentityMs == null
        ? `timeout path=${new URL(page.url()).pathname}`
        : undefined,
  };
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  await context.addCookies(await cookiesFor(EMAIL));
  const page = await context.newPage();

  const hops: Hop[] = [];
  console.log(`App: ${APP} · cycles=${CYCLES}`);

  // Cold: first open after landing
  const cold = await measureOpen(page, 0);
  hops.push(cold);
  console.log(
    `COLD open ${cold.clientId}: opt=${cold.clickToOptimisticMs ?? "-"} identity=${cold.clickToIdentityMs ?? "FAIL"} workspace=${cold.clickToWorkspaceMs ?? "-"} path=${cold.clickToPathMs ?? "-"} blank=${cold.blankUncoveredMs} ${cold.identitySignal ?? ""} ${cold.error ?? ""}`,
  );

  for (let i = 1; i <= CYCLES; i++) {
    const hop = await measureOpen(page, i);
    hops.push(hop);
    console.log(
      `WARM${i} open ${hop.clientId}: opt=${hop.clickToOptimisticMs ?? "-"} identity=${hop.clickToIdentityMs ?? "FAIL"} workspace=${hop.clickToWorkspaceMs ?? "-"} path=${hop.clickToPathMs ?? "-"} blank=${hop.blankUncoveredMs} ${hop.identitySignal ?? ""} ${hop.error ?? ""}`,
    );
  }

  const warm = hops.filter((h) => h.cycle > 0 && !h.error);
  const idMs = warm.map((h) => h.clickToIdentityMs!).filter((x) => x != null);
  const optMs = warm
    .map((h) => h.clickToOptimisticMs)
    .filter((x): x is number => x != null);
  const wsMs = warm
    .map((h) => h.clickToWorkspaceMs)
    .filter((x): x is number => x != null);

  const summary = {
    app: APP,
    cycles: CYCLES,
    cold,
    warmOptimisticMedianMs: median(optMs),
    warmOptimisticMaxMs: optMs.length ? Math.max(...optMs) : null,
    warmIdentityMedianMs: median(idMs),
    warmIdentityMaxMs: idMs.length ? Math.max(...idMs) : null,
    warmWorkspaceMedianMs: median(wsMs),
    warmWorkspaceMaxMs: wsMs.length ? Math.max(...wsMs) : null,
    hops,
  };

  const md = [
    "# Clients list → open client",
    "",
    `- App: \`${APP}\``,
    `- Warm cycles: ${CYCLES}`,
    "",
    `| Metric | ms |`,
    `|---|---:|`,
    `| Cold optimistic | ${cold.clickToOptimisticMs ?? "—"} |`,
    `| Cold identity | ${cold.clickToIdentityMs ?? "FAIL"} |`,
    `| Warm optimistic median | ${summary.warmOptimisticMedianMs ?? "—"} |`,
    `| Warm identity median | ${summary.warmIdentityMedianMs ?? "FAIL"} |`,
    `| Warm identity max | ${summary.warmIdentityMaxMs ?? "—"} |`,
    `| Warm workspace median | ${summary.warmWorkspaceMedianMs ?? "—"} |`,
    `| Warm workspace max | ${summary.warmWorkspaceMaxMs ?? "—"} |`,
    "",
    "Optimistic = chrome-only list name in nav overlay.",
    "Identity = server heading / booking identity visible, nav overlay cleared.",
    "Workspace = booked workspace body densified (staff region / long slot).",
  ].join("\n");

  writeFileSync(join(OUT, "CLIENT-OPEN.json"), JSON.stringify(summary, null, 2));
  writeFileSync(join(OUT, "CLIENT-OPEN.md"), md);
  console.log("\n" + md);
  console.log(`\nWrote ${join(OUT, "CLIENT-OPEN.md")}`);

  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
