import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import { translateEmailBounceFailure } from "@/lib/communication/failure-messages";
import { writeFileSync } from "node:fs";

config({ path: ".env.local", quiet: true });
const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
);
const FANCY = "a415ac52-cd74-42a6-8df7-7a8f6e71d080";

const { data: all } = await admin
  .from("conversation_messages")
  .select("id, failure_reason")
  .eq("venue_id", FANCY)
  .eq("channel", "email")
  .in("status", ["failed", "undelivered"]);

const map = new Map<string, number>();
for (const r of all ?? []) {
  const k = r.failure_reason ?? "(null)";
  map.set(k, (map.get(k) ?? 0) + 1);
}
console.log("buckets", [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12));

const generic = (all ?? []).filter((m) =>
  (m.failure_reason ?? "").toLowerCase().includes("couldn't be delivered")
  || (m.failure_reason ?? "").toLowerCase().includes("couldn’t be delivered")
  || (m.failure_reason ?? "").toLowerCase().includes("could not be delivered"),
);
console.log("genericCount", generic.length, "sampleHex",
  Buffer.from(generic[0]?.failure_reason ?? "").toString("hex"));

const ids = generic.map((m) => m.id);
const { data: events } = await admin
  .from("conversation_message_events")
  .select("message_id, payload")
  .in("message_id", ids)
  .eq("event_type", "email.bounced");

let updated = 0;
const samples: Array<{ id: string; type: string; reason: string }> = [];
for (const e of events ?? []) {
  const bounce =
    (e.payload as { data?: { bounce?: Record<string, unknown> } } | null)?.data?.bounce
    ?? null;
  if (!bounce) continue;
  const reason = translateEmailBounceFailure({
    type: typeof bounce.type === "string" ? bounce.type : null,
    subType: typeof bounce.subType === "string" ? bounce.subType : null,
    message: typeof bounce.message === "string" ? bounce.message : null,
    diagnosticCode: bounce.diagnosticCode as string[] | string | null,
  });
  const { data, error } = await admin
    .from("conversation_messages")
    .update({ failure_reason: reason })
    .eq("id", e.message_id)
    .eq("venue_id", FANCY)
    .select("id");
  if (error) throw error;
  if (data?.length) {
    updated += 1;
    if (samples.length < 5) {
      samples.push({
        id: e.message_id,
        type: String(bounce.type ?? ""),
        reason: reason.slice(0, 180),
      });
    }
  }
}
const result = { generic: generic.length, events: events?.length ?? 0, updated, samples };
writeFileSync(
  "docs/qa/email-delivery-failure-guidance/backfill-results.json",
  JSON.stringify(result, null, 2),
);
console.log(JSON.stringify(result, null, 2));
