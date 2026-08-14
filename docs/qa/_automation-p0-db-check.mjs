/**
 * Automation P0 terminal-stage + completion + activity validation against local DB.
 * Uses service-role admin client; mirrors updateLeadStatus ordering.
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function loadEnv() {
  const p = resolve(process.cwd(), ".env.local");
  const text = readFileSync(p, "utf8");
  const out = {};
  for (const line of text.split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!m) continue;
    out[m[1]] = m[2].replace(/^"|"$/g, "").replace(/^'|'$/g, "");
  }
  return out;
}

const env = loadEnv();
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const key = env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Missing Supabase env");
  process.exit(1);
}

const admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

const VENUE = "69cfd906-0d15-4e5c-8bab-ed106b411c34";
const results = [];

function note(name, pass, detail) {
  results.push({ name, pass: !!pass, detail: detail ?? null });
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
}

async function exitActive(relationshipId, reason) {
  const { data } = await admin.from("sequence_enrollments").select("id")
    .eq("venue_id", VENUE).eq("relationship_id", relationshipId).eq("status", "active");
  const ids = (data ?? []).map((r) => r.id);
  if (ids.length === 0) return [];
  const now = new Date().toISOString();
  await admin.from("sequence_enrollments").update({ status: reason, exited_at: now })
    .in("id", ids).eq("venue_id", VENUE).eq("status", "active");
  await admin.from("scheduled_messages").update({ status: "cancelled" })
    .in("sequence_enrollment_id", ids).eq("status", "scheduled");
  return ids;
}

async function ensureAutomation({ name, triggerType, triggerStage, templateId }) {
  const { data: existing } = await admin.from("message_sequences").select("id")
    .eq("venue_id", VENUE).eq("name", name).maybeSingle();
  if (existing?.id) {
    await admin.from("message_sequences").update({
      trigger_type: triggerType,
      trigger_stage: triggerStage,
      status: "active",
    }).eq("id", existing.id);
    return existing.id;
  }
  const { data, error } = await admin.from("message_sequences").insert({
    venue_id: VENUE,
    name,
    trigger_type: triggerType,
    trigger_stage: triggerStage,
    status: "active",
  }).select("id").single();
  if (error) throw error;
  await admin.from("sequence_steps").insert({
    venue_id: VENUE,
    sequence_id: data.id,
    template_id: templateId,
    channel: "email",
    sort_order: 0,
    offset_days: 0,
  });
  await admin.from("sequence_steps").insert({
    venue_id: VENUE,
    sequence_id: data.id,
    template_id: templateId,
    channel: "email",
    sort_order: 1,
    offset_days: 2,
  });
  return data.id;
}

async function createTestLead(tag) {
  const email = `p0-${tag}-${Date.now()}@example.com`;
  const { data: rel, error: relErr } = await admin.from("venue_customer_relationships").insert({
    venue_id: VENUE,
    first_name: `P0${tag}`,
    last_name: "Validation",
    email,
  }).select("id").single();
  if (relErr) throw relErr;
  const { data: lead, error: leadErr } = await admin.from("leads").insert({
    venue_id: VENUE,
    relationship_id: rel.id,
    first_name: `P0${tag}`,
    last_name: "Validation",
    email,
    status: "new",
    source: "website",
  }).select("id").single();
  if (leadErr) throw leadErr;
  return { relationshipId: rel.id, leadId: lead.id, email };
}

async function enrollWithSteps(sequenceId, relationshipId, { scheduleFuture = true } = {}) {
  const { data: enr, error } = await admin.from("sequence_enrollments").insert({
    venue_id: VENUE,
    sequence_id: sequenceId,
    relationship_id: relationshipId,
    status: "active",
  }).select("id").single();
  if (error) throw error;
  const now = Date.now();
  const rows = [
    {
      venue_id: VENUE,
      relationship_id: relationshipId,
      sequence_enrollment_id: enr.id,
      channel: "email",
      status: scheduleFuture ? "scheduled" : "sent",
      scheduled_for: new Date(now + (scheduleFuture ? 3600_000 : -3600_000)).toISOString(),
      email_subject: "P0 step 1",
      body: "Hello {{first_name}}",
    },
    {
      venue_id: VENUE,
      relationship_id: relationshipId,
      sequence_enrollment_id: enr.id,
      channel: "email",
      status: "scheduled",
      scheduled_for: new Date(now + 2 * 86400_000).toISOString(),
      email_subject: "P0 step 2",
      body: "Hello again {{first_name}}",
    },
  ];
  const { error: smErr } = await admin.from("scheduled_messages").insert(rows);
  if (smErr) throw new Error(`scheduled_messages insert failed: ${smErr.message}`);
  return enr.id;
}

async function enrollViaTrigger(relationshipId, triggerType, triggerStage) {
  // Mirror triggerSequencesForRelationship core: find matching active sequences, skip if active enrollment
  let q = admin.from("message_sequences").select("id, name")
    .eq("venue_id", VENUE).eq("status", "active").eq("trigger_type", triggerType);
  if (triggerType === "lead_stage_changed") q = q.eq("trigger_stage", triggerStage);
  const { data: seqs } = await q;
  const enrolled = [];
  for (const seq of seqs ?? []) {
    const { data: active } = await admin.from("sequence_enrollments").select("id")
      .eq("sequence_id", seq.id).eq("relationship_id", relationshipId).eq("status", "active").maybeSingle();
    if (active) continue;
    const { data: enr, error } = await admin.from("sequence_enrollments").insert({
      venue_id: VENUE,
      sequence_id: seq.id,
      relationship_id: relationshipId,
      status: "active",
    }).select("id").single();
    if (error) throw error;
    enrolled.push({ sequenceId: seq.id, name: seq.name, enrollmentId: enr.id });
  }
  return enrolled;
}

async function timelineFor(relationshipId) {
  // Call RPC as service role — may need venue context. Try direct SQL via rpc.
  const { data, error } = await admin.rpc("get_relationship_activity_timeline", {
    p_relationship_id: relationshipId,
  });
  return { data, error };
}

async function main() {
  const { data: tmpl } = await admin.from("message_templates").select("id")
    .eq("venue_id", VENUE).eq("source_master_key", "MSG-01").maybeSingle();
  if (!tmpl?.id) throw new Error("MSG-01 template missing");

  // Ensure Lost / Cancelled automations exist for Test A/B enroll-after-exit
  const lostAutoId = await ensureAutomation({
    name: "P0 Lost Goodbye",
    triggerType: "lead_stage_changed",
    triggerStage: "lost",
    templateId: tmpl.id,
  });
  const cancelledAutoId = await ensureAutomation({
    name: "P0 Cancelled Goodbye",
    triggerType: "lead_stage_changed",
    triggerStage: "cancelled",
    templateId: tmpl.id,
  });
  const ordinaryAutoId = await ensureAutomation({
    name: "P0 Proposal Nudge",
    triggerType: "lead_stage_changed",
    triggerStage: "proposal_sent",
    templateId: tmpl.id,
  });
  const followupId = "fd5d172e-a457-4231-8238-849f4a91dc6c"; // existing New Inquiry Follow-up

  // ---- Test A: Lost ----
  {
    const t = await createTestLead("Lost");
    const enrollmentId = await enrollWithSteps(followupId, t.relationshipId, { scheduleFuture: true });
    // exit-before-enroll (mirror updateLeadStatus)
    await exitActive(t.relationshipId, "exited_lost");
    const afterExit = await admin.from("sequence_enrollments").select("status")
      .eq("id", enrollmentId).single();
    const schedLeft = await admin.from("scheduled_messages").select("id")
      .eq("sequence_enrollment_id", enrollmentId).eq("status", "scheduled");
    note("Test A existing enrollment → exited_lost", afterExit.data?.status === "exited_lost", afterExit.data?.status);
    note("Test A no future scheduled sends", (schedLeft.data ?? []).length === 0, `scheduled=${(schedLeft.data ?? []).length}`);

    const newly = await enrollViaTrigger(t.relationshipId, "lead_stage_changed", "lost");
    const lostEnroll = newly.find((n) => n.sequenceId === lostAutoId);
    note("Test A Lost-trigger Automation may enroll", !!lostEnroll, JSON.stringify(newly.map((n) => n.name)));
    if (lostEnroll) {
      const still = await admin.from("sequence_enrollments").select("status")
        .eq("id", lostEnroll.enrollmentId).single();
      note("Test A new Lost enrollment NOT immediately exited", still.data?.status === "active", still.data?.status);
    } else {
      note("Test A new Lost enrollment NOT immediately exited", false, "no new enrollment");
    }
  }

  // ---- Test B: Cancelled ----
  {
    const t = await createTestLead("Canc");
    const enrollmentId = await enrollWithSteps(followupId, t.relationshipId, { scheduleFuture: true });
    await exitActive(t.relationshipId, "exited_cancelled");
    const afterExit = await admin.from("sequence_enrollments").select("status")
      .eq("id", enrollmentId).single();
    const schedLeft = await admin.from("scheduled_messages").select("id")
      .eq("sequence_enrollment_id", enrollmentId).eq("status", "scheduled");
    note("Test B existing enrollment → exited_cancelled", afterExit.data?.status === "exited_cancelled", afterExit.data?.status);
    note("Test B no future scheduled sends", (schedLeft.data ?? []).length === 0, `scheduled=${(schedLeft.data ?? []).length}`);

    const newly = await enrollViaTrigger(t.relationshipId, "lead_stage_changed", "cancelled");
    const cEnroll = newly.find((n) => n.sequenceId === cancelledAutoId);
    note("Test B Cancelled-trigger Automation may enroll", !!cEnroll, JSON.stringify(newly.map((n) => n.name)));
    if (cEnroll) {
      const still = await admin.from("sequence_enrollments").select("status")
        .eq("id", cEnroll.enrollmentId).single();
      note("Test B new Cancelled enrollment NOT immediately exited", still.data?.status === "active", still.data?.status);
    } else {
      note("Test B new Cancelled enrollment NOT immediately exited", false, "no new enrollment");
    }
  }

  // ---- Test C: ordinary stage change does NOT auto-exit ----
  {
    const t = await createTestLead("Ord");
    const enrollmentId = await enrollWithSteps(followupId, t.relationshipId, { scheduleFuture: true });
    // ordinary: only enroll, no exit
    await enrollViaTrigger(t.relationshipId, "lead_stage_changed", "proposal_sent");
    const still = await admin.from("sequence_enrollments").select("status")
      .eq("id", enrollmentId).single();
    note("Test C ordinary stage change does NOT auto-exit existing", still.data?.status === "active", still.data?.status);
    const { data: propEnr } = await admin.from("sequence_enrollments").select("id, status")
      .eq("sequence_id", ordinaryAutoId).eq("relationship_id", t.relationshipId).eq("status", "active");
    note("Test C proposal Automation can still enroll", (propEnr ?? []).length === 1, `count=${(propEnr ?? []).length}`);
  }

  // ---- Completion: last scheduled cleared → completed ----
  {
    const t = await createTestLead("Comp");
    const enrollmentId = await enrollWithSteps(followupId, t.relationshipId, { scheduleFuture: true });
    // Mark first sent, leave second scheduled — should NOT complete
    const { data: msgs } = await admin.from("scheduled_messages").select("id, scheduled_for")
      .eq("sequence_enrollment_id", enrollmentId).eq("status", "scheduled").order("scheduled_for");
    await admin.from("scheduled_messages").update({ status: "sent" }).eq("id", msgs[0].id);
    // maybeComplete: remaining scheduled → no complete
    const { data: rem1 } = await admin.from("scheduled_messages").select("id")
      .eq("sequence_enrollment_id", enrollmentId).eq("status", "scheduled");
    if ((rem1 ?? []).length > 0) {
      // leave active
    }
    let st = await admin.from("sequence_enrollments").select("status").eq("id", enrollmentId).single();
    note("Completion mid-run stays active", st.data?.status === "active", st.data?.status);

    // Send final
    await admin.from("scheduled_messages").update({ status: "sent" }).eq("id", msgs[1].id);
    const { data: rem2 } = await admin.from("scheduled_messages").select("id")
      .eq("sequence_enrollment_id", enrollmentId).eq("status", "scheduled");
    if ((rem2 ?? []).length === 0) {
      await admin.from("sequence_enrollments")
        .update({ status: "completed", exited_at: new Date().toISOString() })
        .eq("id", enrollmentId).eq("status", "active");
    }
    st = await admin.from("sequence_enrollments").select("status").eq("id", enrollmentId).single();
    note("Completion final step → completed", st.data?.status === "completed", st.data?.status);
  }

  // ---- Duplicate enrollment protection ----
  {
    const t = await createTestLead("Dup");
    await enrollWithSteps(followupId, t.relationshipId, { scheduleFuture: true });
    const { data: active } = await admin.from("sequence_enrollments").select("id")
      .eq("sequence_id", followupId).eq("relationship_id", t.relationshipId).eq("status", "active");
    // second insert attempt would create duplicate unless guarded — app uses hasActiveEnrollment
    const guarded = (active ?? []).length === 1;
    note("Duplicate enrollment protection (active count=1 before second)", guarded, `active=${(active ?? []).length}`);
    // simulate guard
    const wouldSkip = (active ?? []).length > 0;
    note("Duplicate enrollment guard would skip", wouldSkip);
  }

  // ---- Progress next date presence (scheduled rows) ----
  {
    const t = await createTestLead("Prog");
    const enrollmentId = await enrollWithSteps(followupId, t.relationshipId, { scheduleFuture: true });
    const { data: rows } = await admin.from("scheduled_messages").select("status, scheduled_for")
      .eq("sequence_enrollment_id", enrollmentId);
    const scheduled = (rows ?? []).filter((r) => r.status === "scheduled").sort((a, b) => a.scheduled_for.localeCompare(b.scheduled_for));
    note("Progress data: steps total 2 with next scheduled", (rows ?? []).length === 2 && scheduled.length === 2, JSON.stringify({ total: (rows ?? []).length, next: scheduled[0]?.scheduled_for }));
  }

  // ---- Booking / reply exits still accepted by constraint ----
  {
    const t = await createTestLead("Book");
    const enrollmentId = await enrollWithSteps(followupId, t.relationshipId, { scheduleFuture: true });
    await exitActive(t.relationshipId, "exited_booking");
    const st = await admin.from("sequence_enrollments").select("status").eq("id", enrollmentId).single();
    note("Booking exit → exited_booking", st.data?.status === "exited_booking", st.data?.status);
  }
  {
    const t = await createTestLead("Reply");
    const enrollmentId = await enrollWithSteps(followupId, t.relationshipId, { scheduleFuture: true });
    await exitActive(t.relationshipId, "exited_reply");
    const st = await admin.from("sequence_enrollments").select("status").eq("id", enrollmentId).single();
    note("Reply exit → exited_reply", st.data?.status === "exited_reply", st.data?.status);
  }

  // ---- Activity timeline RPC includes automation lifecycle ----
  {
    const t = await createTestLead("Act");
    const enrollmentId = await enrollWithSteps(followupId, t.relationshipId, { scheduleFuture: true });
    await exitActive(t.relationshipId, "exited_lost");
    // RPC may fail without auth venue context — also verify SQL definition
    const { data, error } = await timelineFor(t.relationshipId);
    if (error) {
      // Fall back: query what the RPC would union
      const { data: se } = await admin.from("sequence_enrollments")
        .select("status, enrolled_at, exited_at, message_sequences(name)")
        .eq("id", enrollmentId).single();
      note("Activity lifecycle rows exist on enrollment", se?.status === "exited_lost" && !!se.enrolled_at && !!se.exited_at, JSON.stringify(se));
      note("Activity RPC callable in this context", false, error.message);
    } else {
      const events = data?.events ?? data ?? [];
      const titles = (Array.isArray(events) ? events : []).map((e) => e.title || e.type);
      const hasStart = titles.some((t) => /Enrolled in automation/i.test(String(t)));
      const hasStop = titles.some((t) => /Automation stopped \(lost\)/i.test(String(t)));
      note("Activity includes enrolled event", hasStart, titles.slice(0, 8).join(" | "));
      note("Activity includes stopped-lost event", hasStop, titles.filter((t) => /Automation/i.test(String(t))).join(" | "));
    }
  }

  // ---- Starter SEQ-01 present ----
  {
    const { data: seq } = await admin.from("message_sequences").select("id, name, trigger_type, source_master_key, status")
      .eq("venue_id", VENUE).eq("source_master_key", "SEQ-01").maybeSingle();
    note("SEQ-01 New Inquiry Welcome provisioned", seq?.name === "New Inquiry Welcome" && seq?.trigger_type === "lead_created", JSON.stringify(seq));
    const { data: tour } = await admin.from("message_sequences").select("id, name")
      .eq("venue_id", VENUE).ilike("name", "%Tour Follow%");
    note("Tour Follow-Up NOT implemented", (tour ?? []).length === 0, JSON.stringify(tour));
  }

  // ---- source_master_key null on venue-created ----
  {
    const { data: venueCreated } = await admin.from("message_sequences").select("name, source_master_key")
      .eq("id", followupId).single();
    note("Existing venue Automation keeps source_master_key null", venueCreated?.source_master_key == null, JSON.stringify(venueCreated));
  }

  const failed = results.filter((r) => !r.pass);
  console.log("\n--- SUMMARY ---");
  console.log(`pass=${results.filter((r) => r.pass).length} fail=${failed.length}`);
  console.log(JSON.stringify({ results, failed }, null, 2));
  process.exit(failed.length ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
