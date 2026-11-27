/**
 * Batch 1 — Browser capture of first Templates visit for a freshly provisioned
 * disposable Sandbox venue (before opening any resource section).
 *
 * Requires local venue app on http://localhost:3000 (this branch).
 *
 * Run:
 *   /opt/homebrew/bin/node --import tsx docs/qa/launch-batch1-starter-first-visit/capture-first-visit.mts
 */
import { createClient } from "@supabase/supabase-js";
import * as ssrUtils from "@supabase/ssr";
import { config } from "dotenv";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { randomBytes } from "node:crypto";
import { chromium, devices } from "playwright";

config({ path: join(process.cwd(), ".env.local"), quiet: true });

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, "shots");
mkdirSync(OUT_DIR, { recursive: true });

const url = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim();
const serviceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
const anonKey = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "").trim();
const appOrigin = (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").trim();
if (!url.includes("wvpsldwwjqdannqasrdf")) throw new Error("Sandbox only");
if (!serviceKey || !anonKey) throw new Error("Supabase keys required");

const admin = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const anon = createClient(url, anonKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const { provisionWorkspaceFromEnrollment } = await import(
  "@/lib/provisioning/workspace"
);

const stamp = Date.now();
const ownerEmail = `batch1-capture-${stamp}@hellotocheers-test.invalid`;
const password = `E2E-${randomBytes(18).toString("base64url")}`;
const venueName = `Batch1 Capture ${stamp}`;

const { data: createdUser, error: userErr } = await admin.auth.admin.createUser({
  email: ownerEmail,
  password,
  email_confirm: true,
  user_metadata: { full_name: "Batch1 Capture" },
});
if (userErr || !createdUser.user) throw new Error(userErr?.message ?? "createUser");

const { data: enrollment, error: enrollErr } = await admin
  .from("venue_enrollments")
  .insert({
    stripe_checkout_session_id: `cs_test_batch1cap_${stamp}`,
    stripe_customer_id: `cus_test_batch1cap_${stamp}`,
    stripe_subscription_id: `sub_test_batch1cap_${stamp}`,
    venue_name: venueName,
    owner_email: ownerEmail,
    owner_first_name: "Batch1",
    owner_last_name: "Capture",
    plan: "standard",
    onboarding_type: "self_setup",
    status: "pending",
  })
  .select("id")
  .single();
if (enrollErr || !enrollment) throw new Error(enrollErr?.message ?? "enrollment");

const provisioned = await provisionWorkspaceFromEnrollment({
  enrollmentId: enrollment.id,
  ownerUserId: createdUser.user.id,
});
if (!provisioned.ok) throw new Error(provisioned.error);
const venueId = provisioned.venueId;

// Activation-equivalent ownership (same as activate_venue_enrollment when
// purchaser_is_owner=true) so the owner can open the app. Does not re-seed
// starters — those were completed during provisionWorkspaceFromEnrollment.
const { error: ownErr } = await admin.rpc("provision_enrollment_venue", {
  p_enrollment_id: enrollment.id,
  p_owner_user_id: createdUser.user.id,
  p_is_owner: true,
});
if (ownErr) throw ownErr;
await admin.from("venues").update({ setup_completed: true }).eq("id", venueId);
await admin.from("venue_enrollments").update({ status: "activated" }).eq("id", enrollment.id);

const { data: legalDocs } = await admin
  .from("legal_documents")
  .select("id,version")
  .eq("is_active", true)
  .eq("is_published", true);
for (const doc of legalDocs ?? []) {
  const { error: legalErr } = await admin.from("legal_acceptances").insert({
    user_id: createdUser.user.id,
    legal_document_id: doc.id,
    accepted_version: doc.version,
    acceptance_method: "Venue Signup",
    accepted_at: new Date().toISOString(),
  });
  if (legalErr && !/duplicate|unique/i.test(legalErr.message)) {
    console.warn("legal accept warn", legalErr.message);
  }
}

console.log("provisioned+activated", {
  venueId,
  venueName,
  ownerEmail,
  starters: provisioned.starters.status,
});

async function staffCookies(email: string, activeVenueId: string) {
  const { data: link, error: linkErr } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
  });
  if (linkErr || !link?.properties?.hashed_token) {
    throw new Error(linkErr?.message ?? "generateLink");
  }
  const { data: otp, error } = await anon.auth.verifyOtp({
    type: "email",
    token_hash: link.properties.hashed_token,
  });
  if (error || !otp?.session) throw error ?? new Error("session");

  const cookieName = "sb-wvpsldwwjqdannqasrdf-auth-token";
  const encoded = "base64-" + ssrUtils.stringToBase64URL(JSON.stringify(otp.session));
  const host = new URL(appOrigin).hostname;
  const secure = appOrigin.startsWith("https");
  return [
    ...ssrUtils.createChunks(cookieName, encoded).map((c: { name: string; value: string }) => ({
      name: c.name,
      value: c.value,
      domain: host,
      path: "/",
      httpOnly: false,
      secure,
      sameSite: "Lax" as const,
    })),
    {
      name: "htc_active_venue_id",
      value: activeVenueId,
      domain: host,
      path: "/",
      httpOnly: false,
      secure,
      sameSite: "Lax" as const,
    },
  ];
}

