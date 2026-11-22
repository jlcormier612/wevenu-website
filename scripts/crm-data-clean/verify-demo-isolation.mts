/**
 * Safeguard verification — file-store isolated (default) or live with disposable cleanup.
 *
 * Proves:
 * 1) Demo-venue sync stamps sandbox_demo and does not pollute operational MRR
 * 2) Ordinary non-demo Sandbox venue remains operational
 * 3) Demo Stripe customer subscription does not create operational MRR
 * 4) Disposable fixture is board-visible but non-operational
 *
 * Does not call Stripe / venue-app / Auth APIs.
 *
 *   npx tsx scripts/crm-data-clean/verify-demo-isolation.mts
 */
import { mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  DISPOSABLE_FIXTURE_GUIDE,
  filterOperationalRelationships,
  findOrCreateRelationship,
  ingestProductFeedback,
  ingestSubscriptionPurchased,
  isOperationalRelationship,
  loadLiveStore,
  resolveCrmRole,
  SANDBOX_DEMO_VENUE_IDS,
  saveLiveStore,
  emptyLiveStore,
  stampCrmIsolation,
} from "../../shared/relationships/index.ts";

const FANCY = "a415ac52-cd74-42a6-8df7-7a8f6e71d080";

async function main() {
  const dir = join(tmpdir(), `htc-demo-isolation-${Date.now()}`);
  mkdirSync(dir, { recursive: true });
  process.env.HTC_CRM_STORE = "file";
  process.env.RELATIONSHIPS_DATA_PATH = dir;

  await saveLiveStore(emptyLiveStore());

  // 1) Demo Fancy feedback → sandbox_demo, not operational
  const fancyFb = await ingestProductFeedback({
    productVenueId: FANCY,
    email: "jennifer@hellotocheers.com",
    venueName: "Jen's Fancy Venue",
    firstName: "Jen",
    lastName: "Fancy",
    feedbackType: "nps",
    subject: "NPS isolation probe",
    body: "verify-demo-isolation",
    rating: 7,
  });
  if (!fancyFb) throw new Error("Fancy feedback failed to create/match");
  stampCrmIsolation(fancyFb.relationship, { productVenueId: FANCY });
  // re-load after ingest already stamped via mutateRelationship
  let store = await loadLiveStore();
  const fancyRel = store.relationships.find(
    (r) => r.productSync?.venueId === FANCY,
  );
  if (!fancyRel) throw new Error("Fancy relationship missing");
  if (resolveCrmRole(fancyRel) !== "sandbox_demo") {
    throw new Error(`Fancy crmRole=${fancyRel.crmRole} expected sandbox_demo`);
  }
  if (isOperationalRelationship(fancyRel)) {
    throw new Error("Fancy must not be operational");
  }

  // 2) Ordinary non-demo Sandbox venue → customer / operational
  const ordinary = await findOrCreateRelationship({
    email: "ordinary.sandbox.buyer@example.com",
    venueName: "Ordinary Sandbox Acceptance Venue",
    firstName: "Ordinary",
    lastName: "Buyer",
  });
  // Bind a non-registry product venue id (simulates real Sandbox venue)
  ordinary.relationship.productSync = {
    status: "idle",
    steps: [],
    adapter: "local",
    venueId: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
  };
  stampCrmIsolation(ordinary.relationship, {
    productVenueId: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
  });
  await saveLiveStore(await loadLiveStore().then(async (s) => {
    const r = s.relationships.find((x) => x.id === ordinary.relationship.id);
    if (r) {
      r.productSync = ordinary.relationship.productSync;
      stampCrmIsolation(r, {
        productVenueId: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
      });
    }
    return s;
  }));

  store = await loadLiveStore();
  const ord = store.relationships.find((r) => r.id === ordinary.relationship.id)!;
  if (resolveCrmRole(ord) !== "customer") {
    throw new Error(`Ordinary crmRole=${ord.crmRole}`);
  }
  if (!isOperationalRelationship(ord)) {
    throw new Error("Ordinary must be operational");
  }

  // 3) Demo Stripe customer purchase → not operational MRR
  const demoCus = [...SANDBOX_DEMO_VENUE_IDS].length
    ? "cus_VOQ2dBHYRsuMBS"
    : "";
  const demoPurchase = await ingestSubscriptionPurchased({
    email: "jlcormier612@gmail.com",
    venueName: "Juniper Valley Farm",
    stripeCustomerId: demoCus,
    stripeSubscriptionId: "sub_verify_isolation_demo_only",
    plan: "flourish",
    mrrCents: 29900,
    foundingMember: true,
    welcomeBackRequested: false,
    onboardingType: "self_guided",
  });
  store = await loadLiveStore();
  const demoRel = store.relationships.find(
    (r) => r.id === demoPurchase.relationship.id,
  )!;
  if (isOperationalRelationship(demoRel)) {
    throw new Error("Demo Stripe purchase must not be operational");
  }
  const opsSubs = store.subscriptions.filter((s) => {
    const parent = store.relationships.find((r) => r.id === s.relationshipId);
    return parent ? isOperationalRelationship(parent) : false;
  });
  const opsMrr = opsSubs
    .filter((s) => s.status === "active" || s.status === "trialing")
    .reduce((sum, s) => sum + (s.mrrCents || 0), 0);
  if (opsMrr !== 0) {
    // ordinary has no sub yet — ops MRR must stay 0 despite demo 29900
    throw new Error(`ops MRR ${opsMrr} expected 0`);
  }

  // 4) Disposable fixture — non-ops metrics, classified disposable
  const disp = await findOrCreateRelationship({
    email: `accept${DISPOSABLE_FIXTURE_GUIDE.emailLocalPartSuffix}hellotocheers.com`,
    venueName: `${DISPOSABLE_FIXTURE_GUIDE.venueNamePrefix.replace("{ticket}", "VERIFY")} Isolation`,
    firstName: "Disposable",
    lastName: "Fixture",
  });
  store = await loadLiveStore();
  const dispRel = store.relationships.find((r) => r.id === disp.relationship.id)!;
  if (resolveCrmRole(dispRel) !== "disposable") {
    throw new Error(`Disposable crmRole=${dispRel.crmRole}`);
  }
  if (isOperationalRelationship(dispRel)) {
    throw new Error("Disposable must not be operational");
  }

  const ops = filterOperationalRelationships(store.relationships);
  if (ops.length !== 1 || ops[0].id !== ord.id) {
    throw new Error(
      `Expected sole operational ${ord.id}; got ${ops.map((r) => r.id).join(",")}`,
    );
  }

  rmSync(dir, { recursive: true, force: true });
  console.log(
    JSON.stringify(
      {
        ok: true,
        demoVenueCount: SANDBOX_DEMO_VENUE_IDS.size,
        checks: [
          "fancy_feedback_sandbox_demo",
          "ordinary_sandbox_customer_operational",
          "demo_stripe_sub_excluded_from_ops_mrr",
          "disposable_classified_non_ops",
        ],
      },
      null,
      2,
    ),
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
