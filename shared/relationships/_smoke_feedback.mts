/**
 * Smoke: product + marketing feedback → CRM open items → resolve.
 *
 *   RELATIONSHIPS_DATA_PATH=./shared/relationships/.smoke-feedback-data \
 *     npx tsx shared/relationships/_smoke_feedback.mts
 */
import { mkdirSync, rmSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const dataDir = path.join(root, "shared/relationships/.smoke-feedback-data");
rmSync(dataDir, { recursive: true, force: true });
mkdirSync(dataDir, { recursive: true });
process.env.RELATIONSHIPS_DATA_PATH = dataDir;
delete process.env.RESEND_API_KEY;

const {
  ingestSubscriptionPurchased,
  ingestProductFeedback,
  ingestSupportRequest,
  resolveOpenFeedback,
  loadLiveStore,
} = await import("./index.ts");
const { sendFeedbackConfirmationEmail } = await import("../email/index.ts");
const { withLiveStore } = await import("./store.ts");

const enrolled = await ingestSubscriptionPurchased({
  email: "feedback-smoke@example.com",
  venueName: "Feedback Smoke Venue",
  plan: "gather",
  planName: "Gather",
  foundingMember: false,
  welcomeBackRequested: false,
  onboardingType: "self_guided",
  stripeSubscriptionId: "sub_fb_smoke",
  stripeCustomerId: "cus_fb_smoke",
  mrrCents: 9900,
  subscriptionStatus: "active",
});

await withLiveStore((store) => {
  const r = store.relationships.find((x) => x.id === enrolled.relationship.id)!;
  r.productSync = {
    status: "completed",
    steps: [],
    adapter: "local",
    venueId: "venue_fb_smoke",
  };
  return null;
});

const bug = await ingestProductFeedback({
  productVenueId: "venue_fb_smoke",
  email: "feedback-smoke@example.com",
  venueName: "Feedback Smoke Venue",
  feedbackType: "bug",
  subject: "Broken calendar",
  body: "Cannot save dates",
  productFeedbackId: "vf_smoke_1",
});
if (!bug || bug.relationship.supportOpenCount !== 1) {
  console.error("FAIL bug ingest", bug?.relationship.supportOpenCount);
  process.exit(1);
}

const idea = await ingestProductFeedback({
  productVenueId: "venue_fb_smoke",
  email: "feedback-smoke@example.com",
  feedbackType: "feature",
  subject: "Dark mode",
  body: "Please",
  productFeedbackId: "vf_smoke_2",
});
if (!idea || idea.relationship.supportOpenCount !== 2) {
  console.error("FAIL idea ingest", idea?.relationship.supportOpenCount);
  process.exit(1);
}

const support = await ingestSupportRequest({
  email: "feedback-smoke@example.com",
  venueName: "Feedback Smoke Venue",
  message: "Need help logging in",
  sourceId: "inq_smoke",
});
if (support.relationship.supportOpenCount !== 3) {
  console.error("FAIL marketing support", support.relationship.supportOpenCount);
  process.exit(1);
}

const ack = await sendFeedbackConfirmationEmail({
  relationshipId: enrolled.relationship.id,
  to: "feedback-smoke@example.com",
  firstName: "Smoke",
  venueName: "Feedback Smoke Venue",
  feedbackType: "bug",
});
if (ack.delivery !== "simulated") {
  console.error("FAIL ack", ack);
  process.exit(1);
}

const openItem = idea.relationship.openFeedbackItems?.find((i) => i.status === "open");
const resolvedOne = await resolveOpenFeedback({
  relationshipId: enrolled.relationship.id,
  itemId: openItem!.id,
});
if ("error" in resolvedOne || resolvedOne.supportOpenCount !== 2) {
  console.error("FAIL resolve one", resolvedOne);
  process.exit(1);
}

const resolvedAll = await resolveOpenFeedback({
  relationshipId: enrolled.relationship.id,
  all: true,
});
if ("error" in resolvedAll || resolvedAll.supportOpenCount !== 0) {
  console.error("FAIL resolve all", resolvedAll);
  process.exit(1);
}

const store = await loadLiveStore();
const rel = store.relationships.find((r) => r.id === enrolled.relationship.id)!;
if (rel.status === "support") {
  console.error("FAIL status still support", rel.status);
  process.exit(1);
}

console.log("SMOKE OK", {
  openItems: rel.openFeedbackItems?.length,
  openCount: rel.supportOpenCount,
  status: rel.status,
  ack: ack.delivery,
});
