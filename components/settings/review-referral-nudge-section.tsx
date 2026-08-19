"use client";

/**
 * ReviewReferralNudgeSection — RC2, Milestone 4.
 *
 * "Event.Completed should become the natural transition from operational
 * coordination into post-event relationship management, without
 * introducing a separate communication model." This is that transition:
 * a Scheduled Send (the exact same mechanism as any coordinator-composed
 * one), queued by an Automation Rule when an event completes.
 *
 * No general automation-rules editor exists yet — this is the one
 * purpose-built toggle for this specific rule, seeded disabled for every
 * venue so nothing sends until a venue intentionally turns it on.
 */
import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { setEventCompletedNudgeEnabledAction } from "@/app/(app)/settings/actions";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import type { AutomationRule } from "@/lib/automation/types";

export function ReviewReferralNudgeSection({ initialRule }: { initialRule: AutomationRule | null }) {
  const router = useRouter();
  const [enabled, setEnabled] = React.useState(initialRule?.enabled ?? false);
  const [pending, setPending] = React.useState(false);

  async function toggle(value: boolean) {
    setEnabled(value);
    setPending(true);
    const result = await setEventCompletedNudgeEnabledAction(value);
    setPending(false);
    if (result.ok) {
      toast.success(value ? "Review & referral nudge turned on." : "Review & referral nudge turned off.");
      router.refresh();
    } else {
      setEnabled(!value);
      toast.error(result.message ?? "Could not update this setting.");
    }
  }

  if (!initialRule) {
    return <p className="text-sm text-muted-foreground">Not available yet — this venue was created before this feature shipped.</p>;
  }

  const params = initialRule.actionParams as { offsetDays?: number; subject?: string };
  const offsetDays = Number.isFinite(Number(params.offsetDays)) ? Number(params.offsetDays) : 3;
  const subject = params.subject ?? "How was your day with us?";

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Switch checked={enabled} disabled={pending} onCheckedChange={(v) => void toggle(v)} />
        <Label className="cursor-pointer">Automatically ask for a review and referral after each event</Label>
      </div>
      <p className="text-xs text-muted-foreground">
        {`When an event is marked complete, an email goes out ${offsetDays} days later — subject “${subject}”. It sends once per event, through this couple's existing Conversation, exactly like any other Scheduled Send.`}
      </p>
    </div>
  );
}
