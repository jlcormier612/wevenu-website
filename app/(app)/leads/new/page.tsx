import type { Metadata } from "next";

import { NewInquiryForm } from "@/components/leads/new-inquiry-form";
import { PageHeader } from "@/components/shell/module-placeholder";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getBlock } from "@/lib/availability/service";
import type { LeadInput } from "@/lib/leads/types";

export const metadata: Metadata = { title: "New Inquiry" };

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
  searchParams: Promise<{ fromBlockId?: string }>;
}) {
  const { fromBlockId } = await searchParams;
  const block = fromBlockId ? await getBlock(fromBlockId) : null;

  // Calendar Booking Placeholder — "Convert to Booking." Pre-filled, not
  // auto-created: a coordinator still reviews and submits, so nothing about
  // a real Lead is ever fabricated silently from a placeholder's guesses.
  const initial: Partial<LeadInput> | undefined = block ? {
    ...(block.clientName ? parseClientName(block.clientName) : {}),
    eventType: block.eventType ?? "wedding",
    eventDate: block.startDate,
    guestCount: block.guestCount != null ? String(block.guestCount) : "",
    estimatedBudget: block.estimatedRevenue != null ? String(block.estimatedRevenue) : "",
    inquiryMessage: `From Calendar: "${block.title}"`,
  } : undefined;

  return (
    <div className="space-y-6">
      <PageHeader
        title={block ? "Convert to Booking" : "New Inquiry"}
        description={block
          ? `Turning "${block.title}" into a real Lead — nothing here was retyped, review and save when ready.`
          : "Record a new lead from a call, email, or walk-in."}
      />
      <Card>
        <CardHeader>
          <CardTitle>Inquiry details</CardTitle>
          <CardDescription>
            Fill in what you know. Everything is editable later from the lead
            record.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <NewInquiryForm initial={initial} fromBlockId={block ? fromBlockId : undefined} />
        </CardContent>
      </Card>
    </div>
  );
}
