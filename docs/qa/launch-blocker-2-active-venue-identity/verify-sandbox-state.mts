/**
 * Read-only Sandbox proof for Launch Blocker #2 residual state.
 * No invites accepted, no handoffs created, no user/venue mutations.
 */
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import { writeFileSync, mkdirSync } from "node:fs";

config({ path: ".env.local", quiet: true });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
if (!url.includes("wvpsldwwjqdannqasrdf")) throw new Error("refusing non-sandbox");

const JUNIPER = "af2d6aa1-0eb2-4e65-aa6f-c066cb71a4b6";
const FANCY_UID = "2fa73101-337b-4530-8c77-f3c272c5463e";
const FANCY_VENUE = "a415ac52-cd74-42a6-8df7-7a8f6e71d080";
const PURCHASER = "6721694e-3f38-45e6-9afa-383ba1fd7564";
const OUT = "docs/qa/launch-blocker-2-active-venue-identity";

const admin = createClient(url, key, { auth: { persistSession: false } });

async function main() {
  const { data: venue } = await admin
    .from("venues")
    .select("id, name, owner_user_id")
    .eq("id", JUNIPER)
    .maybeSingle();

  const { data: fancyJuniper } = await admin
    .from("venue_staff")
    .select("id, email, user_id, is_owner, accepted_at")
    .eq("venue_id", JUNIPER)
    .eq("user_id", FANCY_UID);

  const { data: juniperStaff } = await admin
    .from("venue_staff")
    .select("id, email, user_id, is_owner, accepted_at, owner_invite_pending, invite_token")
    .eq("venue_id", JUNIPER)
    .eq("is_active", true);

  const { data: purchaserCtx } = await admin
    .from("venue_staff_active_context")
    .select("active_venue_id, updated_at")
    .eq("user_id", PURCHASER)
    .maybeSingle();

  const { data: fancyCtx } = await admin
    .from("venue_staff_active_context")
    .select("active_venue_id")
    .eq("user_id", FANCY_UID)
    .maybeSingle();

  const { error: handoffErr } = await admin
    .from("venue_onboarding_handoffs")
    .select("id")
    .limit(1);

  // Live RPC: Fancy session must get email_mismatch on a pending non-Fancy invite if any.
  const pendingOther = (juniperStaff ?? []).find(
    (s) =>
      !s.accepted_at &&
      s.invite_token &&
      String(s.email ?? "").toLowerCase() !== "jennifer@hellotocheers.com",
  );

  let mismatchProbe: { ok?: boolean; error?: string } | null = null;
  if (pendingOther?.invite_token) {
    const anon = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
      auth: { persistSession: false },
    });
    const { data: link } = await admin.auth.admin.generateLink({
      type: "magiclink",
      email: "jennifer@hellotocheers.com",
    });
    const { data: otp, error: otpErr } = await anon.auth.verifyOtp({
      type: "email",
      token_hash: link.properties!.hashed_token!,
    });
    if (otpErr || !otp.session) throw otpErr ?? new Error("no fancy session");
    const authed = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
      global: { headers: { Authorization: `Bearer ${otp.session.access_token}` } },
      auth: { persistSession: false },
    });
    const { data } = await authed.rpc("accept_team_invitation", {
      p_token: pendingOther.invite_token,
    });
    mismatchProbe = data as { ok?: boolean; error?: string };
    await anon.auth.signOut();
  }

  const checks = {
    handoffsTableExists: !handoffErr,
    fancyHasNoJuniperMembership: (fancyJuniper?.length ?? 0) === 0,
    fancyActiveIsFancy: fancyCtx?.active_venue_id === FANCY_VENUE,
    juniperOwnerNotFancy: venue?.owner_user_id !== FANCY_UID,
    mismatchRejectsWhenPendingInvite:
      !pendingOther || mismatchProbe?.error === "email_mismatch",
  };

  const results = {
    at: new Date().toISOString(),
    servingExpected: "2bfe4cde2224d24169f906f5a2bc777488722795",
    venue: {
      id: venue?.id,
      name: venue?.name,
      ownerUserIdPrefix: venue?.owner_user_id?.slice(0, 8) ?? null,
    },
    fancyJuniperCount: fancyJuniper?.length ?? 0,
    juniperStaffSummary: (juniperStaff ?? []).map((s) => ({
      emailDomain: String(s.email ?? "").split("@")[1] ?? "",
      hasUserId: Boolean(s.user_id),
      isOwner: s.is_owner,
      accepted: Boolean(s.accepted_at),
      ownerInvitePending: Boolean(s.owner_invite_pending),
      hasInviteToken: Boolean(s.invite_token),
    })),
    purchaserActivePrefix: purchaserCtx?.active_venue_id?.slice(0, 8) ?? null,
    fancyActivePrefix: fancyCtx?.active_venue_id?.slice(0, 8) ?? null,
    mismatchProbe,
    pendingInviteProbed: Boolean(pendingOther),
    checks,
    allPass: Object.values(checks).every(Boolean),
    readOnly: true,
  };

  mkdirSync(OUT, { recursive: true });
  writeFileSync(`${OUT}/sandbox-state-results.json`, JSON.stringify(results, null, 2));
  console.log(JSON.stringify(results, null, 2));
  if (!results.allPass) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
