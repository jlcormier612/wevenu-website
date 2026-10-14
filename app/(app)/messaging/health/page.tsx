import type { Metadata } from "next";
import Link from "next/link";

import { ReadinessChecklist } from "@/components/communication/readiness-checklist";
import { CollectionBackLink } from "@/components/library/collection-back-link";
import { getCommunicationReadiness } from "@/lib/communication/readiness";

export const metadata: Metadata = { title: "Communication Health" };

/**
 * Communication Health — launch presentation.
 *
 * Aggregate delivery tiles, Excellent/Issues scoring, and the separate
 * failure/history list are deferred. Underlying counts, Attention
 * semantics, and recovery tooling remain available elsewhere (Inbox).
 * Communication Readiness stays front and center.
 */
export default async function CommunicationHealthPage() {
  const readiness = await getCommunicationReadiness();

  return (
    <div className="space-y-6">
      <CollectionBackLink href="/messaging" label="Inbox" />
      <div>
        <h1 className="font-heading text-2xl font-medium text-heading">Communication Health</h1>
        <p className="text-sm text-muted-foreground">
          Check that email and texting are ready before you message leads and clients.
        </p>
        <div className="mt-3 rounded-lg border border-border bg-muted/20 px-3 py-2.5 text-xs text-muted-foreground space-y-1.5">
          <p className="font-medium text-heading">How to read this page</p>
          <p>
            Use the checklist below to finish setup. If <span className="text-heading">texting</span>{" "}
            isn’t ready, enable it in Settings — that isn’t an HTC outage.
          </p>
          <p>
            When a specific message couldn’t be delivered, open that conversation in Inbox to see
            the status and any recovery options.
          </p>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          Email is set up for Hello to Cheers as a platform. Texting is enabled per venue in{" "}
          <Link href="/settings/communications#texting" className="underline underline-offset-2 text-heading">
            Settings → Text messaging
          </Link>
          . Your venue contact email and phone are used for test messages and for how couples reach you.
        </p>
      </div>

      <div data-testid="communication-readiness">
        <ReadinessChecklist initial={readiness} />
      </div>
    </div>
  );
}
