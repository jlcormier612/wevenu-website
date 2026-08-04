/**
 * Relationship inbound email replies — match, append timeline/comms,
 * promote Sales stage to `responded` (never regress later stages).
 *
 * Matching (in order):
 *   1. Reply-To / To subaddress `relationship+{id}@domain`
 *   2. In-Reply-To / References → stored outbound `provider_id` on timeline
 *   3. From email → unique owner email match only
 */

import { randomUUID } from "crypto";

import { normalizeEmail } from "./normalize";
import {
  deriveSalesStage,
  isSalesAutoArrivalStage,
  markAutoArrival,
  promoteSalesStage,
  SALES_STAGE_LABELS,
  type SalesStage,
} from "./sales-cs";
import { withLiveStore } from "./store";
import type {
  Communication,
  Relationship,
  TimelineEvent,
} from "./types";

export type InboundEmailPayload = {
  from: string;
  to?: string[];
  cc?: string[];
  subject?: string;
  text?: string;
  html?: string;
  headers?: { name: string; value: string }[];
};

export type InboundMatchMethod =
  | "subaddress"
  | "in_reply_to"
  | "owner_email";

export type InboundMatchResult = {
  relationshipId: string;
  method: InboundMatchMethod;
};

export type RecordInboundEmailResult = {
  relationship: Relationship;
  communication: Communication;
  timelineEvent: TimelineEvent;
  previousSalesStage: SalesStage;
  salesStage: SalesStage;
  salesStageChanged: boolean;
  stageEvent?: TimelineEvent;
  notificationId?: string;
};

const RELATIONSHIP_PLUS_RE = /relationship\+([a-zA-Z0-9_+-]+)@/i;

export function parseFromEmail(from: string): { email: string; name: string | null } {
  const match = from.match(/^(.*?)\s*<(.+)>$/);
  if (match) return { name: match[1].trim() || null, email: match[2].trim() };
  return { name: null, email: from.trim() };
}

/** Extract relationship id from To/Cc/Reply-To style addresses. */
export function extractRelationshipIdFromAddresses(
  addresses: string[] | undefined,
): string | null {
  if (!addresses?.length) return null;
  for (const addr of addresses) {
    const match = addr.match(RELATIONSHIP_PLUS_RE);
    if (match?.[1]) return match[1];
  }
  return null;
}

function headerValues(
  headers: { name: string; value: string }[] | undefined,
  headerName: string,
): string[] {
  if (!headers?.length) return [];
  const needle = headerName.toLowerCase();
  return headers
    .filter((h) => h.name.toLowerCase() === needle)
    .map((h) => h.value)
    .filter(Boolean);
}

/** Normalize Message-ID / In-Reply-To tokens for provider_id compare. */
export function normalizeMessageIdToken(raw: string): string {
  return raw.replace(/[<>]/g, "").trim().toLowerCase();
}

export function extractReplyMessageIds(
  headers: { name: string; value: string }[] | undefined,
): string[] {
  const ids = new Set<string>();
  for (const value of [
    ...headerValues(headers, "in-reply-to"),
    ...headerValues(headers, "references"),
  ]) {
    for (const part of value.split(/[\s,]+/)) {
      const token = normalizeMessageIdToken(part);
      if (token) ids.add(token);
      // Resend API ids sometimes appear without domain; also try local-part.
      const local = token.split("@")[0];
      if (local) ids.add(local);
    }
  }
  return [...ids];
}

function providerIdFromMeta(
  meta: TimelineEvent["meta"] | undefined,
): string | null {
  if (!meta) return null;
  const raw = meta.provider_id ?? meta.providerId;
  if (typeof raw !== "string" || !raw.trim()) return null;
  return normalizeMessageIdToken(raw);
}

/**
 * Resolve which Relationship an inbound reply belongs to.
 * Prefers subaddress, then threading ids, then unique owner email.
 */
export async function matchRelationshipForInboundReply(
  payload: InboundEmailPayload,
): Promise<InboundMatchResult | null> {
  const toAddrs = [...(payload.to ?? []), ...(payload.cc ?? [])];
  const replyToAddrs = headerValues(payload.headers, "delivered-to").concat(
    headerValues(payload.headers, "x-original-to"),
  );
  const subId =
    extractRelationshipIdFromAddresses(toAddrs) ||
    extractRelationshipIdFromAddresses(replyToAddrs);

  const { result } = await withLiveStore((store) => {
    if (subId) {
      const byId = store.relationships.find((r) => r.id === subId);
      if (byId) return { relationshipId: byId.id, method: "subaddress" as const };
    }

    const replyIds = extractReplyMessageIds(payload.headers);
    if (replyIds.length) {
      const replySet = new Set(replyIds);
      for (const event of store.timelineEvents) {
        if (event.type !== "email_sent") continue;
        const pid = providerIdFromMeta(event.meta);
        if (pid && replySet.has(pid)) {
          return {
            relationshipId: event.relationshipId,
            method: "in_reply_to" as const,
          };
        }
      }
    }

    const { email } = parseFromEmail(payload.from ?? "");
    const from = normalizeEmail(email);
    if (!from) return null;

    const matches = store.relationships.filter(
      (r) => normalizeEmail(r.owner.email) === from,
    );
    if (matches.length === 1) {
      return {
        relationshipId: matches[0].id,
        method: "owner_email" as const,
      };
    }
    return null;
  });

  return result;
}

