import { NextResponse } from "next/server";

import { sendRelationshipEmail } from "@shared/email";
import { greetingFirstName, resolveOpenFeedback } from "@shared/relationships";

import { getRelationship } from "@/lib/data/store";
import { actorCan, getActingMember } from "@/lib/program4/session";
import { ensureProgram4Data } from "@/lib/program4/store";

/**
 * Support actions on a Relationship.
 * POST { relationshipId, action: "resolve" | "reply", ... }
 */
export async function POST(request: Request) {
  await ensureProgram4Data();

  const canAct =
    (await actorCan("edit_relationships")) ||
    (await actorCan("manage_communications"));
  if (!canAct) {
    return NextResponse.json(
      { error: "You do not have permission to manage support" },
      { status: 403 },
    );
  }

  const body = (await request.json()) as {
    relationshipId?: string;
    action?: string;
    itemId?: string | null;
    all?: boolean;
    note?: string | null;
    subject?: string | null;
    body?: string | null;
  };

  if (!body.relationshipId?.trim()) {
    return NextResponse.json({ error: "relationshipId required" }, { status: 400 });
  }

  const actor = await getActingMember();

  if (body.action === "reply") {
    const subject = body.subject?.trim();
    const text = body.body?.trim();
    if (!subject || !text) {
      return NextResponse.json(
        { error: "subject and body required for reply" },
        { status: 400 },
      );
    }

    const relationship = getRelationship(body.relationshipId.trim());
    if (!relationship) {
      return NextResponse.json({ error: "Relationship not found" }, { status: 404 });
    }
    const to = relationship.owner.email?.trim();
    if (!to) {
      return NextResponse.json(
        { error: "Owner email is missing — cannot send reply" },
        { status: 400 },
      );
    }

    const result = await sendRelationshipEmail({
      relationshipId: relationship.id,
      to,
      templateId: "luv_suggestion",
      vars: {
        subject,
        body: text,
        venueName: relationship.venue.name,
        firstName: greetingFirstName({
          firstName: relationship.owner.firstName,
          email: relationship.owner.email,
        }),
      },
      subject,
      text,
      actorId: actor?.id,
      authorName: actor?.name ?? "Hello to Cheers",
      timelineTitle: `Support reply: ${subject}`,
      meta: {
        source: "support_reply",
        feedback_item_id: body.itemId?.trim() || null,
      },
    });

    if (!result.ok && result.delivery === "failed") {
      return NextResponse.json(
        { error: result.message || "Failed to send reply" },
        { status: 502 },
      );
    }

    return NextResponse.json({
      ok: true,
      relationshipId: relationship.id,
      delivery: result.delivery,
      timelineEventId: result.timelineEventId,
      communicationId: result.communicationId,
    });
  }

  if (body.action !== "resolve") {
    return NextResponse.json(
      { error: 'action must be "resolve" or "reply"' },
      { status: 400 },
    );
  }

  const result = await resolveOpenFeedback({
    relationshipId: body.relationshipId,
    itemId: body.itemId ?? undefined,
    all: body.all === true,
    note: body.note,
    actorId: actor?.id,
  });

  if ("error" in result) {
    return NextResponse.json(result, { status: 400 });
  }

  return NextResponse.json({
    ok: true,
    relationshipId: result.relationship.id,
    resolvedIds: result.resolvedIds,
    supportOpenCount: result.supportOpenCount,
    customerSuccessStage: result.relationship.customerSuccessStage,
    timelineEventId: result.timelineEvent.id,
  });
}
