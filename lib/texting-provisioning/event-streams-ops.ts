/**
 * Idempotent Event Streams Sink + Subscription setup for venue subaccounts.
 * Creates resources via Twilio Events API; never mutates protected accounts.
 */
import {
  twilioErrorCode,
  twilioErrorMessage,
  twilioRequest,
  type TwilioCredentials,
} from "@/lib/sms/twilio-http";
import {
  assertNotProtectedTwilioSid,
  assertVenueAllowedForSelfServiceProvisioning,
} from "@/lib/sms/twilio-protected-resources";
import { PHONE_A2P_EVENT_TYPES } from "@/lib/texting-provisioning/phone-a2p-status";
import type { StepOutcome } from "@/lib/texting-provisioning/twilio-ops";

function str(v: unknown): string {
  return typeof v === "string" ? v : v == null ? "" : String(v);
}

/** Public webhook destination for A2P number-registration Event Streams. */
export function buildA2pEventStreamsDestinationUrl(appBaseUrl: string): string {
  const base = appBaseUrl.replace(/\/+$/, "");
  const user = process.env.TEXTING_A2P_EVENTS_WEBHOOK_USER?.trim();
  const pass = process.env.TEXTING_A2P_EVENTS_WEBHOOK_PASSWORD?.trim();
  const path = "/api/messaging/a2p-events";
  if (user && pass) {
    const parsed = new URL(`${base}${path}`);
    parsed.username = user;
    parsed.password = pass;
    return parsed.toString();
  }
  return `${base}${path}`;
}

/** Destination URL used for signature validation (credentials stripped). */
export function publicA2pEventStreamsUrl(appBaseUrl: string): string {
  const base = appBaseUrl.replace(/\/+$/, "");
  return `${base}/api/messaging/a2p-events`;
}

async function listWebhookSinks(credentials: TwilioCredentials): Promise<
  Array<{ sid: string; destination: string; status: string }>
> {
  const result = await twilioRequest({
    method: "GET",
    url: "https://events.twilio.com/v1/Sinks?PageSize=50",
    credentials,
  });
  if (result.status !== 200) return [];
  const sinks = Array.isArray(result.body.sinks) ? result.body.sinks : [];
  return sinks.flatMap((raw) => {
    if (!raw || typeof raw !== "object") return [];
    const row = raw as Record<string, unknown>;
    const sid = str(row.sid);
    const cfg = (row.sink_configuration ?? row.sinkConfiguration) as Record<string, unknown> | undefined;
    const destination = str(cfg?.destination);
    const status = str(row.status ?? row.sink_status);
    if (!sid) return [];
    return [{ sid, destination, status }];
  });
}

function destinationMatches(configured: string, expected: string): boolean {
  try {
    const a = new URL(configured);
    const b = new URL(expected);
    // Compare without userinfo; path + host must match.
    return (
      a.hostname === b.hostname
      && a.pathname.replace(/\/+$/, "") === b.pathname.replace(/\/+$/, "")
    );
  } catch {
    return configured.replace(/\/+$/, "") === expected.replace(/\/+$/, "");
  }
}

export async function ensureVenueA2pEventStreamSink(input: {
  venueId: string;
  credentials: TwilioCredentials;
  destinationUrl: string;
  existingSinkSid?: string | null;
}): Promise<StepOutcome> {
  assertVenueAllowedForSelfServiceProvisioning(input.venueId);
  assertNotProtectedTwilioSid(input.credentials.accountSid, "ensureVenueA2pEventStreamSink");

  if (input.existingSinkSid?.trim()) {
    assertNotProtectedTwilioSid(input.existingSinkSid, "existing event stream sink", {
      owningAccountSid: input.credentials.accountSid,
    });
    const existing = await twilioRequest({
      method: "GET",
      url: `https://events.twilio.com/v1/Sinks/${input.existingSinkSid.trim()}`,
      credentials: input.credentials,
    });
    if (existing.status === 200) {
      return { ok: true, resourceSid: input.existingSinkSid.trim(), detail: { reused: true } };
    }
    // Missing sink — fall through to recreate.
  }

  const listed = await listWebhookSinks(input.credentials);
  const match = listed.find((s) => destinationMatches(s.destination, input.destinationUrl));
  if (match) {
    return { ok: true, resourceSid: match.sid, detail: { reused: true, listed: true } };
  }

  const result = await twilioRequest({
    method: "POST",
    url: "https://events.twilio.com/v1/Sinks",
    credentials: input.credentials,
    form: {
      Description: `HTC A2P number status ${input.venueId.slice(0, 8)}`.slice(0, 64),
      SinkType: "webhook",
      SinkConfiguration: JSON.stringify({
        destination: input.destinationUrl,
        method: "POST",
        batch_events: false,
      }),
    },
  });
  if (result.status === 201 || result.status === 200) {
    const sid = str(result.body.sid);
    if (!sid) {
      return {
        ok: false,
        retryable: true,
        message: "Event Streams sink created without SID.",
        detail: result.body,
      };
    }
    return { ok: true, resourceSid: sid };
  }
  return {
    ok: false,
    retryable: result.status >= 500 || result.status === 429,
    code: twilioErrorCode(result.body),
    message: twilioErrorMessage(result.body),
    detail: result.body,
  };
}

