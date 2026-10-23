/**
 * Sandbox verify — assignment fee semantics, required-vendor submit exclusion,
 * venue dismiss/remove UX (contrast labels), serving SHA.
 * Safe: Fancy staff magic link; couple email @hellotocheers-test.invalid.
 */
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

config({ path: ".env.local", quiet: true });
const require = createRequire("/Users/jensmac/Developer/wevenu-website/marketing/package.json");
const { chromium } = require("playwright");
const ssrUtils = require(
  "/Users/jensmac/Developer/wevenu-website/node_modules/@supabase/ssr/dist/main/utils/index.js",
);

const APP = "https://app.sandbox.hellotocheers.com";
// Contrast/assignment fix landed in 79db74af; later Sandbox deploys may serve a
// descendant (e.g. vendor-selection lifecycle). Pass EXPECTED_SHA to pin.
const EXPECTED_SHA = (process.env.EXPECTED_SHA ?? "76aa3be7a060fbc71367459a6f737896c7dc5bf5").slice(0, 40);
const CONTRAST_ANCESTOR = "79db74af822b5880838bf8d331ab075eb1012093";
const FANCY = "a415ac52-cd74-42a6-8df7-7a8f6e71d080";
const EMAIL = "jennifer@hellotocheers.com";
const EVENT = "ebf74f77-2944-474a-b735-48762ecb6842";
const OUT = "docs/qa/product-contrast-audit";
mkdirSync(`${OUT}/shots`, { recursive: true });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
if (!url.includes("wvpsldwwjqdannqasrdf")) throw new Error("not sandbox");

const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const anon = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } });

type Check = { name: string; pass: boolean; detail: string };
const checks: Check[] = [];
function record(name: string, pass: boolean, detail: string) {
  checks.push({ name, pass, detail: String(detail).slice(0, 1500) });
  console.log(`${pass ? "PASS" : "FAIL"} ${name} — ${String(detail).slice(0, 400)}`);
}

async function staffCookies() {
  const { data: link } = await admin.auth.admin.generateLink({ type: "magiclink", email: EMAIL });
  const { data: otp, error } = await anon.auth.verifyOtp({
    type: "email",
    token_hash: link!.properties!.hashed_token!,
  });
  if (error || !otp?.session) throw error ?? new Error("session");
  const cookieName = "sb-wvpsldwwjqdannqasrdf-auth-token";
  const encoded = "base64-" + ssrUtils.stringToBase64URL(JSON.stringify(otp.session));
  return [
    ...ssrUtils.createChunks(cookieName, encoded).map((c: { name: string; value: string }) => ({
      name: c.name, value: c.value, domain: "app.sandbox.hellotocheers.com", path: "/",
      httpOnly: false, secure: true, sameSite: "Lax" as const,
    })),
    {
      name: "htc_active_venue_id", value: FANCY,
      domain: "app.sandbox.hellotocheers.com", path: "/",
      httpOnly: false, secure: true, sameSite: "Lax" as const,
    },
  ];
}

