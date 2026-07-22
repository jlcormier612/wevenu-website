/**
 * Project 5 — Welcome Back verification on the Relationship record.
 * No separate queue: approve / reject / needs follow-up live on `/relationships/[id]`.
 */

import { sendRelationshipEmail } from "@shared/email";
import {
  hasLiveRelationshipsSync,
  loadLiveStoreSync,
  resolveWelcomeBackVerification,
  type WelcomeBackAction,
} from "@shared/relationships";

import { getRelationship } from "@/lib/data/store";
import {
  appendLocalTask,
  appendLocalTimeline,
  appendRelationshipPatch,
  ensureProgram3Data,
  newId,
} from "@/lib/program3/store";
import { getActingMember } from "@/lib/program4/session";

export type ResolveWelcomeBackInput = {
  relationshipId: string;
  action: WelcomeBackAction;
  note?: string | null;
};

export type ResolveWelcomeBackOk = {
  ok: true;
  action: WelcomeBackAction;
  welcomeBackVerified: "pending" | "verified" | "rejected";
  foundingMember: boolean;
  emailDelivery?: "sent" | "simulated" | "failed" | "skipped";
  taskId?: string;
};

export async function resolveWelcomeBackInWorkspace(
  input: ResolveWelcomeBackInput,
): Promise<ResolveWelcomeBackOk | { error: string }> {
  const relationshipId = input.relationshipId.trim();
  const action = input.action;
  if (!relationshipId) return { error: "relationshipId required" };
  if (action !== "approve" && action !== "reject" && action !== "needs_follow_up") {
    return { error: "action must be approve, reject, or needs_follow_up" };
  }

  await ensureProgram3Data();
  const existing = getRelationship(relationshipId);
  if (!existing) return { error: "Relationship not found" };
  if (!existing.welcomeBackRequested) {
    return { error: "Welcome Back was not requested for this relationship" };
  }
  if (existing.welcomeBackVerified !== "pending") {
    return { error: `Welcome Back is already ${existing.welcomeBackVerified}` };
  }

  const actor = await getActingMember();
  const now = new Date().toISOString();
  const note = input.note?.trim() || undefined;

  const nextVerified =
    action === "approve" ? "verified" : action === "reject" ? "rejected" : "pending";

  await appendRelationshipPatch({
    relationshipId,
    welcomeBackVerified: nextVerified,
    foundingMember: action === "approve" ? true : undefined,
    updatedAt: now,
  });

  const inLive =
    hasLiveRelationshipsSync() &&
    loadLiveStoreSync().relationships.some((r) => r.id === relationshipId);

  let timelineEventId = newId("evt");

  if (inLive) {
    const live = await resolveWelcomeBackVerification(relationshipId, action, {
      actorId: actor.id,
      note,
    });
    if ("error" in live) return { error: live.error };
    timelineEventId = live.timelineEvent.id;
  } else {
    const eventSpec =
      action === "approve"
        ? {
            type: "welcome_back_verified",
            title: "Welcome Back Approved",
            body:
              note ||
              "Welcome Back verified. Founding Member pricing eligibility confirmed.",
          }
        : action === "reject"
          ? {
              type: "welcome_back_rejected",
              title: "Welcome Back Rejected",
              body: note || "Welcome Back verification was not approved.",
            }
          : {
              type: "welcome_back_follow_up",
              title: "Welcome Back Needs Follow Up",
              body:
                note ||
                "Verification needs more information before approve or reject.",
            };

    await appendLocalTimeline({
      id: timelineEventId,
      relationshipId,
      type: eventSpec.type,
      title: eventSpec.title,
      body: eventSpec.body,
      occurredAt: now,
      actorId: actor.id,
      meta: {
        action,
        welcome_back_verified: nextVerified,
        founding_member: action === "approve" ? true : existing.foundingMember,
      },
    });
  }

  let taskId: string | undefined;
  if (action === "needs_follow_up") {
    taskId = newId("task");
    const due = new Date();
    due.setDate(due.getDate() + 2);
    await appendLocalTask({
      id: taskId,
      relationshipId,
      title: "Follow up on Welcome Back verification",
      description:
        note ||
        "Gather more context before approving or rejecting Welcome Back.",
      ownerId: existing.assignedTeamMemberId || actor.id,
      dueDate: due.toISOString().slice(0, 10),
      priority: "high",
      status: "open",
      createdAt: now,
    });
  }

  let emailDelivery: ResolveWelcomeBackOk["emailDelivery"] = "skipped";
  if (action === "approve" || action === "reject") {
    const to = existing.owner.email?.trim();
    if (to) {
      const result = await sendRelationshipEmail({
        relationshipId,
        to,
        templateId:
          action === "approve" ? "welcome_back_verified" : "welcome_back_rejected",
        vars: {
          firstName: existing.owner.firstName,
          venueName: existing.venue.name,
          planName: existing.planName,
        },
        actorId: actor.id,
        authorName: actor.name,
        meta: {
          trigger: "welcome_back_verification",
          action,
          decision_event_id: timelineEventId,
        },
        // Live store records via send; seed-only still sends / dry-runs without live timeline.
        recordOnTimeline: inLive,
      });
      emailDelivery = result.delivery;

      if (!inLive) {
        await appendLocalTimeline({
          id: newId("evt"),
          relationshipId,
          type: "email_sent",
          title:
            action === "approve"
              ? "Welcome Back Verified Email Sent"
              : "Welcome Back Rejection Email Sent",
          body: result.preview,
          occurredAt: new Date().toISOString(),
          actorId: actor.id,
          meta: {
            template_id: result.templateId,
            delivery: result.delivery,
            simulated: result.delivery !== "sent",
            action,
          },
        });
      }
    }
  }

  const foundingMember =
    action === "approve" ? true : existing.foundingMember;

  return {
    ok: true,
    action,
    welcomeBackVerified: nextVerified,
    foundingMember,
    emailDelivery,
    taskId,
  };
}
