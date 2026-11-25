/**
 * Marketing → CRM Program 3 automation bridge.
 *
 * After website/Calendly ingest updates a relationship status, marketing calls
 * this endpoint (Bearer PRODUCT_SYNC_API_KEY) so founder-enabled workflows /
 * sequences enroll through the existing Program 3 engine.
 *
 * Inactive rules → no send. Idempotent per (sourceId, event) when provided.
 */
import { timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";

import { loadLiveStore, loadLiveStoreSync } from "@shared/relationships";

import {
  enrollOnStatusEnter,
  enrollOnStatusLeave,
  handleWalkthroughCanceledAutomation,
} from "@/lib/program3/engine";
import { toPipelineStatus } from "@/lib/pipeline";
import type { PipelineStatus, RelationshipStatus } from "@/lib/types";
import { ensureProgram3Data } from "@/lib/program3/store";
import { tickAutomations } from "@/lib/program3/tick-automations";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type IngestEventBody = {
  event: "status_enter" | "status_leave" | "walkthrough_canceled";
  relationshipId: string;
  status?: string;
  previousStatus?: string | null;
  sourceId?: string | null;
};

function authorize(request: Request): boolean {
  const expected = process.env.PRODUCT_SYNC_API_KEY?.trim();
  if (!expected) return process.env.NODE_ENV !== "production";
  const header = request.headers.get("authorization") || "";
  if (!header.toLowerCase().startsWith("bearer ")) return false;
  const token = header.slice(7).trim();
  const a = Buffer.from(token);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

const processedKeys = new Set<string>();

function rememberIdempotency(key: string): boolean {
  if (processedKeys.has(key)) return false;
  processedKeys.add(key);
  // Bound memory for long-lived ECS tasks
  if (processedKeys.size > 5_000) {
    const first = processedKeys.values().next().value;
    if (first) processedKeys.delete(first);
  }
  return true;
}

export async function POST(request: Request) {
  if (!authorize(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: IngestEventBody;
  try {
    body = (await request.json()) as IngestEventBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const relationshipId = body.relationshipId?.trim();
  if (!relationshipId) {
    return NextResponse.json({ error: "relationshipId required" }, { status: 400 });
  }
  if (
    body.event !== "status_enter" &&
    body.event !== "status_leave" &&
    body.event !== "walkthrough_canceled"
  ) {
    return NextResponse.json({ error: "Unsupported event" }, { status: 400 });
  }

  const idempotencyKey = [
    body.event,
    relationshipId,
    body.status || "",
    body.sourceId || "",
  ].join(":");
  if (body.sourceId && !rememberIdempotency(idempotencyKey)) {
    return NextResponse.json({
      ok: true,
      replayed: true,
      message: "Already processed",
    });
  }

  await ensureProgram3Data();
  await loadLiveStore();

  const getRelationship = (id: string) =>
    loadLiveStoreSync().relationships.find((r) => r.id === id);

  if (!getRelationship(relationshipId)) {
    return NextResponse.json({ error: "Relationship not found" }, { status: 404 });
  }

  if (body.event === "walkthrough_canceled") {
    if (body.previousStatus) {
      const left = toPipelineStatus(body.previousStatus as RelationshipStatus);
      await enrollOnStatusLeave(relationshipId, left, getRelationship);
    }
    const exited = await handleWalkthroughCanceledAutomation(relationshipId);
    await tickAutomations({ includeLifecycle: false });
    return NextResponse.json({ ok: true, event: body.event, ...exited });
  }

  const statusRaw = body.status?.trim();
  if (!statusRaw) {
    return NextResponse.json({ error: "status required" }, { status: 400 });
  }

  // Support overlay maps to "active" for boards — do not auto-enroll as Active.
  if (statusRaw === "support") {
    return NextResponse.json({
      ok: true,
      event: body.event,
      skipped: "support_overlay",
    });
  }

  const pipeline = toPipelineStatus(statusRaw as RelationshipStatus) as PipelineStatus;

  if (body.event === "status_enter") {
    if (body.previousStatus && body.previousStatus !== statusRaw) {
      const left = toPipelineStatus(body.previousStatus as RelationshipStatus);
      if (body.previousStatus !== "support") {
        await enrollOnStatusLeave(relationshipId, left, getRelationship);
      }
    }
    await enrollOnStatusEnter(relationshipId, pipeline, getRelationship);
  } else {
    await enrollOnStatusLeave(relationshipId, pipeline, getRelationship);
  }

  await tickAutomations({ includeLifecycle: false });
  return NextResponse.json({ ok: true, event: body.event, status: pipeline });
}
