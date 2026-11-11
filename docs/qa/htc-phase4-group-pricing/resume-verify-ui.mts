/**
 * Resume Phase 4 acceptance UI + Stripe confirmation after payment/activation.
 * Fixtures from the successful paid journey (Prop A + Prop B).
 */
import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import { mkdirSync, writeFileSync } from "node:fs";

config({ path: "/Users/jensmac/Developer/wevenu-website/.env.local", quiet: true });

const OUT =
  "/Users/jensmac/Developer/wevenu-website/docs/qa/htc-phase4-group-pricing/browser";
mkdirSync(OUT, { recursive: true });
const APP = "https://app.sandbox.hellotocheers.com";
const WS = "https://workspace.sandbox.hellotocheers.com";
const EMAIL = "jennifer@hellotocheers.com";
const JEN = "2fa73101-337b-4530-8c77-f3c272c5463e";
const PROP_A = "4609a143-556c-4eb3-b64e-fc64f2dc19f8";
const PROP_B = "d2063d3c-108b-40ab-af02-d17578d6d96e";
const ORG = "90efb537-aa7e-4302-8f38-1c4d6e196d99";
const SUB_A = "sub_1Ua0PFErUqJH7nktG6NBEFXb";
const SUB_B = "sub_1Ua1GUErUqJH7nktqmmVOnB3";
const CUS_A = "cus_VbCogr9Mnehst8";

const report: Record<string, unknown> = { ok: false, steps: [] as unknown[] };
function step(name: string, detail: Record<string, unknown> = {}) {
  (report.steps as unknown[]).push({ name, at: new Date().toISOString(), ...detail });
  console.log(`STEP ${name}`, detail);
}

