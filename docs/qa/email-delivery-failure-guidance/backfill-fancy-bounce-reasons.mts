/**
 * One-shot Sandbox repair: restore Fancy bounce failure_reason from
 * conversation_message_events payloads (evidence already stored).
 * No sends. No status changes.
 */
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import { writeFileSync } from "node:fs";
import { translateEmailBounceFailure } from "@/lib/communication/failure-messages";

config({ path: ".env.local", quiet: true });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
if (!url.includes("wvpsldwwjqdannqasrdf")) throw new Error("refusing non-sandbox");
const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false },
});
const FANCY = "a415ac52-cd74-42a6-8df7-7a8f6e71d080";
const OUT = "docs/qa/email-delivery-failure-guidance/backfill-results.json";

async function main() {
  const { data: all, error } = await admin
    .from("conversation_messages")
    .select("id, failure_reason")
    .eq("venue_id", FANCY)
    .eq("channel", "email")
    .in("status", ["failed", "undelivered"])
    .ilike("failure_reason", "%couldn%t be delivered%");
  if (error) throw error;

  const ids = (all ?? []).map((m) => m.id);
  const { data: events, error: evErr } = await admin
    .from("conversation_message_events")
    .select("message_id, payload")
    .in("message_id", ids)
    .eq("event_type", "email.bounced");
  if (evErr) throw evErr;

  let updated = 0;
  const samples: Array<{ id: string; type: string; reason: string }> = [];
  for (const e of events ?? []) {
    const bounce =
      (e.payload as { data?: { bounce?: unknown } } | null)?.data?.bounce ?? null;
    if (!bounce || typeof bounce !== "object") continue;
    const reason = translateEmailBounceFailure(
      bounce as { type?: string; message?: string; diagnosticCode?: string[] },
    );
    const { data, error: upErr } = await admin
      .from("conversation_messages")
      .update({ failure_reason: reason })
      .eq("id", e.message_id)
      .eq("venue_id", FANCY)
      .select("id");
    if (upErr) throw upErr;
    if (data?.length) {
      updated += 1;
      if (samples.length < 5) {
        samples.push({
          id: e.message_id,
          type: String((bounce as { type?: string }).type ?? ""),
          reason: reason.slice(0, 180),
        });
      }
    }
  }

  const result = {
    candidates: ids.length,
    events: events?.length ?? 0,
    updated,
    samples,
    at: new Date().toISOString(),
  };
  writeFileSync(OUT, JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
