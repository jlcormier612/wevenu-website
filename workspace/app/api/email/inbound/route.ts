/**
 * POST /api/email/inbound
 *
 * Relationship Workspace inbound email webhook (Resend inbound routing).
 * Separate from venue `/api/messaging/inbound` — CRM / Sales board only.
 *
 * Setup:
 *   1. Resend → Inbound → verify domain + MX
 *   2. RESEND_INBOUND_ADDRESS=inbox@replies.yourdomain.com
 *   3. Create a Resend webhook for this Workspace URL and set
 *      RESEND_WEBHOOK_SECRET to that endpoint's Signing Secret (whsec_…).
 *      Comma-separate secrets during rotation. Do not reuse an unrelated
 *      endpoint's secret.
 *   4. Point inbound webhook to https://<workspace-host>/api/email/inbound
 *      (Svix headers only — no query-string secret).
 *
 * Auth is fail-closed: missing/empty RESEND_WEBHOOK_SECRET → 401.
 *
 * On match: append inbound communication + timeline, promote salesStage →
 * responded (never regress), stop active sequence enrollments, notify.
 *
 * Dry-run (no writes): add `"dryRun": true` in JSON body, or `?dry_run=1`
 * (still requires a valid Svix signature).
 */

import { randomUUID } from "node:crypto";
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

import { authorizeInboundWebhook } from "@/lib/email/inbound-webhook-auth";
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
  if (!authorizeInboundWebhook(rawBody, request.headers)) {
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