const browser = await chromium.launch({ headless: true });

async function capture(
  label: string,
  contextOptions: Parameters<typeof browser.newContext>[0],
) {
  const context = await browser.newContext(contextOptions);
  await context.addCookies(await staffCookies(ownerEmail, venueId));
  const page = await context.newPage();

  const t0 = Date.now();
  await page.goto(`${appOrigin}/library`, { waitUntil: "domcontentloaded", timeout: 120_000 });
  // Dismiss first-run modals if present (legal already accepted via DB).
  for (let i = 0; i < 8; i++) {
    const body = await page.locator("body").innerText().catch(() => "");
    if (/library-commercial-ia|Packages & Pricing|Templates/i.test(body) &&
        !/Welcome to Hello to Cheers|Before you continue/i.test(body)) {
      break;
    }
    const btn = page.getByRole("button", {
      name: /Continue|Get started|Let's go|Skip|Got it|Maybe later|Close|I agree/i,
    }).first();
    if (await btn.count()) {
      await btn.click({ timeout: 2000 }).catch(() => undefined);
      await page.waitForTimeout(400);
      continue;
    }
    break;
  }
  if (!page.url().includes("/library")) {
    await page.goto(`${appOrigin}/library`, { waitUntil: "domcontentloaded", timeout: 60_000 });
  }
  await page.waitForSelector('[data-testid="library-commercial-ia"]', { timeout: 90_000 });
  const loadMs = Date.now() - t0;

  await page.screenshot({
    path: join(OUT_DIR, `${label}-01-templates-first-visit-top.png`),
    fullPage: false,
  });
  await page.screenshot({
    path: join(OUT_DIR, `${label}-02-templates-first-visit-full.png`),
    fullPage: true,
  });

  const text = await page.locator('[data-testid="library-commercial-ia"]').innerText();
  const templateBadges = await page.getByText("Template", { exact: true }).count();
  const catalogBadges = await page.getByText("Catalog", { exact: true }).count();
  const mutedCounts: Record<string, string | null> = {};
  for (const title of [
    "Packages & Pricing",
    "Available Inventory",
    "Event Order Templates",
    "Offerings Catalog",
    "Planning Templates",
    "Timeline Templates",
    "Message Templates",
    "Contract Templates",
  ]) {
    const card = page.locator(".htc-toolbox-card", { hasText: title }).first();
    const badgeText = (await card.locator(".inline-flex, [class*='badge']").allInnerTexts().catch(() => [])) as string[];
    mutedCounts[title] = badgeText.join(" | ") || null;
  }

  await context.close();
  return {
    loadMs,
    templateBadges,
    catalogBadges,
    mutedCounts,
    textSnippet: text.slice(0, 1500),
    url: page.url(),
  };
}

const desktop = await capture("desktop", { viewport: { width: 1280, height: 900 } });
const mobile = await capture("mobile", { ...devices["iPhone 13"] });
await browser.close();

const meta = {
  generatedAt: new Date().toISOString(),
  venueId,
  venueName,
  ownerEmail,
  appOrigin,
  provisionStarters: provisioned.starters,
  desktop,
  mobile,
  note: "Captured on first /library navigation after provision; no resource section opened beforehand.",
};
writeFileSync(join(__dirname, "capture-results.json"), JSON.stringify(meta, null, 2));
console.log(JSON.stringify(meta, null, 2));
console.log("shots in", OUT_DIR);
