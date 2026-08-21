/**
 * Sandbox Email Intake path checks that do not require a live MX delivery.
 *
 * Usage:
 *   SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… npx tsx scripts/verify-email-intake-sandbox.mts
 *
 * Optional:
 *   APP_URL=https://app.sandbox.hellotocheers.com
 *   RESEND_WEBHOOK_SECRET=whsec_…   # if set, posts a signed email.received probe
 */
import { createHmac } from "node:crypto";

const APP_URL = (process.env.APP_URL ?? "https://app.sandbox.hellotocheers.com").replace(/\/$/, "");
const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

function fail(msg: string): never {
  console.error("FAIL:", msg);
  process.exit(1);
}

async function rest<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${SUPABASE_URL}${path}`, {
    ...init,
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  const text = await res.text();
  if (!res.ok) fail(`${path} → ${res.status} ${text}`);
  return text ? (JSON.parse(text) as T) : (null as T);
}

function signSvix(secret: string, id: string, timestamp: string, body: string): string {
  const secretBytes = Buffer.from(secret.replace(/^whsec_/, ""), "base64");
  const digest = createHmac("sha256", secretBytes)
    .update(`${id}.${timestamp}.${body}`)
    .digest("base64");
  return `v1,${digest}`;
}

async function main() {
  if (!SUPABASE_URL || !SERVICE_KEY) fail("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required");

  const venues = await rest<{ id: string; name: string; lead_email_key: string }[]>(
    "/rest/v1/venues?select=id,name,lead_email_key&lead_email_key=neq.&limit=1",
  );
  if (!venues?.length) fail("No venue with lead_email_key found");
  const venue = venues[0];
  console.log("venue", venue.name, venue.id);
  console.log("lead_email_key", venue.lead_email_key);

  const rpc = await rest<unknown>("/rest/v1/rpc/get_venue_by_lead_email_key", {
    method: "POST",
    body: JSON.stringify({ p_key: venue.lead_email_key }),
  });
  console.log("get_venue_by_lead_email_key", JSON.stringify(rpc));

  const probe = await fetch(`${APP_URL}/api/leads/email-intake`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ type: "ping" }),
  });
  console.log("public POST /api/leads/email-intake (unsigned ping)", probe.status, await probe.text());

  const webhookSecret = process.env.RESEND_WEBHOOK_SECRET?.split(",")[0]?.trim();
  if (webhookSecret) {
    const body = JSON.stringify({
      type: "email.received",
      created_at: new Date().toISOString(),
      data: {
        email_id: "00000000-0000-0000-0000-000000000000",
        from: "Probe Sender <probe@example.com>",
        to: [`leads+${venue.lead_email_key}@replies.hellotocheers.com`],
        subject: "Sandbox Email Intake probe — Jane Doe inquiry for a wedding",
      },
    });
    const id = `msg_probe_${Date.now()}`;
    const timestamp = String(Math.floor(Date.now() / 1000));
    const signed = await fetch(`${APP_URL}/api/leads/email-intake`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "svix-id": id,
        "svix-timestamp": timestamp,
        "svix-signature": signSvix(webhookSecret, id, timestamp, body),
      },
      body,
    });
    console.log(
      "signed email.received probe",
      signed.status,
      await signed.text(),
      "(body fetch will fail for fake email_id — expect ok:true without a new lead)",
    );
  } else {
    console.log("skip signed probe (set RESEND_WEBHOOK_SECRET to exercise Svix)");
  }

  console.log("OK — resolution + public route checks complete");
}

main().catch((err) => fail(err instanceof Error ? err.message : String(err)));
