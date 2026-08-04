import { NextResponse } from "next/server";

import { sendRelationshipEmail } from "@shared/email";
import {
  appendCommunication,
  appendTimelineEvent,
  hasLiveRelationshipsSync,
  loadLiveStoreSync,
  updateRelationshipFields,
} from "@shared/relationships";

import { getRelationship } from "@/lib/data/store";
import {
  appendLocalCommunication,
  appendLocalTask,
  appendLocalTimeline,
  ensureProgram3Data,
  newId,
} from "@/lib/program3/store";
import { actorCan, getActingMember } from "@/lib/program4/session";
import { ensureProgram4Data } from "@/lib/program4/store";

type OwnerAction = "create_task" | "send_message" | "add_note";

/**
 * Owner panel tools on Relationship detail (Sales + CS).
 * POST { relationshipId, action, ... }
 */
export async function POST(request: Request) {
  await ensureProgram4Data();
  await ensureProgram3Data();

  const canEdit = await actorCan("edit_relationships");
  const canComms = await actorCan("manage_communications");
  const canTasks = await actorCan("manage_tasks");
  if (!canEdit && !canComms && !canTasks) {
    return NextResponse.json(
      { error: "You do not have permission for owner actions" },
      { status: 403 },
    );
  }

  const body = (await request.json()) as {
    relationshipId?: string;
    action?: OwnerAction;
    title?: string;
    description?: string | null;
    dueDate?: string | null;
    subject?: string | null;
    body?: string | null;
    note?: string | null;
  };

  const relationshipId = body.relationshipId?.trim();
  if (!relationshipId) {
    return NextResponse.json({ error: "relationshipId required" }, { status: 400 });
  }

  const relationship = getRelationship(relationshipId);
  if (!relationship) {
    return NextResponse.json({ error: "Relationship not found" }, { status: 404 });
  }

  const actor = await getActingMember();
  const now = new Date().toISOString();
  const inLive =
    hasLiveRelationshipsSync() &&
    loadLiveStoreSync().relationships.some((r) => r.id === relationshipId);

  if (body.action === "create_task") {
    if (!canEdit && !canTasks) {
      return NextResponse.json(
        { error: "Permission required to create tasks" },
        { status: 403 },
      );
    }
    const title = body.title?.trim();
    if (!title) {
      return NextResponse.json({ error: "title required" }, { status: 400 });
    }

    const due =
      body.dueDate?.trim() ||
      (() => {
        const d = new Date();
        d.setDate(d.getDate() + 2);
        return d.toISOString().slice(0, 10);
      })();
    const description = body.description?.trim() || undefined;
    const taskId = newId("task");
    const timelineId = newId("te");

    await appendLocalTask({
      id: taskId,
      relationshipId,
      title,
      description,
      ownerId: relationship.assignedTeamMemberId || actor?.id || "unassigned",
      dueDate: due,
      priority: "medium",
      status: "open",
      createdAt: now,
    });

    await appendLocalTimeline({
      id: timelineId,
      relationshipId,
      type: "note_added",
      title: `Task created: ${title}`,
      body: description?.slice(0, 280),
      occurredAt: now,
      actorId: actor?.id,
      meta: { source: "owner_actions", task_id: taskId },
    });

    if (inLive) {
      await appendTimelineEvent(relationshipId, {
        id: timelineId,
        type: "note_added",
        title: `Task created: ${title}`,
        body: description?.slice(0, 280),
        occurredAt: now,
        actorId: actor?.id,
        meta: { source: "owner_actions", task_id: taskId },
      });
    }

    return NextResponse.json({
      ok: true,
      action: "create_task",
      taskId,
      timelineEventId: timelineId,
      message: "Task created.",
    });
  }

  if (body.action === "send_message") {
    if (!canEdit && !canComms) {
      return NextResponse.json(
        { error: "Permission required to send messages" },
        { status: 403 },
      );
    }
    const subject = body.subject?.trim();
    const text = body.body?.trim();
    if (!subject || !text) {
      return NextResponse.json(
        { error: "subject and body required" },
        { status: 400 },
      );
    }

    const to = relationship.owner.email?.trim();
    if (!to) {
      return NextResponse.json(
        { error: "Owner email is missing — cannot send message" },
        { status: 400 },
      );
    }

    const result = await sendRelationshipEmail({
      relationshipId,
      to,
      templateId: "luv_suggestion",
      vars: {
        subject,
        body: text,
        venueName: relationship.venue.name,
        firstName: relationship.owner.firstName,
      },
      subject,
      text,
      actorId: actor?.id,
      authorName: actor?.name ?? "Hello to Cheers",
      timelineTitle: `Message sent: ${subject}`,
      meta: { source: "owner_actions" },
    });

    if (!result.ok && result.delivery === "failed") {
      return NextResponse.json(
        { error: result.message || "Failed to send message" },
        { status: 502 },
      );
    }

    const communicationId = result.communicationId || newId("com");
    const timelineId = result.timelineEventId || newId("te");

    // Keep local rows in sync for seed / hybrid UI (same ids when live-recorded).
    await appendLocalCommunication({
      id: communicationId,
      relationshipId,
      channel: "email",
      subject,
      body: text,
      direction: "outbound",
      occurredAt: now,
      actorId: actor?.id,
      authorName: actor?.name ?? "Hello to Cheers",
    });

    if (!result.timelineEventId) {
      await appendLocalTimeline({
        id: timelineId,
        relationshipId,
        type: "email_sent",
        title:
          result.delivery === "sent"
            ? `Message sent: ${subject}`
            : result.delivery === "simulated"
              ? `Message simulated: ${subject}`
              : `Message failed: ${subject}`,
        body: text.slice(0, 280),
        occurredAt: now,
        actorId: actor?.id,
        meta: {
          source: "owner_actions",
          delivery: result.delivery,
          provider_id: result.providerId ?? null,
        },
      });
    } else {
      await appendLocalTimeline({
        id: timelineId,
        relationshipId,
        type: "email_sent",
        title: `Message sent: ${subject}`,
        body: text.slice(0, 280),
        occurredAt: now,
        actorId: actor?.id,
        meta: {
          source: "owner_actions",
          delivery: result.delivery,
          provider_id: result.providerId ?? null,
        },
      });
    }

    const message =
      result.delivery === "sent"
        ? "Message sent."
        : result.delivery === "simulated"
          ? "Message logged (simulated send — no RESEND_API_KEY)."
          : "Message recorded.";

    return NextResponse.json({
      ok: true,
      action: "send_message",
      delivery: result.delivery,
      communicationId,
      timelineEventId: timelineId,
      message,
    });
  }

  if (body.action === "add_note") {
    if (!canEdit && !canComms) {
      return NextResponse.json(
        { error: "Permission required to add notes" },
        { status: 403 },
      );
    }
    const note = (body.note ?? body.body)?.trim();
    if (!note) {
      return NextResponse.json({ error: "note required" }, { status: 400 });
    }
    const subject = body.subject?.trim() || "Internal note";
    const communicationId = newId("com");
    const timelineId = newId("te");

    await appendLocalCommunication({
      id: communicationId,
      relationshipId,
      channel: "internal_comment",
      subject,
      body: note,
      direction: "internal",
      occurredAt: now,
      actorId: actor?.id,
      authorName: actor?.name ?? "Hello to Cheers",
    });

    await appendLocalTimeline({
      id: timelineId,
      relationshipId,
      type: "note_added",
      title: `Note: ${subject}`,
      body: note.slice(0, 280),
      occurredAt: now,
      actorId: actor?.id,
      meta: { source: "owner_actions" },
    });

    if (inLive) {
      await appendCommunication(relationshipId, {
        id: communicationId,
        channel: "internal_comment",
        subject,
        body: note,
        direction: "internal",
        occurredAt: now,
        actorId: actor?.id,
        authorName: actor?.name ?? "Hello to Cheers",
      });
      await appendTimelineEvent(relationshipId, {
        id: timelineId,
        type: "note_added",
        title: `Note: ${subject}`,
        body: note.slice(0, 280),
        occurredAt: now,
        actorId: actor?.id,
        meta: { source: "owner_actions" },
      });
      await updateRelationshipFields(relationshipId, {
        notes: note,
        lastTeamActivityAt: now,
      });
    }

    return NextResponse.json({
      ok: true,
      action: "add_note",
      communicationId,
      timelineEventId: timelineId,
      message: "Note added.",
    });
  }

  return NextResponse.json(
    { error: 'action must be "create_task", "send_message", or "add_note"' },
    { status: 400 },
  );
}
