/**
 * Read-only: dump owner-related venue_staff rows for Jen's Fancy Venue.
 * Usage: npx tsx --env-file=.env.local scripts/qa/prove-owner-setup-states.ts
 */
import { createClient } from "@supabase/supabase-js";
import { writeFileSync, mkdirSync } from "node:fs";

const FANCY = "a415ac52-cd74-42a6-8df7-7a8f6e71d080";

async function main() {
  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );

  const { data, error } = await sb
    .from("venue_staff")
    .select(
      "id, full_name, email, is_owner, owner_invite_pending, accepted_at, user_id, invite_token, invited_at, is_active, access_title",
    )
    .eq("venue_id", FANCY)
    .eq("is_active", true)
    .or("is_owner.eq.true,owner_invite_pending.eq.true")
    .order("is_owner", { ascending: false });

  const out = {
    at: new Date().toISOString(),
    venueId: FANCY,
    error: error?.message ?? null,
    owners: data ?? [],
  };
  mkdirSync("docs/qa/owner-setup-invite-separate", { recursive: true });
  writeFileSync(
    "docs/qa/owner-setup-invite-separate/db-owners-baseline.json",
    JSON.stringify(out, null, 2),
  );
  console.log(JSON.stringify(out, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
