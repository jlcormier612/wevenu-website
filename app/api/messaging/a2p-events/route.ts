/**
 * POST /api/messaging/a2p-events
 *
 * Twilio Event Streams webhook for A2P phone number registration lifecycle.
 * Batch body is a JSON array of CloudEvents. Authenticate with subaccount
 * Auth Token via Event Streams body signature (+ optional Basic Auth).
 */
import { type NextRequest, NextResponse } from "next/server";

import {
  verifyEventStreamsBasicAuth,
  verifyTwilioEventStreamsSignature,
} from "@/lib/sms/event-streams-verify";
import { resolveVenueTwilioForWebhookAccountSid } from "@/lib/sms/venue-twilio-resolve";
import { applyPhoneA2pEvent } from "@/lib/texting-provisioning/apply-phone-a2p-event";
import { publicA2pEventStreamsUrl } from "@/lib/texting-provisioning/event-streams-ops";
import {
  isPhoneA2pEventType,
  parsePhoneA2pCloudEvent,
} from "@/lib/texting-provisioning/phone-a2p-status";

function appBaseUrl(request: NextRequest): string {
  return (process.env.NEXT_PUBLIC_APP_URL?.trim() || request.nextUrl.origin).replace(/\/+$/, "");
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-twilio-signature");

  if (
    !verifyEventStreamsBasicAuth(
      request.headers.get("authorization"),
      process.env.TEXTING_A2P_EVENTS_WEBHOOK_USER,
      process.env.TEXTING_A2P_EVENTS_WEBHOOK_PASSWORD,
    )
  ) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  let parsed: unknown;
  try {
    parsed = rawBody ? JSON.parse(rawBody) : null;
  } catch {
    return NextResponse.json({ error: "Malformed JSON." }, { status: 400 });
  }

  const events = Array.isArray(parsed) ? parsed : parsed ? [parsed] : [];
  if (events.length === 0) {
    return NextResponse.json({ ok: true, processed: 0 });
  }

  // Authenticate using the first parseable phone event's AccountSid → venue secret.
  let authAccountSid: string | null = null;
  for (const item of events) {
    const payload = parsePhoneA2pCloudEvent(item);
    if (payload?.accountSid) {
      authAccountSid = payload.accountSid;
      break;
    }
    // Non-phone event in batch — try data.accountsid directly for auth routing.
    if (item && typeof item === "object") {
      const data = (item as { data?: unknown }).data;
      const obj = typeof data === "string"
        ? (() => {
          try { return JSON.parse(data) as Record<string, unknown>; } catch { return null; }
        })()
        : (data && typeof data === "object" ? data as Record<string, unknown> : null);
      const sid = String(obj?.accountsid ?? obj?.accountSid ?? "").trim();
      if (sid) {
        authAccountSid = sid;
        break;
      }
    }
  }

  if (!authAccountSid) {
    return NextResponse.json({ error: "Missing account." }, { status: 401 });
  }

  const resolved = await resolveVenueTwilioForWebhookAccountSid(authAccountSid);
  if (!resolved.ok) {
    return NextResponse.json({ error: "Unknown Twilio account." }, { status: 401 });
  }

  const destinationUrl = publicA2pEventStreamsUrl(appBaseUrl(request));
  const urlWithQuery = request.nextUrl.search
    ? `${destinationUrl}${request.nextUrl.search}`
    : destinationUrl;

  if (
    !verifyTwilioEventStreamsSignature(
      urlWithQuery,
      rawBody,
      signature,
      resolved.ctx.secret.authToken,
    )
  ) {
    return NextResponse.json({ error: "Invalid signature." }, { status: 401 });
  }

  let processed = 0;
  let applied = 0;
  let ignored = 0;

  for (const item of events) {
    const type = item && typeof item === "object" && typeof (item as { type?: unknown }).type === "string"
      ? (item as { type: string }).type
      : "";
    if (type && !isPhoneA2pEventType(type)) {
      // Ignore non-phone A2P event types quietly (future brand/campaign streams).
      ignored += 1;
      continue;
    }

    const payload = parsePhoneA2pCloudEvent(item);
    if (!payload) {
      ignored += 1;
      continue;
    }

    // Cross-venue contamination guard: every event AccountSid must match the
    // authenticated subaccount for this request.
    if (payload.accountSid !== authAccountSid) {
      console.error("[a2p-events] batch account mismatch", {
        timestamp: new Date().toISOString(),
      });
      return NextResponse.json({ error: "Account mismatch." }, { status: 409 });
    }

    const result = await applyPhoneA2pEvent(payload);
    processed += 1;
    if (!result.ok) {
      if (result.status === 404) {
        return NextResponse.json({ error: "Unknown Twilio account." }, { status: 401 });
      }
      return NextResponse.json({ error: result.reason }, { status: result.status });
    }
    if (result.applied) applied += 1;
    else ignored += 1;
  }

  return NextResponse.json({ ok: true, processed, applied, ignored });
}
