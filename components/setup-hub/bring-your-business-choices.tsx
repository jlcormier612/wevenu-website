"use client";

import Link from "next/link";
import { ChevronRight, HelpCircle } from "lucide-react";

import { StageAcknowledgeButton } from "@/components/setup-hub/stage-acknowledge-button";
import { setBringYourBusinessPathAction } from "@/app/(app)/setup-hub/actions";
import { BRING_YOUR_BUSINESS_ROUTES, bringYourBusinessHref } from "@/lib/setup-hub/bring-your-business";
import {
  bringBusinessIntakeHeading,
  type BringBusinessChoice,
} from "@/lib/onboarding/types";
import {
  BYB_ENTRY_CHOICES,
  BYB_ENTRY_HEADLINE,
  BYB_STARTING_FRESH,
} from "@/lib/setup-hub/bring-your-business-journey";
import type { BringYourBusinessPath } from "@/lib/setup-hub/types";

/**
 * Setup Hub — Bring Your Business.
 * Same three customer-facing choices as the unified journey. Named sources are not shown.
 */
export function BringYourBusinessChoices({
  done,
  hasImportedData,
  path,
  calendarReadyHint,
  intakeBringBusinessChoice = null,
}: {
  done: boolean;
  hasImportedData: boolean;
  path: BringYourBusinessPath | null;
  calendarReadyHint?: string | null;
  intakeBringBusinessChoice?: BringBusinessChoice | null;
}) {
  const intakeHeading = bringBusinessIntakeHeading(intakeBringBusinessChoice);

  if (done) {
    return (
      <div className="flex flex-wrap items-center gap-3 pt-1">
        {hasImportedData ? (
          <Link
            href={BRING_YOUR_BUSINESS_ROUTES.guidedExperience}
            className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
          >
            Continue Bring Your Business
            <ChevronRight className="h-3 w-3" />
          </Link>
        ) : path === "individual" ? (
          <Link
            href={bringYourBusinessHref("prepare")}
            className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
          >
            Keep adding individually
            <ChevronRight className="h-3 w-3" />
          </Link>
        ) : path === "skipped" ? (
          <div className="space-y-1">
            {intakeBringBusinessChoice === "starting_fresh" ? (
              <p className="text-xs text-muted-foreground">Start fresh — that matches what you told us at setup.</p>
            ) : null}
            <Link
              href={BRING_YOUR_BUSINESS_ROUTES.guidedExperience}
              className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
            >
              Changed your mind? Bring your business over
              <ChevronRight className="h-3 w-3" />
            </Link>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-3 pt-1">
      <p className="text-xs text-muted-foreground">{BYB_ENTRY_HEADLINE.replace(/\.$/, "")} — recommended order, skippable anytime.</p>
      {calendarReadyHint ? (
        <p className="text-xs text-amber-800 dark:text-amber-200">
          {calendarReadyHint}{" "}
          <Link href={BRING_YOUR_BUSINESS_ROUTES.calendarAvailability} className="font-medium underline">
            Open Availability &amp; Capacity
          </Link>
        </p>
      ) : null}

      {intakeHeading && intakeBringBusinessChoice !== "starting_fresh" ? (
        <div className="htc-surface-guidance space-y-2 p-3 text-sm">
          <p className="font-medium">{intakeHeading}</p>
          <p className="text-xs text-muted-foreground">
            You already chose this during setup. You can still pick a different path below.
          </p>
        </div>
      ) : null}

      {intakeBringBusinessChoice === "starting_fresh" ? (
        <p className="text-xs text-muted-foreground">
          Start fresh — that matches what you told us at setup. You can still import or add records if you change course.
        </p>
      ) : null}

      <div className="space-y-2">
        {BYB_ENTRY_CHOICES.map((choice) => (
          <Link
            key={choice.id}
            href={choice.href}
            className="htc-surface-guidance flex items-start justify-between gap-3 p-3 text-sm hover:border-primary"
          >
            <span>
              <span className="font-medium">{choice.title}</span>
              <span className="mt-1 block text-xs text-muted-foreground">{choice.description}</span>
            </span>
            <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground" />
          </Link>
        ))}

        <div className="htc-surface-guidance space-y-2 p-3 text-sm">
          <p className="font-medium">{BYB_STARTING_FRESH.title}</p>
          <p className="mt-1 text-xs text-muted-foreground">{BYB_STARTING_FRESH.description}</p>
          <div className="mt-2">
            <StageAcknowledgeButton
              action={() => setBringYourBusinessPathAction("skipped")}
              label="Skip for now"
            />
          </div>
        </div>
      </div>

      <Link
        href="/help/what-should-i-set-up-before-i-start"
        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground hover:underline"
      >
        <HelpCircle className="h-3 w-3" />
        How to bring your business over
      </Link>
    </div>
  );
}
