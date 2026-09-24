/**
 * Read-only Sandbox proof for Event Spaces + calendar filter.
 * Usage: npx tsx --env-file=.env.local scripts/qa/prove-event-spaces-ux.ts
 */
import { createClient } from "@supabase/supabase-js";
import { mkdirSync, writeFileSync } from "fs";
import { resolve } from "path";

import { shouldShowCalendarSpaceFilter } from "@/lib/venue-spaces/uses";
import { calendarItemMatchesSpace } from "@/lib/calendar/space-filter";

const FANCY = "a415ac52-cd74-42a6-8df7-7a8f6e71d080";
const OUT = resolve("docs/qa/event-spaces-calendar-uses");

async function main() {
  mkdirSync(OUT, { recursive: true });
  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );

  const { data: venues, error: vErr } = await sb
    .from("venues")
    .select("id,name,space_operating_mode")
    .or("name.ilike.%Fancy%,name.ilike.%Daisy%");
  if (vErr) throw vErr;

  const fancy = (venues ?? []).find((v) => /fancy/i.test(v.name));
  const daisy = (venues ?? []).find((v) => /daisy/i.test(v.name));
  if (!fancy) throw new Error("Fancy venue missing");

  const { data: spaces, error: sErr } = await sb
    .from("venue_spaces")
    .select("id,venue_id,name,capacity,permitted_uses,is_active,sort_order")
    .in("venue_id", [fancy.id, daisy?.id].filter(Boolean) as string[])
    .order("sort_order");
  if (sErr) throw sErr;

  const fancySpaces = (spaces ?? []).filter((s) => s.venue_id === fancy.id && s.is_active);
  const daisySpaces = (spaces ?? []).filter((s) => daisy && s.venue_id === daisy.id && s.is_active);

  const { data: assignments } = await sb
    .from("event_space_assignments")
    .select("event_id,use_key,use_label,space_id,venue_spaces(name)")
    .eq("venue_id", fancy.id)
    .limit(40);

  const result = {
    fancy: {
      id: fancy.id,
      name: fancy.name,
      mode: fancy.space_operating_mode,
      showFilter: shouldShowCalendarSpaceFilter(
        fancy.space_operating_mode as "single" | "multi",
        fancySpaces.length,
      ),
      spaces: fancySpaces.map((s) => ({
        id: s.id,
        name: s.name,
        capacity: s.capacity,
        permitted_uses: s.permitted_uses,
      })),
    },
    daisy: daisy
      ? {
          id: daisy.id,
          name: daisy.name,
          mode: daisy.space_operating_mode,
          showFilter: shouldShowCalendarSpaceFilter(
            daisy.space_operating_mode as "single" | "multi",
            daisySpaces.length,
          ),
          spaces: daisySpaces.map((s) => ({
            id: s.id,
            name: s.name,
            capacity: s.capacity,
            permitted_uses: s.permitted_uses,
          })),
        }
      : null,
    assignmentSample: (assignments ?? []).slice(0, 12),
    filterProof: {
      allSpacesShowsBoth: calendarItemMatchesSpace({ spaceId: "barn", spaceIds: ["barn"] }, null),
      barnOnly: calendarItemMatchesSpace({ spaceId: "barn", spaceIds: ["barn"] }, "barn"),
      unassignedNotBarn: calendarItemMatchesSpace({ spaceId: null, spaceIds: [] }, "barn") === false,
    },
    preserved: {
      barn: fancySpaces.find((s) => /barn/i.test(s.name)),
      bridge: fancySpaces.find((s) => /bridge/i.test(s.name)),
      lawn: fancySpaces.find((s) => /lawn|garden/i.test(s.name)),
    },
  };

  writeFileSync(resolve(OUT, "db-baseline.json"), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
