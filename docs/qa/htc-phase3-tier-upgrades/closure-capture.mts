/**
 * Phase 3 final acceptance UI capture (Sandbox) — ca4c60f5
 */
import { chromium, type Page } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

config({ path: "/Users/jensmac/Developer/wevenu-website/.env.local", quiet: true });

const OUT = "/tmp/htc-phase3-sandbox/closure-ui";
mkdirSync(OUT, { recursive: true });
const VENUE = "f9427d5e-84f9-48bc-a9fa-8a2bcb95af7f";
const WILLOW = "31f38b79-eb99-4ebc-81bc-af85767b42aa";
const APP = "https://app.sandbox.hellotocheers.com";
const WS = "https://workspace.sandbox.hellotocheers.com";
const EXPECTED = "ca4c60f5";
const EMAIL = "jennifer@hellotocheers.com";

function save(name: string, text: string) {
  writeFileSync(`${OUT}/${name}`, text);
}

async function shot(page: Page, name: string) {
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: true });
}

async function setActiveVenue(venueId: string) {
  const sb = process.env.NEXT_PUBLIC_SUPABASE_URL!.replace(/\/$/, "");
  const sr = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const uid = "2fa73101-337b-4530-8c77-f3c272c5463e";
  await fetch(`${sb}/rest/v1/venue_staff_active_context?user_id=eq.${uid}`, {
    method: "PATCH",
    headers: {
      apikey: sr,
      Authorization: `Bearer ${sr}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify({
      active_venue_id: venueId,
      updated_at: new Date().toISOString(),
    }),
  });
}

async function establishVenueSession(page: Page) {
  const sbUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  // Ensure active venue is rehearsal before session bootstrap
  await setActiveVenue(VENUE);

  const gen = await fetch(`${sbUrl}/auth/v1/admin/generate_link`, {
    method: "POST",
    headers: {
      apikey: service,
      Authorization: `Bearer ${service}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      type: "magiclink",
      email: EMAIL,
      options: { redirect_to: `${APP}/settings/billing` },
    }),
  });
  const linkPayload = (await gen.json()) as {
    hashed_token?: string;
    action_link?: string;
    email_otp?: string;
  };
  save("magic-link-meta.json", JSON.stringify({
    hasHash: Boolean(linkPayload.hashed_token),
    action: linkPayload.action_link?.slice(0, 120),
  }, null, 2));

  // Prefer token_hash confirm path (reliable in Sandbox)
  if (linkPayload.hashed_token) {
    const confirmUrl =
      `${APP}/auth/confirm?token_hash=${encodeURIComponent(linkPayload.hashed_token)}` +
      `&type=magiclink&next=${encodeURIComponent("/settings/billing")}`;
    await page.goto(confirmUrl, { waitUntil: "domcontentloaded", timeout: 90000 });
    await page.waitForTimeout(4000);
  } else if (linkPayload.action_link) {
    await page.goto(linkPayload.action_link, { waitUntil: "domcontentloaded", timeout: 90000 });
    await page.waitForTimeout(2000);
    const landed = page.url();
    const hash = landed.includes("#") ? landed.slice(landed.indexOf("#")) : "";
    if (hash.includes("access_token")) {
      await page.goto(
        `${APP}/auth/confirm?next=${encodeURIComponent("/settings/billing")}${hash}`,
        { waitUntil: "domcontentloaded", timeout: 90000 },
      );
      await page.waitForTimeout(4000);
    }
  } else {
    // Fallback: verify OTP via supabase-js and inject session cookie through browser setSession
    const admin = createClient(sbUrl, service, { auth: { persistSession: false } });
    // cannot easily mint session without link; throw
    throw new Error("No magic link token available");
  }

  await shot(page, "01-after-auth-confirm");
  save("01-url.txt", page.url());

  // If still on login, try setSession from anon client inside page using email OTP if present
  if (page.url().includes("/login") || page.url().includes("/forgot-password") || page.url().includes("/auth/confirm")) {
    // Last resort: password login for Fancy Venue demo accounts is not guaranteed.
    // Use service-role generated session via verifyOtp in Node + cookie injection.
    const browserClient = createClient(sbUrl, anon, { auth: { persistSession: false, autoRefreshToken: false } });
    if (!linkPayload.hashed_token) throw new Error("Cannot establish session");
    const verified = await browserClient.auth.verifyOtp({
      type: "magiclink",
      token_hash: linkPayload.hashed_token,
    });
    if (verified.error || !verified.data.session) {
      throw new Error(`verifyOtp failed: ${verified.error?.message}`);
    }
    const session = verified.data.session;
    await page.goto(APP, { waitUntil: "domcontentloaded" });
    await page.evaluate(
      async ({ access_token, refresh_token }) => {
        const key = Object.keys(localStorage).find((k) => k.includes("auth-token"));
        // Prefer cookie-based SSR client path by calling setSession through exposed supabase if present.
        // Fallback: store in localStorage in supabase format.
        const payload = JSON.stringify({
          access_token,
          refresh_token,
          expires_at: Math.floor(Date.now() / 1000) + 3600,
          expires_in: 3600,
          token_type: "bearer",
          user: null,
        });
        // Common project ref cookie/local storage names
        localStorage.setItem("sb-wvpsldwwjqdannqasrdf-auth-token", payload);
        document.cookie = `sb-wvpsldwwjqdannqasrdf-auth-token=${encodeURIComponent(payload)}; path=/; SameSite=Lax`;
        void key;
      },
      {
        access_token: session.access_token,
        refresh_token: session.refresh_token,
      },
    );
    // Use auth confirm setSession path with tokens in hash — most reliable for SSR cookies
    await page.goto(
      `${APP}/auth/confirm?next=${encodeURIComponent("/settings/billing")}#access_token=${encodeURIComponent(session.access_token)}&refresh_token=${encodeURIComponent(session.refresh_token)}&type=magiclink`,
      { waitUntil: "networkidle", timeout: 90000 },
    );
    await page.waitForTimeout(4000);
  }

  // Re-assert active venue after auth (bootstrap may restore prior cookie venue)
  await setActiveVenue(VENUE);
  await page.goto(`${APP}/settings/billing`, { waitUntil: "networkidle", timeout: 90000 });
  await page.waitForTimeout(2500);

  // Venue switcher if needed
  if (!(await page.locator("body").innerText()).includes("DISPOSABLE") &&
      !(await page.locator("body").innerText()).match(/Plan growth|Subscription/)) {
    const switcher = page.getByRole("button").filter({ hasText: /Willow|Fancy|DISPOSABLE|venue|Grove/i }).first();
    if (await switcher.count()) {
      await switcher.click().catch(() => {});
      await page.waitForTimeout(500);
      const item = page.getByText(/DISPOSABLE-P3-REHEARSAL/i).first();
      if (await item.count()) {
        await item.click();
        await page.waitForTimeout(2500);
        await page.goto(`${APP}/settings/billing`, { waitUntil: "networkidle", timeout: 90000 });
        await page.waitForTimeout(2500);
      }
    }
  }
}

