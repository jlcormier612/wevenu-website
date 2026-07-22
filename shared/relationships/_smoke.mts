/**
 * One-off merge smoke test. Run:
 *   RELATIONSHIPS_DATA_PATH=./shared/relationships/.smoke-data npx tsx shared/relationships/_smoke.mts
 */
import { mkdirSync, rmSync } from "fs";
import {
  ingestCheckoutStarted,
  ingestContactForm,
  ingestSubscriptionLifecycle,
  ingestSubscriptionPurchased,
  ingestWalkthroughRequest,
  ingestWelcomeBackRequest,
  loadLiveStore,
} from "./index.ts";

async function main() {
  const dir = process.env.RELATIONSHIPS_DATA_PATH;
  if (!dir) {
    console.error("Set RELATIONSHIPS_DATA_PATH");
    process.exit(1);
  }
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });

  const email = "jen-dedupe@example.com";

  await ingestContactForm({
    name: "Jen Test",
    email,
    venueName: "Willow Hall",
    message: "Hi",
  });
  await ingestWalkthroughRequest({
    name: "Jen Test",
    email,
    venueName: "Willow Hall",
    message: "Tour please",
  });
  await ingestWelcomeBackRequest({
    email,
    firstName: "Jen",
    lastName: "Test",
    venueName: "Willow Hall",
    yearsWithWeven: "3",
  });
  const draft = await ingestCheckoutStarted({
    checkoutSessionId: "cs_test_abc123",
    plan: "growing",
    planName: "Celebrate",
    welcomeBack: true,
    onboardingType: "white_glove",
  });
  const beforePurchaseCount = (await loadLiveStore()).relationships.length;

  await ingestSubscriptionPurchased({
    email,
    venueName: "Willow Hall",
    plan: "growing",
    planName: "Celebrate",
    foundingMember: true,
    welcomeBackRequested: false,
    onboardingType: "self_guided",
    stripeSubscriptionId: "sub_1",
    stripeCustomerId: "cus_1",
    stripeCheckoutSessionId: "cs_test_abc123",
    mrrCents: 24900,
  });

  // Lifecycle: past_due then cancel — must not duplicate Relationship
  await ingestSubscriptionLifecycle({
    email,
    stripeSubscriptionId: "sub_1",
    stripeCustomerId: "cus_1",
    stripeStatus: "past_due",
    mrrCents: 24900,
  });
  await ingestSubscriptionLifecycle({
    email,
    stripeSubscriptionId: "sub_1",
    stripeCustomerId: "cus_1",
    stripeStatus: "canceled",
    deleted: true,
    mrrCents: 0,
  });

  const store = await loadLiveStore();
  const rels = store.relationships;
  const events = store.timelineEvents;
  const subs = store.subscriptions;
  const tasks = store.tasks ?? [];
  const r = rels[0];
  const sub = subs.find((s) => s.stripeSubscriptionId === "sub_1");
  const checklistTitles = [
    "Venue branding",
    "Packages",
    "Contracts",
    "Questionnaires",
    "Email templates",
    "Website review",
    "Launch review",
    "Go Live",
  ];
  const checklist = tasks.filter(
    (t) => t.relationshipId === r.id && checklistTitles.includes(t.title),
  );

  const checks: Array<[string, boolean]> = [
    ["draft existed before purchase", beforePurchaseCount >= 2 || Boolean(draft)],
    ["single relationship after purchase", rels.length === 1],
    ["email set", r.owner.email === email],
    ["welcomeBackRequested kept", r.welcomeBackRequested === true],
    ["welcomeBackVerified pending", r.welcomeBackVerified === "pending"],
    ["white glove kept", r.onboardingType === "white_glove"],
    ["founding true", r.foundingMember === true],
    ["plan celebrate", r.planId === "celebrate"],
    ["stripe sub", r.stripeSubscriptionId === "sub_1"],
    ["status former after cancel", r.status === "former_customer"],
    ["sub cancelled", sub?.status === "cancelled"],
    ["mrr on cancel zero or kept", sub?.mrrCents === 0 || sub?.mrrCents === 24900],
    ["timeline has checkout started", events.some((e) => e.type === "checkout_started")],
    ["timeline has past_due update", events.some((e) => e.type === "subscription_updated")],
    ["timeline has cancelled", events.some((e) => e.type === "subscription_cancelled")],
    [
      "founder title present",
      events.some((e) => e.title.includes("Founder Subscription Purchased")),
    ],
    ["white glove checklist has 8 tasks", checklist.length === 8],
    ["checklist owned by Eli", checklist.every((t) => t.ownerId === "tm_eli")],
    [
      "checklist timeline event",
      events.some((e) => e.title === "Implementation Checklist created"),
    ],
  ];

  // Idempotency: purchase path already ran; ensuring again must not duplicate.
  const { ensureWhiteGloveChecklist } = await import("./white-glove-checklist.ts");
  await ensureWhiteGloveChecklist(r.id);
  const tasksAfter = (await loadLiveStore()).tasks ?? [];
  const checklistAfter = tasksAfter.filter(
    (t) => t.relationshipId === r.id && checklistTitles.includes(t.title),
  );
  checks.push(["checklist idempotent", checklistAfter.length === 8]);

  for (const [label, ok] of checks) {
    console.log(ok ? "PASS" : "FAIL", label);
  }
  if (checks.some(([, ok]) => !ok)) {
    console.log(
      JSON.stringify(
        {
          r,
          sub,
          eventTitles: events.map((e) => e.title),
          checklistTitles: checklist.map((t) => t.title),
          relCount: rels.length,
          taskCount: tasks.length,
        },
        null,
        2,
      ),
    );
    process.exit(1);
  }
  console.log("OK", {
    id: r.id,
    events: events.length,
    subs: subs.length,
    checklist: checklist.length,
  });
  rmSync(dir, { recursive: true, force: true });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
