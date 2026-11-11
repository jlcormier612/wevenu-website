/**
 * Sandbox RPC proof for venue notification clear/dismiss.
 * Disposable notification rows only. Does not rotate credentials.
 *
 * Run: npx tsx --env-file=.env.local scripts/qa/venue-notification-clear-proof.mts
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const service = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
if (!url.includes("wvpsldwwjqdannqasrdf")) throw new Error("Not Sandbox: " + url);
if (!service || !anon) throw new Error("Missing Sandbox keys");

const admin = createClient(url, service, { auth: { persistSession: false } });

const FANCY_VENUE = "a415ac52-cd74-42a6-8df7-7a8f6e71d080";
const FANCY_EMAIL = "jennifer@hellotocheers.com";

const results: Record<string, { ok: boolean; detail: string }> = {};
function record(name: string, ok: boolean, detail: string) {
  results[name] = { ok, detail };
  console.log(`[${ok ? "PASS" : "FAIL"}] ${name}: ${detail}`);
}

async function fancyClient(): Promise<SupabaseClient> {
  const client = createClient(url, anon, { auth: { persistSession: false } });

  // Prefer an existing saved session when still valid.
  try {
    const session = JSON.parse(readFileSync("/tmp/jen-session.json", "utf8")) as {
      access_token?: string;
      refresh_token?: string;
    };
    if (session.access_token && session.refresh_token) {
      const { error } = await client.auth.setSession({
        access_token: session.access_token,
        refresh_token: session.refresh_token,
      });
      if (!error) {
        const { data: user } = await client.auth.getUser();
        if (user.user?.email?.toLowerCase() === FANCY_EMAIL) return client;
      }
    }
  } catch {
    // fall through
  }

  // Service-role magic link — does not rotate Fancy credentials.
  const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: FANCY_EMAIL,
  });
  if (linkErr) throw linkErr;
  const tokenHash = linkData.properties?.hashed_token;
  if (!tokenHash) throw new Error("generateLink missing hashed_token");
  const { error: otpErr } = await client.auth.verifyOtp({
    type: "email",
    token_hash: tokenHash,
  });
  if (otpErr) throw otpErr;
  return client;
}

const { data: otherVenue, error: otherErr } = await admin
  .from("venues")
  .select("id,name")
  .neq("id", FANCY_VENUE)
  .limit(1)
  .maybeSingle();
if (otherErr || !otherVenue) throw new Error("No other venue for isolation: " + otherErr?.message);

const marker = `notif-clear-proof-${Date.now()}`;

const { data: fancyRow, error: fancyInsErr } = await admin
  .from("venue_notifications")
  .insert({
    venue_id: FANCY_VENUE,
    type: "new_lead",
    title: `${marker}-fancy-one`,
    body: "clear-one proof",
    emoji: "🧪",
    link: "/leads",
  })
  .select("id")
  .single();
if (fancyInsErr || !fancyRow) throw new Error("fancy insert: " + fancyInsErr?.message);

const { data: fancyKeep, error: fancyKeepErr } = await admin
  .from("venue_notifications")
  .insert({
    venue_id: FANCY_VENUE,
    type: "new_lead",
    title: `${marker}-fancy-keep`,
    body: "should remain after clear-one",
    emoji: "🧪",
    link: "/leads",
  })
  .select("id")
  .single();
if (fancyKeepErr || !fancyKeep) throw new Error("fancy keep insert: " + fancyKeepErr?.message);

const { data: otherRow, error: otherInsErr } = await admin
  .from("venue_notifications")
  .insert({
    venue_id: otherVenue.id,
    type: "new_lead",
    title: `${marker}-other`,
    body: "must not be cleared",
    emoji: "🧪",
    link: "/leads",
  })
  .select("id")
  .single();
if (otherInsErr || !otherRow) throw new Error("other insert: " + otherInsErr?.message);

record(
  "seed.rows",
  Boolean(fancyRow.id && fancyKeep.id && otherRow.id),
  `fancyOne=${fancyRow.id} fancyKeep=${fancyKeep.id} other=${otherRow.id} otherVenue=${otherVenue.id}`,
);

const fancy = await fancyClient();
record("auth.fancy", true, FANCY_EMAIL);

const { data: clearOneData, error: clearOneErr } = await fancy.rpc(
  "clear_venue_notifications",
  { p_notification_ids: [fancyRow.id] },
);
record(
  "rpc.clear_one",
  !clearOneErr && (clearOneData as { ok?: boolean } | null)?.ok === true,
  JSON.stringify({ clearOneData, clearOneErr: clearOneErr?.message ?? null }),
);

const { data: afterOne } = await admin
  .from("venue_notifications")
  .select("id")
  .in("id", [fancyRow.id, fancyKeep.id, otherRow.id]);
const ids = new Set((afterOne ?? []).map((r) => r.id));
record(
  "rpc.clear_one.isolation",
  !ids.has(fancyRow.id) && ids.has(fancyKeep.id) && ids.has(otherRow.id),
  `remaining=${[...ids].join(",")}`,
);

const { data: crossData, error: crossErr } = await fancy.rpc(
  "clear_venue_notifications",
  { p_notification_ids: [otherRow.id] },
);
const { data: otherStill } = await admin
  .from("venue_notifications")
  .select("id")
  .eq("id", otherRow.id)
  .maybeSingle();
record(
  "rpc.clear_other_venue_id_noop",
  !crossErr &&
    (crossData as { ok?: boolean } | null)?.ok === true &&
    Boolean(otherStill),
  JSON.stringify({ crossData, otherStill: otherStill?.id ?? null }),
);

const { data: clearAllData, error: clearAllErr } = await fancy.rpc(
  "clear_venue_notifications",
  { p_notification_ids: [] },
);
record(
  "rpc.clear_all",
  !clearAllErr && (clearAllData as { ok?: boolean } | null)?.ok === true,
  JSON.stringify({ clearAllData, clearAllErr: clearAllErr?.message ?? null }),
);

const { data: fancyLeft } = await admin
  .from("venue_notifications")
  .select("id")
  .eq("venue_id", FANCY_VENUE)
  .ilike("title", `${marker}%`);
const { data: otherLeft } = await admin
  .from("venue_notifications")
  .select("id")
  .eq("id", otherRow.id)
  .maybeSingle();
record(
  "rpc.clear_all.isolation",
  (fancyLeft ?? []).length === 0 && Boolean(otherLeft),
  `fancyLeft=${(fancyLeft ?? []).length} otherLeft=${otherLeft?.id ?? null}`,
);

const anonClient = createClient(url, anon, { auth: { persistSession: false } });
const { data: unauthData, error: unauthErr } = await anonClient.rpc(
  "clear_venue_notifications",
  { p_notification_ids: [] },
);
record(
  "rpc.unauthenticated_rejected",
  (unauthData as { ok?: boolean } | null)?.ok === false || Boolean(unauthErr),
  JSON.stringify({ unauthData, unauthErr: unauthErr?.message ?? null }),
);

const { data: readSeed } = await admin
  .from("venue_notifications")
  .insert({
    venue_id: FANCY_VENUE,
    type: "new_lead",
    title: `${marker}-read`,
    body: "mark-read proof",
    emoji: "🧪",
    link: "/leads",
  })
  .select("id")
  .single();
const { data: markData, error: markErr } = await fancy.rpc("mark_notifications_read", {
  p_notification_ids: [readSeed!.id],
});
const { data: marked } = await admin
  .from("venue_notifications")
  .select("id,read_at")
  .eq("id", readSeed!.id)
  .maybeSingle();
record(
  "rpc.mark_one_read_still_works",
  !markErr &&
    (markData as { ok?: boolean } | null)?.ok === true &&
    Boolean(marked?.read_at),
  JSON.stringify({ markData, read_at: marked?.read_at ?? null }),
);

await admin.from("venue_notifications").delete().eq("venue_id", FANCY_VENUE).ilike("title", `${marker}%`);
await admin.from("venue_notifications").delete().eq("id", otherRow.id);

const allOk = Object.values(results).every((r) => r.ok);
const out = {
  ok: allOk,
  commit_expected: "cb0e66ae517acd2d9a236e6b11c315d173645217",
  migration: "20261413100000_clear_venue_notifications.sql",
  results,
  at: new Date().toISOString(),
};
mkdirSync("docs/qa/venue-notification-clear", { recursive: true });
writeFileSync(
  "docs/qa/venue-notification-clear/results.json",
  JSON.stringify(out, null, 2),
);
console.log(JSON.stringify({ ok: out.ok, results: Object.fromEntries(Object.entries(results).map(([k, v]) => [k, v.ok])) }, null, 2));
process.exit(allOk ? 0 : 1);