const report: Record<string, unknown> = {
  expectedSha: EXPECTED,
  venueId: VENUE,
  steps: [] as unknown[],
};

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();

try {
  await establishVenueSession(page);
  await shot(page, "02-billing");
  const billingBody = await page.locator("body").innerText();
  save("02-billing-body.txt", billingBody.slice(0, 8000));
  save("02-billing-url.txt", page.url());

  const api = await page.evaluate(async () => {
    const res = await fetch("/api/billing/tier-upgrade", { credentials: "include" });
    const text = await res.text();
    try {
      return { status: res.status, json: JSON.parse(text) };
    } catch {
      return { status: res.status, text: text.slice(0, 500) };
    }
  });
  save("02-billing-api.json", JSON.stringify(api, null, 2));
  (report.steps as unknown[]).push({ billingApi: api, billingUrl: page.url() });

  const billingOk =
    api.status === 200 &&
    (api as { json?: Record<string, unknown> }).json?.currentPlan &&
    ((api as { json: { currentPlan: { name?: string } } }).json.currentPlan.name === "Celebrate") &&
    String((api as { json: { currentRecurringAmount?: string } }).json.currentRecurringAmount || "").includes("249") &&
    !(api as { json: { pendingUpgrade?: unknown } }).json.pendingUpgrade &&
    (api as { json: { lastAppliedUpgrade?: { fromPlanName?: string; toPlanName?: string } } }).json
      .lastAppliedUpgrade?.fromPlanName === "Gather" &&
    (api as { json: { lastAppliedUpgrade?: { toPlanName?: string } } }).json.lastAppliedUpgrade
      ?.toPlanName === "Celebrate" &&
    (api as { json: { volume?: { peakCount?: number } } }).json.volume?.peakCount === 26 &&
    /No pending upgrade/i.test(billingBody) &&
    /Celebrate/i.test(billingBody) &&
    /\$249/i.test(billingBody);

  (report.steps as unknown[]).push({
    billingUiOk: billingOk,
    bodyHasCelebrate: /Celebrate/i.test(billingBody),
    bodyHas249: /\$249/i.test(billingBody),
    bodyNoPending: /No pending upgrade/i.test(billingBody),
    bodyHasLastUpgrade: /Last completed upgrade/i.test(billingBody),
  });

  // --- Founder CRM ---
  const wsPage = await context.newPage();
  await wsPage.goto(`${WS}/login`, { waitUntil: "networkidle", timeout: 90000 });
  await shot(wsPage, "03-workspace-login");
  await wsPage.locator('input[type="email"], input[name="email"]').first().fill(EMAIL);
  await wsPage.locator('input[type="password"], input[name="password"]').first().fill("cheers-demo");
  await wsPage.getByRole("button", { name: /sign in|log in|continue/i }).click();
  await wsPage.waitForTimeout(3000);
  await shot(wsPage, "04-workspace-after-login");
  save("04-workspace-url.txt", wsPage.url());

  await wsPage.goto(`${WS}/tier-upgrades`, { waitUntil: "networkidle", timeout: 90000 });
  await wsPage.waitForTimeout(3000);
  await shot(wsPage, "05-crm-tier-upgrades");
  const crmBody = await wsPage.locator("body").innerText();
  save("05-crm-body.txt", crmBody.slice(0, 12000));

  const crmApi = await wsPage.evaluate(async () => {
    const res = await fetch("/api/relationships/tier-upgrades");
    return { status: res.status, json: await res.json() };
  });
  save("05-crm-api.json", JSON.stringify(crmApi, null, 2));
  const applied = (crmApi.json?.upgrades || []).find(
    (u: { id: string }) => u.id === "c31898c1-faea-4c17-a309-ac458d66dc78",
  );
  (report.steps as unknown[]).push({
    crmApiStatus: crmApi.status,
    appliedFound: Boolean(applied),
    applied,
    crmUrl: wsPage.url(),
  });

  const row = wsPage.locator("tr").filter({ hasText: /applied|Celebrate|Gather/i }).first();
  if (await row.count()) {
    await row.click().catch(() => {});
    await wsPage.waitForTimeout(800);
  }
  await shot(wsPage, "06-crm-applied-detail");

  const place = wsPage.getByRole("button", { name: /Place hold/i }).first();
  if (await place.count()) {
    await place.click();
    await wsPage.waitForTimeout(2500);
  }
  await shot(wsPage, "07-crm-hold-placed");
  const crmAfterPlace = await wsPage.evaluate(async () => {
    const res = await fetch("/api/relationships/tier-upgrades");
    return { status: res.status, json: await res.json() };
  });
  save("07-crm-after-place.json", JSON.stringify(crmAfterPlace, null, 2));
  const activeHold =
    (crmAfterPlace.json?.holds || []).find(
      (h: { venueId: string; active: boolean }) => h.venueId === VENUE && h.active,
    ) || null;
  (report.steps as unknown[]).push({ holdPlaced: Boolean(activeHold), hold: activeHold });

  const release = wsPage.getByRole("button", { name: /Release hold/i }).first();
  if (await release.count()) {
    await release.click();
    await wsPage.waitForTimeout(2500);
  } else if (activeHold?.id) {
    await wsPage.evaluate(async (holdId) => {
      await fetch("/api/relationships/tier-upgrades", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "release_hold",
          holdId,
          releaseReason: "Founder CRM acceptance release",
          actorEmail: EMAIL,
        }),
      });
    }, activeHold.id as string);
    await wsPage.reload({ waitUntil: "networkidle" });
    await wsPage.waitForTimeout(2000);
  }
  await shot(wsPage, "08-crm-hold-released");
  const crmAfterRelease = await wsPage.evaluate(async () => {
    const res = await fetch("/api/relationships/tier-upgrades");
    return { status: res.status, json: await res.json() };
  });
  save("08-crm-after-release.json", JSON.stringify(crmAfterRelease, null, 2));
  const stillActive = (crmAfterRelease.json?.holds || []).some(
    (h: { venueId: string; active: boolean }) => h.venueId === VENUE && h.active,
  );
  (report.steps as unknown[]).push({ holdReleased: !stillActive });

  // Unauthorized denial
  await context.clearCookies();
  const deniedPage = await context.newPage();
  const unauth = await deniedPage.evaluate(async (url) => {
    const res = await fetch(url);
    return { status: res.status, text: (await res.text()).slice(0, 500) };
  }, `${WS}/api/relationships/tier-upgrades`);
  save("09-unauth-api.json", JSON.stringify(unauth, null, 2));
  await deniedPage.goto(`${WS}/tier-upgrades`, { waitUntil: "networkidle", timeout: 90000 });
  await deniedPage.waitForTimeout(2000);
  await shot(deniedPage, "09-unauthorized-crm");
  save("09-unauthorized-url.txt", deniedPage.url());
  const unauthBody = await deniedPage.locator("body").innerText();
  save("09-unauthorized-body.txt", unauthBody.slice(0, 3000));
  const deniedUi =
    !deniedPage.url().includes("/tier-upgrades") ||
    /sign in|log in|email|password/i.test(unauthBody);
  (report.steps as unknown[]).push({ unauthApi: unauth, unauthUrl: deniedPage.url(), deniedUi });

  const venueOnly = await page.evaluate(async (url) => {
    try {
      const res = await fetch(url, { credentials: "include" });
      return { status: res.status, text: (await res.text()).slice(0, 400) };
    } catch (e) {
      return { error: String(e) };
    }
  }, `${WS}/api/relationships/tier-upgrades`);
  save("10-venue-staff-crm-denied.json", JSON.stringify(venueOnly, null, 2));
  (report.steps as unknown[]).push({ venueStaffCrmDenied: venueOnly });

  report.ok =
    billingOk &&
    crmApi.status === 200 &&
    Boolean(applied) &&
    Boolean(activeHold) &&
    !stillActive &&
    (unauth.status === 401 || unauth.status === 403 || deniedUi);
} finally {
  // Always restore Willow Grove for the human user
  await setActiveVenue(WILLOW);
  save("restored-active-venue.txt", WILLOW);
}

save("CLOSURE-REPORT.json", JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
await browser.close();
process.exit(report.ok ? 0 : 1);
