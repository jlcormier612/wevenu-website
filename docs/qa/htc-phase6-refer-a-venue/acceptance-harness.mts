/**
 * Phase 6 Sandbox API acceptance harness (disposable fixtures).
 *
 * Proves: submit → CRM list → attribute → mark paid → force qualify →
 * approve → issue subscription-scoped Stripe credit → readiness.
 *
 * Requires REFERRAL_PROGRAM_V1=true on serving SHA.
 * Stripe issue steps require REFERRAL_REWARD_ISSUE=true.
 *
 * Usage (from repo root, with .env.local loaded by caller):
 *   npx tsx docs/qa/htc-phase6-refer-a-venue/acceptance-harness.mts
 */

import { createClient } from "@supabase/supabase-js";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { config } from "dotenv";

config({ path: ".env.local", quiet: true });

const VENUE_APP =
  process.env.VENUE_APP_BASE_URL?.replace(/\/$/, "") ||
  "https://app.sandbox.hellotocheers.com";
const PRODUCT_KEY = process.env.PRODUCT_SYNC_API_KEY?.trim() || "";
const CRON_SECRET = process.env.CRON_SECRET?.trim() || "";
const AUTH = PRODUCT_KEY || CRON_SECRET;

const OUT = join(
  "docs/qa/htc-phase6-refer-a-venue",
  "acceptance",
  new Date().toISOString().replace(/[:.]/g, "-"),
);

if (!AUTH) {
  console.error("PRODUCT_SYNC_API_KEY or CRON_SECRET required");
  process.exit(1);
}

mkdirSync(OUT, { recursive: true });

async function internal(
  path: string,
  init?: RequestInit,
): Promise<{ status: number; json: any }> {
  const res = await fetch(`${VENUE_APP}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${AUTH}`,
      ...(init?.headers || {}),
    },
    cache: "no-store",
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, json };
}

function save(name: string, data: unknown) {
  writeFileSync(join(OUT, name), JSON.stringify(data, null, 2));
}

