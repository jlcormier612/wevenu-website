/**
 * POST /api/email/inbound
 *
 * Relationship Workspace inbound email webhook (Resend inbound routing).
 * Separate from venue `/api/messaging/inbound` — CRM / Sales board only.
 *
 * Setup:
 *   1. Resend → Inbound → verify domain + MX
 *   2. RESEND_INBOUND_ADDRESS=inbox@replies.yourdomain.com
 *   3. RESEND_WEBHOOK_SECRET=… (query ?secret= or Svix headers)
 *   4. Point inbound endpoint to https://<workspace-host>/api/email/inbound?secret=…
 *
 * On match: append inbound communication + timeline, promote salesStage →
 * responded (never regress), stop active sequence enrollments, notify.
 *
 * Local test without MX — POST a hand-built payload (secret optional when unset):
 *   curl -s -X POST 'http://localhost:3002/api/email/inbound' \
 *     -H 'Content-Type: application/json' \
 *     -d '{"from":"prospect@example.com","to":["relationship+rel_XXXX@replies.example.com"],"subject":"Re: Hello","text":"Thanks — interested in a walkthrough."}'
 *
 * Dry-run (no writes): add `"dryRun": true` in JSON body, or `?dry_run=1`.
 */

import { createHmac, randomUUID } from "node:crypto";
import { type NextRequest, NextResponse } from "next/server";

import {
  deriveSalesStage,
  extractRelationshipIdFromAddresses,
  matchRelationshipForInboundReply,
  parseFromEmail,
  promoteSalesStage,
  recordInboundEmailReply,
  type InboundEmailPayload,
  type InboundMatchMethod,
  type SalesStage,
} from "@shared/relationships";

import { getRelationship } from "@/lib/data/store";
import {
  appendLocalCommunication,
  appendLocalTimeline,
  appendRelationshipPatch,
  ensureProgram3Data,
} from "@/lib/program3/store";
import { exitActiveEnrollmentsForRelationship } from "@/lib/program3/sequence-engine";

type InboundBody = InboundEmailPayload & {
  dryRun?: boolean;
};

function newId(prefix: string) {
  return `${prefix}_${randomUUID().replace(/-/g, "").slice(0, 12)}`;
}

function verifyQuerySecret(request: NextRequest): boolean {
  const secret = process.env.RESEND_WEBHOOK_SECRET?.trim();
  if (!secret) return true;
  return request.nextUrl.searchParams.get("secret") === secret;
}

function verifySvixSignature(body: string, headers: Headers): boolean {
  const secret = process.env.RESEND_WEBHOOK_SECRET?.trim();
  if (!secret) return true;

  const svixId = headers.get("svix-id") ?? "";
  const svixTimestamp = headers.get("svix-timestamp") ?? "";
  const svixSignature = headers.get("svix-signature") ?? "";
  if (!svixId || !svixTimestamp || !svixSignature) return false;

  const ts = parseInt(svixTimestamp, 10);
  if (Number.isNaN(ts) || Math.abs(Date.now() / 1000 - ts) > 300) return false;

  const key = secret.startsWith("whsec_")
    ? Buffer.from(secret.slice("whsec_".length), "base64")
    : Buffer.from(secret, "utf8");

  const toSign = `${svixId}.${svixTimestamp}.${body}`;
  const expected = createHmac("sha256", key).update(toSign).digest("base64");
  const signatures = svixSignature.split(" ").map((s) => s.replace(/^v1,/, ""));
  return signatures.some((sig) => sig === expected);
}

function authorize(request: NextRequest, rawBody: string): boolean {
  const secret = process.env.RESEND_WEBHOOK_SECRET?.trim();
  if (!secret) return true;

  if (verifyQuerySecret(request)) return true;

  if (
    request.headers.get("svix-id") ||
    request.headers.get("svix-signature")
  ) {
    return verifySvixSignature(rawBody, request.headers);
  }

  // Dev-only unsigned simulation when NODE_ENV is not production.
  if (
    process.env.NODE_ENV !== "production" &&
    (request.nextUrl.searchParams.get("test") === "1" ||
      request.headers.get("x-wevenu-inbound-test") === "1")
  ) {
    return true;
  }

  return false;
}

function plainBody(payload: InboundEmailPayload): string {
  return (
    payload.text?.trim() ||
    payload.html?.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() ||
    ""
  );
}

