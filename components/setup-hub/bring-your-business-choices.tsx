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
          <>
            <Link
              href={BRING_YOUR_BUSINESS_ROUTES.migrationCenter}
              className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
            >
              Open Migration Center
              <ChevronRight className="h-3 w-3" />
            </Link>
            <Link
              href={BRING_YOUR_BUSINESS_ROUTES.spreadsheetImport}
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground hover:underline"
            >
              Spreadsheet import
              <ChevronRight className="h-3 w-3" />
            </Link>
          </>
        ) : manualConfirmed ? (
          <>
            <Link
              href={BRING_YOUR_BUSINESS_ROUTES.migrationCenter}
              className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
            >
              Changed your mind? Bring a system over
              <ChevronRight className="h-3 w-3" />
            </Link>
            <Link
              href={BRING_YOUR_BUSINESS_ROUTES.spreadsheetImport}
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground hover:underline"
            >
              Import a spreadsheet
              <ChevronRight className="h-3 w-3" />
            </Link>
          </>
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
          I&apos;m moving from another system
          <ChevronRight className="h-3 w-3" />
        </Link>
        <Link
          href={BRING_YOUR_BUSINESS_ROUTES.spreadsheetImport}
          className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
        >
          I have a spreadsheet to import
          <ChevronRight className="h-3 w-3" />
        </Link>
        <StageAcknowledgeButton
          action={setBringYourBusinessManualAction}
          label="I'm starting fresh"
        />
      </div>
      <p className="text-xs text-muted-foreground">
        Moving from another system opens Migration Center — whether we know
        your software by name or not, we&apos;ll help you bring things over
        carefully. A spreadsheet is fine when you just have a file to upload.
      </p>
    </div>
  );
}