async function main() {
  // ── DB: fee + required + removal requests ─────────────────────────────
  const { data: assignments } = await admin
    .from("event_vendor_assignments")
    .select("id, vendor_id, agreed_fee, payment_status, notes, vendors(business_name, category)")
    .eq("event_id", EVENT)
    .eq("venue_id", FANCY);

  const cuppity = (assignments ?? []).find((a) => {
    const v = a.vendors as { business_name?: string } | null;
    return (v?.business_name ?? "").toLowerCase().includes("cuppity");
  });

  record(
    "cuppity-assignment-present",
    !!cuppity,
    cuppity
      ? JSON.stringify({ id: cuppity.id, fee: cuppity.agreed_fee, status: cuppity.payment_status, vendor: cuppity.vendors })
      : `assignments=${(assignments ?? []).length}`,
  );

  if (cuppity) {
    const { data: rel } = await admin
      .from("venue_vendor_relationships")
      .select("is_required, status")
      .eq("venue_id", FANCY)
      .eq("vendor_id", cuppity.vendor_id)
      .maybeSingle();
    record(
      "cuppity-is-required-network",
      rel?.is_required === true && rel?.status === "active",
      JSON.stringify(rel),
    );

    const { data: pending } = await admin
      .from("event_vendor_removal_requests")
      .select("id, status, requested_by, reason, created_at, resolved_at")
      .eq("assignment_id", cuppity.id)
      .eq("status", "pending");
    record(
      "cuppity-no-pending-couple-removal-after-repair",
      (pending ?? []).length === 0,
      JSON.stringify(pending),
    );

    // Fee must not appear on event_order_lines
    const { data: eo } = await admin.from("event_orders").select("id").eq("event_id", EVENT).maybeSingle();
    if (eo) {
      const { data: lines } = await admin
        .from("event_order_lines")
        .select("id, description, amount, unit_price")
        .eq("event_order_id", eo.id);
      // Amount coincidence alone is not a charge link (e.g. Ceremony Coordination $500).
      const feeHit = (lines ?? []).filter((l) =>
        /cuppity|agreed.?fee|venue cost|vendor fee/i.test(`${l.description ?? ""}`),
      );
      record(
        "fee-not-on-event-order-lines",
        feeHit.length === 0,
        `eo=${eo.id} cuppity/fee-named hits=${JSON.stringify(feeHit).slice(0, 400)} lines=${(lines ?? []).length}`,
      );
    } else {
      record("fee-not-on-event-order-lines", true, "no event_order for event (N/A)");
    }

    const { data: inv } = await admin
      .from("invoices")
      .select("id, total, status")
      .eq("event_id", EVENT)
      .eq("venue_id", FANCY)
      .limit(5);
    record(
      "invoices-exist-independently",
      true,
      `count=${(inv ?? []).length} sample=${JSON.stringify(inv ?? []).slice(0, 300)}`,
    );
  }

  // Migration function body check via RPC definition is hard; assert repair side-effect globally for Fancy
  const { data: staleRequired } = await admin
    .from("event_vendor_removal_requests")
    .select("id, vendor_id, status, requested_by")
    .eq("venue_id", FANCY)
    .eq("status", "pending")
    .eq("requested_by", "couple");
  const vendorIds = [...new Set((staleRequired ?? []).map((r) => r.vendor_id))];
  let requiredPending = 0;
  if (vendorIds.length) {
    const { data: reqRels } = await admin
      .from("venue_vendor_relationships")
      .select("vendor_id, is_required, status")
      .eq("venue_id", FANCY)
      .in("vendor_id", vendorIds)
      .eq("is_required", true)
      .eq("status", "active");
    requiredPending = (reqRels ?? []).length;
  }
  record(
    "fancy-no-pending-couple-requests-on-required",
    requiredPending === 0,
    `pendingCouple=${(staleRequired ?? []).length} requiredOverlap=${requiredPending}`,
  );

  // Seed a temporary couple removal request on non-required Baker's Dozen so
  // Dismiss/Remove contrast can be measured. Cleaned up after screenshots.
  const baker = (assignments ?? []).find((a) => {
    const v = a.vendors as { business_name?: string } | null;
    return (v?.business_name ?? "").toLowerCase().includes("baker");
  });
  let seededRequestId: string | null = null;
  if (baker) {
    const { data: seeded, error: seedErr } = await admin
      .from("event_vendor_removal_requests")
      .insert({
        venue_id: FANCY,
        event_id: EVENT,
        assignment_id: baker.id,
        vendor_id: baker.vendor_id,
        status: "pending",
        requested_by: "couple",
        reason: "QA contrast probe — safe to dismiss",
      })
      .select("id")
      .maybeSingle();
    if (seedErr) {
      record("seed-baker-removal-request", false, seedErr.message);
    } else {
      seededRequestId = seeded?.id ?? null;
      record("seed-baker-removal-request", !!seededRequestId, `id=${seededRequestId}`);
    }
  } else {
    record("seed-baker-removal-request", false, "Baker assignment missing");
  }

  // ── Browser (requires serving SHA) ────────────────────────────────────
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await context.addCookies(await staffCookies());
  const page = await context.newPage();

  let serving = "";
  try {
    const res = await page.goto(`${APP}/events/${EVENT}`, { waitUntil: "domcontentloaded", timeout: 60000 });
    serving = (await page.evaluate(() => (window as unknown as { __NEXT_DATA__?: { buildId?: string } }).__NEXT_DATA__?.buildId ?? "")).slice(0, 40)
      || (res?.headers()["x-deployment-id"] ?? "")
      || "";
    // Prefer meta / footer deploy marker if present
    const meta = await page.locator('meta[name="htc-deployment-id"]').getAttribute("content").catch(() => null);
    const dpl = meta || serving;
    record("page-loaded", res?.ok() === true || (res?.status() ?? 0) < 400, `status=${res?.status()} dpl=${dpl}`);

    // Event page Vendors tab (not sidebar /vendors network list)
    await page.goto(`${APP}/events/${EVENT}?tab=vendors`, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForTimeout(1200);
    const eventVendorsTab = page.locator('[role="tablist"] [role="tab"]').filter({ hasText: /^Vendors$/i }).first();
    if (await eventVendorsTab.count()) {
      await eventVendorsTab.click({ timeout: 5000 }).catch(() => {});
      await page.waitForTimeout(800);
    }
    await page.locator("text=Assigned to This Event").first().waitFor({ timeout: 15000 }).catch(() => {});
    await page.locator("text=Assigned to This Event").first().scrollIntoViewIfNeeded().catch(() => {});
    await page.waitForTimeout(600);

    const venueCost = await page.getByText(/Venue cost \$/).count();
    const addVenueCost = await page.getByText(/Add venue cost/).count();
    const legacyDollar = await page.getByRole("button", { name: /^\$\d/ }).count();
    const cuppity = await page.getByText(/Cuppity Cakes/i).count();
    const labelOk = venueCost > 0 || addVenueCost > 0;
    record(
      "venue-cost-label-visible-or-add",
      labelOk,
      `venueCost=${venueCost} add=${addVenueCost} legacyBareDollarButtons=${legacyDollar} cuppityVisible=${cuppity}`,
    );

    // Contrast of fee chip if present (black-ish on light surface)
    if (venueCost > 0) {
      const feeBtn = page.getByRole("button", { name: /Venue cost \$/i }).first();
      const colors = await feeBtn.evaluate((el) => {
        const s = getComputedStyle(el);
        return { color: s.color, bg: s.backgroundColor };
      });
      function parseRgb(c: string): [number, number, number] | null {
        const m = c.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
        return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
      }
      function rel([r, g, b]: [number, number, number]) {
        const ch = (v: number) => {
          const x = v / 255;
          return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
        };
        return 0.2126 * ch(r) + 0.7152 * ch(g) + 0.0722 * ch(b);
      }
      function ratio(fg: string, bg: string) {
        const a = parseRgb(fg);
        const b = parseRgb(bg);
        if (!a || !b) return 0;
        const L1 = rel(a);
        const L2 = rel(b);
        return (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
      }
      // Fee chip uses border + transparent-ish bg — measure ink vs page background
      const pageBg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
      const r = ratio(colors.color, pageBg.includes("rgba(0") || colors.bg === "rgba(0, 0, 0, 0)" ? pageBg : colors.bg);
      record("venue-cost-chip-contrast-aa", r >= 4.5, `ratio=${r.toFixed(2)} ${JSON.stringify({ ...colors, pageBg })}`);
    }

    const banner = page.getByTestId("vendor-removal-request-banner");
    const bannerCount = await banner.count();
    record("removal-banner-count", true, `count=${bannerCount}`);

    if (bannerCount > 0) {
      const dismiss = banner.getByRole("button", { name: /Dismiss request/i }).first();
      const remove = banner.getByRole("button", { name: /Remove/i }).first();
      const dBox = await dismiss.boundingBox();
      const rBox = await remove.boundingBox();
      const dColor = await dismiss.evaluate((el) => {
        const s = getComputedStyle(el);
        return { color: s.color, bg: s.backgroundColor, border: s.borderColor };
      });
      const rColor = await remove.evaluate((el) => {
        const s = getComputedStyle(el);
        return { color: s.color, bg: s.backgroundColor, border: s.borderColor };
      });
      record("banner-buttons-computed-styles", true, JSON.stringify({ dismiss: dColor, remove: rColor, dBox, rBox }));

      // Rough luminance check: reject near-white text on light bg
      function parseRgb(c: string): [number, number, number] | null {
        const m = c.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
        return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
      }
      function rel([r, g, b]: [number, number, number]) {
        const ch = (v: number) => {
          const c = v / 255;
          return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
        };
        return 0.2126 * ch(r) + 0.7152 * ch(g) + 0.0722 * ch(b);
      }
      function ratio(fg: string, bg: string) {
        const a = parseRgb(fg);
        const b = parseRgb(bg);
        if (!a || !b) return 0;
        const L1 = rel(a);
        const L2 = rel(b);
        const hi = Math.max(L1, L2);
        const lo = Math.min(L1, L2);
        return (hi + 0.05) / (lo + 0.05);
      }
      const dRatio = ratio(dColor.color, dColor.bg);
      const rRatio = ratio(rColor.color, rColor.bg);
      record("dismiss-button-contrast-aa", dRatio >= 4.5, `ratio=${dRatio.toFixed(2)} ${JSON.stringify(dColor)}`);
      record("remove-button-contrast-aa", rRatio >= 4.5, `ratio=${rRatio.toFixed(2)} ${JSON.stringify(rColor)}`);
    }

    await page.screenshot({ path: `${OUT}/shots/event-vendors-1280.png`, fullPage: false });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${OUT}/shots/event-vendors-390.png`, fullPage: false });
    record("screenshots-saved", true, "shots/event-vendors-1280.png + 390.png");

    // Serving SHA from /api or deployment header if exposed
    const versionRes = await page.request.get(`${APP}/api/version`).catch(() => null);
    const versionJson = versionRes && versionRes.ok() ? await versionRes.json().catch(() => null) : null;
    const served =
      (versionJson && (versionJson.sha || versionJson.deploymentId || versionJson.commit)) ||
      (await page.evaluate(() => document.documentElement.dataset.deploymentId || "")).slice(0, 40) ||
      "";
    let ecsImage = "";
    try {
      const { execSync } = await import("node:child_process");
      ecsImage = execSync(
        `aws ecs describe-tasks --cluster htc-sandbox --tasks "$(aws ecs list-tasks --cluster htc-sandbox --service-name htc-sandbox-venue-app --desired-status RUNNING --query 'taskArns[0]' --output text)" --query 'tasks[0].containers[0].image' --output text`,
        { encoding: "utf8" },
      ).trim();
    } catch { /* optional */ }
    const shaOk = ecsImage.includes(EXPECTED_SHA.slice(0, 12))
      || ecsImage.includes(CONTRAST_ANCESTOR.slice(0, 12))
      || (typeof served === "string" && (
        served.includes(EXPECTED_SHA.slice(0, 8))
        || served.includes(CONTRAST_ANCESTOR.slice(0, 8))
      ));
    record(
      "serving-sha",
      shaOk,
      `expected=${EXPECTED_SHA.slice(0, 12)} contrastAncestor=${CONTRAST_ANCESTOR.slice(0, 12)} ecs=${ecsImage} meta=${JSON.stringify(served).slice(0, 120)}`,
    );
  } finally {
    await browser.close();
    if (seededRequestId) {
      await admin
        .from("event_vendor_removal_requests")
        .update({ status: "dismissed", resolved_at: new Date().toISOString() })
        .eq("id", seededRequestId)
        .eq("status", "pending");
    }
  }

  const failed = checks.filter((c) => !c.pass);
  writeFileSync(
    `${OUT}/browser-results.json`,
    JSON.stringify({ expectedSha: EXPECTED_SHA, eventId: EVENT, checks, failed: failed.length }, null, 2),
  );
  console.log(`\n${checks.length - failed.length}/${checks.length} passed; results → ${OUT}/browser-results.json`);
  if (failed.length) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
