"use server";

import { revalidatePath } from "next/cache";

import { sendRelationshipEmail } from "@shared/email";
import {
  hasLiveRelationshipsSync,
  loadLiveStoreSync,
} from "@shared/relationships";

import { getRelationship } from "@/lib/data/store";
import { dismissInsight } from "@/lib/luv/dismissals";
import {
  appendLocalCommunication,
  appendLocalTask,
  appendLocalTimeline,
  ensureProgram3Data,
  newId,
} from "@/lib/program3/store";
import { getActingMember } from "@/lib/program4/session";

export async function dismissLuvInsightAction(formData: FormData) {
  const insightId = String(formData.get("insightId") || "").trim();
  const relationshipId = String(formData.get("relationshipId") || "").trim() || null;
  if (!insightId) return { ok: false as const, error: "missing_insight" };

  const actor = await getActingMember();
  await dismissInsight({
    insightId,
    relationshipId,
    actorId: actor.id,
  });

  revalidatePath("/business");
  revalidatePath("/today");
  if (relationshipId) {
    revalidatePath(`/relationships/${relationshipId}`);
    revalidatePath("/sales");
    revalidatePath("/customer-success");
  }
  return { ok: true as const };
}

export async function createLuvTaskAction(formData: FormData) {
  const relationshipId = String(formData.get("relationshipId") || "").trim();
  const title = String(formData.get("title") || "").trim();
  const insightId = String(formData.get("insightId") || "").trim();
  if (!relationshipId || !title) return { ok: false as const, error: "missing_fields" };

  const rel = getRelationship(relationshipId);
  if (!rel) return { ok: false as const, error: "not_found" };

  await ensureProgram3Data();
  const actor = await getActingMember();
  const due = new Date();
  due.setDate(due.getDate() + 2);

  await appendLocalTask({
    id: newId("task"),
    relationshipId,
    title,
    description: insightId ? `Created from Luv insight ${insightId}` : "Created from Luv",
    ownerId: rel.assignedTeamMemberId || actor.id,
    dueDate: due.toISOString().slice(0, 10),
    priority: "medium",
    status: "open",
    createdAt: new Date().toISOString(),
  });

  revalidatePath(`/relationships/${relationshipId}`);
  revalidatePath("/sales");
  revalidatePath("/customer-success");
  revalidatePath("/tasks");
  revalidatePath("/today");
  return { ok: true as const };
}

export async function useLuvDraftAction(formData: FormData) {
  const relationshipId = String(formData.get("relationshipId") || "").trim();
  const subject = String(formData.get("subject") || "").trim();
  const body = String(formData.get("body") || "").trim();
  const channelRaw = String(formData.get("channel") || "email").trim();
  const mode = String(formData.get("mode") || "note").trim(); // note | send | simulated_send

  if (!relationshipId || !body) return { ok: false as const, error: "missing_fields" };
  const rel = getRelationship(relationshipId);
  if (!rel) return { ok: false as const, error: "not_found" };

  await ensureProgram3Data();
  const actor = await getActingMember();
  const now = new Date().toISOString();

  const isSend = mode === "send" || mode === "simulated_send";
  const channel: "email" | "internal_comment" =
    channelRaw === "internal_note" || mode === "note" ? "internal_comment" : "email";

  const direction =
    channel === "internal_comment" ? "internal" : isSend ? "outbound" : "internal";

  let delivery: "sent" | "simulated" | "failed" | "note" = "note";
  let providerId: string | undefined;
  let timelineId = newId("te");
  let communicationId = newId("com");

  if (isSend && channel === "email") {
    const to = rel.owner.email?.trim();
    if (!to) return { ok: false as const, error: "missing_email" };

    const result = await sendRelationshipEmail({
      relationshipId,
      to,
      templateId: "luv_suggestion",
      vars: {
        subject: subject || `Luv draft — ${rel.venue.name}`,
        body,
        venueName: rel.venue.name,
        firstName: rel.owner.firstName,
      },
      subject: subject || `Luv draft — ${rel.venue.name}`,
      text: body,
      actorId: actor.id,
      authorName: actor.name,
      meta: { source: "luv" },
      // Live store gets the canonical append from sendRelationshipEmail.
      // Seed-only relationships: we still send (or dry-run) then log locally below.
      recordOnTimeline: true,
    });

    delivery = result.delivery;
    providerId = result.providerId;
    if (result.timelineEventId) timelineId = result.timelineEventId;
    if (result.communicationId) communicationId = result.communicationId;

    const inLive =
      hasLiveRelationshipsSync() &&
      loadLiveStoreSync().relationships.some((r) => r.id === relationshipId);

    // Always keep a local row (same ids when live-synced) so seed + hybrid UIs stay in sync.
    await appendLocalCommunication({
      id: communicationId,
      relationshipId,
      channel: "email",
      subject: subject || `Luv draft — ${rel.venue.name}`,
      body,
      direction: "outbound",
      occurredAt: now,
      actorId: actor.id,
      authorName: actor.name,
    });

    await appendLocalTimeline({
      id: timelineId,
      relationshipId,
      type: "email_sent",
      title:
        delivery === "sent"
          ? `Email sent — ${subject || "Luv draft"}`
          : delivery === "failed"
            ? `Email failed — ${subject || "Luv draft"}`
            : `Email simulated — ${subject || "Luv draft"}`,
      body: body.slice(0, 280),
      occurredAt: now,
      actorId: actor.id,
      meta: {
        source: "luv",
        simulated: delivery !== "sent",
        delivery,
        provider_id: providerId ?? null,
        in_live_store: inLive,
      },
    });
  } else {
    await appendLocalCommunication({
      id: communicationId,
      relationshipId,
      channel,
      subject: subject || `Luv draft — ${rel.venue.name}`,
      body,
      direction,
      occurredAt: now,
      actorId: actor.id,
      authorName: actor.name,
    });

    await appendLocalTimeline({
      id: timelineId,
      relationshipId,
      type: "note_added",
      title: `Luv draft saved — ${subject || "Note"}`,
      body: body.slice(0, 280),
      occurredAt: now,
      actorId: actor.id,
      meta: { source: "luv", simulated: false },
    });
  }

  revalidatePath(`/relationships/${relationshipId}`);
  revalidatePath("/communications");
  return {
    ok: true as const,
    delivery,
    providerId,
  };
}
