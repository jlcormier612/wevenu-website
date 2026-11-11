/**
 * Sandbox: prove ops alert path Detection → SNS → SQS + Resend email fanout.
 * Does not log secrets or customer PII. Does not modify Production/billing.
 */
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const OUT = "docs/qa/supabase-egress-quota-audit";
mkdirSync(OUT, { recursive: true });
const REGION = "us-east-1";
const TOPIC = "arn:aws:sns:us-east-1:405254329873:htc-sandbox-ops-alerts";
const QUEUE = "htc-sandbox-ops-alerts-proof";
const ALARM = "htc-sandbox-health-supabase-down";
const OPS_TO = "jennifer@hellotocheers.com";

function awsJson(args: string[]): unknown {
  const r = spawnSync("aws", [...args, "--region", REGION, "--output", "json"], {
    encoding: "utf8",
    maxBuffer: 8 * 1024 * 1024,
  });
  if (r.status !== 0) throw new Error(r.stderr || args.join(" "));
  return JSON.parse(r.stdout || "null");
}

function awsText(args: string[]): string {
  const r = spawnSync("aws", [...args, "--region", REGION, "--output", "text"], {
    encoding: "utf8",
    maxBuffer: 8 * 1024 * 1024,
  });
  if (r.status !== 0) throw new Error(r.stderr || args.join(" "));
  return (r.stdout || "").trim();
}

function secretResendKey(): string {
  const raw = awsText([
    "secretsmanager",
    "get-secret-value",
    "--secret-id",
    "htc/sandbox/resend-api-key",
    "--query",
    "SecretString",
  ]);
  try {
    const j = JSON.parse(raw) as Record<string, string>;
    return j.api_key || j.RESEND_API_KEY || j.key || Object.values(j)[0]!;
  } catch {
    return raw;
  }
}

async function resendGet(path: string): Promise<unknown> {
  const key = secretResendKey();
  const res = await fetch(`https://api.resend.com${path}`, {
    headers: { Authorization: `Bearer ${key}`, "User-Agent": "HTC-Sandbox-OpsVerify/1.0" },
  });
  const body = await res.json();
  if (!res.ok) throw new Error(`resend ${path} ${res.status}`);
  return body;
}

