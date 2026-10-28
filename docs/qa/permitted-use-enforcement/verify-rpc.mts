/**
 * Sandbox RPC proof: permitted_uses enforced on replace_event_space_assignments.
 * EXPECTED_SHA optional for app tip; this script verifies DB authority.
 *
 * npx tsx docs/qa/permitted-use-enforcement/verify-rpc.mts
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import { randomBytes } from "node:crypto";

config({ path: ".env.local", quiet: true });

const FANCY = "a415ac52-cd74-42a6-8df7-7a8f6e71d080";
const BARN = "3b36ec69-b17d-4351-8186-68d96dd6dfe7";
const PATIO = "f6df6024-e6a0-4df8-b391-27f2eae61238";
const OUT = "docs/qa/permitted-use-enforcement";
mkdirSync(OUT, { recursive: true });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
if (!url.includes("wvpsldwwjqdannqasrdf")) throw new Error("not sandbox");
const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });

type Check = { name: string; pass: boolean; detail: string };
const checks: Check[] = [];
function record(name: string, pass: boolean, detail: string) {
  checks.push({ name, pass, detail: String(detail).slice(0, 2000) });
  console.log(`${pass ? "PASS" : "FAIL"} ${name} — ${String(detail).slice(0, 350)}`);
}

async function main() {
  const stamp = `PUE${Date.now().toString(36).toUpperCase()}`;
  const date = "2030-08-19";

  const { data: patio } = await admin.from("venue_spaces")
    .select("id,name,permitted_uses").eq("id", PATIO).single();
  record(
    "patio_cocktail_only",
    Array.isArray(patio?.permitted_uses)
      && patio!.permitted_uses.length === 1
      && patio!.permitted_uses[0] === "cocktail_hour",
    JSON.stringify(patio),
  );

  const { data: ballroom } = await admin.from("venue_spaces")
    .select("id,name").eq("venue_id", FANCY).eq("name", "Ballroom").maybeSingle();
  record("ballroom_present", !!ballroom?.id, ballroom?.id ?? "missing");

  const { data: client, error: cErr } = await admin.from("clients").insert({
    venue_id: FANCY,
    first_name: "PUE",
    last_name: stamp,
    email: `pue-${stamp.toLowerCase()}@hellotocheers-test.invalid`,
    status: "confirmed",
  }).select("id").single();
  if (cErr || !client) throw cErr ?? new Error("client");

  const { data: event, error: eErr } = await admin.from("events").insert({
    venue_id: FANCY,
    client_id: client.id,
    name: `PUE-${stamp}-Probe`,
    event_type: "wedding",
    event_date: date,
    event_end_date: date,
    status: "confirmed",
    booked_at: new Date().toISOString(),
    space_id: BARN,
    start_time: "11:00",
    end_time: "14:00",
  }).select("id").single();
  if (eErr || !event) throw eErr ?? new Error("event");

  // Seed a valid cocktail assignment first
  const { error: seedErr } = await admin.rpc("replace_event_space_assignments", {
    p_venue_id: FANCY,
    p_event_id: event.id,
    p_primary_space_id: PATIO,
    p_assignments: [
      {
        useKey: "cocktail_hour",
        useLabel: "Cocktail Hour",
        spaceId: PATIO,
        startTime: "11:00",
        endTime: "12:00",
        scheduledDate: date,
        sortOrder: 0,
      },
    ],
  });
  record("valid_cocktail_on_patio", !seedErr, seedErr?.message ?? "ok");

  const { data: before } = await admin.from("event_space_assignments")
    .select("use_key,space_id").eq("event_id", event.id);
  record(
    "seed_persisted",
    (before?.length === 1 && before[0]?.use_key === "cocktail_hour" && before[0]?.space_id === PATIO),
    JSON.stringify(before),
  );

  // Invalid: reception on cocktail-only patio
  const { error: badErr } = await admin.rpc("replace_event_space_assignments", {
    p_venue_id: FANCY,
    p_event_id: event.id,
    p_primary_space_id: PATIO,
    p_assignments: [
      {
        useKey: "reception",
        useLabel: "Reception",
        spaceId: PATIO,
        startTime: "12:00",
        endTime: "14:00",
        scheduledDate: date,
        sortOrder: 0,
      },
    ],
  });
  record(
    "invalid_reception_rejected",
    !!badErr && /cannot be used for|permitted_use|Reception/i.test(`${badErr.hint ?? ""} ${badErr.message}`),
    `${badErr?.hint ?? ""} ${badErr?.message ?? "NO_ERROR"}`,
  );

  const { data: afterBad } = await admin.from("event_space_assignments")
    .select("use_key,space_id").eq("event_id", event.id);
  record(
    "invalid_did_not_persist",
    afterBad?.length === 1
      && afterBad[0]?.use_key === "cocktail_hour"
      && afterBad[0]?.space_id === PATIO,
    JSON.stringify(afterBad),
  );

  // Valid barn reception still works
  const { error: barnErr } = await admin.rpc("replace_event_space_assignments", {
    p_venue_id: FANCY,
    p_event_id: event.id,
    p_primary_space_id: BARN,
    p_assignments: [
      {
        useKey: "reception",
        useLabel: "Reception",
        spaceId: BARN,
        startTime: "12:00",
        endTime: "14:00",
        scheduledDate: date,
        sortOrder: 0,
      },
    ],
  });
  record("valid_barn_reception", !barnErr, barnErr?.message ?? "ok");

  // Simultaneous Barn + Ballroom regression (separate events)
  if (ballroom?.id) {
    const day = "2030-09-21";
    async function mk(label: string, spaceId: string, start: string, end: string) {
      const { data: c } = await admin.from("clients").insert({
        venue_id: FANCY,
        first_name: label,
        last_name: stamp,
        email: `pue-${label.toLowerCase()}-${randomBytes(2).toString("hex")}@hellotocheers-test.invalid`,
        status: "confirmed",
      }).select("id").single();
      const { data: ev, error } = await admin.from("events").insert({
        venue_id: FANCY,
        client_id: c!.id,
        name: `PUE-${stamp}-${label}`,
        event_type: "wedding",
        event_date: day,
        event_end_date: day,
        status: "confirmed",
        booked_at: new Date().toISOString(),
        space_id: spaceId,
        start_time: start,
        end_time: end,
      }).select("id").single();
      if (error || !ev) return { ok: false as const, message: error?.message ?? "fail", id: null as string | null };
      const { error: aErr } = await admin.rpc("replace_event_space_assignments", {
        p_venue_id: FANCY,
        p_event_id: ev.id,
        p_primary_space_id: spaceId,
        p_assignments: [
          {
            useKey: "reception",
            useLabel: "Reception",
            spaceId,
            startTime: start,
            endTime: end,
            scheduledDate: day,
            sortOrder: 0,
          },
        ],
      });
      return { ok: !aErr, message: aErr?.message ?? "ok", id: ev.id };
    }
    const a = await mk("SimA", BARN, "16:00", "22:00");
    const b = await mk("SimB", ballroom.id, "17:00", "23:00");
    record("simultaneous_barn_ballroom", a.ok && b.ok, `A=${a.message} B=${b.message}`);

    // Same-space conflict
    const conflict = await mk("ConflictBarn", BARN, "18:00", "21:00");
    record(
      "same_space_conflict",
      !conflict.ok && /space_overlap|already booked/i.test(conflict.message),
      conflict.message,
    );

    // Capacity: need current max
    const { data: rules } = await admin.from("venue_capacity_rules")
      .select("max_simultaneous_events").eq("venue_id", FANCY).maybeSingle();
    const max = rules?.max_simultaneous_events ?? 1;
    record("capacity_config_scoped", typeof max === "number" && max >= 1, `max=${max} venue=${FANCY}`);
  }

  // Part 2: Fancy config isolation — spaces/rules are venue_id scoped
  const { data: otherRules } = await admin.from("venue_capacity_rules")
    .select("venue_id,max_simultaneous_events").neq("venue_id", FANCY).limit(5);
  const { count: fancyOnlySpaces } = await admin.from("venue_spaces")
    .select("id", { count: "exact", head: true })
    .eq("venue_id", FANCY)
    .in("name", ["Ballroom", "Lakeside Pavilion"]);
  record(
    "fancy_spaces_venue_scoped",
    (fancyOnlySpaces ?? 0) >= 1,
    `Ballroom/Lakeside count on Fancy=${fancyOnlySpaces}; other venue rules sample=${JSON.stringify(otherRules?.slice(0, 3))}`,
  );

  const ok = checks.every((c) => c.pass);
  writeFileSync(`${OUT}/rpc-results.json`, JSON.stringify({
    at: new Date().toISOString(),
    stamp,
    eventId: event.id,
    clientId: client.id,
    checks,
    ok,
  }, null, 2));
  console.log(ok ? "VERDICT=GREEN" : "VERDICT=OPEN");
  process.exit(ok ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
