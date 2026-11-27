/**
 * Batch 1 — Genuine new-venue first-visit starter acceptance (Sandbox disposable).
 *
 * Creates a venue via provisionWorkspaceFromEnrollment (supported path), then:
 *  1. Records DB state immediately after provisioning
 *  2. Simulates Templates overview ensure+count WITHOUT opening section pages
 *  3. Compares overview counts to detail-table counts
 *  4. Re-runs ensure (idempotent / no duplicates)
 *  5. Customization + intentional deletion checks
 *
 * Does NOT touch Willow Grove, Hayes, Jen's Fancy, or Production.
 *
 * Run from repo root:
 *   /opt/homebrew/bin/node --import tsx docs/qa/launch-batch1-starter-first-visit/verify-first-visit.mts
 */
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { randomBytes } from "node:crypto";

config({ path: join(process.cwd(), ".env.local"), quiet: true });

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = __dirname;
mkdirSync(OUT_DIR, { recursive: true });
const OUT = join(OUT_DIR, "verify-results.json");

const PROTECTED = new Set([
  "31f38b79-eb99-4ebc-81bc-af85767b42aa", // Willow Grove
  "a415ac52-cd74-42a6-8df7-7a8f6e71d080", // Jen's Fancy
]);

const url = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim();
const serviceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
if (!url.includes("wvpsldwwjqdannqasrdf")) {
  throw new Error("Refusing to run outside Sandbox");
}
if (!serviceKey) throw new Error("SUPABASE_SERVICE_ROLE_KEY required");

const admin = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const { provisionWorkspaceFromEnrollment } = await import(
  "@/lib/provisioning/workspace"
);
const { ensureVenueStarters, getStarterProvisioningSnapshot } = await import(
  "@/lib/provisioning/starters"
);
const { STANDARD_WEDDING_SETUP_PROFILE_NAME } = await import(
  "@/lib/event-setup/provision-standard-wedding-setup"
);
const { countActivePlanningLibraryTemplates } = await import(
  "@/lib/playbooks/library-count"
);

const stamp = Date.now();
const ownerEmail = `batch1-firstvisit-${stamp}@hellotocheers-test.invalid`;
const venueName = `Batch1 FirstVisit ${stamp}`;
const password = `E2E-${randomBytes(18).toString("base64url")}`;

type Check = { id: string; ok: boolean; detail: string };
const checks: Check[] = [];
function check(id: string, ok: boolean, detail: string) {
  checks.push({ id, ok, detail });
  console.log(`[${ok ? "PASS" : "FAIL"}] ${id}: ${detail}`);
}

async function countByVenue(table: string, venueId: string, extra?: (q: ReturnType<typeof admin.from>) => unknown) {
  let q = admin.from(table).select("id", { count: "exact", head: true }).eq("venue_id", venueId);
  if (extra) q = extra(q as never) as typeof q;
  const { count, error } = await q;
  if (error) throw error;
  return count ?? 0;
}

console.log("=== Batch 1 first-visit starter verification ===");
console.log({ venueName, ownerEmail });

const { data: createdUser, error: userErr } = await admin.auth.admin.createUser({
  email: ownerEmail,
  password,
  email_confirm: true,
  user_metadata: { full_name: "Batch1 FirstVisit" },
});
if (userErr || !createdUser.user) {
  throw new Error(`auth createUser failed: ${userErr?.message}`);
}
const ownerUserId = createdUser.user.id;
check("auth.user", true, ownerUserId);

const { data: enrollment, error: enrollErr } = await admin
  .from("venue_enrollments")
  .insert({
    stripe_checkout_session_id: `cs_test_batch1_${stamp}`,
    stripe_customer_id: `cus_test_batch1_${stamp}`,
    stripe_subscription_id: `sub_test_batch1_${stamp}`,
    venue_name: venueName,
    owner_email: ownerEmail,
    owner_first_name: "Batch1",
    owner_last_name: "FirstVisit",
    plan: "standard",
    onboarding_type: "self_setup",
    status: "pending",
  })
  .select("id")
  .single();
if (enrollErr || !enrollment) throw new Error(`enrollment: ${enrollErr?.message}`);

const t0 = Date.now();
const provisioned = await provisionWorkspaceFromEnrollment({
  enrollmentId: enrollment.id,
  ownerUserId,
});
const provisionMs = Date.now() - t0;
if (!provisioned.ok) throw new Error(`provision failed: ${"error" in provisioned ? provisioned.error : "?"}`);
const venueId = provisioned.venueId;
if (PROTECTED.has(venueId)) throw new Error("Refusing to mutate protected venue");
check("provision.ok", true, `venueId=${venueId} ms=${provisionMs}`);
check(
  "provision.starters_ok",
  Boolean(provisioned.starters?.ok),
  `status=${provisioned.starters?.status} seeded=${provisioned.starters?.seeded?.length ?? 0} failed=${JSON.stringify(provisioned.starters?.failed ?? [])}`,
);

