/**
 * Prove seed_public_form_starter rejects ordinary authenticated callers.
 * Uses a disposable auth user + anon client. Never touches curated venues.
 *
 *   npx tsx scripts/sandbox/prove-seed-rpc-authz.mts
 */
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { PUBLIC_FORM_STARTER_MASTERS } from "@/lib/public-forms/starters";
import { PROTECTED_SANDBOX_VENUE_IDS } from "@/lib/qa/protected-venues";

config({ path: ".env.local", quiet: true });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const OUT = join(process.env.HOME!, "Desktop/HTC-willow-demo-cleanup-plan");

const admin = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function main() {
  const stamp = `${Date.now()}`;
  const email = `jennifer+rpc-authz.${stamp}@hellotocheers.com`;
  const password = `Rpc-${stamp}-Aa1x`;

  const { data: userData, error: uErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (uErr || !userData.user) throw uErr ?? new Error("createUser failed");
  const userId = userData.user.id;

  // Disposable venue so any accidental success cannot touch curated data.
  const { data: venue, error: vErr } = await admin
    .from("venues")
    .insert({
      owner_user_id: userId,
      name: `[DISPOSABLE-RPC-AUTHZ] ${stamp}`,
      email,
      setup_completed: true,
      setup_completed_at: new Date().toISOString(),
    })
    .select("id, name")
    .single();
  if (vErr || !venue) throw vErr ?? new Error("venue insert failed");

  await admin.from("venue_staff").insert({
    venue_id: venue.id,
    user_id: userId,
    full_name: "RPC Authz Probe",
    email,
    role: "owner",
    is_owner: true,
    is_active: true,
    accepted_at: new Date().toISOString(),
    access_title: "administrator",
    title_basis: "administrator",
    capability_overrides: {},
    owner_invite_pending: false,
  });

  const userClient = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error: signErr } = await userClient.auth.signInWithPassword({ email, password });
  if (signErr) throw signErr;

  const master = PUBLIC_FORM_STARTER_MASTERS[0];
  const { data, error } = await userClient.rpc("seed_public_form_starter", {
    p_venue_id: venue.id,
    p_starter_key: master.key,
    p_internal_name: "ATTACKER TITLE",
    p_public_title: "ATTACKER PUBLIC",
    p_description: "should never install",
    p_field_config: {},
    p_questions: [{ question_text: "pwned", question_type: "short_answer", required: false, sort_order: 1 }],
  });

  const errMsg = error?.message ?? "";
  const denied =
    /permission denied|not found|does not exist|service_role required|42501|42883/i.test(errMsg) ||
    (error != null && data == null);

  // Confirm no form was created under starter_key for this venue.
  const { data: forms } = await admin
    .from("public_forms")
    .select("id, starter_key, internal_name, public_title")
    .eq("venue_id", venue.id);

  const curatedUntouched = {
    willow: PROTECTED_SANDBOX_VENUE_IDS.WILLOW_GROVE,
    fancy: PROTECTED_SANDBOX_VENUE_IDS.JENS_FANCY_VENUE,
    daisy: PROTECTED_SANDBOX_VENUE_IDS.SWEET_DAISY_BARN,
  };

  const report = {
    measuredAt: new Date().toISOString(),
    disposableVenueId: venue.id,
    authenticatedRpcError: errMsg || null,
    authenticatedRpcData: data,
    denied,
    formsAfterAttempt: forms,
    noStarterInstalled: !(forms ?? []).some((f) => f.starter_key),
    curatedVenueIdsNotUsed: curatedUntouched,
    ok: denied && !(forms ?? []).some((f) => f.starter_key),
  };

  // Teardown disposable
  await admin.from("public_form_questions").delete().eq("venue_id", venue.id);
  await admin.from("public_forms").delete().eq("venue_id", venue.id);
  await admin.from("venue_staff").delete().eq("venue_id", venue.id);
  await admin.from("venues").delete().eq("id", venue.id);
  await admin.auth.admin.deleteUser(userId);

  writeFileSync(join(OUT, "SEED-RPC-AUTHZ-PROOF.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  if (!report.ok) process.exitCode = 2;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
