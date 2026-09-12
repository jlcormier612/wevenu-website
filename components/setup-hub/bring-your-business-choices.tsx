"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";

import { StageAcknowledgeButton } from "@/components/setup-hub/stage-acknowledge-button";
import { setBringYourBusinessManualAction } from "@/app/(app)/setup-hub/actions";
import { BRING_YOUR_BUSINESS_ROUTES } from "@/lib/setup-hub/bring-your-business";
import { BRING_BUSINESS_OPTIONS } from "@/lib/onboarding/types";

/**
 * Setup Hub — Bring Your Business decision.
 * Exact four customer-facing choices from the product specification.
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
      <div className="space-y-2">
        {BRING_BUSINESS_OPTIONS.filter((o) => o.key !== "starting_fresh").map((opt) => {
          const href =
            opt.key === "honeybook"
              ? `${BRING_YOUR_BUSINESS_ROUTES.migrationCenter}?source=honeybook`
              : opt.key === "tripleseat"
                ? `${BRING_YOUR_BUSINESS_ROUTES.migrationCenter}?source=tripleseat`
                : `${BRING_YOUR_BUSINESS_ROUTES.migrationCenter}?source=another_system`;
          return (
            <Link
              key={opt.key}
              href={href}
              className="block rounded-md border p-3 text-sm hover:border-primary"
            >
              <span className="font-medium">{opt.title}</span>
              <span className="mt-1 block text-xs text-muted-foreground">{opt.description}</span>
            </Link>
          );
        })}
        <div className="rounded-md border p-3 text-sm">
          <p className="font-medium">No — I&apos;m starting fresh</p>
          <p className="mt-1 text-xs text-muted-foreground">
            We&apos;ll set you up with everything you need to get started.
          </p>
          <div className="mt-2">
            <StageAcknowledgeButton
              action={setBringYourBusinessManualAction}
              label="I'm starting fresh"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
