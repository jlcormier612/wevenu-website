import { NextResponse } from "next/server";

import {
  ingestWalkthroughRequest,
  loadLiveStore,
  setWalkthroughStatus,
} from "@shared/relationships";
import type { WalkthroughStatus } from "@shared/relationships";

import { getActingMember, actorCan } from "@/lib/program4/session";
import { ensureProgram4Data } from "@/lib/program4/store";

const STATUSES = new Set<WalkthroughStatus>([
  "completed",
  "rescheduled",
  "cancelled",
]);

/**
 * POST /api/walkthroughs — Log Walkthrough (manual schedule).
 * Permission: manage_walkthroughs
 */
export async function POST(request: Request) {
  await ensureProgram4Data();

  if (!(await actorCan("manage_walkthroughs"))) {
    return NextResponse.json(
      { error: "You do not have permission to log walkthroughs" },
      { status: 403 },
    );
  }

  const body = (await request.json()) as {
    relationshipId?: string;
    email?: string;
    venueName?: string;
    ownerName?: string;
    scheduledAt?: string;
    assignedTeamMemberId?: string;
    notes?: string;
  };

  const scheduledAt = body.scheduledAt?.trim();
  if (!scheduledAt) {
    return NextResponse.json({ error: "scheduledAt required" }, { status: 400 });
  }

  let email = body.email?.trim();
  let venueName = body.venueName?.trim();
  let ownerName = body.ownerName?.trim();

  if (body.relationshipId?.trim()) {
    const store = await loadLiveStore();
    const rel = store.relationships.find((r) => r.id === body.relationshipId);
    if (!rel) {
      return NextResponse.json({ error: "Relationship not found" }, { status: 404 });
    }
    email = email || rel.owner.email;
    venueName = venueName || rel.venue.name;
    ownerName =
      ownerName ||
      [rel.owner.firstName, rel.owner.lastName].filter(Boolean).join(" ");
  }

  if (!email) {
    return NextResponse.json(
      { error: "email or relationshipId required" },
      { status: 400 },
    );
  }

  const actor = await getActingMember();
  const result = await ingestWalkthroughRequest({
    email,
    name: ownerName,
    venueName,
    message: body.notes,
    scheduledAt,
    assignedTeamMemberId: body.assignedTeamMemberId || actor.id,
    referralSource: "Manual walkthrough",
    sourceId: `manual_${Date.now()}`,
  });

  return NextResponse.json({
    ok: true,
    relationshipId: result.relationship.id,
    created: result.created,
  });
}

/**
 * PATCH /api/walkthroughs — Complete / Reschedule / Cancel (persist).
 * Permission: manage_walkthroughs
 */
export async function PATCH(request: Request) {
  await ensureProgram4Data();

  if (!(await actorCan("manage_walkthroughs"))) {
    return NextResponse.json(
      { error: "You do not have permission to update walkthroughs" },
      { status: 403 },
    );
  }

  const body = (await request.json()) as {
    walkthroughId?: string;
    status?: string;
    scheduledAt?: string | null;
    notes?: string | null;
  };

  if (!body.walkthroughId?.trim()) {
    return NextResponse.json({ error: "walkthroughId required" }, { status: 400 });
  }
  if (!body.status || !STATUSES.has(body.status as WalkthroughStatus)) {
    return NextResponse.json(
      { error: "status must be completed, rescheduled, or cancelled" },
      { status: 400 },
    );
  }

  const actor = await getActingMember();
  const result = await setWalkthroughStatus(
    body.walkthroughId,
    body.status as WalkthroughStatus,
    {
      scheduledAt: body.scheduledAt,
      notes: body.notes,
      actorId: actor.id,
    },
  );

  if ("error" in result) {
    return NextResponse.json(result, { status: 400 });
  }

  return NextResponse.json({
    ok: true,
    status: result.walkthrough.status,
    relationshipId: result.relationship.id,
  });
}