// --- DB immediately after provisioning (before any "section" ensure) ---
const snap0 = await getStarterProvisioningSnapshot(venueId, admin);
const postProvision = {
  status: snap0.status,
  seededSteps: snap0.seededSteps,
  failedSteps: snap0.failedSteps,
  needsAttention: snap0.needsAttention,
  playbooks: await countByVenue("playbook_templates", venueId),
  messages: await countByVenue("message_templates", venueId),
  contracts: await countByVenue("contract_templates", venueId),
  timelines: await countByVenue("timeline_templates", venueId),
  questionnaires: await countByVenue("questionnaire_templates", venueId),
  packages: await countByVenue("packages", venueId),
  eventOrders: await countByVenue("event_order_templates", venueId),
  floorPlans: await countByVenue("floor_plan_templates", venueId),
  publicForms: await countByVenue("public_forms", venueId),
  brochures: await countByVenue("brochures", venueId),
  automations: await countByVenue("message_sequences", venueId),
  inventoryItems: await countByVenue("inventory_items", venueId),
};
check(
  "db.post_provision_complete",
  snap0.status === "complete" && !snap0.needsAttention,
  JSON.stringify(postProvision),
);
check("db.playbooks_gt0", postProvision.playbooks > 0, String(postProvision.playbooks));
check("db.messages_gt0", postProvision.messages > 0, String(postProvision.messages));
check("db.contracts_gt0", postProvision.contracts > 0, String(postProvision.contracts));
check("db.timelines_gt0", postProvision.timelines > 0, String(postProvision.timelines));
check("db.questionnaires_gt0", postProvision.questionnaires > 0, String(postProvision.questionnaires));
check("db.packages_gt0", postProvision.packages > 0, String(postProvision.packages));
check("db.event_orders_gt0", postProvision.eventOrders > 0, String(postProvision.eventOrders));
check("db.automations_paused_or_present", postProvision.automations > 0, String(postProvision.automations));

const { data: weddingProfiles, error: profileErr } = await admin
  .from("venue_setup_profiles")
  .select("id,name")
  .eq("venue_id", venueId);
if (profileErr) throw new Error(`venue_setup_profiles: ${profileErr.message}`);
const wedding = (weddingProfiles ?? []).filter(
  (p) => p.name === STANDARD_WEDDING_SETUP_PROFILE_NAME,
);
check(
  "setup_profile.wedding_default",
  wedding.length === 1,
  JSON.stringify({ wedding: wedding.length, all: weddingProfiles }),
);

const { data: assignments, error: assignErr } = await admin
  .from("venue_setup_profile_assignments")
  .select("profile_id,event_type")
  .eq("venue_id", venueId);
if (assignErr) throw new Error(`assignments: ${assignErr.message}`);
const corporateAssign = (assignments ?? []).filter((a) => a.event_type === "corporate");
check(
  "setup_profile.no_corporate_assign",
  corporateAssign.length === 0,
  JSON.stringify(assignments),
);

const { data: sequences } = await admin
  .from("message_sequences")
  .select("status,source_master_key")
  .eq("venue_id", venueId)
  .not("source_master_key", "is", null);
const allPaused = (sequences ?? []).every((s) => s.status === "paused" || s.status === "draft");
check("automations.initially_paused", allPaused && (sequences?.length ?? 0) > 0, JSON.stringify(sequences));

// --- Simulate Templates overview first visit (ensure + recount; no section pages) ---
const tEnsure = Date.now();
const ensure1 = await ensureVenueStarters(venueId, { client: admin });
const ensure1Ms = Date.now() - tEnsure;
check(
  "overview.ensure_idempotent_fast",
  ensure1.ok && ensure1.status === "complete" && ensure1Ms < 5000,
  `ms=${ensure1Ms} status=${ensure1.status} seeded=${ensure1.seeded.length}`,
);

const overviewCounts = {
  playbooks: await countByVenue("playbook_templates", venueId),
  messages: await countByVenue("message_templates", venueId),
  contracts: await countByVenue("contract_templates", venueId),
  timelines: await countByVenue("timeline_templates", venueId),
  questionnaires: await countByVenue("questionnaire_templates", venueId),
  packages: await countByVenue("packages", venueId),
  eventOrders: await countByVenue("event_order_templates", venueId),
  floorPlans: await countByVenue("floor_plan_templates", venueId),
  publicForms: await countByVenue("public_forms", venueId),
  brochures: await countByVenue("brochures", venueId),
  inventoryItems: await countByVenue("inventory_items", venueId),
};

