"use client";

import * as React from "react";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";

import { QuickBooksConnectSection } from "@/components/settings/quickbooks-connect-section";
import { StripeConnectSection } from "@/components/settings/stripe-connect-section";
import { Button } from "@/components/ui/button";
import { STAGE_COPY } from "@/lib/setup-hub/stage-copy";
import type { QuickBooksSyncLogEntry } from "@/lib/quickbooks/service";
import type { QuickBooksConnection } from "@/lib/quickbooks/types";
import type { Venue } from "@/lib/venue/types";

/**
 * Setup Hub Financials stage. Reuses the exact Settings connect sections
 * (QuickBooksConnectSection, StripeConnectSection). Next returns to Setup
 * Hub — graduation is Ready to Invite Couples, not this screen.
 */
export function PostSetupFinancial({
  venue,
  quickbooksConnection,
  quickbooksSyncLog,
}: {
  venue: Venue;
  quickbooksConnection: QuickBooksConnection | null;
  quickbooksSyncLog: QuickBooksSyncLogEntry[];
}) {
  const router = useRouter();
  const copy = STAGE_COPY.financials;

  return (
    <div className="mx-auto max-w-xl space-y-6 py-10">
      <div className="space-y-2 text-center">
        <h1 className="font-heading text-2xl font-medium tracking-tight text-heading">
          Financials
        </h1>
        <div className="space-y-1 text-sm text-muted-foreground">
          <p>{copy.what}</p>
          <p>{copy.why}</p>
          <p>{copy.whatToDo}</p>
          {copy.helpHref && copy.helpTitle ? (
            <p>
              <Link href={copy.helpHref} className="text-primary hover:underline">
                {copy.helpTitle}
              </Link>
            </p>
          ) : null}
        </div>
      </div>

      <QuickBooksConnectSection
        venueId={venue.id}
        connection={quickbooksConnection}
        syncLog={quickbooksSyncLog}
        returnTo="onboarding"
      />
      <StripeConnectSection venue={venue} returnTo="onboarding" />

      <div className="flex justify-end">
        <Button
          type="button"
          size="lg"
          onClick={() => {
            router.push("/setup-hub");
            router.refresh();
          }}
        >
          Next
          <ArrowRight className="ml-1 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