async function setActiveVenue(venueId: string) {
  const sb = process.env.NEXT_PUBLIC_SUPABASE_URL!.replace(/\/$/, "");
  const sr = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  await fetch(`${sb}/rest/v1/venue_staff_active_context?user_id=eq.${JEN}`, {
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

async function prepareVenueAccess(venueId: string, venueName: string) {
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
  const now = new Date().toISOString();
  await admin
    .from("venues")
    .update({
      setup_completed: true,
      setup_completed_at: now,
      onboarding_dismissed: true,
    })
    .eq("id", venueId);
  await admin.from("venue_onboarding_intake").upsert(
    {
      venue_id: venueId,
      path: "self_setup",
      venue_name: venueName,
      space_mode: "one",
      spaces: [{ name: "Main Space", maxCapacity: null }],
      offers_tours: true,
      inquiry_sources: [],
      bring_business_choice: "starting_fresh",
      submitted_at: now,
      primary_contact_name: "Jennifer Cormier",
      contact_email: EMAIL,
    },
    { onConflict: "venue_id" },
  );
}

async function main() {
  const stripeKey = process.env.STRIPE_SECRET_KEY!;
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );

  // --- H. Stripe confirmation ---
  const subA = await (
    await fetch(
      `https://api.stripe.com/v1/subscriptions/${SUB_A}?expand[]=discounts`,
      { headers: { Authorization: `Bearer ${stripeKey}` } },
    )
  ).json();
  const couponA =
    subA.discounts?.[0]?.source?.coupon ||
    subA.discount?.coupon?.id ||
    null;
  const previewA = await (
    await fetch("https://api.stripe.com/v1/invoices/create_preview", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${stripeKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: `customer=${CUS_A}&subscription=${SUB_A}`,
    })
  ).json();
  writeFileSync(`${OUT}/resume-prop-a-stripe.json`, JSON.stringify({ subA, previewA }, null, 2));
  step("H_prop_a_stripe", {
    subscriptionId: subA.id,
    coupon: couponA,
    previewTotal: previewA.total,
    previewDue: previewA.amount_due,
    sameAnchor: subA.billing_cycle_anchor,
  });
  if (couponA !== "htc_group_10_forever") {
    throw new Error(`Prop A coupon ${couponA} !== htc_group_10_forever`);
  }
  if (previewA.total !== 17910 && previewA.amount_due !== 17910) {
    throw new Error(`Prop A preview ${previewA.total}/${previewA.amount_due} !== 17910`);
  }

  const subB = await (
    await fetch(
      `https://api.stripe.com/v1/subscriptions/${SUB_B}?expand[]=latest_invoice&expand[]=discounts`,
      { headers: { Authorization: `Bearer ${stripeKey}` } },
    )
  ).json();
  const invB =
    typeof subB.latest_invoice === "object" ? subB.latest_invoice : null;
  const couponB = subB.discounts?.[0]?.source?.coupon || null;
  writeFileSync(`${OUT}/resume-prop-b-stripe.json`, JSON.stringify({ subB }, null, 2));
  step("H_prop_b_stripe", {
    subscriptionId: subB.id,
    coupon: couponB,
    invoiceId: invB?.id,
    invoicePaid: invB?.amount_paid,
  });
  if (couponB !== "htc_group_10_forever" || invB?.amount_paid !== 17910) {
    throw new Error("Prop B group invoice/coupon mismatch");
  }

  const { data: members } = await admin
    .from("saas_organization_memberships")
    .select("*")
    .eq("organization_id", ORG)
    .eq("status", "active");
  const { data: adj } = await admin
    .from("saas_group_billing_adjustments")
    .select("*")
    .eq("organization_id", ORG)
    .order("created_at", { ascending: false });
  step("G_org", {
    membershipCount: members?.length,
    adjustmentStatus: adj?.[0]?.status,
    adjustmentCoupon: adj?.[0]?.desired_stripe_coupon_id,
  });
  if ((members?.length ?? 0) < 2) throw new Error("Need 2 active memberships");
  if (adj?.[0]?.status !== "applied") throw new Error("Prop A adjustment not applied");

  await prepareVenueAccess(PROP_A, "[DISPOSABLE-P4-PROP-A]");
  await prepareVenueAccess(PROP_B, "[DISPOSABLE-P4-PROP-B]");

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
  try {
    const sbUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const service = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    await setActiveVenue(PROP_A);
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
    const link = (await gen.json()) as { hashed_token?: string };
    await page.goto(
      `${APP}/auth/confirm?token_hash=${encodeURIComponent(link.hashed_token!)}&type=magiclink&next=${encodeURIComponent("/settings/billing")}`,
      { waitUntil: "domcontentloaded", timeout: 90000 },
    );
    await page.waitForTimeout(4000);
    await setActiveVenue(PROP_A);
    await page.goto(`${APP}/settings/billing`, {
      waitUntil: "networkidle",
      timeout: 90000,
    });
    await page.waitForTimeout(3000);
    await page.screenshot({ path: `${OUT}/resume-22-property-a-billing.png`, fullPage: true });
    const aText = await page.locator("body").innerText();
    const orgApiA = await page.evaluate(async () => {
      const res = await fetch("/api/billing/organization");
      return { status: res.status, body: await res.json().catch(() => null) };
    });
    writeFileSync(`${OUT}/resume-org-api-a.json`, JSON.stringify(orgApiA, null, 2));
    step("I_billing_a", {
      url: page.url(),
      groupEligible: Boolean(orgApiA.body?.groupEligible),
      qualifying: orgApiA.body?.qualifyingVenueCount,
      addAvailable: orgApiA.body?.addAnotherVenueAvailable,
      hasOrg: Boolean(orgApiA.body?.organization),
      hasAddButton: /Add Another Venue/i.test(aText),
    });
    if (!orgApiA.body?.groupEligible || orgApiA.body?.qualifyingVenueCount < 2) {
      throw new Error("Property A Billing not group-eligible with 2 venues");
    }

    await setActiveVenue(PROP_B);
    await page.goto(`${APP}/settings/billing`, {
      waitUntil: "networkidle",
      timeout: 90000,
    });
    await page.waitForTimeout(3000);
    await page.screenshot({ path: `${OUT}/resume-23-property-b-billing.png`, fullPage: true });
    const orgApiB = await page.evaluate(async () => {
      const res = await fetch("/api/billing/organization");
      return { status: res.status, body: await res.json().catch(() => null) };
    });
    writeFileSync(`${OUT}/resume-org-api-b.json`, JSON.stringify(orgApiB, null, 2));
    step("I_billing_b", {
      url: page.url(),
      groupEligible: Boolean(orgApiB.body?.groupEligible),
      orgId: orgApiB.body?.organization?.id,
      sameOrg: orgApiB.body?.organization?.id === ORG,
    });

    // Founder CRM — workspace uses program4 password login (not Supabase magic link).
    await page.goto(`${WS}/login`, { waitUntil: "networkidle", timeout: 90000 });
    await page.locator('input[type="email"], input[name="email"]').first().fill(EMAIL);
    await page
      .locator('input[type="password"], input[name="password"]')
      .first()
      .fill("cheers-demo");
    await page.getByRole("button", { name: /sign in|log in|continue/i }).click();
    await page.waitForTimeout(3000);
    await page.goto(`${WS}/organizations`, {
      waitUntil: "networkidle",
      timeout: 90000,
    });
    await page.waitForTimeout(3000);
    await page.screenshot({
      path: `${OUT}/resume-24-crm-organizations.png`,
      fullPage: true,
    });
    const crmText = await page.locator("body").innerText();
    const crmApi = await page.evaluate(async () => {
      const res = await fetch("/api/relationships/organizations");
      const text = await res.text();
      try {
        return { status: res.status, body: JSON.parse(text) };
      } catch {
        return { status: res.status, body: text.slice(0, 500) };
      }
    }).catch((e) => ({ status: 0, body: String(e) }));
    writeFileSync(`${OUT}/resume-crm-api.json`, JSON.stringify(crmApi, null, 2));
    const orgs = Array.isArray((crmApi.body as { organizations?: unknown[] })?.organizations)
      ? (crmApi.body as { organizations: Array<Record<string, unknown>> }).organizations
      : [];
    const ourOrg = orgs.find((o) => o.id === ORG || /DISPOSABLE-P4/i.test(JSON.stringify(o)));
    step("J_crm", {
      url: page.url(),
      hasDisposable: /DISPOSABLE-P4/i.test(crmText) || Boolean(ourOrg),
      apiStatus: crmApi.status,
      orgCount: orgs.length,
      ourOrg: ourOrg
        ? {
            id: ourOrg.id,
            qualifyingVenueCount: ourOrg.qualifyingVenueCount,
            groupEligible: ourOrg.groupEligible,
            memberCount: Array.isArray(ourOrg.members) ? ourOrg.members.length : null,
          }
        : null,
    });
    if (crmApi.status !== 200 || !ourOrg) {
      throw new Error("Founder CRM organizations verification failed");
    }

    report.ok = true;
    step("DONE", { ok: true });
  } finally {
    writeFileSync(`${OUT}/resume-report.json`, JSON.stringify(report, null, 2));
    await browser.close();
  }
  if (!report.ok) process.exit(1);
}

await main();