/** Pure helper — reuse first Twilio Subscription already attached to this Sink. */
export function pickReusableSubscriptionSid(
  listed: Array<{ sid: string; sinkSid: string }>,
  sinkSid: string,
): string | null {
  const match = listed.find((row) => row.sid && row.sinkSid === sinkSid);
  return match?.sid ?? null;
}

async function listSubscriptionsForSink(
  credentials: TwilioCredentials,
  sinkSid: string,
): Promise<Array<{ sid: string; sinkSid: string }>> {
  const result = await twilioRequest({
    method: "GET",
    url: `https://events.twilio.com/v1/Subscriptions?PageSize=50&SinkSid=${encodeURIComponent(sinkSid)}`,
    credentials,
  });
  if (result.status !== 200) {
    // Fallback without SinkSid filter (some accounts omit query support).
    const all = await twilioRequest({
      method: "GET",
      url: "https://events.twilio.com/v1/Subscriptions?PageSize=50",
      credentials,
    });
    if (all.status !== 200) return [];
    const rows = Array.isArray(all.body.subscriptions) ? all.body.subscriptions : [];
    return rows.flatMap((raw) => {
      if (!raw || typeof raw !== "object") return [];
      const row = raw as Record<string, unknown>;
      const sid = str(row.sid);
      const rowSink = str(row.sink_sid ?? row.sinkSid);
      if (!sid || rowSink !== sinkSid) return [];
      return [{ sid, sinkSid: rowSink }];
    });
  }
  const rows = Array.isArray(result.body.subscriptions) ? result.body.subscriptions : [];
  return rows.flatMap((raw) => {
    if (!raw || typeof raw !== "object") return [];
    const row = raw as Record<string, unknown>;
    const sid = str(row.sid);
    const rowSink = str(row.sink_sid ?? row.sinkSid);
    if (!sid) return [];
    if (rowSink && rowSink !== sinkSid) return [];
    return [{ sid, sinkSid: rowSink || sinkSid }];
  });
}

/**
 * Prefer an existing Subscription for this Sink before creating another.
 * Handles retries where the Subscription SID was never persisted locally.
 */
export async function ensureVenueA2pEventStreamSubscription(input: {
  venueId: string;
  credentials: TwilioCredentials;
  sinkSid: string;
  existingSubscriptionSid?: string | null;
}): Promise<StepOutcome> {
  assertVenueAllowedForSelfServiceProvisioning(input.venueId);
  assertNotProtectedTwilioSid(input.sinkSid, "ensureVenueA2pEventStreamSubscription sink", {
    owningAccountSid: input.credentials.accountSid,
  });

  if (input.existingSubscriptionSid?.trim()) {
    const existing = await twilioRequest({
      method: "GET",
      url: `https://events.twilio.com/v1/Subscriptions/${input.existingSubscriptionSid.trim()}`,
      credentials: input.credentials,
    });
    if (existing.status === 200) {
      return {
        ok: true,
        resourceSid: input.existingSubscriptionSid.trim(),
        detail: { reused: true },
      };
    }
  }

  const listed = await listSubscriptionsForSink(input.credentials, input.sinkSid);
  const reusable = pickReusableSubscriptionSid(listed, input.sinkSid);
  if (reusable) {
    return {
      ok: true,
      resourceSid: reusable,
      detail: { reused: true, listed: true },
    };
  }

  // Twilio accepts repeated Types= form fields for multi-event subscriptions.
  const pairs: Array<[string, string]> = [
    ["Description", `HTC A2P number events ${input.venueId.slice(0, 8)}`.slice(0, 64)],
    ["SinkSid", input.sinkSid],
  ];
  for (const type of PHONE_A2P_EVENT_TYPES) {
    pairs.push(["Types", JSON.stringify({ type, schema_version: 1 })]);
  }

  const result = await twilioRequest({
    method: "POST",
    url: "https://events.twilio.com/v1/Subscriptions",
    credentials: input.credentials,
    pairs,
  });
  if (result.status === 201 || result.status === 200) {
    const sid = str(result.body.sid);
    if (!sid) {
      return {
        ok: false,
        retryable: true,
        message: "Event Streams subscription created without SID.",
        detail: result.body,
      };
    }
    return { ok: true, resourceSid: sid };
  }
  return {
    ok: false,
    retryable: result.status >= 500 || result.status === 429,
    code: twilioErrorCode(result.body),
    message: twilioErrorMessage(result.body),
    detail: result.body,
  };
}
