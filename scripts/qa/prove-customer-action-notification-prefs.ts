/**
 * Sandbox RCJ: customer-action notification prefs ON/OFF + idempotency.
 * Uses service-role DB writes + canonical RPCs. Does not touch Production.
 *
 * Usage: npx tsx --env-file=.env.local scripts/qa/prove-customer-action-notification-prefs.ts
 */
import { createClient } from "@supabase/supabase-js";
import { execSync } from "node:child_process";
import { writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";

const FANCY = "a415ac52-cd74-42a6-8df7-7a8f6e71d080";
const DAISY = "5c84e74e-355d-4ce1-9e6b-913a9267f543";
const MAILBOX = "jyagnesak@yahoo.com";
const OUT = resolve("docs/qa/customer-action-notification-prefs");

function secretJson(name: string): Record<string, string> {
  const raw = execSync(
    `aws secretsmanager get-secret-value --secret-id ${name} --query SecretString --output text`,
    { encoding: "utf8" },
  ).trim();
  try {
    return JSON.parse(raw);
  } catch {
    return { value: raw };
  }
}

async function countNotifs(
  sb: ReturnType<typeof createClient>,
  venueId: string,
  type: string,
  sinceIso: string,
) {
  const { data } = await sb
    .from("venue_notifications")
    .select("id, title, body, needs_email, emailed_at, created_at")
    .eq("venue_id", venueId)
    .eq("type", type)
    .gte("created_at", sinceIso)
    .order("created_at", { ascending: false });
  return data ?? [];
}

async function setPrefs(
  sb: ReturnType<typeof createClient>,
  venueId: string,
  patch: Record<string, boolean>,
) {
  const { error } = await sb.from("venue_notification_preferences").upsert(
    { venue_id: venueId, ...patch, updated_at: new Date().toISOString() } as never,
    { onConflict: "venue_id" },
  );
  if (error) throw new Error(`prefs: ${error.message}`);
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );

  const stamp = Date.now();
  const since = new Date(stamp - 1000).toISOString();
  const results: Record<string, unknown> = { stamp, venue: FANCY };

  // Ensure prefs row exists
  await setPrefs(sb, FANCY, {
    pref_tour_scheduled: true,
    pref_tour_confirmed: true,
    pref_proposal_accepted: true,
  });

  // ── Tour scheduled ON ────────────────────────────────────────────────────
  const { data: lead, error: le } = await sb
    .from("leads")
    .insert({
      venue_id: FANCY,
      first_name: "Tour",
      last_name: `Notif${stamp}`,
      email: `tour.notif.${stamp}@hellotocheers.test`,
      sales_stage: "new_inquiry",
    } as never)
    .select("id, first_name, last_name")
    .single();
  if (le || !lead) throw new Error(`lead: ${le?.message}`);

  // Unique far-future slots to avoid capacity collisions with live Sandbox tours.
  const dayOffset = (stamp % 300) + 5;
  const base = Date.UTC(2028, 2, 1, 14, 0, 0) + dayOffset * 86400000;
  const slotAt = (offsetDays: number) =>
    new Date(base + offsetDays * 86400000).toISOString();
  const { data: appt, error: ae } = await sb
    .from("tour_appointments")
    .insert({
      venue_id: FANCY,
      lead_id: lead.id,
      scheduled_at: slotAt(0),
      duration_minutes: 60,
      status: "scheduled",
      contact_name: `${lead.first_name} ${lead.last_name}`,
      contact_email: `tour.notif.${stamp}@hellotocheers.test`,
      event_type: "Wedding",
    } as never)
    .select("id, confirm_token, status, confirmation_source, confirmed_at")
    .single();
  if (ae || !appt) throw new Error(`appt: ${ae?.message}`);

  const scheduledOn = await countNotifs(sb, FANCY, "tour_scheduled", since);
  results.tour_scheduled_on = {
    ok: scheduledOn.length === 1 && scheduledOn[0]?.title?.startsWith("New tour scheduled —"),
    count: scheduledOn.length,
    row: scheduledOn[0] ?? null,
  };

  // Tour scheduled OFF — new appointment must not notify
  await setPrefs(sb, FANCY, { pref_tour_scheduled: false });
  const sinceOff = new Date().toISOString();
  const { data: appt2, error: ae2 } = await sb
    .from("tour_appointments")
    .insert({
      venue_id: FANCY,
      lead_id: lead.id,
      scheduled_at: slotAt(1),
      duration_minutes: 45,
      status: "scheduled",
      contact_name: `${lead.first_name} ${lead.last_name}`,
      contact_email: `tour.notif.${stamp}@hellotocheers.test`,
      event_type: "Wedding",
    } as never)
    .select("id")
    .single();
  if (ae2 || !appt2) throw new Error(`appt2: ${ae2?.message}`);
  const scheduledOff = await countNotifs(sb, FANCY, "tour_scheduled", sinceOff);
  results.tour_scheduled_off = { ok: scheduledOff.length === 0, count: scheduledOff.length };

  // ── Tour confirmed ON ────────────────────────────────────────────────────
  await setPrefs(sb, FANCY, { pref_tour_confirmed: true });
  const sinceConfirm = new Date().toISOString();
  const { data: confirm1, error: ce1 } = await sb.rpc("confirm_tour_by_token", {
    p_token: appt.confirm_token,
  });
  if (ce1) throw new Error(`confirm1: ${ce1.message}`);
  const confirmedOn = await countNotifs(sb, FANCY, "tour_confirmed", sinceConfirm);
  const { data: apptAfter } = await sb
    .from("tour_appointments")
    .select("status, confirmed_at, confirmation_source")
    .eq("id", appt.id)
    .single();

  // Replay — must not duplicate
  const { data: confirm2 } = await sb.rpc("confirm_tour_by_token", {
    p_token: appt.confirm_token,
  });
  const confirmedReplay = await countNotifs(sb, FANCY, "tour_confirmed", sinceConfirm);
  results.tour_confirmed_on = {
    ok:
      confirmedOn.length === 1 &&
      confirmedReplay.length === 1 &&
      (confirm1 as { alreadyConfirmed?: boolean })?.alreadyConfirmed !== true &&
      (confirm2 as { alreadyConfirmed?: boolean })?.alreadyConfirmed === true &&
      apptAfter?.status === "confirmed" &&
      apptAfter?.confirmation_source === "prospect_link" &&
      Boolean(apptAfter?.confirmed_at),
    confirm1,
    confirm2,
    count: confirmedOn.length,
    replayCount: confirmedReplay.length,
    apptAfter,
    row: confirmedOn[0] ?? null,
  };

  // Confirmation request alone must NOT fire tour_confirmed
  await setPrefs(sb, FANCY, { pref_tour_confirmed: true });
  const { data: appt3, error: ae3 } = await sb
    .from("tour_appointments")
    .insert({
      venue_id: FANCY,
      lead_id: lead.id,
      scheduled_at: slotAt(2),
      duration_minutes: 60,
      status: "scheduled",
      contact_name: `${lead.first_name} ${lead.last_name}`,
      contact_email: `tour.notif.${stamp}@hellotocheers.test`,
    } as never)
    .select("id")
    .single();
  if (ae3 || !appt3) throw new Error(`appt3: ${ae3?.message}`);
  const sinceReq = new Date().toISOString();
  await sb
    .from("tour_appointments")
    .update({ confirmation_requested_at: new Date().toISOString() } as never)
    .eq("id", appt3.id);
  const afterRequest = await countNotifs(sb, FANCY, "tour_confirmed", sinceReq);
  results.confirmation_request_no_notify = { ok: afterRequest.length === 0, count: afterRequest.length };

  // Tour confirmed OFF
  await setPrefs(sb, FANCY, { pref_tour_confirmed: false });
  const sinceConfirmOff = new Date().toISOString();
  const { data: appt4 } = await sb
    .from("tour_appointments")
    .insert({
      venue_id: FANCY,
      lead_id: lead.id,
      scheduled_at: slotAt(3),
      duration_minutes: 60,
      status: "scheduled",
      contact_name: `${lead.first_name} ${lead.last_name}`,
      confirm_token: crypto.randomUUID(),
    } as never)
    .select("id, confirm_token")
    .single();
  await sb.rpc("confirm_tour_by_token", { p_token: appt4!.confirm_token });
  const confirmedOff = await countNotifs(sb, FANCY, "tour_confirmed", sinceConfirmOff);
  results.tour_confirmed_off = { ok: confirmedOff.length === 0, count: confirmedOff.length };

  // ── Proposal accepted ON (legacy selection path) ─────────────────────────
  await setPrefs(sb, FANCY, { pref_proposal_accepted: true });
  const token = crypto.randomUUID().replace(/-/g, "");
  const { data: sel, error: se } = await sb
    .from("commercial_selections")
    .insert({
      venue_id: FANCY,
      lead_id: lead.id,
      name: "Signature Wedding",
      total_amount: 7700,
      deposit_amount: 800,
      included_items: [],
      status: "offered",
      offered_at: new Date().toISOString(),
      accept_token: token,
      version: 1,
    } as never)
    .select("id, accept_token, status")
    .single();
  if (se || !sel) throw new Error(`selection: ${se?.message}`);

  const sinceAccept = new Date().toISOString();
  const { data: accept1, error: ace } = await sb.rpc("accept_commercial_selection", {
    p_token: token,
  });
  if (ace) throw new Error(`accept1: ${ace.message}`);
  const acceptedOn = await countNotifs(sb, FANCY, "proposal_accepted", sinceAccept);
  const { data: accept2 } = await sb.rpc("accept_commercial_selection", { p_token: token });
  const acceptedReplay = await countNotifs(sb, FANCY, "proposal_accepted", sinceAccept);
  results.proposal_accepted_on = {
    ok:
      acceptedOn.length === 1 &&
      acceptedReplay.length === 1 &&
      (accept1 as { alreadyAccepted?: boolean })?.alreadyAccepted === false &&
      (accept2 as { alreadyAccepted?: boolean })?.alreadyAccepted === true &&
      String(acceptedOn[0]?.title ?? "").startsWith("Proposal accepted —"),
    accept1,
    accept2,
    count: acceptedOn.length,
    row: acceptedOn[0] ?? null,
  };

  // Proposal accepted OFF
  await setPrefs(sb, FANCY, { pref_proposal_accepted: false });
  const tokenOff = crypto.randomUUID().replace(/-/g, "");
  await sb.from("commercial_selections").insert({
    venue_id: FANCY,
    lead_id: lead.id,
    name: "Garden Package",
    total_amount: 5000,
    deposit_amount: 500,
    included_items: [],
    status: "offered",
    offered_at: new Date().toISOString(),
    accept_token: tokenOff,
    version: 2,
  } as never);
  const sinceAcceptOff = new Date().toISOString();
  await sb.rpc("accept_commercial_selection", { p_token: tokenOff });
  const acceptedOff = await countNotifs(sb, FANCY, "proposal_accepted", sinceAcceptOff);
  results.proposal_accepted_off = { ok: acceptedOff.length === 0, count: acceptedOff.length };

  // Restore prefs ON for venue (product default)
  await setPrefs(sb, FANCY, {
    pref_tour_scheduled: true,
    pref_tour_confirmed: true,
    pref_proposal_accepted: true,
  });

  // Optional: dispatch email for one needs_email row and poll Resend if venue has email
  const { data: fancyVenue } = await sb.from("venues").select("email, name").eq("id", FANCY).single();
  let emailProof: Record<string, unknown> | null = null;
  if (fancyVenue?.email && scheduledOn[0]?.id) {
    // Force needs_email if gate set it
    await sb
      .from("venue_notifications")
      .update({ needs_email: true, emailed_at: null } as never)
      .eq("id", scheduledOn[0].id);
    // Call process endpoint if secret available — otherwise mark for manual cron
    emailProof = {
      note: "Notification row ready for processVenueNotificationEmails; venue email present",
      venueEmail: fancyVenue.email,
      notificationId: scheduledOn[0].id,
      subject: scheduledOn[0].title,
      mailboxHint: MAILBOX,
      daisyAlsoConnected: DAISY,
    };
  }
  results.email = emailProof;

  const ok = Object.entries(results)
    .filter(([k, v]) => typeof v === "object" && v && "ok" in (v as object))
    .every(([, v]) => (v as { ok: boolean }).ok);

  const proof = { ok, results };
  writeFileSync(resolve(OUT, "results.json"), JSON.stringify(proof, null, 2));
  console.log(JSON.stringify(proof, null, 2));
  if (!ok) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
