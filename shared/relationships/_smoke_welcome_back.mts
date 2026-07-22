/**
 * Quick smoke for Project 5 Welcome Back verification (no Resend).
 *
 *   npx tsx shared/relationships/_smoke_welcome_back.mts
 */
import { mkdirSync, rmSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const dataDir = path.join(root, "shared/relationships/.smoke-wb-data");
rmSync(dataDir, { recursive: true, force: true });
mkdirSync(dataDir, { recursive: true });
process.env.RELATIONSHIPS_DATA_PATH = dataDir;
delete process.env.RESEND_API_KEY;

const {
  ingestWelcomeBackRequest,
  resolveWelcomeBackVerification,
  loadLiveStore,
} = await import("./index.ts");
const { sendRelationshipEmail } = await import("../email/index.ts");

const created = await ingestWelcomeBackRequest({
  email: "wb-smoke@example.com",
  venueName: "Smoke Welcome Manor",
  firstName: "Pat",
  lastName: "Smoke",
  notes: "Former Weven venue",
});

const id = created.relationship.id;
console.log("created", id, created.relationship.welcomeBackVerified, created.relationship.foundingMember);

const follow = await resolveWelcomeBackVerification(id, "needs_follow_up", {
  actorId: "tm_jen",
});
if ("error" in follow) throw new Error(follow.error);
console.log("follow_up", follow.relationship.welcomeBackVerified);

const approved = await resolveWelcomeBackVerification(id, "approve", {
  actorId: "tm_jen",
});
if ("error" in approved) throw new Error(approved.error);
console.log(
  "approve",
  approved.relationship.welcomeBackVerified,
  approved.relationship.foundingMember,
  approved.timelineEvent.title,
);

const email = await sendRelationshipEmail({
  relationshipId: id,
  to: "wb-smoke@example.com",
  templateId: "welcome_back_verified",
  vars: { firstName: "Pat", venueName: "Smoke Welcome Manor", planName: "Celebrate" },
});
console.log("email", email.delivery, email.templateId);

const created2 = await ingestWelcomeBackRequest({
  email: "wb-reject@example.com",
  venueName: "Reject Test Hall",
  firstName: "Rej",
});
const rejected = await resolveWelcomeBackVerification(created2.relationship.id, "reject");
if ("error" in rejected) throw new Error(rejected.error);
console.log("reject", rejected.relationship.welcomeBackVerified, rejected.timelineEvent.title);

const store = await loadLiveStore();
const wb = store.relationships.filter((r) => r.welcomeBackRequested);
const pending = wb.filter((r) => r.welcomeBackVerified === "pending").length;
const verified = wb.filter((r) => r.welcomeBackVerified === "verified").length;
const rejectedCount = wb.filter((r) => r.welcomeBackVerified === "rejected").length;
console.log("counts", { pending, verified, rejectedCount, total: wb.length });

if (verified !== 1 || rejectedCount !== 1 || pending !== 0) {
  console.error("SMOKE FAIL counts", { pending, verified, rejectedCount });
  process.exit(1);
}
if (!approved.relationship.foundingMember) {
  console.error("SMOKE FAIL foundingMember");
  process.exit(1);
}
console.log("SMOKE OK");
rmSync(dataDir, { recursive: true, force: true });
