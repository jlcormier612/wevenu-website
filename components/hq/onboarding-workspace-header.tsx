"use client";

import * as React from "react";
import { useTransition } from "react";
import Link from "next/link";

import { OnboardingStatusBadge } from "@/components/hq/onboarding-status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  startOnboardingAction, pauseOnboardingAction, resumeOnboardingAction,
  markOnboardingBlockedAction, completeOnboardingAction,
  assignOnboardingToMeAction, unassignOnboardingAction, setOnboardingFocusAction,
} from "@/app/admin/onboarding/actions";
import type { OnboardingEngagement } from "@/lib/hq/onboarding-types";

/** §2.2a step 4 — the per-venue workspace header: status, specialist assignment, current focus, and the lifecycle controls (Start/Pause/Resume/Block/Complete), each an audited action. */
export function OnboardingWorkspaceHeader({
  venueId, venueName, engagement, assignedName, currentAdminId, currentAdminName,
}: {
  venueId: string;
  venueName: string;
  engagement: OnboardingEngagement | null;
  assignedName: string | null;
  currentAdminId: string;
  currentAdminName: string;
}) {
  const [pending, startTransition] = useTransition();
  const [focus, setFocus] = React.useState(engagement?.currentFocus ?? "");

  const status = engagement?.status ?? "not_started";
  const isMine = engagement?.assignedHqAdminId === currentAdminId;

  function run(action: () => Promise<unknown>) {
    startTransition(async () => { await action(); });
  }

  return (
    <div className="space-y-4">
      <div>
        <Link href="/admin/onboarding" className="text-xs text-muted-foreground hover:text-foreground transition-colors">← Customer Success</Link>
        <div className="flex flex-wrap items-center gap-2 mt-1">
          <h1 className="text-2xl font-heading font-semibold text-heading">{venueName}</h1>
          <OnboardingStatusBadge status={status} />
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">
          {assignedName ? `Assigned to ${assignedName}` : "Unassigned"}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {status === "not_started" && (
          <Button size="sm" disabled={pending} onClick={() => run(() => startOnboardingAction(venueId))}>Start Onboarding</Button>
        )}
        {status === "in_progress" && (
          <>
            <Button size="sm" variant="outline" disabled={pending} onClick={() => run(() => pauseOnboardingAction(venueId))}>Pause</Button>
            <Button size="sm" variant="outline" disabled={pending} onClick={() => run(() => markOnboardingBlockedAction(venueId))}>Mark Blocked</Button>
            <Button size="sm" disabled={pending} onClick={() => run(() => completeOnboardingAction(venueId))}>Mark Complete</Button>
          </>
        )}
        {(status === "paused" || status === "blocked") && (
          <>
            <Button size="sm" disabled={pending} onClick={() => run(() => resumeOnboardingAction(venueId))}>Resume</Button>
            <Button size="sm" variant="outline" disabled={pending} onClick={() => run(() => completeOnboardingAction(venueId))}>Mark Complete</Button>
          </>
        )}
        {isMine ? (
          <Button size="sm" variant="ghost" disabled={pending} onClick={() => run(() => unassignOnboardingAction(venueId))}>Unassign me</Button>
        ) : (
          <Button size="sm" variant="ghost" disabled={pending} onClick={() => run(() => assignOnboardingToMeAction(venueId, currentAdminId))}>
            Assign to me ({currentAdminName})
          </Button>
        )}
      </div>

      <form
        className="flex items-center gap-2"
        action={() => run(() => setOnboardingFocusAction(venueId, focus))}
      >
        <Input
          value={focus}
          onChange={(e) => setFocus(e.target.value)}
          placeholder="Current focus — e.g. importing vendor list…"
          className="h-8 max-w-md text-sm"
        />
        <Button type="submit" size="sm" variant="outline" disabled={pending}>Save</Button>
      </form>
    </div>
  );
}
