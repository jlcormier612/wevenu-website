"use client";

/**
 * Settings bridge for Post-Event Thank You (SEQ-04).
 * Authoritative create/edit lives under Automations; this toggle only
 * turns the starter on/off after the venue has reviewed it.
 */
import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { setEventCompletedNudgeEnabledAction } from "@/app/(app)/settings/actions";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import type { PostEventThankYouAutomation } from "@/lib/automation/service";

export function ReviewReferralNudgeSection({
  initialRule,
}: {
  initialRule: PostEventThankYouAutomation | null;
}) {
  const router = useRouter();
  const [enabled, setEnabled] = React.useState(initialRule?.enabled ?? false);
  const [pending, setPending] = React.useState(false);

  async function toggle(value: boolean) {
    setEnabled(value);
    setPending(true);
    const result = await setEventCompletedNudgeEnabledAction(value);
    setPending(false);
    if (result.ok) {
      toast.success(value ? "Post-event thank you turned on." : "Post-event thank you turned off.");
      router.refresh();
    } else {
      setEnabled(!value);
      toast.error(result.message ?? "Could not update this setting.");
    }
  }

  if (!initialRule) {
    return (
      <p className="text-sm text-muted-foreground">
        Not available yet. Open{" "}
        <Link href="/communication/series" className="underline underline-offset-2">
          Automations
        </Link>{" "}
        to add a Post-Event Thank You automation.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Switch checked={enabled} disabled={pending} onCheckedChange={(v) => void toggle(v)} />
        <Label className="cursor-pointer">Automatically send a thank-you / review ask after each event</Label>
      </div>
      <p className="text-xs text-muted-foreground">
        Uses your <span className="font-medium text-heading">{initialRule.name}</span> Automation.
        When an event is marked complete, the first message goes out {initialRule.offsetDays} days later.
        Edit the message and timing in{" "}
        <Link href={`/communication/series/${initialRule.id}/edit`} className="underline underline-offset-2">
          Automations
        </Link>
        .
      </p>
    </div>
  );
}
