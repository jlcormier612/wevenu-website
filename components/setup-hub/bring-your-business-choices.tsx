"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";

import { StageAcknowledgeButton } from "@/components/setup-hub/stage-acknowledge-button";
import { setBringYourBusinessManualAction } from "@/app/(app)/setup-hub/actions";
import { BRING_YOUR_BUSINESS_ROUTES } from "@/lib/setup-hub/bring-your-business";

/**
 * Setup Hub — Bring Your Business decision.
 * Routes into Migration Center (cutover) or CSV Import (small adds).
 */
export function BringYourBusinessChoices({
  done,
  hasImportedData,
  manualConfirmed,
  calendarReadyHint,
}: {
  done: boolean;
  hasImportedData: boolean;
  manualConfirmed: boolean;
  /** Conditional hard gate when spaces/capacity are not ready for dated Events. */
  calendarReadyHint?: string | null;
}) {
  if (done) {
    return (
      <div className="flex flex-wrap items-center gap-3 pt-1">
        {hasImportedData ? (
          <Link
            href={BRING_YOUR_BUSINESS_ROUTES.migrationCenter}
            className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
          >
            Continue Migration Center
            <ChevronRight className="h-3 w-3" />
          </Link>
        ) : manualConfirmed ? (
          <Link
            href={BRING_YOUR_BUSINESS_ROUTES.migrationCenter}
            className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
          >
            Changed your mind? Bring your business over
            <ChevronRight className="h-3 w-3" />
          </Link>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-3 pt-1">
      {calendarReadyHint ? (
        <p className="text-xs text-amber-800 dark:text-amber-200">
          {calendarReadyHint}{" "}
          <Link href={BRING_YOUR_BUSINESS_ROUTES.calendarAvailability} className="font-medium underline">
            Open Calendar & Availability
          </Link>
        </p>
      ) : null}
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        <Link
          href={BRING_YOUR_BUSINESS_ROUTES.migrationCenter}
          className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
        >
          Bring my existing business
          <ChevronRight className="h-3 w-3" />
        </Link>
        <Link
          href={BRING_YOUR_BUSINESS_ROUTES.spreadsheetImport}
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:underline"
        >
          Just a small spreadsheet
          <ChevronRight className="h-3 w-3" />
        </Link>
        <StageAcknowledgeButton
          action={setBringYourBusinessManualAction}
          label="I'm starting fresh"
        />
      </div>
      <p className="text-xs text-muted-foreground">
        Migration Center moves clients and calendar (events, tours, holds, blocks)
        into real Hello to Cheers records — with review before commit. Conflicts
        are shown; nothing is silently changed.
      </p>
    </div>
  );
}