async function applyLocalOverlays(opts: {
  relationshipId: string;
  salesStage: SalesStage;
  previousSalesStage: SalesStage;
  salesStageChanged: boolean;
  subject: string;
  body: string;
  authorName: string;
  occurredAt: string;
  matchMethod: InboundMatchMethod;
  communicationId?: string;
  timelineEventId?: string;
  stageEventId?: string;
}) {
  await appendRelationshipPatch({
    relationshipId: opts.relationshipId,
    salesStage: opts.salesStage,
    updatedAt: opts.occurredAt,
  });

  const commId = opts.communicationId ?? newId("com");
  const evtId = opts.timelineEventId ?? newId("evt");

  await appendLocalCommunication({
    id: commId,
    relationshipId: opts.relationshipId,
    channel: "email",
    subject: opts.subject,
    body: opts.body,
    direction: "inbound",
    occurredAt: opts.occurredAt,
    authorName: opts.authorName,
  });

  await appendLocalTimeline({
    id: evtId,
    relationshipId: opts.relationshipId,
    type: "email_received",
    title: "Inbound email received",
    body: opts.body.replace(/\s+/g, " ").trim().slice(0, 180),
    occurredAt: opts.occurredAt,
    meta: {
      match_method: opts.matchMethod,
      sales_stage: opts.salesStage,
      previous_sales_stage: opts.previousSalesStage,
    },
  });

  if (opts.salesStageChanged) {
    await appendLocalTimeline({
      id: opts.stageEventId ?? newId("evt"),
      relationshipId: opts.relationshipId,
      type: "status_changed",
      title: "Sales stage updated",
      body: `Sales stage → ${opts.salesStage.replace(/_/g, " ")} (inbound reply)`,
      occurredAt: opts.occurredAt,
      meta: {
        sales_stage: opts.salesStage,
        previous_sales_stage: opts.previousSalesStage,
        trigger: "inbound_reply",
      },
    });
  }

  try {
    await exitActiveEnrollmentsForRelationship(opts.relationshipId, "exited_reply");
  } catch (error) {
    console.error("[workspace inbound] sequence exit-on-reply failed:", error);
  }

  return { communicationId: commId, timelineEventId: evtId };
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  if (!authorize(request, rawBody)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  let payload: InboundBody;
  try {
    payload = JSON.parse(rawBody) as InboundBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const dryRun =
    payload.dryRun === true ||
    request.nextUrl.searchParams.get("dry_run") === "1";

  const { email: fromEmail, name: fromName } = parseFromEmail(payload.from ?? "");
  const body = plainBody(payload);
  if (!fromEmail || !body) {
    return NextResponse.json({ ok: true, skipped: "missing_from_or_body" });
  }

  await ensureProgram3Data();

  let relationshipId: string | null = null;
  let matchMethod: InboundMatchMethod = "subaddress";

  const liveMatch = await matchRelationshipForInboundReply(payload);
  if (liveMatch) {
    relationshipId = liveMatch.relationshipId;
    matchMethod = liveMatch.method;
  } else {
    // Seed / workspace-only: accept subaddress if the relationship exists here.
    const subId = extractRelationshipIdFromAddresses(payload.to ?? []);
    if (subId && getRelationship(subId)) {
      relationshipId = subId;
      matchMethod = "subaddress";
    }
  }

  if (!relationshipId || !getRelationship(relationshipId)) {
    console.warn("[workspace inbound] unmatched sender:", fromEmail);
    return NextResponse.json({ ok: true, matched: false });
  }

  const workspaceRel = getRelationship(relationshipId)!;
  const previousSalesStage = deriveSalesStage(workspaceRel);
  const nextSalesStage = promoteSalesStage(workspaceRel.salesStage, "responded");
  const salesStageChanged = nextSalesStage !== previousSalesStage;
  const occurredAt = new Date().toISOString();
  const subject = payload.subject?.trim() || "(no subject)";
  const authorName = fromName ?? fromEmail;

  if (dryRun) {
    return NextResponse.json({
      ok: true,
      matched: true,
      dryRun: true,
      relationshipId,
      matchMethod,
      salesStage: nextSalesStage,
      previousSalesStage,
      salesStageChanged,
    });
  }

  const recorded = await recordInboundEmailReply(relationshipId, payload, {
    matchMethod,
  });

  // Live store write when present; always apply Program 3 overlays so Today/Sales see it.
  const local = await applyLocalOverlays({
    relationshipId,
    salesStage: recorded?.salesStage ?? nextSalesStage,
    previousSalesStage: recorded?.previousSalesStage ?? previousSalesStage,
    salesStageChanged: recorded?.salesStageChanged ?? salesStageChanged,
    subject: recorded?.communication.subject ?? subject,
    body: recorded?.communication.body ?? body,
    authorName: recorded?.communication.authorName ?? authorName,
    occurredAt: recorded?.communication.occurredAt ?? occurredAt,
    matchMethod,
    communicationId: recorded?.communication.id,
    timelineEventId: recorded?.timelineEvent.id,
    stageEventId: recorded?.stageEvent?.id,
  });

  return NextResponse.json({
    ok: true,
    matched: true,
    dryRun: false,
    relationshipId,
    matchMethod,
    salesStage: recorded?.salesStage ?? nextSalesStage,
    previousSalesStage: recorded?.previousSalesStage ?? previousSalesStage,
    salesStageChanged: recorded?.salesStageChanged ?? salesStageChanged,
    communicationId: local.communicationId,
    timelineEventId: local.timelineEventId,
    liveRecorded: Boolean(recorded),
  });
}
