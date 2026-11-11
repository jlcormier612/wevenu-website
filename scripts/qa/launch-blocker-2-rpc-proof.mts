/**
 * Live Sandbox RPC proof for Launch Blocker #2.
 * Disposable identities only. Does not touch Fancy / Jennifer credentials.
 *
 * Run: npx tsx --env-file=.env.local scripts/qa/launch-blocker-2-rpc-proof.mts
 */
import { writeFileSync } from "node:fs";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const service = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
if (!url.includes("wvpsldwwjqdannqasrdf")) throw new Error("Not Sandbox: " + url);
if (!service || !anon) throw new Error("Missing Sandbox keys");

const admin = createClient(url, service, { auth: { persistSession: false } });

const JUNIPER = "af2d6aa1-0eb2-4e65-aa6f-c066cb71a4b6";
const FANCY_USER = "2fa73101-337b-4530-8c77-f3c272c5463e";
const PURCHASER = "6721694e-3f38-45e6-9afa-383ba1fd7564";
const YAHOO_USER = "bb2c2bf3-5082-4a58-9e87-e1ea764f6b5f";
const STAFF_ROW = "f26f53a4-5613-47ff-9523-b37fad9d7adb";
const FANCY_VENUE = "a415ac52-cd74-42a6-8df7-7a8f6e71d080";

const results: Record<string, { ok: boolean; detail: string }> = {};
function record(name: string, ok: boolean, detail: string) {
  results[name] = { ok, detail };
  console.log(`[${ok ? "PASS" : "FAIL"}] ${name}: ${detail}`);
}

async function asUser(email: string, password: string): Promise<SupabaseClient> {
  const client = createClient(url, anon, { auth: { persistSession: false } });
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return client;
}

const { data: juniperVenue } = await admin
  .from("venues")
  .select("id,name,owner_user_id")
  .eq("id", JUNIPER)
  .maybeSingle();
record(
  "repair.venues.owner_not_fancy",
  juniperVenue?.owner_user_id !== FANCY_USER,
  `owner_user_id=${juniperVenue?.owner_user_id ?? "missing"}`,
);

const { data: juniperStaff } = await admin
  .from("venue_staff")
  .select(
    "id,user_id,email,is_owner,owner_invite_pending,accepted_at,invite_token,is_active,access_title",
  )
  .eq("venue_id", JUNIPER)
  .order("created_at", { ascending: false });

const repaired = (juniperStaff ?? []).find((s) => s.id === STAFF_ROW);
record(
  "repair.yahoo_pending_unbound",
  Boolean(
    repaired &&
      repaired.user_id == null &&
      repaired.accepted_at == null &&
      repaired.owner_invite_pending === true &&
      repaired.is_owner === false &&
      Boolean(repaired.invite_token) &&
      String(repaired.email).toLowerCase() === "jyagnesak@yahoo.com",
  ),
  JSON.stringify(repaired ?? null),
);

const fancyJuniper = (juniperStaff ?? []).filter((s) => s.user_id === FANCY_USER);
record(
  "repair.fancy_has_no_juniper_membership",
  fancyJuniper.length === 0,
  `fancyJuniperRows=${fancyJuniper.length}`,
);

const purchaserStaff = (juniperStaff ?? []).find((s) => s.user_id === PURCHASER);
record(
  "repair.purchaser_admin_intact",
  Boolean(purchaserStaff?.is_active && purchaserStaff.accepted_at && purchaserStaff.is_owner === false),
  JSON.stringify(purchaserStaff ?? null),
);

const { data: fancyStaff } = await admin
  .from("venue_staff")
  .select("id,user_id,is_owner,is_active,accepted_at")
  .eq("venue_id", FANCY_VENUE)
  .eq("user_id", FANCY_USER)
  .maybeSingle();
record(
  "repair.fancy_membership_untouched",
  Boolean(fancyStaff?.is_active && fancyStaff.accepted_at),
  JSON.stringify(fancyStaff ?? null),
);

const { data: yahooJuniper } = await admin
  .from("venue_staff")
  .select("id,user_id,email")
  .eq("venue_id", JUNIPER)
  .eq("user_id", YAHOO_USER);
record(
  "repair.yahoo_can_still_accept",
  (yahooJuniper ?? []).length === 0 && Boolean(repaired?.invite_token),
  `yahooBound=${(yahooJuniper ?? []).length} pendingToken=${Boolean(repaired?.invite_token)}`,
);

const stamp = Date.now();
const password = `Lb2-${stamp}-Hx9kQ2`;
const emailA = `lb2.a.${stamp}@hellotocheers-test.invalid`;
const emailB = `lb2.b.${stamp}@hellotocheers-test.invalid`;
const emailC = `lb2.c.${stamp}@hellotocheers-test.invalid`;

