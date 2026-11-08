/**
 * Send venue dunning / suspension emails.
 *
 * Dedupes via dunning.lastReminderDay (markDunningReminderSent).
 * Suspension enforcement is independent of email success — callers must still
 * suspend when due even if this returns sent:false.
 */
import { sendRelationshipEmail } from "@shared/email";

import { markDunningReminderSent } from "./lifecycle";
import { loadLiveStore } from "./store";
import type { DunningDay } from "./types";

export async function sendDunningCheckpointEmail(input: {
  relationshipId: string;
  day: DunningDay;
  shouldSuspend?: boolean;
  billingPortalUrl?: string | null;
}): Promise<{ sent: boolean; skipped: boolean; error?: string }> {
  const store = await loadLiveStore();
  const relationship = store.relationships.find((r) => r.id === input.relationshipId);
  if (!relationship) {
    return { sent: false, skipped: true, error: "relationship_not_found" };
  }

  const last = relationship.dunning?.lastReminderDay;
  if (last != null && last >= input.day && !input.shouldSuspend) {
    return { sent: false, skipped: true };
  }
  // Day-21 / suspend notice: skip only if we already recorded day 21.
  if ((input.day === 21 || input.shouldSuspend) && last != null && last >= 21) {
    return { sent: false, skipped: true };
  }

  const to = relationship.owner.email?.trim();
  if (!to) {
    return { sent: false, skipped: true, error: "no_owner_email" };
  }

  const accessEndsAt = relationship.dunning?.startedAt
    ? new Date(
        new Date(relationship.dunning.startedAt).getTime() + 21 * 86_400_000,
      ).toISOString()
    : null;

  const templateId =
    input.day === 21 || input.shouldSuspend ? "account_suspended" : "payment_reminder";

  try {
    await sendRelationshipEmail({
      relationshipId: relationship.id,
      to,
      templateId,
      vars: {
        firstName: relationship.owner.firstName,
        venueName: relationship.venue.name,
        planName: relationship.planName,
        dunningDay: input.day,
        billingPortalUrl: input.billingPortalUrl ?? null,
        accessEndsAt,
      },
      meta: {
        trigger: "dunning_checkpoint",
        dunning_day: input.day,
        access_ends_at: accessEndsAt,
      },
    });
    await markDunningReminderSent(
      relationship.id,
      input.shouldSuspend && input.day < 21 ? 21 : input.day,
    );
    return { sent: true, skipped: false };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[dunning-notify] email failed — suspension must still proceed if due", {
      relationshipId: input.relationshipId,
      day: input.day,
      error: message,
    });
    return { sent: false, skipped: false, error: message };
  }
}