const { data: playbookRows } = await admin
  .from("playbook_templates")
  .select("id,name,is_archived,kind")
  .eq("venue_id", venueId);
const planningActive = countActivePlanningLibraryTemplates(
  (playbookRows ?? []).map((r) => ({
    kind: String((r as { kind?: string }).kind ?? ""),
    isArchived: Boolean((r as { is_archived?: boolean }).is_archived),
  })),
);

check(
  "overview.matches_post_provision",
  overviewCounts.playbooks === postProvision.playbooks &&
    overviewCounts.messages === postProvision.messages &&
    overviewCounts.timelines === postProvision.timelines &&
    overviewCounts.packages === postProvision.packages,
  JSON.stringify({ overviewCounts, postProvision, planningActive }),
);

// --- Second ensure: no duplicates ---
const beforeDup = { ...overviewCounts };
const ensure2 = await ensureVenueStarters(venueId, { client: admin });
const afterDup = {
  playbooks: await countByVenue("playbook_templates", venueId),
  messages: await countByVenue("message_templates", venueId),
  contracts: await countByVenue("contract_templates", venueId),
  packages: await countByVenue("packages", venueId),
  timelines: await countByVenue("timeline_templates", venueId),
};
check(
  "reensure.no_duplicates",
  ensure2.ok &&
    afterDup.playbooks === beforeDup.playbooks &&
    afterDup.messages === beforeDup.messages &&
    afterDup.packages === beforeDup.packages &&
    afterDup.timelines === beforeDup.timelines,
  JSON.stringify({ beforeDup, afterDup, ensure2 }),
);

// --- Customization preserved ---
const { data: onePkg } = await admin
  .from("packages")
  .select("id,name,source_master_key")
  .eq("venue_id", venueId)
  .not("source_master_key", "is", null)
  .limit(1)
  .maybeSingle();
if (onePkg) {
  const customName = `Customized ${onePkg.name} ${stamp}`;
  await admin.from("packages").update({ name: customName }).eq("id", onePkg.id);
  await ensureVenueStarters(venueId, { client: admin });
  const { data: still } = await admin.from("packages").select("name").eq("id", onePkg.id).single();
  check("customize.preserved", still?.name === customName, String(still?.name));
} else {
  check("customize.preserved", false, "no package starter to customize");
}

// --- Intentional delete not recreated ---
const { data: delContract } = await admin
  .from("contract_templates")
  .select("id,source_master_key")
  .eq("venue_id", venueId)
  .not("source_master_key", "is", null)
  .limit(1)
  .maybeSingle();
if (delContract) {
  const master = delContract.source_master_key;
  await admin.from("contract_templates").delete().eq("id", delContract.id);
  const ensureAfterDel = await ensureVenueStarters(venueId, { client: admin });
  const { count: resurrected } = await admin
    .from("contract_templates")
    .select("id", { count: "exact", head: true })
    .eq("venue_id", venueId)
    .eq("source_master_key", master);
  check(
    "delete.not_recreated",
    ensureAfterDel.ok && (resurrected ?? 0) === 0,
    `master=${master} resurrected=${resurrected} status=${ensureAfterDel.status}`,
  );
} else {
  check("delete.not_recreated", false, "no contract starter to delete");
}

// --- Partial incomplete recovery: simulate incomplete row then restore ---
await admin.from("venue_starter_provisioning").upsert({
  venue_id: venueId,
  status: "incomplete",
  seeded_steps: ["message_templates"],
  failed_steps: [{ key: "playbooks", message: "simulated" }],
  last_error: "simulated",
  updated_at: new Date().toISOString(),
});
const repaired = await ensureVenueStarters(venueId, { client: admin });
const snapRepair = await getStarterProvisioningSnapshot(venueId, admin);
check(
  "partial.recovery_safe",
  repaired.ok && snapRepair.status === "complete",
  `status=${snapRepair.status} seeded=${snapRepair.seededSteps.length} failed=${JSON.stringify(repaired.failed)}`,
);

const result = {
  generatedAt: new Date().toISOString(),
  venueId,
  venueName,
  ownerEmail,
  provisionMs,
  ensure1Ms,
  postProvision,
  overviewCounts,
  planningActive,
  checks,
  pass: checks.every((c) => c.ok),
  failCount: checks.filter((c) => !c.ok).length,
};
writeFileSync(OUT, JSON.stringify(result, null, 2));
console.log(`\nWrote ${OUT}`);
console.log(result.pass ? "RESULT: GREEN" : `RESULT: RED (${result.failCount} failures)`);
process.exit(result.pass ? 0 : 1);
