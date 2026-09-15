"use client";

import Link from "next/link";
import { ChevronRight, HelpCircle } from "lucide-react";

import { StageAcknowledgeButton } from "@/components/setup-hub/stage-acknowledge-button";
import { setBringYourBusinessPathAction } from "@/app/(app)/setup-hub/actions";
import { BRING_YOUR_BUSINESS_ROUTES } from "@/lib/setup-hub/bring-your-business";
import { BRING_BUSINESS_OPTIONS } from "@/lib/onboarding/types";
import type { BringYourBusinessPath } from "@/lib/setup-hub/types";

/**
 * Setup Hub — Bring Your Business.
 * Three equally respected paths: import, add individually, skip for now.
 */
export function BringYourBusinessChoices({
  done,
  hasImportedData,
  path,
  calendarReadyHint,
}: {
  done: boolean;
  hasImportedData: boolean;
  path: BringYourBusinessPath | null;
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
        ) : path === "individual" ? (
          <>
            <Link
              href={BRING_YOUR_BUSINESS_ROUTES.spreadsheetImport}
              className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
            >
              Keep adding individually
              <ChevronRight className="h-3 w-3" />
            </Link>
            <Link
              href={BRING_YOUR_BUSINESS_ROUTES.migrationCenter}
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground hover:underline"
            >
              Prefer to import instead?
              <ChevronRight className="h-3 w-3" />
            </Link>
          </>
        ) : path === "skipped" ? (
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
            Open Availability &amp; Capacity
          </Link>
        </p>
      ) : null}

      <div className="space-y-2">
        <div className="rounded-md border p-3 text-sm space-y-2">
          <p className="font-medium">Import my business</p>
          <p className="text-xs text-muted-foreground">
            Bring clients and calendar commitments over through Migration Center. HoneyBook, Tripleseat, or another system — all fine.
          </p>
          <div className="space-y-1.5">
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
                  className="flex items-center justify-between rounded-md border border-transparent px-2 py-1.5 text-xs hover:border-primary hover:bg-muted/30"
                >
                  <span>
                    <span className="font-medium">{opt.title.replace(/^Yes — /, "")}</span>
                    <span className="mt-0.5 block text-muted-foreground">{opt.description}</span>
                  </span>
                  <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground" />
                </Link>
              );
            })}
          </div>
        </div>

        <div className="rounded-md border p-3 text-sm">
          <p className="font-medium">Add things individually</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Enter clients and commitments yourself as you go. Not inferior to importing — just a different pace.
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <StageAcknowledgeButton
              action={() => setBringYourBusinessPathAction("individual")}
              label="I'll add things myself"
            />
            <Link
              href={BRING_YOUR_BUSINESS_ROUTES.spreadsheetImport}
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground hover:underline"
            >
              Open Import
              <ChevronRight className="h-3 w-3" />
            </Link>
          </div>
        </div>

        <div className="rounded-md border p-3 text-sm">
          <p className="font-medium">I&apos;m starting fresh / skip for now</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Nothing to bring over yet. You can always import later.
          </p>
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
        What Should I Set Up Before I Start?
      </Link>
    </div>
  );
}
