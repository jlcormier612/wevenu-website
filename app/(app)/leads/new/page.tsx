import type { Metadata } from "next";

import { NewInquiryForm } from "@/components/leads/new-inquiry-form";
import { CollectionBackLink } from "@/components/library/collection-back-link";
import { PageHeader } from "@/components/shell/module-placeholder";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getBlock } from "@/lib/availability/service";
import { normalizeEventType } from "@/lib/event-types/canonical";
import { buildVenueEventTypeOptions } from "@/lib/event-types/venue-options";
import { getInquiryFormSettings } from "@/lib/inquiry-form/service";
import type { LeadInput } from "@/lib/leads/types";
import { getCurrentVenue } from "@/lib/venue/service";

export const metadata: Metadata = { title: "New Lead" };

/** Best-effort split of a placeholder's free-text "Client" field into a LeadInput's first/last/partner names — everything here is editable before submitting, so an imperfect guess costs a coordinator a click, never data correctness. */
function parseClientName(clientName: string): Partial<LeadInput> {
  const sides = clientName.split(/\s+(?:&|and)\s+/i);
  const splitName = (s: string) => {
    const parts = s.trim().split(/\s+/);
    return { first: parts[0] ?? "", last: parts.length > 1 ? parts.slice(1).join(" ") : "" };
  };
  const a = splitName(sides[0] ?? "");
  const b = sides[1] ? splitName(sides[1]) : null;
  // "Emma & James Smith" — Emma has no last name of her own; assume shared.
  if (b && !a.last && b.last) a.last = b.last;
  return {
    firstName: a.first, lastName: a.last,
    partnerFirstName: b?.first ?? "", partnerLastName: b?.last ?? "",
  };
}

export default async function NewLeadPage({
  searchParams,
}: {
  searchParams: Promise<{ fromBlockId?: string; intent?: string }>;
}) {
  const { fromBlockId, intent } = await searchParams;
  const isPractice = intent === "practice";
  const [block, inquirySettings, venue] = await Promise.all([
    fromBlockId ? getBlock(fromBlockId) : Promise.resolve(null),
    getInquiryFormSettings(),
    getCurrentVenue(),
  ]);

  // Calendar Booking Placeholder — "Convert to Booking." Pre-filled, not
  // auto-created: a coordinator still reviews and submits, so nothing about
  // a real Lead is ever fabricated silently from a placeholder's guesses.
  const eventTypeOptions = buildVenueEventTypeOptions({
    acceptedRaw: inquirySettings?.acceptedEventTypes ?? null,
  });
  const acceptedSet = new Set(eventTypeOptions.map((o) => o.value));

  const practiceInitial: Partial<LeadInput> | undefined = isPractice && !block
    ? {
        firstName: "Practice",
        lastName: "Lead",
        inquiryMessage:
          "PRACTICE — Safe Setup Hub exploration. Do not email, text, or charge. Delete when finished.",
      }
    : undefined;

  const initial: Partial<LeadInput> | undefined = block ? {
    ...(block.clientName ? parseClientName(block.clientName) : {}),
    // New Lead is inquiry creation — only accepted types. A Hold with a
    // legacy event type clears so the coordinator picks an accepted one.
    eventType: (() => {
      const fromHold = block.eventType
        ? (normalizeEventType(block.eventType) ?? block.eventType)
        : "";
      return fromHold && acceptedSet.has(fromHold) ? fromHold : "";
    })(),
    eventDate: block.startDate,
    guestCount: block.guestCount != null ? String(block.guestCount) : "",
    estimatedBudget: block.estimatedRevenue != null ? String(block.estimatedRevenue) : "",
    inquiryMessage: `From Calendar: "${block.title}"`,
  } : practiceInitial;

  return (
    <div className="htc-hospitality-page space-y-5 sm:space-y-6" data-htc-phase12="lead-new">
      <CollectionBackLink href={isPractice ? "/setup-hub" : "/leads"} label={isPractice ? "Setup" : "Leads"} />
      <div className="htc-hospitality-heading htc-hospitality-intro-accent">
        <PageHeader
          title={block ? "Convert to Lead" : isPractice ? "Practice Lead" : "New Lead"}
          description={block
            ? `Turning "${block.title}" into a real Lead — nothing here was retyped, review and save when ready.`
            : isPractice
              ? "Safe exploration only — saving creates a real lead record in your venue, but nothing is emailed, texted, or charged unless you take those actions later."
              : "Record a new lead from a call, email, or walk-in."}
        />
      </div>
      {isPractice ? (
        <div
          className="htc-surface-guidance rounded-md border border-dashed px-4 py-3 text-sm text-muted-foreground"
          data-testid="practice-lead-banner"
        >
          This is a practice lead from Setup Hub. Name it clearly so your team never confuses it with a real client.
        </div>
      ) : null}
      <Card className="htc-working-card gap-0 py-0">
        <CardHeader className="py-4">
          <CardTitle>Lead details</CardTitle>
          <CardDescription>
            Fill in what you know. Everything is editable later from the lead
            record.
          </CardDescription>
        </CardHeader>
        <CardContent className="py-5">
          <NewInquiryForm
            initial={initial}
            fromBlockId={block ? fromBlockId : undefined}
            eventTypeOptions={eventTypeOptions}
            venueTimezone={venue?.timezone ?? null}
          />
        </CardContent>
      </Card>
    </div>
  );
}