const { data: userA, error: errA } = await admin.auth.admin.createUser({
  email: emailA,
  password,
  email_confirm: true,
});
if (errA || !userA.user) throw errA ?? new Error("create A failed");
const { data: userB, error: errB } = await admin.auth.admin.createUser({
  email: emailB,
  password,
  email_confirm: true,
});
if (errB || !userB.user) throw errB ?? new Error("create B failed");
const { data: userC, error: errC } = await admin.auth.admin.createUser({
  email: emailC,
  password,
  email_confirm: true,
});
if (errC || !userC.user) throw errC ?? new Error("create C failed");

async function insertVenue(name: string, ownerId: string, email: string) {
  const { data, error } = await admin
    .from("venues")
    .insert({ owner_user_id: ownerId, name, email })
    .select("id,name")
    .single();
  if (error || !data) throw error ?? new Error("venue insert failed: " + name);
  return data;
}

const prior = await insertVenue(`LB2 Prior ${stamp}`, userA.user.id, emailA);
const purchased = await insertVenue(`LB2 New ${stamp}`, userA.user.id, emailA);
const stranger = await insertVenue(`LB2 Stranger ${stamp}`, userC.user.id, emailC);

async function insertStaff(input: Record<string, unknown>) {
  const { error } = await admin.from("venue_staff").insert(input);
  if (error) throw error;
}

await insertStaff({
  venue_id: prior.id,
  user_id: userA.user.id,
  full_name: "LB2 Purchaser",
  email: emailA,
  role: "owner",
  is_owner: true,
  is_active: true,
  accepted_at: new Date().toISOString(),
  access_title: "administrator",
  title_basis: "administrator",
  capability_overrides: {},
  owner_invite_pending: false,
});
await insertStaff({
  venue_id: purchased.id,
  user_id: userA.user.id,
  full_name: "LB2 Purchaser",
  email: emailA,
  role: "manager",
  is_owner: false,
  is_active: true,
  accepted_at: new Date().toISOString(),
  access_title: "administrator",
  title_basis: "administrator",
  capability_overrides: { "account.billing": true },
  owner_invite_pending: false,
});
await insertStaff({
  venue_id: stranger.id,
  user_id: userC.user.id,
  full_name: "LB2 Stranger",
  email: emailC,
  role: "owner",
  is_owner: true,
  is_active: true,
  accepted_at: new Date().toISOString(),
  access_title: "administrator",
  title_basis: "administrator",
  capability_overrides: {},
  owner_invite_pending: false,
});

const { error: ctxErr } = await admin.from("venue_staff_active_context").upsert({
  user_id: userA.user.id,
  active_venue_id: prior.id,
  updated_at: new Date().toISOString(),
});
if (ctxErr) throw ctxErr;

const inviteToken = crypto.randomUUID();
await insertStaff({
  venue_id: purchased.id,
  user_id: null,
  full_name: "LB2 Invited Owner",
  email: emailB,
  role: "manager",
  is_owner: false,
  is_active: true,
  accepted_at: null,
  invited_at: new Date().toISOString(),
  invite_token: inviteToken,
  access_title: "administrator",
  title_basis: "administrator",
  capability_overrides: {},
  owner_invite_pending: true,
});

const clientA = await asUser(emailA, password);
const mismatch = await clientA.rpc("accept_team_invitation", { p_token: inviteToken });
const mismatchPayload = mismatch.data as { ok?: boolean; error?: string } | null;
record(
  "1.invite_mismatch_rejects",
  mismatchPayload?.ok === false && mismatchPayload.error === "email_mismatch",
  JSON.stringify(mismatchPayload ?? mismatch.error),
);

const { data: afterMismatch } = await admin
  .from("venue_staff")
  .select("id,user_id,is_owner,accepted_at,invite_token,owner_invite_pending")
  .eq("venue_id", purchased.id)
  .eq("email", emailB)
  .maybeSingle();
record(
  "2.invite_not_consumed_on_mismatch",
  Boolean(afterMismatch?.invite_token === inviteToken && afterMismatch.accepted_at == null),
  JSON.stringify(afterMismatch ?? null),
);
record(
  "3.wrong_user_no_membership",
  afterMismatch?.user_id !== userA.user.id,
  `boundUser=${afterMismatch?.user_id ?? "null"}`,
);
record(
  "4.wrong_user_no_owner_role",
  afterMismatch?.is_owner !== true && afterMismatch?.user_id !== userA.user.id,
  `is_owner=${afterMismatch?.is_owner} user_id=${afterMismatch?.user_id ?? "null"}`,
);

const { data: aCtxAfterMismatch } = await admin
  .from("venue_staff_active_context")
  .select("active_venue_id")
  .eq("user_id", userA.user.id)
  .maybeSingle();
record(
  "mismatch_no_active_venue_change",
  aCtxAfterMismatch?.active_venue_id === prior.id,
  `active=${aCtxAfterMismatch?.active_venue_id}`,
);