async function main() {
  const at = new Date().toISOString();
  const tipHtml = await fetch("https://app.sandbox.hellotocheers.com/login").then((r) => r.text());
  const tip = (tipHtml.match(/dpl=([a-f0-9]{40})/) || [])[1] || "unknown";
  const health = await fetch("https://app.sandbox.hellotocheers.com/api/health").then((r) => r.json());

  // Usage canary
  const usageInvoke = awsJson([
    "lambda",
    "invoke",
    "--function-name",
    "htc-sandbox-resend-usage-canary",
    "--cli-binary-format",
    "raw-in-base64-out",
    "--payload",
    "{}",
    "/tmp/htc-ops-usage.json",
  ]) as { StatusCode?: number };
  const usageBody = JSON.parse(readFileSync("/tmp/htc-ops-usage.json", "utf8")) as Record<string, unknown>;

  const resendUsage = (await resendGet("/usage")) as {
    emails?: { daily?: { used?: number; limit?: number }; monthly?: { used?: number; limit?: number } };
  };

  const subs = awsJson(["sns", "list-subscriptions-by-topic", "--topic-arn", TOPIC]) as {
    Subscriptions?: Array<{ Protocol?: string; Endpoint?: string; SubscriptionArn?: string }>;
  };
  const emailSub = (subs.Subscriptions || []).find((s) => s.Protocol === "email");
  const lambdaSub = (subs.Subscriptions || []).find((s) => s.Protocol === "lambda");
  const sqsSub = (subs.Subscriptions || []).find((s) => s.Protocol === "sqs");

  const queueUrl = awsText(["sqs", "get-queue-url", "--queue-name", QUEUE, "--query", "QueueUrl"]);
  // Drain a few old messages so we can spot the new one
  awsJson([
    "sqs",
    "receive-message",
    "--queue-url",
    queueUrl,
    "--max-number-of-messages",
    "10",
    "--wait-time-seconds",
    "1",
    "--visibility-timeout",
    "0",
  ]);

  const marker = `ops-verify-${Date.now()}`;
  // Force ALARM then OK on health canary alarm (SNS → SQS + Lambda email)
  awsText(["cloudwatch", "set-alarm-state", "--alarm-name", ALARM, "--state-value", "ALARM", "--state-reason", `Controlled Sandbox ops verify ${marker}`]);
  await new Promise((r) => setTimeout(r, 8000));
  awsText(["cloudwatch", "set-alarm-state", "--alarm-name", ALARM, "--state-value", "OK", "--state-reason", `Controlled Sandbox ops verify recovery ${marker}`]);
  await new Promise((r) => setTimeout(r, 10000));

  const sqsRecv = awsJson([
    "sqs",
    "receive-message",
    "--queue-url",
    queueUrl,
    "--max-number-of-messages",
    "10",
    "--wait-time-seconds",
    "10",
    "--visibility-timeout",
    "30",
  ]) as { Messages?: Array<{ Body?: string; ReceiptHandle?: string }> };

  let sqsAlarm = false;
  let sqsOk = false;
  for (const m of sqsRecv.Messages || []) {
    const body = m.Body || "";
    if (body.includes(ALARM) && body.includes("ALARM")) sqsAlarm = true;
    if (body.includes(ALARM) && body.includes('"OK"')) sqsOk = true;
    if (m.ReceiptHandle) {
      spawnSync(
        "aws",
        ["sqs", "delete-message", "--queue-url", queueUrl, "--receipt-handle", m.ReceiptHandle, "--region", REGION],
        { encoding: "utf8" },
      );
    }
  }

  // Look for recent Resend ops emails (to ops address only; do not store other recipients)
  const emails = (await resendGet("/emails?limit=20")) as {
    data?: Array<{ id?: string; to?: string[]; subject?: string; last_event?: string; created_at?: string }>;
  };
  const opsMails = (emails.data || []).filter((e) => {
    const to = (e.to || []).join(",");
    const sub = e.subject || "";
    return to.includes(OPS_TO) && /HTC Sandbox/i.test(sub) && /health-supabase-down/i.test(sub);
  });
  // Prefer messages created in the last 5 minutes
  const cutoff = Date.now() - 5 * 60 * 1000;
  const recentOps = opsMails.filter((e) => {
    const t = e.created_at ? Date.parse(e.created_at) : 0;
    return t >= cutoff;
  });
  const delivered = recentOps.filter((e) => e.last_event === "delivered" || e.last_event === "sent");
  const alarmMail = recentOps.some((e) => /\[ALARM\]/i.test(e.subject || ""));
  const okMail = recentOps.some((e) => /\[OK\]/i.test(e.subject || ""));

  const alarms = awsJson([
    "cloudwatch",
    "describe-alarms",
    "--alarm-name-prefix",
    "htc-sandbox",
  ]) as { MetricAlarms?: Array<{ AlarmName?: string; StateValue?: string }> };
  const alarmNames = (alarms.MetricAlarms || []).map((a) => a.AlarmName).sort();

  const out = {
    at,
    tip,
    health,
    usageCanary: { invokeStatus: usageInvoke.StatusCode, body: usageBody },
    resendUsage: {
      daily: resendUsage.emails?.daily,
      monthly: resendUsage.emails?.monthly,
    },
    sns: {
      emailSubscription: emailSub?.SubscriptionArn === "PendingConfirmation" ? "PendingConfirmation" : emailSub?.SubscriptionArn ? "Confirmed" : "missing",
      emailEndpoint: emailSub?.Endpoint || null,
      sqsSubscription: sqsSub?.SubscriptionArn ? "Confirmed" : "missing",
      lambdaEmailFanout: lambdaSub?.SubscriptionArn ? "Confirmed" : "missing",
      lambdaEndpoint: lambdaSub?.Endpoint || null,
    },
    delivery: {
      marker,
      sqsAlarmSeen: sqsAlarm,
      sqsOkSeen: sqsOk,
      resendOpsEmailsRecent: recentOps.map((e) => ({
        id: e.id,
        subject: e.subject,
        last_event: e.last_event,
        created_at: e.created_at,
      })),
      resendAlarmEmail: alarmMail,
      resendOkEmail: okMail,
      resendHumanPathProven: delivered.length > 0 && (alarmMail || okMail),
    },
    alarmCount: alarmNames.length,
    alarmNames,
  };

  writeFileSync(`${OUT}/ops-alert-verify.json`, JSON.stringify(out, null, 2) + "\n");
  console.log(
    JSON.stringify(
      {
        tip,
        usageOk: usageBody.ok === true,
        daily: out.resendUsage.daily,
        monthly: out.resendUsage.monthly,
        snsEmail: out.sns.emailSubscription,
        lambdaFanout: out.sns.lambdaEmailFanout,
        sqsAlarm,
        sqsOk,
        resendHumanPathProven: out.delivery.resendHumanPathProven,
        alarmCount: out.alarmCount,
      },
      null,
      2,
    ),
  );
  if (!out.delivery.resendHumanPathProven || !sqsAlarm) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
