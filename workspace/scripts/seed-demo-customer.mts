/**
 * Seed a demo subscribed customer for Customer Success (no Stripe).
 *
 * Run from repo root:
 *   npx tsx workspace/scripts/seed-demo-customer.mts
 *   npx tsx workspace/scripts/seed-demo-customer.mts --renewal-window
 *   npx tsx workspace/scripts/seed-demo-customer.mts --renewed
 *
 * Idempotent: finds by email (or venue name), creates/subscribes once, then
 * refreshes CS snapshot fields on re-run. Does not touch Elloby Farm.
 *
 * Flags (Jennifer renewal testing):
 *   --renewal-window  backdate subscribedAt so today is ~45 days before anniversary
 *   --renewed         backdate so today is the day after anniversary (+1)
 */
import {
  createManualSubscription,
  findOrCreateRelationship,
  initialRenewalDateIso,
  loadLiveStore,
  mutateRelationship,
  refreshRelationshipHealth,
  withLiveStore,
  type ProductSyncState,
} from "../../shared/relationships/index.ts";
import {
  PRODUCT_SYNC_STEP_LABELS,
  type ProductSyncStepId,
} from "../../shared/product-sync/types.ts";

const DEMO = {
  email: "jennifer+demo-daisy@hellotocheers.com",
  venueName: "Sweet Daisy Barn & Farm",
  city: "Woodstock",
  state: "VT",
  website: "https://sweetdaisy.example.com",
  firstName: "Daisy",
  lastName: "Harper",
  phone: "(802) 555-0142",
  planId: "celebrate" as const,
  planName: "Celebrate",
  mrrCents: 24900,
  foundingMember: true,
  notes: "Demo subscribed customer for CS snapshot (no Stripe).",
};

const args = new Set(process.argv.slice(2));
const WANT_RENEWAL_WINDOW = args.has("--renewal-window");
const WANT_RENEWED = args.has("--renewed");

function daysAgo(days: number): string {
  return new Date(Date.now() - days * 86_400_000).toISOString();
}

/**
 * Build subscribedAt so anniversary (subscribedAt + 1 UTC year) is
 * `daysUntilAnniversary` days from today (UTC day).
 */
function subscribedAtForDaysUntilRenewal(daysUntilAnniversary: number): string {
  const now = new Date();
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const anniversary = new Date(today + daysUntilAnniversary * 86_400_000);
  return new Date(
    Date.UTC(
      anniversary.getUTCFullYear() - 1,
      anniversary.getUTCMonth(),
      anniversary.getUTCDate(),
      12,
      0,
      0,
    ),
  ).toISOString();
}

/**
 * Build subscribedAt so today is `daysAfterAnniversary` days after the
 * first anniversary (renewed day when daysAfterAnniversary === 1).
 */
function subscribedAtForDaysAfterRenewal(daysAfterAnniversary: number): string {
  const now = new Date();
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const anniversary = new Date(today - daysAfterAnniversary * 86_400_000);
  return new Date(
    Date.UTC(
      anniversary.getUTCFullYear() - 1,
      anniversary.getUTCMonth(),
      anniversary.getUTCDate(),
      12,
      0,
      0,
    ),
  ).toISOString();
}

function midOnboardingProductSync(now: string): ProductSyncState {
  const done = (id: ProductSyncStepId, resourceId: string) => ({
    id,
    label: PRODUCT_SYNC_STEP_LABELS[id],
    status: "completed" as const,
    resourceId,
    completedAt: daysAgo(10),
    simulated: true,
  });
  const running = (id: ProductSyncStepId) => ({
    id,
    label: PRODUCT_SYNC_STEP_LABELS[id],
    status: "running" as const,
    simulated: true,
  });
  const pending = (id: ProductSyncStepId) => ({
    id,
    label: PRODUCT_SYNC_STEP_LABELS[id],
    status: "pending" as const,
  });

  return {
    status: "running",
    adapter: "local",
    startedAt: daysAgo(12),
    lastRunAt: now,
    lastError: null,
    venueId: "venue_demo_sweet_daisy",
    workspaceId: "ws_demo_sweet_daisy",
    websiteId: null,
    subscriptionId: "sub_demo_sweet_daisy",
    ownerAccountId: "owner_demo_sweet_daisy",
    onboardingId: "onb_demo_sweet_daisy",
    launchedAt: null,
    steps: [
      done("venue", "venue_demo_sweet_daisy"),
      done("workspace", "ws_demo_sweet_daisy"),
      pending("website"),
      done("subscription", "sub_demo_sweet_daisy"),
      done("owner_account", "owner_demo_sweet_daisy"),
      running("onboarding"),
      pending("launch"),
    ],
  };
}