const clientB = await asUser(emailB, password);
const accept = await clientB.rpc("accept_team_invitation", { p_token: inviteToken });
const acceptPayload = accept.data as { ok?: boolean; error?: string; venueId?: string; isOwner?: boolean } | null;
record(
  "5.correct_identity_accepts",
  acceptPayload?.ok === true && acceptPayload.venueId === purchased.id,
  JSON.stringify(acceptPayload ?? accept.error),
);

const { data: afterAccept } = await admin
  .from("venue_staff")
  .select("id,user_id,is_owner,accepted_at,invite_token,owner_invite_pending,email")
  .eq("venue_id", purchased.id)
  .eq("email", emailB)
  .maybeSingle();
record(
  "6.correct_identity_receives_owner",
  Boolean(
    afterAccept?.user_id === userB.user.id &&
      afterAccept.is_owner === true &&
      afterAccept.accepted_at &&
      afterAccept.invite_token == null,
  ),
  JSON.stringify(afterAccept ?? null),
);

const replay = await clientB.rpc("accept_team_invitation", { p_token: inviteToken });
const replayPayload = replay.data as { ok?: boolean; error?: string } | null;
record(
  "7.invite_cannot_replay",
  replayPayload?.ok === false && replayPayload.error === "invalid_or_expired_token",
  JSON.stringify(replayPayload ?? replay.error),
);

const { data: bCtx } = await admin
  .from("venue_staff_active_context")
  .select("active_venue_id")
  .eq("user_id", userB.user.id)
  .maybeSingle();
record(
  "8.successful_invite_activates_venue",
  bCtx?.active_venue_id === purchased.id,
  `active=${bCtx?.active_venue_id}`,
);

const { data: otherOwners } = await admin
  .from("venue_staff")
  .select("user_id,email,is_owner")
  .eq("venue_id", purchased.id)
  .eq("is_owner", true);
record(
  "invite_owner_not_granted_to_others",
  (otherOwners ?? []).every((s) => s.user_id === userB.user.id),
  JSON.stringify(otherOwners ?? []),
);

const { data: handoffCreate, error: hErr } = await admin.rpc("create_venue_onboarding_handoff", {
  p_user_id: userA.user.id,
  p_intended_email: emailA,
  p_venue_id: purchased.id,
  p_origin: "purchase_activation",
});
record(
  "9.purchase_handoff_preserves_venue",
  !hErr && (handoffCreate as { ok?: boolean })?.ok === true,
  JSON.stringify(handoffCreate ?? hErr),
);

const consume = await clientA.rpc("consume_venue_onboarding_handoff");
const consumePayload = consume.data as { ok?: boolean; venueId?: string; error?: string } | null;
record(
  "10.purchase_handoff_activates_new_venue",
  consumePayload?.ok === true && consumePayload.venueId === purchased.id,
  JSON.stringify(consumePayload ?? consume.error),
);

const { data: aMemberships } = await admin
  .from("venue_staff")
  .select("venue_id,is_owner,is_active")
  .eq("user_id", userA.user.id)
  .eq("is_active", true);
record(
  "11.prior_venue_membership_intact",
  Boolean(
    aMemberships?.some((s) => s.venue_id === prior.id) &&
      aMemberships?.some((s) => s.venue_id === purchased.id),
  ),
  JSON.stringify(aMemberships ?? []),
);

await admin.from("venue_staff_active_context").upsert({
  user_id: userA.user.id,
  active_venue_id: prior.id,
  updated_at: new Date().toISOString(),
});
const { data: keep } = await admin
  .from("venue_staff_active_context")
  .select("active_venue_id")
  .eq("user_id", userA.user.id)
  .maybeSingle();
record(
  "12.ordinary_keep_valid_context",
  keep?.active_venue_id === prior.id,
  `active=${keep?.active_venue_id}`,
);

const switchBack = await clientA.rpc("set_active_venue", { p_venue_id: purchased.id });
const switchPayload = switchBack.data as { ok?: boolean; venueId?: string } | null;
record(
  "13.manual_switch_still_works",
  switchPayload?.ok === true && switchPayload.venueId === purchased.id,
  JSON.stringify(switchPayload ?? switchBack.error),
);

const rawSwitch = await clientA.rpc("set_active_venue", { p_venue_id: stranger.id });
const rawPayload = rawSwitch.data as { ok?: boolean; error?: string } | null;
record(
  "14.raw_venue_id_cannot_authorize",
  rawPayload?.ok === false && rawPayload.error === "not_a_member",
  JSON.stringify(rawPayload ?? rawSwitch.error),
);

