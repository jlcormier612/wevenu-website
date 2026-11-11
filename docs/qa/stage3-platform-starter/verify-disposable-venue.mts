/**
 * Stage 3 — Disposable Sandbox venue verification (no commit/push/deploy).
 *
 * Creates a fresh enrollment + workspace via the supported local provisioning
 * path (provisionWorkspaceFromEnrollment → seedWorkspaceStarters), then verifies
 * starter resources, Standard Wedding Setup, automation pause defaults,
 * inheritance for wedding vs non-wedding, and idempotent re-seed.
 *
 * Does not touch Willow Grove, Hayes, or Jen's Fancy Venue.
 *
 * Run:
 *   /opt/homebrew/bin/node --import tsx docs/qa/stage3-platform-starter/verify-disposable-venue.mts
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
const OUT = join(OUT_DIR, "verify-results.json");

const WG = "31f38b79-eb99-4ebc-81bc-af85767b42aa";
const JEN = "a415ac52-cd74-42a6-8df7-7a8f6e71d080";

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
const { seedWorkspaceStarters } = await import("@/lib/provisioning/starters");
const { inheritSetupProfileForNewEvent } = await import("@/lib/event-setup/inherit");
const { STANDARD_WEDDING_SETUP_PROFILE_NAME } = await import(
  "@/lib/event-setup/provision-standard-wedding-setup"
);

const stamp = Date.now();
const ownerEmail = `stage3-starter-${stamp}@hellotocheers-test.invalid`;
const venueName = `Stage3 Starter Venue ${stamp}`;
const password = `E2E-${randomBytes(18).toString("base64url")}`;

type Check = { id: string; ok: boolean; detail: string };
const checks: Check[] = [];
function check(id: string, ok: boolean, detail: string) {
  checks.push({ id, ok, detail });
  console.log(`[${ok ? "PASS" : "FAIL"}] ${id}: ${detail}`);
}

async function countByVenue(table: string, venueId: string, filter?: Record<string, string>) {
  let q = admin.from(table).select("id", { count: "exact", head: true }).eq("venue_id", venueId);
  if (filter) {
    for (const [k, v] of Object.entries(filter)) q = q.eq(k, v);
  }
  const { count, error } = await q;
  if (error) throw error;
  return count ?? 0;
}

console.log("=== Stage 3 disposable venue verification ===");
console.log({ venueName, ownerEmail });

// 1. Auth user for owner
const { data: createdUser, error: userErr } = await admin.auth.admin.createUser({
  email: ownerEmail,
  password,
  email_confirm: true,
  user_metadata: { full_name: "Stage3 Starter" },
});
if (userErr || !createdUser.user) {
  throw new Error(`auth createUser failed: ${userErr?.message}`);
}
const ownerUserId = createdUser.user.id;
check("auth.user", true, ownerUserId);

// 2. Enrollment row
const { data: enrollment, error: enrollErr } = await admin
  .from("venue_enrollments")
  .insert({
    stripe_checkout_session_id: `cs_test_stage3_${stamp}`,
    stripe_customer_id: `cus_test_stage3_${stamp}`,
    stripe_subscription_id: `sub_test_stage3_${stamp}`,
    venue_name: venueName,
    owner_email: ownerEmail,
    owner_first_name: "Stage3",
    owner_last_name: "Starter",
    plan: "standard",
    onboarding_type: "self_setup",
    status: "pending",
    activation_token: `act_${randomBytes(20).toString("hex")}`,
    purchase_hold: false,
  })
  .select("id")
  .single<{ id: string }>();
if (enrollErr || !enrollment) {
  throw new Error(`enrollment insert failed: ${enrollErr?.message}`);
}
check("enrollment", true, enrollment.id);

// 3. Supported provisioning path (local code → Sandbox DB)
const provisioned = await provisionWorkspaceFromEnrollment({
  enrollmentId: enrollment.id,
  ownerUserId,
});
if (!provisioned.ok) {
  throw new Error(`provisionWorkspaceFromEnrollment failed: ${provisioned.error}`);
}
const venueId = provisioned.venueId;
check("provision.venue", true, venueId);
check(
  "provision.starters_ok",
  provisioned.starters.ok,
  JSON.stringify({
    seeded: provisioned.starters.seeded,
    failed: provisioned.starters.failed,
  }),
);

if (venueId === WG || venueId === JEN) {
  throw new Error("BLOCKER: disposable venue collided with WG or Jen Fancy");
}

// 4. Starter resources once
const pbKeys = [
  "PB-CLIENT-01",
  "PB-VENUE-01",
  "PB-CLIENT-CORP-01",
  "PB-VENUE-CORP-01",
  "PB-CLIENT-SOCIAL-01",
  "PB-VENUE-SOCIAL-01",
];
const { data: playbooks } = await admin
  .from("playbook_templates")
  .select("id, name, kind, event_type, source_master_key, is_default, is_archived")
  .eq("venue_id", venueId);
const pbByKey = new Map((playbooks ?? []).map((p) => [p.source_master_key, p]));
for (const key of pbKeys) {
  const row = pbByKey.get(key);
  check(`playbook.${key}`, Boolean(row), row ? `${row.name} (${row.event_type})` : "missing");
}
check(
  "playbook.wedding_only_defaults",
  (playbooks ?? [])
    .filter((p) => p.is_default && !p.is_archived)
    .every((p) => p.event_type === "wedding"),
  JSON.stringify(
    (playbooks ?? []).filter((p) => p.is_default).map((p) => ({
      key: p.source_master_key,
      event_type: p.event_type,
    })),
  ),
);

const { data: timelines } = await admin
  .from("timeline_templates")
  .select("id, name, source_master_key")
  .eq("venue_id", venueId);
check(
  "timeline.TL-01",
  (timelines ?? []).some((t) => t.source_master_key === "TL-01"),
  JSON.stringify((timelines ?? []).map((t) => t.source_master_key)),
);

const { data: questionnaires } = await admin
  .from("questionnaire_templates")
  .select("id, name, source_master_key")
  .eq("venue_id", venueId);
check(
  "questionnaire.QST-CP",
  (questionnaires ?? []).some((q) => q.source_master_key === "QST-CP"),
  "present",
);
check(
  "questionnaire.QST-FD",
  (questionnaires ?? []).some((q) => q.source_master_key === "QST-FD"),
  "present",
);

// 5. Standard Wedding Setup once, wedding only, no venue default
const { data: profiles } = await admin
  .from("venue_setup_profiles")
  .select("id, name, decisions, template_refs")
  .eq("venue_id", venueId);
const weddingProfiles = (profiles ?? []).filter(
  (p) => p.name === STANDARD_WEDDING_SETUP_PROFILE_NAME,
);
check("profile.count_named", weddingProfiles.length === 1, `count=${weddingProfiles.length}`);
const profile = weddingProfiles[0];
const decisions = (profile?.decisions ?? {}) as Record<string, string>;
check("profile.planning", decisions.planning === "set_up", decisions.planning ?? "missing");
check("profile.timeline", decisions.timeline === "set_up", decisions.timeline ?? "missing");
check(
  "profile.questionnaires",
  decisions.questionnaires === "set_up",
  decisions.questionnaires ?? "missing",
);
check("profile.vendors", decisions.vendors === "set_up", decisions.vendors ?? "missing");
check(
  "profile.floor_plans_not_included",
  decisions.floor_plans === "skipped",
  decisions.floor_plans ?? "missing",
);

const refs = (profile?.template_refs ?? {}) as Record<string, unknown>;
const clientPb = pbByKey.get("PB-CLIENT-01");
const venuePb = pbByKey.get("PB-VENUE-01");
const tl01 = (timelines ?? []).find((t) => t.source_master_key === "TL-01");
check(
  "profile.refs.client_playbook",
  refs.planningPlaybookTemplateId === clientPb?.id,
  String(refs.planningPlaybookTemplateId),
);
check(
  "profile.refs.venue_playbook",
  refs.venuePlanningPlaybookTemplateId === venuePb?.id,
  String(refs.venuePlanningPlaybookTemplateId),
);
check(
  "profile.refs.timeline",
  refs.timelineTemplateId === tl01?.id,
  String(refs.timelineTemplateId),
);
const qIds = Array.isArray(refs.questionnaireTemplateIds)
  ? (refs.questionnaireTemplateIds as string[])
  : [];
check("profile.refs.questionnaires", qIds.length >= 2, JSON.stringify(qIds));
check(
  "profile.refs.no_floor_plan",
  !refs.defaultFloorPlanTemplateId &&
    (!Array.isArray(refs.floorPlanTemplateIds) ||
      (refs.floorPlanTemplateIds as string[]).length === 0),
  JSON.stringify({
    defaultFloorPlanTemplateId: refs.defaultFloorPlanTemplateId,
    floorPlanTemplateIds: refs.floorPlanTemplateIds,
  }),
);
check(
  "profile.refs.no_vendors_forced",
  (!Array.isArray(refs.recommendedVendorIds) ||
    (refs.recommendedVendorIds as string[]).length === 0) &&
    (!Array.isArray(refs.requiredVendorIds) ||
      (refs.requiredVendorIds as string[]).length === 0),
  "empty vendor refs",
);

const { data: assignments } = await admin
  .from("venue_setup_profile_assignments")
  .select("profile_id, event_type")
  .eq("venue_id", venueId);
const weddingAssign = (assignments ?? []).filter((a) => a.event_type === "wedding");
const nullAssign = (assignments ?? []).filter((a) => a.event_type == null);
check(
  "assignment.wedding_once",
  weddingAssign.length === 1 && weddingAssign[0]!.profile_id === profile?.id,
  JSON.stringify(weddingAssign),
);
check("assignment.no_venue_default", nullAssign.length === 0, JSON.stringify(nullAssign));

// 6. Automations all paused
const { data: sequences } = await admin
  .from("message_sequences")
  .select("name, source_master_key, status")
  .eq("venue_id", venueId);
const seqByKey = Object.fromEntries(
  (sequences ?? []).map((s) => [s.source_master_key, s]),
);
for (const key of ["SEQ-01", "SEQ-02", "SEQ-03", "SEQ-04"]) {
  check(
    `automation.${key}_paused`,
    seqByKey[key]?.status === "paused",
    `${seqByKey[key]?.name ?? "missing"}=${seqByKey[key]?.status ?? "missing"}`,
  );
}

// 7. Idempotent re-seed
const beforePb = await countByVenue("playbook_templates", venueId);
const beforeProfiles = await countByVenue("venue_setup_profiles", venueId);
const beforeSeq = await countByVenue("message_sequences", venueId);
const reseeds = await seedWorkspaceStarters(venueId, admin);
check("reseed.ok", reseeds.ok, JSON.stringify(reseeds.failed));
const afterPb = await countByVenue("playbook_templates", venueId);
const afterProfiles = await countByVenue("venue_setup_profiles", venueId);
const afterSeq = await countByVenue("message_sequences", venueId);
check("reseed.playbooks_stable", beforePb === afterPb, `${beforePb}→${afterPb}`);
check(
  "reseed.profiles_stable",
  beforeProfiles === afterProfiles,
  `${beforeProfiles}→${afterProfiles}`,
);
check("reseed.sequences_stable", beforeSeq === afterSeq, `${beforeSeq}→${afterSeq}`);

// 8. Inheritance — wedding vs corporate (admin client; no invites/payments)
async function createBookableClient(opts: {
  first: string;
  last: string;
  email: string;
  eventType: string;
  eventName: string;
  eventDate: string;
}) {
  const { data: lead, error: lErr } = await admin
    .from("leads")
    .insert({
      venue_id: venueId,
      first_name: opts.first,
      last_name: opts.last,
      email: opts.email,
      sales_stage: "new_inquiry",
      status: "active",
      source: "website",
      event_type: opts.eventType,
      event_date: opts.eventDate,
    })
    .select("id")
    .single<{ id: string }>();
  if (lErr || !lead) throw new Error(`lead insert: ${lErr?.message}`);

  const { data: client, error: cErr } = await admin
    .from("clients")
    .insert({
      venue_id: venueId,
      lead_id: lead.id,
      first_name: opts.first,
      last_name: opts.last,
      email: opts.email,
      event_type: opts.eventType,
      event_date: opts.eventDate,
    })
    .select("id")
    .single<{ id: string }>();
  if (cErr || !client) throw new Error(`client insert: ${cErr?.message}`);

  const { data: booked, error: bErr } = await admin.rpc("book_relationship", {
    p_venue_id: venueId,
    p_client_id: client.id,
    p_space_id: null,
    p_pipeline_stage_id: null,
    p_name: opts.eventName,
    p_event_type: opts.eventType,
    p_event_date: opts.eventDate,
    p_event_end_date: null,
    p_start_time: "16:00",
    p_end_time: "22:00",
    p_setup_time: null,
    p_teardown_time: null,
    p_guest_count: 80,
    p_lifecycle_origin: "direct",
    p_confirmed_occupancy: null,
  });
  if (bErr) throw new Error(`book_relationship: ${bErr.message}`);
  const row = booked as { ok?: boolean; event_id?: string; message?: string };
  if (!row?.ok || !row.event_id) {
    throw new Error(`book_relationship failed: ${row?.message ?? "unknown"}`);
  }
  // Inheritance runs outside the RPC in the app path — call it explicitly.
  await inheritSetupProfileForNewEvent(admin as never, venueId, row.event_id);
  return { clientId: client.id, eventId: row.event_id };
}

const weddingBook = await createBookableClient({
  first: "Ada",
  last: "Wedding",
  email: `ada.wedding.${stamp}@hellotocheers-test.invalid`,
  eventType: "wedding",
  eventName: "Ada & Test Wedding",
  eventDate: "2027-09-18",
});
const corpBook = await createBookableClient({
  first: "Blake",
  last: "Corp",
  email: `blake.corp.${stamp}@hellotocheers-test.invalid`,
  eventType: "corporate",
  eventName: "Blake Corp Retreat",
  eventDate: "2027-10-12",
});

const { data: weddingSetup } = await admin
  .from("event_setup_states")
  .select(
    "event_id, uses_profile, profile_id, profile_name, inherited_decisions, inherited_template_refs",
  )
  .eq("event_id", weddingBook.eventId)
  .maybeSingle();
check(
  "inherit.wedding_profile",
  weddingSetup?.uses_profile === true &&
    weddingSetup.profile_id === profile?.id &&
    weddingSetup.profile_name === STANDARD_WEDDING_SETUP_PROFILE_NAME,
  JSON.stringify({
    uses_profile: weddingSetup?.uses_profile,
    profile_name: weddingSetup?.profile_name,
    profile_id: weddingSetup?.profile_id,
  }),
);

const { data: weddingTasks } = await admin
  .from("event_tasks")
  .select("id, title, visibility")
  .eq("event_id", weddingBook.eventId);
check(
  "inherit.wedding_has_tasks",
  (weddingTasks?.length ?? 0) > 0,
  `tasks=${weddingTasks?.length ?? 0}`,
);

const { data: corpSetup } = await admin
  .from("event_setup_states")
  .select("event_id, uses_profile, profile_id, profile_name")
  .eq("event_id", corpBook.eventId)
  .maybeSingle();
check(
  "inherit.corporate_no_wedding_profile",
  !corpSetup || corpSetup.uses_profile !== true || corpSetup.profile_id !== profile?.id,
  JSON.stringify(corpSetup),
);

const { data: corpTasks } = await admin
  .from("event_tasks")
  .select("id, title")
  .eq("event_id", corpBook.eventId);
const weddingTaskTitles = new Set((weddingTasks ?? []).map((t) => t.title));
const leakedWeddingTitles = (corpTasks ?? []).filter((t) =>
  ["Purchase event insurance", "Submit your seating plan", "Leave a review"].includes(
    t.title,
  ),
);
check(
  "inherit.corporate_no_wedding_tasks",
  leakedWeddingTitles.length === 0,
  JSON.stringify({
    corpTaskCount: corpTasks?.length ?? 0,
    leaked: leakedWeddingTitles.map((t) => t.title),
    weddingSample: [...weddingTaskTitles].slice(0, 5),
  }),
);

// 9. No messages / invitations / payment ops for this venue
const { count: msgCount } = await admin
  .from("scheduled_messages")
  .select("id", { count: "exact", head: true })
  .eq("venue_id", venueId);
const { count: inviteCount } = await admin
  .from("client_invitations")
  .select("id", { count: "exact", head: true })
  .eq("venue_id", venueId);
check("side_effects.no_messages", (msgCount ?? 0) === 0, `scheduled_messages=${msgCount ?? 0}`);
check(
  "side_effects.no_invitations",
  (inviteCount ?? 0) === 0,
  `client_invitations=${inviteCount ?? 0}`,
);

// 10. Existing venues preserved (spot-check counts unchanged for WG Signature + Jen)
const { data: wgProfile } = await admin
  .from("venue_setup_profiles")
  .select("id, name")
  .eq("venue_id", WG)
  .eq("name", "Signature Wedding Setup")
  .maybeSingle();
check("regression.wg_signature", Boolean(wgProfile), wgProfile?.id ?? "missing");
const { data: jenProfile } = await admin
  .from("venue_setup_profiles")
  .select("id, name")
  .eq("venue_id", JEN)
  .eq("name", "Standard Wedding Setup")
  .maybeSingle();
check("regression.jen_standard", Boolean(jenProfile), jenProfile?.id ?? "missing");
const { count: jenSeqActive } = await admin
  .from("message_sequences")
  .select("id", { count: "exact", head: true })
  .eq("venue_id", JEN)
  .eq("source_master_key", "SEQ-01");
check(
  "regression.jen_seq01_untouched_row",
  (jenSeqActive ?? 0) >= 1,
  `SEQ-01 rows=${jenSeqActive ?? 0}`,
);

const failed = checks.filter((c) => !c.ok);
const result = {
  stamp,
  venueId,
  venueName,
  ownerEmail,
  ownerUserId,
  enrollmentId: enrollment.id,
  passwordFile: "/tmp/stage3-starter-creds.json",
  profileId: profile?.id ?? null,
  weddingEventId: weddingBook.eventId,
  corporateEventId: corpBook.eventId,
  checks,
  failed: failed.map((c) => c.id),
  verdict: failed.length === 0 ? "GREEN" : "PARTIAL",
};

writeFileSync(
  "/tmp/stage3-starter-creds.json",
  JSON.stringify(
    {
      stamp,
      venueId,
      venueName,
      ownerEmail,
      password,
      ownerUserId,
      enrollmentId: enrollment.id,
    },
    null,
    2,
  ),
);
mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(OUT, JSON.stringify(result, null, 2));
console.log("\n=== VERDICT ===", result.verdict);
console.log(`Failed: ${failed.length}/${checks.length}`);
console.log(`Results: ${OUT}`);
console.log("Credentials: /tmp/stage3-starter-creds.json (not in repo)");
if (failed.length) process.exitCode = 1;
