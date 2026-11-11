/**
 * Prove selection-request email vs Event Order share are distinct on Sandbox fixture.
 * Redacts tokens. Does not send email or mutate share state.
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

config({ path: ".env.local", quiet: true });

const EVENT = "ebf74f77-2944-474a-b735-48762ecb6842";
const CLIENT = "b4e2764b-be33-4579-89e3-0c8e4a6dd5be";
const OUT = "docs/qa/event-order-workflow-correction";
mkdirSync(OUT, { recursive: true });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
if (!url.includes("wvpsldwwjqdannqasrdf")) throw new Error("not sandbox");

const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false },
});

function redact(s: string): string {
  return s
    .replace(/\/p\/[^/?#\s]+/gi, "/p/[redacted]")
    .replace(/access_token=[^&\s]+/gi, "access_token=[redacted]")
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, (m) =>
      m === EVENT || m === CLIENT ? m : "[uuid]",
    );
}

async function main() {
  const { data: eo } = await admin
    .from("event_orders")
    .select(
      "id,status,shared_at,finalized_at,client_agreed_at,client_agreed_name,revision,updated_at,created_at",
    )
    .eq("event_id", EVENT)
    .maybeSingle();

  const { data: choices } = await admin
    .from("client_choices")
    .select(
      "id,name,status,sent_at,submitted_at,finalized_at,event_order_id,created_at,updated_at",
    )
    .eq("event_id", EVENT)
    .order("created_at", { ascending: false });

  const choiceIds = (choices ?? []).map((c) => c.id);
  const { data: acts } = choiceIds.length
    ? await admin
        .from("client_choices_activity")
        .select("client_choices_id,type,title,description,created_at")
        .in("client_choices_id", choiceIds)
        .order("created_at", { ascending: false })
        .limit(40)
    : { data: [] };

  const { data: eoActs } = eo?.id
    ? await admin
        .from("event_order_activity")
        .select("type,title,description,created_at")
        .eq("event_order_id", eo.id)
        .order("created_at", { ascending: false })
        .limit(30)
    : { data: [] };

  // Outbound may live on conversation_messages or a dedicated table — probe both.
  const outboundTables = [
    "conversation_messages",
    "external_client_outbound",
    "outbound_messages",
  ] as const;
  const outbound: Record<string, unknown> = {};
  for (const table of outboundTables) {
    const res = await admin
      .from(table)
      .select("id,source_type,source_id,status,created_at,body,provider_id,channel")
      .eq("client_id", CLIENT)
      .order("created_at", { ascending: false })
      .limit(20);
    outbound[table] = res.error
      ? { error: res.error.message }
      : (res.data ?? []).map((row) => ({
          ...row,
          body: typeof row.body === "string" ? redact(row.body).slice(0, 500) : row.body,
        }));
  }

  const { data: docs } = await admin
    .from("documents")
    .select("id,doc_type,title,created_at,signed_at,shared_at,event_id")
    .eq("event_id", EVENT)
    .eq("doc_type", "event_order")
    .order("created_at", { ascending: false })
    .limit(5);

  const emailActs = (acts ?? []).filter((a) =>
    /email/i.test(a.type) || /email/i.test(a.title ?? ""),
  );
  const shareActs = (eoActs ?? []).filter((a) =>
    /share/i.test(a.type) || /share/i.test(a.title ?? ""),
  );

  const selectionSents = (choices ?? [])
    .map((c) => c.sent_at)
    .filter(Boolean)
    .sort() as string[];
  const firstSelectionSent = selectionSents[0] ?? null;
  const eoSharedAt = eo?.shared_at ?? null;

  let shareVsSelection: string;
  if (!eoSharedAt) {
    shareVsSelection = "EO not shared — selection cannot have caused share";
  } else if (!firstSelectionSent) {
    shareVsSelection = "EO shared but no selection sent_at on packets";
  } else if (new Date(eoSharedAt).getTime() < new Date(firstSelectionSent).getTime()) {
    shareVsSelection =
      "EO shared_at PREDATES earliest selection sent_at — share is pre-existing, not caused by selection request";
  } else {
    shareVsSelection =
      "EO shared_at is at/after a selection send — investigate whether share was triggered by selection path";
  }

  const report = {
    probedAt: new Date().toISOString(),
    eventId: EVENT,
    eventOrder: eo,
    choices,
    choiceEmailActivities: emailActs,
    eventOrderShareActivities: shareActs,
    recentEoActivities: eoActs,
    recentChoiceActivities: acts,
    outbound,
    eventOrderDocuments: docs,
    conclusion: {
      shareVsSelection,
      clientAgreedAt: eo?.client_agreed_at ?? null,
      selectionDoesNotSetClientAgreed: eo?.client_agreed_at == null,
    },
  };

  writeFileSync(`${OUT}/selection-vs-share-probe.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report.conclusion, null, 2));
  console.log("eo.shared_at", eoSharedAt);
  console.log("firstSelectionSent", firstSelectionSent);
  console.log("emailActs", emailActs.length);
  console.log("shareActs", shareActs.length);
  console.log("wrote", `${OUT}/selection-vs-share-probe.json`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
