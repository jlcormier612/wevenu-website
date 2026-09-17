import type { Metadata } from "next";

import { Bug, Lightbulb, MessageCircle, Star } from "lucide-react";

import { FeedbackSheet, type FeedbackType } from "@/components/feedback/feedback-sheet";
import { PageHeader } from "@/components/shell/module-placeholder";

export const metadata: Metadata = { title: "Give feedback" };

/**
 * Your Venue → Give feedback. The venue-facing product feedback destination.
 *
 * Deliberately not /admin/feedback: that is the HQ triage console showing every
 * venue's submissions. This page is the venue's own way in, and it opens the
 * same FeedbackSheet the portal and vendor app use rather than reimplementing
 * the form — one submission path, one set of validation.
 *
 * Each card is the trigger for its own category. Previously the four sat here
 * as inert bordered `div`s and a separate "Share feedback" button in the corner
 * did the actual work, which meant reading four descriptions, deciding, and
 * then clicking something else that asked the same question over again. The
 * card you press now *is* the answer.
 */
const CHANNELS: {
  type: FeedbackType;
  icon: typeof MessageCircle;
  /** Matches the label on the matching picker chip inside the form. */
  title: string;
  description: string;
}[] = [
  {
    type: "support",
    icon: MessageCircle,
    title: "Get Help",
    description: "Stuck on something? Describe what you were trying to do and we'll follow up.",
  },
  {
    type: "bug",
    icon: Bug,
    title: "Report a Bug",
    description: "Something behaving wrongly? Attach a screenshot and we can reproduce it faster.",
  },
  {
    type: "feature",
    icon: Lightbulb,
    title: "Suggest an Idea",
    description: "Tell us what would make Hello to Cheers better — and vote on what other venues asked for.",
  },
  {
    type: "nps",
    icon: Star,
    title: "Rate Hello to Cheers",
    description: "Tell us how likely you'd be to recommend us, and why.",
  },
];

export default function FeedbackPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Give feedback"
        description="Talk to the people who build Hello to Cheers — ask for help, report a problem, or tell us what to build next."
      />

      <div className="grid gap-2 sm:grid-cols-2">
        {CHANNELS.map(({ type, icon: Icon, title, description }) => (
          <FeedbackSheet
            key={type}
            surface="venue"
            presentation="dialog"
            initialType={type}
            triggerAsButton
            triggerClassName="flex h-full w-full items-start gap-3 rounded-sm border border-border bg-card p-4 text-left outline-none transition-colors hover:border-primary/40 hover:bg-muted/40 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
              <Icon className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1 space-y-1">
              <p className="text-sm font-medium text-heading">{title}</p>
              <p className="text-xs text-muted-foreground">{description}</p>
            </div>
          </FeedbackSheet>
        ))}
      </div>

      <p className="text-xs text-muted-foreground">
        Looking for your venue&rsquo;s own reference material instead? That lives under{" "}
        Your Venue &rarr; Venue Guide. For how to use Hello to Cheers, see Overview &rarr; Guidance.
      </p>
    </div>
  );
}