function hasEventType(
  events: { relationshipId: string; type: string }[],
  relationshipId: string,
  type: string,
): boolean {
  return events.some((e) => e.relationshipId === relationshipId && e.type === type);
}

async function main() {
  const found = await findOrCreateRelationship({
    email: DEMO.email,
    venueName: DEMO.venueName,
    city: DEMO.city,
    state: DEMO.state,
    website: DEMO.website,
    firstName: DEMO.firstName,
    lastName: DEMO.lastName,
    phone: DEMO.phone,
    assignedTeamMemberId: "tm_jen",
    referralSource: "Demo seed",
  });

  let relationship = found.relationship;
  const wasCreated = found.created;
  let subscribedNow = false;

  if (!relationship.subscribedAt) {
    const subResult = await createManualSubscription({
      relationshipId: relationship.id,
      planId: DEMO.planId,
      planName: DEMO.planName,
      onboardingType: "self_guided",
      foundingMember: DEMO.foundingMember,
      mrrCents: DEMO.mrrCents,
      actorId: "tm_jen",
      notes: DEMO.notes,
    });
    if (!subResult?.relationship) {
      throw new Error(`Failed to subscribe ${DEMO.venueName} (${relationship.id})`);
    }
    relationship = subResult.relationship;
    subscribedNow = true;
  }

  const now = new Date().toISOString();
  let subscribedAt = relationship.subscribedAt || daysAgo(14);
  if (WANT_RENEWED) {
    subscribedAt = subscribedAtForDaysAfterRenewal(1);
  } else if (WANT_RENEWAL_WINDOW) {
    subscribedAt = subscribedAtForDaysUntilRenewal(45);
  }
  const renewalDate = initialRenewalDateIso(subscribedAt);
  const demoCsStage = WANT_RENEWED
    ? ("healthy" as const)
    : WANT_RENEWAL_WINDOW
      ? ("healthy" as const)
      : ("onboarding" as const);
  const demoStatus = WANT_RENEWED || WANT_RENEWAL_WINDOW ? "active" : "onboarding";

  await withLiveStore((store) => {
    const row = store.relationships.find((r) => r.id === relationship.id);
    if (!row) return null;

    row.venue = {
      ...row.venue,
      name: DEMO.venueName,
      city: DEMO.city,
      state: DEMO.state,
      website: DEMO.website,
    };
    row.owner = {
      ...row.owner,
      firstName: DEMO.firstName,
      lastName: DEMO.lastName,
      email: DEMO.email,
      phone: DEMO.phone,
    };
    row.status = demoStatus;
    row.currentStageLabel = WANT_RENEWED || WANT_RENEWAL_WINDOW ? "Active" : "Onboarding";
    row.salesStage = "closed_won";
    row.customerSuccessStage = demoCsStage;
    row.customerSuccessStageBeforeSupport = null;
    row.assignedTeamMemberId = "tm_jen";
    row.planId = DEMO.planId;
    row.planName = DEMO.planName;
    row.foundingMember = DEMO.foundingMember;
    row.onboardingType = "self_guided";
    row.paymentStatus = "manual";
    row.subscribedAt = subscribedAt;
    row.renewalDate = renewalDate;
    row.accessDisabled = false;
    row.activationToken = null;
    row.activationCompletedAt = row.activationCompletedAt || daysAgo(11);
    row.lastLoginAt = daysAgo(1);
    row.loginCount30d = 6;
    row.lastCustomerActivityAt = daysAgo(1);
    row.lastTeamActivityAt = daysAgo(2);
    row.websitePublished = false;
    row.nextMilestone = WANT_RENEWAL_WINDOW
      ? "Renewal conversation"
      : WANT_RENEWED
        ? "Post-renewal check-in"
        : "Publish venue website";
    row.nextMilestoneAt = daysAgo(-5);
    row.notes = WANT_RENEWAL_WINDOW
      ? `${DEMO.notes} Seeded with --renewal-window (≈45 days before anniversary).`
      : WANT_RENEWED
        ? `${DEMO.notes} Seeded with --renewed (day after anniversary).`
        : DEMO.notes;
    row.supportOpenCount = 0;
    row.openFeedbackItems = [];
    row.productSync = midOnboardingProductSync(now);
    row.updatedAt = now;
    row.lastContactAt = now;

    const existingSub = store.subscriptions.find(
      (s) => s.relationshipId === row.id,
    );
    if (existingSub) {
      existingSub.planId = DEMO.planId;
      existingSub.planName = DEMO.planName;
      existingSub.status = "active";
      existingSub.mrrCents = DEMO.mrrCents;
      existingSub.foundingMember = DEMO.foundingMember;
      existingSub.manual = true;
      existingSub.startedAt = existingSub.startedAt || subscribedAt;
      existingSub.cancelledAt = undefined;
    } else {
      store.subscriptions.push({
        id: `sub_demo_sweet_daisy`,
        relationshipId: row.id,
        planId: DEMO.planId,
        planName: DEMO.planName,
        status: "active",
        mrrCents: DEMO.mrrCents,
        startedAt: subscribedAt,
        foundingMember: DEMO.foundingMember,
        manual: true,
      });
    }

    if (!hasEventType(store.timelineEvents, row.id, "email_sent")) {
      store.timelineEvents.push({
        id: `evt_demo_daisy_welcome`,
        relationshipId: row.id,
        type: "email_sent",
        title: "Welcome email sent",
        body: `Founder Welcome sent to ${DEMO.email}.`,
        occurredAt: daysAgo(13),
        actorId: "tm_jen",
        meta: { template_id: "founder_welcome", demo_seed: true },
      });
      store.communications.push({
        id: `com_demo_daisy_welcome`,
        relationshipId: row.id,
        channel: "email",
        subject: "Welcome to Hello to Cheers — Sweet Daisy Barn & Farm",
        body: "Welcome aboard! Here's how Launch Yourself onboarding works.",
        direction: "outbound",
        occurredAt: daysAgo(13),
        actorId: "tm_jen",
        authorName: "Jennifer Cormier",
      });
    }

    if (
      !subscribedNow &&
      !hasEventType(store.timelineEvents, row.id, "manual_subscription")
    ) {
      store.timelineEvents.push({
        id: `evt_demo_daisy_manual_sub`,
        relationshipId: row.id,
        type: "manual_subscription",
        title: `Manual Subscription — ${DEMO.planName}`,
        body: DEMO.notes,
        occurredAt: subscribedAt,
        actorId: "tm_jen",
        meta: { plan: DEMO.planId, onboarding_type: "self_guided", manual: true },
      });
    }

    relationship = row;
    return row;
  });

  // Keep salesStage / CS stage locked via mutate (forceViewStages path) if needed.
  await mutateRelationship({
    find: { email: DEMO.email, venueName: DEMO.venueName },
    updateOnly: true,
    patch: {
      salesStage: "closed_won",
      customerSuccessStage: demoCsStage,
      paymentStatus: "manual",
      accessDisabled: false,
      subscribedAt,
      renewalDate,
    },
  });

  await refreshRelationshipHealth(relationship.id);
  const store = await loadLiveStore();
  const final = store.relationships.find((r) => r.id === relationship.id);
  if (!final) throw new Error("Demo relationship missing after seed");

  console.log(
    JSON.stringify(
      {
        action: wasCreated
          ? "created"
          : subscribedNow
            ? "subscribed"
            : "updated",
        id: final.id,
        venue: final.venue.name,
        owner: `${final.owner.firstName} ${final.owner.lastName}`,
        email: final.owner.email,
        subscribedAt: final.subscribedAt,
        renewalDate: final.renewalDate,
        salesStage: final.salesStage,
        customerSuccessStage: final.customerSuccessStage,
        status: final.status,
        plan: final.planName,
        renewalSeed: WANT_RENEWED
          ? "renewed"
          : WANT_RENEWAL_WINDOW
            ? "renewal_window"
            : null,
        tip: WANT_RENEWED || WANT_RENEWAL_WINDOW
          ? "POST /api/relationships/lifecycle { \"action\": \"tick_renewals\" } or open /customer-success"
          : undefined,
        mrrCents: store.subscriptions.find((s) => s.relationshipId === final.id)
          ?.mrrCents,
        open: {
          customerSuccess: "http://localhost:3002/customer-success",
          relationship: `http://localhost:3002/relationships/${final.id}`,
          salesClosedWon: "http://localhost:3002/sales",
        },
      },
      null,
      2,
    ),
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