function plainBody(payload: InboundEmailPayload): string {
  const text = payload.text?.trim();
  if (text) return text;
  const html = payload.html?.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  return html ?? "";
}

/**
 * Append inbound communication + email_received timeline, set lastInboundAt,
 * promote salesStage → responded (no regression), optional notification.
 */
export async function recordInboundEmailReply(
  relationshipId: string,
  payload: InboundEmailPayload,
  opts?: {
    matchMethod?: InboundMatchMethod;
    dryRun?: boolean;
  },
): Promise<RecordInboundEmailResult | null> {
  const { email: fromEmail, name: fromName } = parseFromEmail(payload.from ?? "");
  const body = plainBody(payload);
  if (!fromEmail || !body) return null;

  const { result } = await withLiveStore((store) => {
    const relationship = store.relationships.find((r) => r.id === relationshipId);
    if (!relationship) return null;

    const now = new Date().toISOString();
    const previousSalesStage = deriveSalesStage(relationship);
    const nextSalesStage = promoteSalesStage(relationship.salesStage, "responded");
    const salesStageChanged = nextSalesStage !== previousSalesStage;

    if (opts?.dryRun) {
      return {
        relationship: { ...relationship, salesStage: nextSalesStage },
        communication: {
          id: "dry_run",
          relationshipId,
          channel: "email" as const,
          subject: payload.subject ?? "(no subject)",
          body,
          direction: "inbound" as const,
          occurredAt: now,
          authorName: fromName ?? fromEmail,
        },
        timelineEvent: {
          id: "dry_run",
          relationshipId,
          type: "email_received" as const,
          title: "Inbound email received",
          body: body.slice(0, 180),
          occurredAt: now,
        },
        previousSalesStage,
        salesStage: nextSalesStage,
        salesStageChanged,
      } satisfies RecordInboundEmailResult;
    }

    relationship.salesStage = nextSalesStage;
    if (salesStageChanged && isSalesAutoArrivalStage(nextSalesStage)) {
      markAutoArrival(relationship, nextSalesStage, "sales", now);
    }
    relationship.lastInboundAt = now;
    relationship.lastContactAt = now;
    relationship.updatedAt = now;

    const communication: Communication = {
      id: `com_${randomUUID().replace(/-/g, "").slice(0, 12)}`,
      relationshipId,
      channel: "email",
      subject: payload.subject?.trim() || "(no subject)",
      body,
      direction: "inbound",
      occurredAt: now,
      authorName: fromName ?? fromEmail,
    };
    store.communications.push(communication);

    const timelineEvent: TimelineEvent = {
      id: `evt_${randomUUID().replace(/-/g, "").slice(0, 12)}`,
      relationshipId,
      type: "email_received",
      title: "Inbound email received",
      body: body.replace(/\s+/g, " ").trim().slice(0, 180),
      occurredAt: now,
      meta: {
        from: fromEmail,
        subject: communication.subject,
        match_method: opts?.matchMethod ?? null,
        sales_stage: nextSalesStage,
        previous_sales_stage: previousSalesStage,
      },
    };
    store.timelineEvents.push(timelineEvent);

    let stageEvent: TimelineEvent | undefined;
    if (salesStageChanged) {
      stageEvent = {
        id: `evt_${randomUUID().replace(/-/g, "").slice(0, 12)}`,
        relationshipId,
        type: "status_changed",
        title: "Sales stage updated",
        body: `Sales stage → ${SALES_STAGE_LABELS[nextSalesStage]} (inbound reply)`,
        occurredAt: now,
        meta: {
          sales_stage: nextSalesStage,
          previous_sales_stage: previousSalesStage,
          trigger: "inbound_reply",
        },
      };
      store.timelineEvents.push(stageEvent);
    }

    if (!store.notifications) store.notifications = [];
    const notification = {
      id: `ntf_${randomUUID().replace(/-/g, "").slice(0, 12)}`,
      type: "prospect_responded" as const,
      relationshipId,
      title: `${relationship.venue.name} responded`,
      body: "Follow up immediately — they replied to your email.",
      createdAt: now,
      read: false,
    };
    store.notifications.push(notification);

    return {
      relationship,
      communication,
      timelineEvent,
      previousSalesStage,
      salesStage: nextSalesStage,
      salesStageChanged,
      stageEvent,
      notificationId: notification.id,
    } satisfies RecordInboundEmailResult;
  });

  return result;
}
