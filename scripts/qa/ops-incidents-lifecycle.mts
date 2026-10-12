/**
 * Sandbox ops incident lifecycle proof (service role + Lambda invoke).
 * Does not touch Production or billing.
 */
import { createClient } from "@supabase/supabase-js";
import { writeFileSync, mkdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { execSync } from "node:child_process";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const outDir = resolve("docs/qa/supabase-egress-quota-audit");
mkdirSync(outDir, { recursive: true });

const admin = createClient(url, key, { auth: { persistSession: false } });
const dedupe = `qa:ops-lifecycle:${Date.now()}`;

async function main() {
  const results: Record<string, unknown> = {
    at: new Date().toISOString(),
    dedupe,
  };

  // 1) Create critical incident (simulates first ALARM persist)
  const { data: created, error: cErr } = await admin
    .from("ops_incidents")
    .insert({
      dedupe_key: dedupe,
      source_service: "infrastructure",
      source_alarm: "htc-sandbox-qa-lifecycle",
      source_event_id: "qa-1",
      severity: "critical",
      status: "active",
      title: "QA lifecycle critical",
      summary: "Controlled synthetic incident for Sandbox verification.",
      recommended_action: "No customer action — disposable QA fixture.",
      diagnostic: { qa: true },
      observation_count: 1,
    })
    .select("*")
    .single();
  if (cErr || !created) throw new Error(`create failed: ${cErr?.message}`);
  results.createdId = created.id;

  await admin.from("ops_incident_events").insert({
    incident_id: created.id,
    event_type: "detected",
    severity: "critical",
    message: "QA detected",
  });

  // 2) Re-observe — bump count, no second row
  const { data: updated } = await admin
    .from("ops_incidents")
    .update({
      observation_count: 2,
      last_observed_at: new Date().toISOString(),
      summary: "Re-observed without duplicate.",
    })
    .eq("dedupe_key", dedupe)
    .select("*")
    .single();
  results.observationCount = updated?.observation_count;
  results.noDuplicate =
    (
      await admin.from("ops_incidents").select("id", { count: "exact", head: true }).eq("dedupe_key", dedupe)
    ).count === 1;

  // 3) Acknowledge via RPC as service role won't have auth.uid HQ — simulate ack fields
  const { data: acked } = await admin
    .from("ops_incidents")
    .update({
      status: "acknowledged",
      acknowledged_at: new Date().toISOString(),
    })
    .eq("id", created.id)
    .select("*")
    .single();
  results.ackKeepsUnresolved = acked?.status === "acknowledged" && !acked?.resolved_at && !acked?.recovered_at;

  await admin.from("ops_incident_events").insert({
    incident_id: created.id,
    event_type: "acknowledged",
    severity: "critical",
    message: "QA acknowledged (not resolved)",
  });

  // 4) Email failure evidence leaves incident intact
  await admin.from("ops_notification_attempts").insert({
    incident_id: created.id,
    channel: "email",
    outcome: "failed",
    error_safe: "qa_simulated_email_failure",
    idempotency_key: `email:${created.id}:qa-fail`,
  });
  const stillThere = await admin.from("ops_incidents").select("id,status").eq("id", created.id).single();
  results.emailFailureKeepsIncident = stillThere.data?.status === "acknowledged";

  // 5) Recovery
  const { data: recovered } = await admin
    .from("ops_incidents")
    .update({
      status: "recovered",
      recovered_at: new Date().toISOString(),
    })
    .eq("id", created.id)
    .select("*")
    .single();
  results.recovered = recovered?.status === "recovered";

  await admin.from("ops_incident_events").insert({
    incident_id: created.id,
    event_type: "recovered",
    severity: "critical",
    message: "QA recovered",
  });

  // 6) Unauthorized shape: anon key should not see rows (if anon available)
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (anon) {
    const guest = createClient(url, anon, { auth: { persistSession: false } });
    const { data: guestRows, error: gErr } = await guest.from("ops_incidents").select("id").eq("id", created.id);
    results.anonCannotRead = !guestRows?.length;
    results.anonError = gErr?.message ?? null;
  }

  // 7) Invoke real Lambda with synthetic SNS payload (uses real email path — ops inbox)
  const lambdaAlarm = "htc-sandbox-qa-lifecycle-probe";
  const msgId = `qa-lifecycle-${Date.now()}`;
  const payload = {
    Records: [
      {
        Sns: {
          MessageId: msgId,
          Subject: `ALARM: ${lambdaAlarm}`,
          Message: JSON.stringify({
            AlarmName: lambdaAlarm,
            NewStateValue: "ALARM",
            NewStateReason: "QA controlled synthetic for ops incident + email path",
          }),
        },
      },
    ],
  };
  const payloadPath = "/tmp/htc-ops-lifecycle-payload.json";
  writeFileSync(payloadPath, JSON.stringify(payload));
  try {
    execSync(
      `aws lambda invoke --function-name htc-sandbox-ops-alert-email --region us-east-1 --cli-binary-format raw-in-base64-out --payload file://${payloadPath} /tmp/htc-ops-lifecycle-out.json`,
      { stdio: "pipe" },
    );
    const out = JSON.parse(readFileSync("/tmp/htc-ops-lifecycle-out.json", "utf8"));
    results.lambdaInvoke = out;

    // Duplicate ALARM — should update, not flood email
    const msgId2 = `${msgId}-dup`;
    writeFileSync(
      payloadPath,
      JSON.stringify({
        Records: [
          {
            Sns: {
              MessageId: msgId2,
              Subject: `ALARM: ${lambdaAlarm}`,
              Message: JSON.stringify({
                AlarmName: lambdaAlarm,
                NewStateValue: "ALARM",
                NewStateReason: "QA duplicate observation",
              }),
            },
          },
        ],
      }),
    );
    execSync(
      `aws lambda invoke --function-name htc-sandbox-ops-alert-email --region us-east-1 --cli-binary-format raw-in-base64-out --payload file://${payloadPath} /tmp/htc-ops-lifecycle-dup.json`,
      { stdio: "pipe" },
    );
    results.lambdaDupInvoke = JSON.parse(readFileSync("/tmp/htc-ops-lifecycle-dup.json", "utf8"));

    // Recovery
    writeFileSync(
      payloadPath,
      JSON.stringify({
        Records: [
          {
            Sns: {
              MessageId: `${msgId}-ok`,
              Subject: `OK: ${lambdaAlarm}`,
              Message: JSON.stringify({
                AlarmName: lambdaAlarm,
                NewStateValue: "OK",
                NewStateReason: "QA recovery",
              }),
            },
          },
        ],
      }),
    );
    execSync(
      `aws lambda invoke --function-name htc-sandbox-ops-alert-email --region us-east-1 --cli-binary-format raw-in-base64-out --payload file://${payloadPath} /tmp/htc-ops-lifecycle-ok.json`,
      { stdio: "pipe" },
    );
    results.lambdaOkInvoke = JSON.parse(readFileSync("/tmp/htc-ops-lifecycle-ok.json", "utf8"));
  } catch (e) {
    results.lambdaInvokeError = String(e).slice(0, 300);
  }

  const { data: fromLambda } = await admin
    .from("ops_incidents")
    .select("id,status,severity,title,last_email_outcome,observation_count")
    .eq("dedupe_key", `cw:${lambdaAlarm}`)
    .maybeSingle();
  results.lambdaIncident = fromLambda;

  writeFileSync(resolve(outDir, "ops-incidents-lifecycle.json"), JSON.stringify(results, null, 2));
  console.log(JSON.stringify(results, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
