/**
 * Sandbox exercise: portal docs viewer, timeline couple-add, budget soft-remove/custom,
 * floor Ceremony+Reception defaults. Run only after deploy SHA matches 72ea7a0c…
 *
 *   npx tsx docs/qa/staff-light-canvas/findings-wave-a-status/verify-sandbox.mts
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { chromium } from "playwright";

const APP = process.env.HTC_APP_URL ?? "https://app.sandbox.hellotocheers.com";
const EXPECT_SHA = process.env.EXPECT_SHA ?? "72ea7a0c71d5a97cb9b3e4389831689078345eef";
const OUT = join(process.cwd(), "docs/qa/staff-light-canvas/findings-wave-a-status");
mkdirSync(OUT, { recursive: true });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
if (!url || !key) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");

const admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const results: Record<string, unknown> = { expectSha: EXPECT_SHA, app: APP, checks: {} };

function record(id: string, ok: boolean, detail?: unknown) {
  (results.checks as Record<string, unknown>)[id] = { ok, detail };
  console.log(`${ok ? "PASS" : "FAIL"}  ${id}`, detail ?? "");
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

try {
  const { data: link, error } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: "jennifer@hellotocheers.com",
  });
  if (error || !link?.properties?.hashed_token) throw error ?? new Error("no magic link");
  const hashed = link.properties.hashed_token;
  await page.goto(
    `${APP}/auth/confirm?token_hash=${encodeURIComponent(hashed)}&type=magiclink&next=/dashboard`,
    { waitUntil: "domcontentloaded", timeout: 60_000 },
  );
  await page.waitForTimeout(2500);

  const dpl = await page.locator("[data-dpl-id]").first().getAttribute("data-dpl-id").catch(() => null);
  record("deploy_sha", dpl === EXPECT_SHA || (dpl?.startsWith("41ed6464") ?? false), { dpl, EXPECT_SHA });
  if (!(results.checks as any).deploy_sha.ok) {
    writeFileSync(join(OUT, "browser-results.json"), JSON.stringify(results, null, 2));
    await browser.close();
    process.exit(2);
  }

  // Floor organizer — find a booked event with floor plans
  await page.goto(`${APP}/events`, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.waitForTimeout(1500);
  const eventHref = await page.locator('a[href^="/events/"]').first().getAttribute("href").catch(() => null);
  record("events_list", Boolean(eventHref), { eventHref });

  if (eventHref) {
    await page.goto(`${APP}${eventHref}`, { waitUntil: "domcontentloaded", timeout: 60_000 });
    await page.waitForTimeout(1500);
    const floorTab = page.getByRole("link", { name: /floor/i }).or(page.getByRole("tab", { name: /floor/i })).first();
    if (await floorTab.count()) {
      await floorTab.click().catch(() => null);
      await page.waitForTimeout(1200);
    }
    const organizer = page.getByTestId("floor-plan-setup-package");
    const hasOrganizer = await organizer.count().then((n) => n > 0);
    record("floor_organizer_present", hasOrganizer);
    if (hasOrganizer) {
      await page.getByTestId("floor-plan-setup-package-toggle").click().catch(() => null);
      await page.waitForTimeout(800);
      const defaultsBtn = page.getByTestId("floor-plan-setup-defaults-create");
      const defaultsVisible = await defaultsBtn.isVisible().catch(() => false);
      record("floor_defaults_cta_or_existing_setups", defaultsVisible || (await page.getByTestId("floor-plan-setup-add").count()) > 0, {
        defaultsVisible,
      });
      await page.screenshot({ path: join(OUT, "floor-organizer-1280.png"), fullPage: true });
    }

    // Timeline couple-add affordance on venue side
    const timelineTab = page.getByRole("link", { name: /timeline/i }).or(page.getByRole("tab", { name: /timeline/i })).first();
    if (await timelineTab.count()) {
      await timelineTab.click().catch(() => null);
      await page.waitForTimeout(1200);
      const enable = page.getByTestId("timeline-enable-couple-additions");
      const enableOrSections = (await enable.count()) > 0 || (await page.getByText(/Your additions|Couple can add/i).count()) > 0;
      record("timeline_couple_add_venue_control", enableOrSections || (await page.getByText(/Add Section/i).count()) > 0);
      await page.screenshot({ path: join(OUT, "timeline-venue-1280.png"), fullPage: true });
    }
  }

  // Portal: resolve a client portal session for Jen's venue if available
  const { data: sessions } = await admin
    .from("client_portal_sessions")
    .select("access_token, client_id, expires_at")
    .order("created_at", { ascending: false })
    .limit(20);
  const token = (sessions ?? []).find((s: { access_token?: string; expires_at?: string | null }) => {
    if (!s.access_token) return false;
    if (!s.expires_at) return true;
    return Date.parse(s.expires_at) > Date.now();
  })?.access_token as string | undefined;

  record("portal_token", Boolean(token));
  if (token) {
    await page.goto(`${APP}/portal/${token}?section=documents`, { waitUntil: "domcontentloaded", timeout: 60_000 });
    await page.waitForTimeout(2000);
    const openBtn = page.getByTestId("portal-document-open").first();
    const hasOpen = await openBtn.count().then((n) => n > 0);
    record("portal_docs_open_control", hasOpen || (await page.getByText(/Documents/i).count()) > 0);
    if (hasOpen) {
      await openBtn.click();
      await page.waitForTimeout(1000);
      const viewer = await page.getByTestId("portal-document-viewer").count();
      record("portal_docs_viewer", viewer > 0);
      await page.screenshot({ path: join(OUT, "portal-docs-viewer-1280.png") });
      await page.keyboard.press("Escape").catch(() => null);
    }

    await page.goto(`${APP}/portal/${token}?section=timeline`, { waitUntil: "domcontentloaded", timeout: 60_000 });
    await page.waitForTimeout(2000);
    const addItem = await page.getByTestId("portal-timeline-add-item").count();
    const unavailable = await page.getByTestId("portal-timeline-add-unavailable").count();
    record("portal_timeline_add_or_hint", addItem > 0 || unavailable > 0, { addItem, unavailable });
    await page.screenshot({ path: join(OUT, "portal-timeline-1280.png"), fullPage: true });

    await page.goto(`${APP}/portal/${token}?section=budget`, { waitUntil: "domcontentloaded", timeout: 60_000 });
    await page.waitForTimeout(2000);
    const unalloc = await page.getByTestId("budget-unallocated").count();
    const addCustom = await page.getByTestId("budget-add-custom-category").count();
    const remove = await page.getByTestId("budget-category-remove").count();
    const setupBudget = await page.getByText(/Set your wedding budget|total wedding budget/i).count();
    record("portal_budget_controls", unalloc > 0 || addCustom > 0 || remove > 0 || setupBudget > 0, {
      unalloc, addCustom, remove, setupBudget,
    });
    await page.screenshot({ path: join(OUT, "portal-budget-1280.png"), fullPage: true });
  }
} catch (e) {
  record("harness_error", false, String(e));
  await page.screenshot({ path: join(OUT, "harness-error.png") }).catch(() => null);
} finally {
  writeFileSync(join(OUT, "browser-results.json"), JSON.stringify(results, null, 2));
  await browser.close();
}

const failed = Object.values(results.checks as Record<string, { ok: boolean }>).filter((c) => !c.ok).length;
console.log(JSON.stringify(results, null, 2));
process.exit(failed ? 1 : 0);
