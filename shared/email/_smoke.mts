/**
 * Project 3 smoke — dry-run sendRelationshipEmail + timeline without RESEND_API_KEY.
 *
 *   RELATIONSHIPS_DATA_PATH=./shared/relationships/.smoke-email-data \
 *     npx tsx shared/email/_smoke.mts
 */

import { mkdirSync, rmSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const dataDir = path.join(root, "shared/relationships/.smoke-email-data");

rmSync(dataDir, { recursive: true, force: true });
mkdirSync(dataDir, { recursive: true });
process.env.RELATIONSHIPS_DATA_PATH = dataDir;
delete process.env.RESEND_API_KEY;

const { ingestSubscriptionPurchased } = await import("../relationships/index.ts");
const {
  sendEnrollmentProductEmails,
  sendRelationshipEmail,
  listEmailTemplates,
  liveTemplateIds,
  registryOnlyTemplateIds,
} = await import("./index.ts");
const { loadLiveStore } = await import("../relationships/index.ts");

const live = liveTemplateIds();
const stubs = registryOnlyTemplateIds();
console.log("templates live:", live.join(", "));
console.log("templates registry-only:", stubs.join(", "));
console.log("registry count:", listEmailTemplates().length);

const enrolled = await ingestSubscriptionPurchased({
  email: "smoke-founder@example.com",
  venueName: "Smoke Test Manor",
  plan: "celebrate",
  planName: "Celebrate",
  foundingMember: true,
  welcomeBackRequested: true,
  onboardingType: "white_glove",
  stripeSubscriptionId: "sub_smoke_email",
  stripeCustomerId: "cus_smoke_email",
  mrrCents: 19900,
  subscriptionStatus: "active",
});

const results = await sendEnrollmentProductEmails({
  relationshipId: enrolled.relationship.id,
  customerEmail: "smoke-founder@example.com",
  venueName: "Smoke Test Manor",
  planName: "Celebrate",
  firstName: "Smoke",
  foundingMember: true,
  welcomeBackRequested: true,
  onboardingType: "white_glove",
});

console.log(
  "enrollment emails:",
  results.map((r) => `${r.templateId}:${r.delivery}`).join(", "),
);

const luv = await sendRelationshipEmail({
  relationshipId: enrolled.relationship.id,
  to: "smoke-founder@example.com",
  templateId: "luv_suggestion",
  subject: "Luv smoke note",
  text: "Hello from Luv smoke test.",
  vars: { firstName: "Smoke", venueName: "Smoke Test Manor" },
  meta: { source: "smoke" },
});
console.log("luv suggestion:", luv.delivery, luv.subject);

const store = await loadLiveStore();
const emails = store.timelineEvents.filter((e) => e.type === "email_sent");
console.log("timeline email_sent count:", emails.length);
for (const e of emails) {
  console.log(" -", e.title, e.meta?.delivery, e.meta?.simulated);
}

const allSimulated = results.every((r) => r.delivery === "simulated") && luv.delivery === "simulated";
const expectedMin = 5; // founder_welcome + welcome_back + kickoff + scheduling + luv
if (!allSimulated || emails.length < expectedMin) {
  console.error("SMOKE FAIL", { allSimulated, emailCount: emails.length, expectedMin });
  process.exit(1);
}

console.log("SMOKE OK");
rmSync(dataDir, { recursive: true, force: true });