async function main() {
  const checks: Record<string, boolean> = {};

  const readiness = await internal("/api/internal/pricing/referrals");
  save("00-readiness.json", readiness);
  checks.readiness_ok = readiness.status === 200 && readiness.json?.ok === true;
  checks.program_ready = readiness.json?.readiness?.ready === true;
  const rewardIssueEnabled =
    readiness.json?.readiness?.rewardIssueEnabled === true;

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );

  // Disposable referrer: prefer known Phase 5 venue if present
  const referrerVenueId =
    process.env.REFERRAL_ACCEPTANCE_REFERRER_VENUE_ID?.trim() ||
    "9336a6cb-6a49-4a38-82bc-ff3b2361e8a3";

  const { data: referrer } = await supabase
    .from("venues")
    .select(
      "id, name, saas_stripe_subscription_id, saas_stripe_customer_id, saas_plan_key, saas_subscription_status",
    )
    .eq("id", referrerVenueId)
    .maybeSingle();

  save("01-referrer.json", referrer);
  checks.referrer_loaded = Boolean(referrer?.saas_stripe_subscription_id);

  // Create disposable referred venue row (no Stripe purchase in this harness —
  // founder attribution + synthetic paid invoice timestamps are used, then
  // Stripe credit is issued against the referrer subscription only).
  const stamp = Date.now();
  const referredName = `DISPOSABLE-P6-REF-${stamp}`;
  const { data: referrerOwner } = await supabase
    .from("venues")
    .select("owner_user_id")
    .eq("id", referrerVenueId)
    .maybeSingle();

  const { data: referred, error: referredErr } = await supabase
    .from("venues")
    .insert({
      name: referredName,
      website: `https://p6-ref-${stamp}.test`,
      owner_user_id: referrerOwner?.owner_user_id,
      saas_plan_key: "starter",
      saas_subscription_status: "active",
      saas_stripe_subscription_id: `sub_fake_p6_${stamp}`,
      saas_stripe_customer_id: `cus_fake_p6_${stamp}`,
    })
    .select("id, name, website")
    .single();
  save("02-referred-create.json", { referred, referredErr });
  checks.referred_created = Boolean(referred?.id);

  // Direct store submission via internal isn't exposed for venue auth —
  // insert referral row via service path using internal founder actions after
  // creating through Postgres for disposable isolation.
  const { data: referral, error: referralErr } = await supabase
    .from("saas_venue_referrals")
    .insert({
      referring_venue_id: referrerVenueId,
      referred_venue_name: referredName,
      referred_city: "Austin",
      referred_state: "TX",
      referred_website: `https://p6-ref-${stamp}.test`,
      referred_website_domain: `p6-ref-${stamp}.test`,
      referred_contact_email: `contact+p6-${stamp}@hellotocheers.com`,
      referred_contact_name: "P6 Contact",
      status: "submitted",
      program_policy_version: "referral_v1",
      qualification_days: 30,
      submitted_by_email: "jennifer@hellotocheers.com",
      metadata: { disposable: true, harness: "phase6" },
    })
    .select("*")
    .single();
  save("03-referral-insert.json", { referral, referralErr });
  checks.referral_inserted = Boolean(referral?.id);

  if (!referral?.id || !referred?.id) {
    save("REPORT.json", { ok: false, checks, out: OUT });
    console.error("Fixture create failed", checks);
    process.exit(1);
  }

  const list = await internal("/api/internal/pricing/referrals?search=DISPOSABLE-P6");
  save("04-crm-list.json", list);
  checks.crm_lists_referral = (list.json?.referrals ?? []).some(
    (r: any) => r.id === referral.id,
  );

  const attr = await internal("/api/internal/pricing/referrals", {
    method: "POST",
    body: JSON.stringify({
      action: "attribute",
      referralId: referral.id,
      referredVenueId: referred.id,
      matchMethod: "founder_confirmed",
      actorEmail: "phase6-harness@hellotocheers.com",
    }),
  });
  save("05-attribute.json", attr);
  checks.attributed = attr.status === 200 && attr.json?.ok === true;

  const paidAt = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000).toISOString();
  const markPaid = await internal("/api/internal/pricing/referrals", {
    method: "POST",
    body: JSON.stringify({
      action: "mark_paid",
      attributionId: attr.json?.attribution?.id,
      firstPaidInvoiceId: `in_fake_p6_${stamp}`,
      firstPaidInvoiceAt: paidAt,
      actorEmail: "phase6-harness@hellotocheers.com",
    }),
  });
  save("06-mark-paid.json", markPaid);
  checks.marked_paid = markPaid.status === 200 && markPaid.json?.ok === true;

  const qualify = await internal("/api/internal/pricing/referrals", {
    method: "POST",
    body: JSON.stringify({
      action: "evaluate_qualification",
      attributionId: attr.json?.attribution?.id,
      forceNow: true,
      actorEmail: "phase6-harness@hellotocheers.com",
    }),
  });
  save("07-qualify.json", qualify);
  checks.qualified =
    qualify.status === 200 &&
    qualify.json?.reward?.status === "eligible" &&
    Number(qualify.json?.reward?.rewardAmountCents) > 0;

  const approve = await internal("/api/internal/pricing/referrals", {
    method: "POST",
    body: JSON.stringify({
      action: "approve_reward",
      rewardId: qualify.json?.reward?.id,
      actorEmail: "phase6-harness@hellotocheers.com",
      notes: "Phase 6 harness approval",
    }),
  });
  save("08-approve.json", approve);
  checks.approved =
    approve.status === 200 && approve.json?.reward?.status === "approved";

  if (rewardIssueEnabled) {
    const issue = await internal("/api/internal/pricing/referrals", {
      method: "POST",
      body: JSON.stringify({
        action: "issue_reward",
        rewardId: qualify.json?.reward?.id,
        actorEmail: "phase6-harness@hellotocheers.com",
      }),
    });
    save("09-issue.json", issue);
    checks.issued =
      issue.status === 200 &&
      issue.json?.reward?.status === "issued" &&
      Boolean(issue.json?.reward?.stripeInvoiceItemId);
    checks.issue_amount_matches =
      issue.json?.reward?.rewardAmountCents ===
      qualify.json?.reward?.rewardAmountCents;
  } else {
    checks.issued = false;
    checks.issue_skipped_flag_off = true;
    save("09-issue.json", {
      skipped: true,
      reason: "REFERRAL_REWARD_ISSUE=false",
    });
  }

  const detail = await internal(
    `/api/internal/pricing/referrals?referralId=${encodeURIComponent(referral.id)}`,
  );
  save("10-detail.json", detail);

  const report = {
    ok:
      checks.readiness_ok &&
      checks.program_ready &&
      checks.referral_inserted &&
      checks.crm_lists_referral &&
      checks.attributed &&
      checks.marked_paid &&
      checks.qualified &&
      checks.approved &&
      (rewardIssueEnabled ? checks.issued && checks.issue_amount_matches : true),
    rewardIssueEnabled,
    checks,
    referralId: referral.id,
    referredVenueId: referred.id,
    referrerVenueId,
    rewardAmountCents: qualify.json?.reward?.rewardAmountCents ?? null,
    stripeInvoiceItemId:
      detail.json?.reward?.stripeInvoiceItemId ?? null,
    out: OUT,
  };
  save("REPORT.json", report);
  writeFileSync(
    join("docs/qa/htc-phase6-refer-a-venue", "FINAL-API-ACCEPTANCE.json"),
    JSON.stringify(report, null, 2),
  );
  console.log(JSON.stringify(report, null, 2));
  process.exit(report.ok ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