const { data: expiredHandoff, error: expErr } = await admin.rpc("create_venue_onboarding_handoff", {
  p_user_id: userA.user.id,
  p_intended_email: emailA,
  p_venue_id: prior.id,
  p_origin: "purchase_activation",
  p_ttl_minutes: 1,
});
if (expErr) throw expErr;
const expiredId = (expiredHandoff as { id?: string })?.id;
if (expiredId) {
  await admin
    .from("venue_onboarding_handoffs")
    .update({ expires_at: new Date(Date.now() - 60_000).toISOString() })
    .eq("id", expiredId);
}
const expiredConsume = await clientA.rpc("consume_venue_onboarding_handoff");
const expiredPayload = expiredConsume.data as { ok?: boolean; error?: string } | null;
record(
  "15.handoff_expires",
  expiredPayload?.ok === false && expiredPayload.error === "no_handoff",
  JSON.stringify(expiredPayload ?? expiredConsume.error),
);

const { error: replayCreateErr } = await admin.rpc("create_venue_onboarding_handoff", {
  p_user_id: userA.user.id,
  p_intended_email: emailA,
  p_venue_id: purchased.id,
  p_origin: "purchase_activation",
});
if (replayCreateErr) throw replayCreateErr;
const firstConsume = await clientA.rpc("consume_venue_onboarding_handoff");
const secondConsume = await clientA.rpc("consume_venue_onboarding_handoff");
const firstPayload = firstConsume.data as { ok?: boolean; venueId?: string } | null;
const secondPayload = secondConsume.data as { ok?: boolean; error?: string } | null;
record(
  "16.handoff_cannot_replay",
  firstPayload?.ok === true && secondPayload?.ok === false && secondPayload.error === "no_handoff",
  JSON.stringify({ first: firstPayload, second: secondPayload }),
);

const { error: wrongCreateErr } = await admin.rpc("create_venue_onboarding_handoff", {
  p_user_id: userA.user.id,
  p_intended_email: emailA,
  p_venue_id: purchased.id,
  p_origin: "purchase_activation",
});
if (wrongCreateErr) throw wrongCreateErr;
const clientC = await asUser(emailC, password);
const wrongConsume = await clientC.rpc("consume_venue_onboarding_handoff");
const wrongPayload = wrongConsume.data as { ok?: boolean; error?: string } | null;
record(
  "17.handoff_wrong_user_rejected",
  wrongPayload?.ok === false,
  JSON.stringify(wrongPayload ?? wrongConsume.error),
);
const { data: cCtx } = await admin
  .from("venue_staff_active_context")
  .select("active_venue_id")
  .eq("user_id", userC.user.id)
  .maybeSingle();
record(
  "18.no_cross_venue_from_handoff",
  cCtx?.active_venue_id !== purchased.id && cCtx?.active_venue_id !== prior.id,
  `cActive=${cCtx?.active_venue_id ?? "none"}`,
);

const emailD = `lb2.d.${stamp}@hellotocheers-test.invalid`;
const { data: userD, error: errD } = await admin.auth.admin.createUser({
  email: emailD,
  password,
  email_confirm: true,
});
if (errD || !userD.user) throw errD ?? new Error("create D failed");

const browserInviteToken = crypto.randomUUID();
await insertStaff({
  venue_id: purchased.id,
  user_id: null,
  full_name: "LB2 Browser Invited Owner",
  email: emailD,
  role: "manager",
  is_owner: false,
  is_active: true,
  accepted_at: null,
  invited_at: new Date().toISOString(),
  invite_token: browserInviteToken,
  access_title: "administrator",
  title_basis: "administrator",
  capability_overrides: {},
  owner_invite_pending: true,
});

await admin.from("venue_staff_active_context").upsert({
  user_id: userA.user.id,
  active_venue_id: prior.id,
  updated_at: new Date().toISOString(),
});
const { error: browserHandoffErr } = await admin.rpc("create_venue_onboarding_handoff", {
  p_user_id: userA.user.id,
  p_intended_email: emailA,
  p_venue_id: purchased.id,
  p_origin: "purchase_activation",
});
if (browserHandoffErr) throw browserHandoffErr;

const failed = Object.entries(results).filter(([, v]) => !v.ok);
const fixture = {
  emailA,
  emailB,
  emailC,
  emailD,
  password,
  userA: userA.user.id,
  userB: userB.user.id,
  userC: userC.user.id,
  userD: userD.user.id,
  prior,
  purchased,
  stranger,
  inviteUrl: `/join?token=${browserInviteToken}`,
  juniperRepair: {
    staffRow: repaired,
    purchaserStaff,
    fancyJuniperCount: fancyJuniper.length,
  },
  results,
  failed: failed.map(([k]) => k),
};
writeFileSync("/tmp/lb2-e2e.json", JSON.stringify(fixture, null, 2));
console.log(JSON.stringify({ failed: fixture.failed, pass: Object.keys(results).length - failed.length }, null, 2));
if (failed.length) process.exitCode = 1;
