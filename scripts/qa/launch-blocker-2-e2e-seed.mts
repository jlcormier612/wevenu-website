/**
 * Disposable Sandbox identities for Launch Blocker #2 E2E.
 * Does not touch Fancy / Jennifer credentials.
 */
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
if (!url.includes("wvpsldwwjqdannqasrdf")) throw new Error("Not Sandbox: " + url);
const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY || "", {
  auth: { persistSession: false },
});

const stamp = Date.now();
const password = `Lb2-${stamp}-Hx9kQ2`;
const emailA = `lb2.a.${stamp}@hellotocheers-test.invalid`;
const emailB = `lb2.b.${stamp}@hellotocheers-test.invalid`;

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

const { data: v1, error: v1err } = await admin
  .from("venues")
  .insert({
    owner_user_id: userA.user.id,
    name: `LB2 Prior ${stamp}`,
    email: emailA,
  })
  .select("id,name")
  .single();
if (v1err || !v1) throw v1err ?? new Error("v1");

const { data: v2, error: v2err } = await admin
  .from("venues")
  .insert({
    owner_user_id: userA.user.id,
    name: `LB2 New ${stamp}`,
    email: emailA,
  })
  .select("id,name")
  .single();
if (v2err || !v2) throw v2err ?? new Error("v2");

async function staff(input: Record<string, unknown>) {
  const { error } = await admin.from("venue_staff").insert(input);
  if (error) throw error;
}

await staff({
  venue_id: v1.id,
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

await staff({
  venue_id: v2.id,
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

const { error: ctxErr } = await admin.from("venue_staff_active_context").upsert({
  user_id: userA.user.id,
  active_venue_id: v1.id,
  updated_at: new Date().toISOString(),
});
if (ctxErr) throw ctxErr;

const { data: handoff, error: hErr } = await admin.rpc("create_venue_onboarding_handoff", {
  p_user_id: userA.user.id,
  p_intended_email: emailA,
  p_venue_id: v2.id,
  p_origin: "purchase_activation",
});
if (hErr) throw hErr;

const inviteToken = crypto.randomUUID();
await staff({
  venue_id: v2.id,
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

const out = {
  emailA,
  emailB,
  password,
  userA: userA.user.id,
  userB: userB.user.id,
  priorVenue: v1,
  newVenue: v2,
  handoff,
  inviteUrl: `/join?token=${inviteToken}`,
};
console.log(JSON.stringify(out, null, 2));
