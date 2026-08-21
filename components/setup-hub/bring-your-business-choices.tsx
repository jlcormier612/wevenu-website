"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";

import { StageAcknowledgeButton } from "@/components/setup-hub/stage-acknowledge-button";
import { setBringYourBusinessManualAction } from "@/app/(app)/setup-hub/actions";
import { BRING_YOUR_BUSINESS_ROUTES } from "@/lib/setup-hub/bring-your-business";

/**
 * Setup Hub — Bring Your Business decision.
 * Routes into existing Migration Center / CSV Import; does not run migration logic.
 */
export function BringYourBusinessChoices({
  done,
  hasImportedData,
  manualConfirmed,
}: {
  done: boolean;
  hasImportedData: boolean;
  manualConfirmed: boolean;
}) {
  if (done) {
    return (
      <div className="flex flex-wrap items-center gap-3 pt-1">
        {hasImportedData ? (
          <Link
            href={BRING_YOUR_BUSINESS_ROUTES.migrationCenter}
            className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
          >
            Open Migration Center
            <ChevronRight className="h-3 w-3" />
          </Link>
        ) : manualConfirmed ? (
          <Link
            href={BRING_YOUR_BUSINESS_ROUTES.migrationCenter}
            className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
          >
            Changed your mind? Bring your data over
            <ChevronRight className="h-3 w-3" />
          </Link>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-3 pt-1">
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        <Link
          href={BRING_YOUR_BUSINESS_ROUTES.migrationCenter}
          className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
        >
          I have data to bring over
          <ChevronRight className="h-3 w-3" />
        </Link>
        <StageAcknowledgeButton
          action={setBringYourBusinessManualAction}
          label="I'm starting fresh"
        />
      </div>
      <p className="text-xs text-muted-foreground">
        Switching from another system, or just have a spreadsheet or CSV
        export? Either way, this is the same place — we&apos;ll recognize
        your software when we can, and guide you through mapping it in when
        we can&apos;t.
      </p>
    </div>
  );
}
