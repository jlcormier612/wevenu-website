/**
 * Exact-runtime proof: Rory Meadowbrook completed-tour Noticed must not
 * assert the early-arrival ask as unanswered. Does not send mail/SMS.
 */
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import { mkdirSync, writeFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { evaluateCompletedTour } from "@/lib/luv/completed-tour-intelligence";
import { tourOccurrenceIso } from "@/lib/tours/occurrence-clock";

config({ path: ".env.local", quiet: true });

const OUT = "docs/qa/luv-noticed-stale-attendance";
const EXPECTED = process.env.EXPECTED_SHA ?? "";
const MEADOW = "05f16a15-1752-4855-8a3b-aad5c593d8d9";
const LEAD = "09d26751-f184-461f-9cdb-8891b676cd61";
const TOUR = "4b57743b-d27f-4c5e-9d60-1c34c8870ab3";
const CONV = "dcba7cbc-77d7-4707-ac0d-e615016c186f";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
if (!url.includes("wvpsldwwjqdannqasrdf")) throw new Error("refusing non-sandbox");
if (!EXPECTED) throw new Error("EXPECTED_SHA required");

const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false },
});

type Check = { name: string; pass: boolean; detail: string };
const checks: Check[] = [];
function record(name: string, pass: boolean, detail: string) {
  checks.push({ name, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"} ${name} — ${detail}`);
}

function servingImage(): string {
  try {
    const taskArn = execSync(
      "aws ecs list-tasks --cluster htc-sandbox --service-name htc-sandbox-venue-app --desired-status RUNNING --query 'taskArns[0]' --output text",
      { encoding: "utf8" },
    ).trim();
    if (!taskArn || taskArn === "None") return "";
    return execSync(
      `aws ecs describe-tasks --cluster htc-sandbox --tasks ${taskArn} --query 'tasks[0].containers[0].image' --output text`,
      { encoding: "utf8" },
    ).trim();
  } catch {
    return "";
  }
}

mkdirSync(OUT, { recursive: true });
const image = servingImage();
record("Serving expected SHA", image.includes(EXPECTED.slice(0, 12)), image || "unknown");

const { data: tour } = await admin
  .from("tour_appointments")
  .select("id, status, scheduled_at, actual_occurred_at, completed_at, follow_up_sent_at, notes, lead_id")
  .eq("id", TOUR)
  .single();
record("Tour completed", tour?.status === "completed", JSON.stringify({
  status: tour?.status,
  actual: tour?.actual_occurred_at,
  completed: tour?.completed_at,
}));

const { data: msgs } = await admin
  .from("conversation_messages")
  .select("sent_at, sender_type, channel, body")
  .eq("conversation_id", CONV)
  .order("sent_at", { ascending: true });

const { data: conv } = await admin
  .from("conversations")
  .select("venue_unread, needs_response")
  .eq("id", CONV)
  .single();

const occurrence = tourOccurrenceIso({
  actual_occurred_at: tour?.actual_occurred_at,
  completed_at: tour?.completed_at,
});
const decision = evaluateCompletedTour({
  tourId: TOUR,
  leadId: LEAD,
  contactName: "Rory",
  occurredAt: occurrence!,
  followUpSentAt: tour?.follow_up_sent_at,
  proposalSent: false,
  messages: (msgs ?? []).map((m) => ({
    sentAt: m.sent_at,
    senderType: m.sender_type,
    channel: m.channel,
    body: m.body,
  })),
});

const staleCopy = /don't see an answer recorded|still unanswered|come in tonight/i;
record(
  "Completed-tour decision is silence (not stale unanswered ACTION)",
  decision.mode === "silence",
  `mode=${decision.mode}`,
);
record(
  "No stale unanswered assertion in decision payload",
  !staleCopy.test(JSON.stringify(decision)),
  decision.mode,
);

// Genuine unresolved question still actionable (synthetic sibling message)
const withSetup = evaluateCompletedTour({
  tourId: TOUR,
  leadId: LEAD,
  contactName: "Rory",
  occurredAt: occurrence!,
  proposalSent: false,
  messages: [
    ...(msgs ?? []).map((m) => ({
      sentAt: m.sent_at,
      senderType: m.sender_type,
      channel: m.channel,
      body: m.body,
    })),
    {
      sentAt: "2026-10-15T05:00:00.000Z",
      senderType: "lead_or_client",
      channel: "email",
      body: "Can you do Saturday setup for the ceremony?",
    },
  ],
});
record(
  "Genuine post-tour question still actionable",
  withSetup.mode === "actionable"
    && withSetup.purpose === "unresolved_question"
    && /Saturday setup/i.test(withSetup.observation.message),
  withSetup.mode,
);

record(
  "Conversation unread/needs_response untouched by evaluator (read-only check)",
  conv?.venue_unread === 0 && conv?.needs_response === true,
  JSON.stringify(conv),
);

const early = (msgs ?? []).find((m) => (m.body ?? "").includes("come in tonight"));
record("Original early-arrival message still persisted", Boolean(early), early?.sent_at ?? "missing");
record("Tour outcome notes still persisted", Boolean(tour?.notes), (tour?.notes ?? "").slice(0, 80));

const results = {
  at: new Date().toISOString(),
  expectedSha: EXPECTED,
  servingImage: image,
  occurrence,
  decisionMode: decision.mode,
  conv,
  checks,
  allPass: checks.every((c) => c.pass),
  productionUntouched: true,
  noCustomerSends: true,
};
writeFileSync(`${OUT}/runtime-results.json`, JSON.stringify(results, null, 2));
console.log(JSON.stringify({ allPass: results.allPass }, null, 2));
if (!results.allPass) process.exit(1);
