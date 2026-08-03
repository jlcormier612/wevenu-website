import { NextResponse } from "next/server";
import { randomUUID } from "crypto";

import { getRelationship } from "@/lib/data/store";
import { isPipelineStatus } from "@/lib/pipeline";
import { moveRelationshipStatus } from "@/lib/program3/engine";
import {
  appendLocalTimeline,
  appendRelationshipPatch,
  ensureProgram3Data,
} from "@/lib/program3/store";
import {
  isCustomerSuccessStage,
  isSalesStage,
} from "@/lib/sales-cs";
import {
  hasLiveRelationshipsSync,
  updateRelationshipFields,
} from "@shared/relationships";

function newId(prefix: string) {
  return `${prefix}_${randomUUID().replace(/-/g, "").slice(0, 12)}`;
}

export async function POST(request: Request) {
  await ensureProgram3Data();
  const body = (await request.json()) as {
    relationshipId?: string;
    status?: string;
    salesStage?: string;
    customerSuccessStage?: string;
  };

  if (!body.relationshipId) {
    return NextResponse.json({ error: "relationshipId required" }, { status: 400 });
  }

  const existing = getRelationship(body.relationshipId);
  if (!existing) {
    return NextResponse.json({ error: "Relationship not found" }, { status: 404 });
  }

  const updatedAt = new Date().toISOString();

  // Sales board move — view field only (same Relationship ID).
  if (body.salesStage) {
    if (!isSalesStage(body.salesStage)) {
      return NextResponse.json({ error: "Invalid sales stage" }, { status: 400 });
    }
    await appendRelationshipPatch({
      relationshipId: body.relationshipId,
      salesStage: body.salesStage,
      updatedAt,
    });
    if (hasLiveRelationshipsSync()) {
      try {
        await updateRelationshipFields(body.relationshipId, {
          salesStage: body.salesStage,
        });
      } catch {
        /* local patch still applied */
      }
    }
    await appendLocalTimeline({
      id: newId("evt"),
      relationshipId: body.relationshipId,
      type: "status_changed",
      title: "Sales stage updated",
      body: `Sales stage → ${body.salesStage.replace(/_/g, " ")}`,
      occurredAt: updatedAt,
      meta: { sales_stage: body.salesStage },
    });
    return NextResponse.json({ ok: true, salesStage: body.salesStage });
  }

  // Customer Success board move — view field only.
  if (body.customerSuccessStage) {
    if (!isCustomerSuccessStage(body.customerSuccessStage)) {
      return NextResponse.json(
        { error: "Invalid customer success stage" },
        { status: 400 },
      );
    }
    await appendRelationshipPatch({
      relationshipId: body.relationshipId,
      customerSuccessStage: body.customerSuccessStage,
      updatedAt,
    });
    if (hasLiveRelationshipsSync()) {
      try {
        await updateRelationshipFields(body.relationshipId, {
          customerSuccessStage: body.customerSuccessStage,
        });
      } catch {
        /* local patch still applied */
      }
    }
    await appendLocalTimeline({
      id: newId("evt"),
      relationshipId: body.relationshipId,
      type: "status_changed",
      title: "Customer Success stage updated",
      body: `Customer Success → ${body.customerSuccessStage.replace(/_/g, " ")}`,
      occurredAt: updatedAt,
      meta: { customer_success_stage: body.customerSuccessStage },
    });
    return NextResponse.json({
      ok: true,
      customerSuccessStage: body.customerSuccessStage,
    });
  }

  if (!body.status) {
    return NextResponse.json(
      { error: "status, salesStage, or customerSuccessStage required" },
      { status: 400 },
    );
  }
  if (!isPipelineStatus(body.status)) {
    return NextResponse.json({ error: "Invalid pipeline status" }, { status: 400 });
  }

  const result = await moveRelationshipStatus(body.relationshipId, body.status, {
    getRelationship,
  });

  if ("error" in result) {
    return NextResponse.json(result, { status: 400 });
  }

  return NextResponse.json({ ok: true, status: result.status });
}
