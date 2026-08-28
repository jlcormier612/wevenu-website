"use client";

import * as React from "react";

import { useRouter } from "next/navigation";
import { ArrowRight, CheckCircle2 } from "lucide-react";

import { QuickBooksConnectSection } from "@/components/settings/quickbooks-connect-section";
import { StripeConnectSection } from "@/components/settings/stripe-connect-section";
import { Button } from "@/components/ui/button";
import type { QuickBooksSyncLogEntry } from "@/lib/quickbooks/service";
import type { QuickBooksConnection } from "@/lib/quickbooks/types";
import type { Venue } from "@/lib/venue/types";

/**
 * Financial Setup — shown once, right after venue creation, before the
 * congratulations screen. This can only exist as its own real onboarding
 * step (not one of the pre-creation wizard steps) because connecting
 * QuickBooks requires a real venue_id to attach the connection to — the
 * pre-creation "Payments" step in setup-steps.tsx is necessarily
 * informational-only for exactly this reason.
 *
 * Reuses the exact same Settings sections (QuickBooksConnectSection,
 * StripeConnectSection) rather than building parallel onboarding-specific
 * connect UI — same connect/disconnect/status logic, same honesty about
 * what's actually live (Stripe stays "coming soon" here too; TR-M1).
 */
export function PostSetupFinancial({
  venue,
  quickbooksConnection,
  quickbooksSyncLog,
  stripeConnectUrl,
  quickbooksConnectUrl,
}: {
  venue: Venue;
  quickbooksConnection: QuickBooksConnection | null;
  quickbooksSyncLog: QuickBooksSyncLogEntry[];
  stripeConnectUrl?: string | null;
  quickbooksConnectUrl?: string | null;
}) {
  const router = useRouter();
  const [stage, setStage] = React.useState<"financial" | "done">("financial");

  if (stage === "done") {
    return (
      <div className="mx-auto max-w-xl space-y-8 py-16 text-center">
        <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary">
          <CheckCircle2 className="h-8 w-8" />
        </span>
        <div className="space-y-3">
          <h1 className="font-heading text-3xl font-medium tracking-tight text-heading">
            Your venue is ready
          </h1>
          <p className="mx-auto max-w-md text-sm text-muted-foreground">
            <span className="font-medium text-foreground">{venue.name}</span> is set
            up and your workspace is live. From here you can start inviting your
            team and building out events.
          </p>
        </div>
        <Button
          size="lg"
          className="w-full sm:w-auto"
          onClick={() => {
            router.push("/dashboard");
            router.refresh();
          }}
        >
          Enter your workspace
          <ArrowRight className="ml-1 h-4 w-4" />
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl space-y-6 py-10">
      <div className="space-y-2 text-center">
        <h1 className="font-heading text-2xl font-medium tracking-tight text-heading">
          Financial Setup
        </h1>
        <p className="text-sm text-muted-foreground">
          Connect the accounting tools you already use. You can always change
          this later from Settings — nothing here is required to continue.
        </p>
      </div>

      <QuickBooksConnectSection
        venueId={venue.id}
        connection={quickbooksConnection}
        syncLog={quickbooksSyncLog}
        returnTo="onboarding"
        connectUrl={quickbooksConnectUrl}
      />
      <StripeConnectSection
        venue={venue}
        returnTo="onboarding"
        connectUrl={stripeConnectUrl}
      />

      <div className="flex justify-end">
        <Button type="button" size="lg" onClick={() => setStage("done")}>
          Next
          <ArrowRight className="ml-1 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
