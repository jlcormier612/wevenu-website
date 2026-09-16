import type { Metadata } from "next";

import { Bug, Lightbulb, MessageCircle, Star } from "lucide-react";

import { FeedbackSheet } from "@/components/feedback/feedback-sheet";
import { PageHeader } from "@/components/shell/module-placeholder";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Feedback" };

/**
 * Your Venue → Feedback. The venue-facing product feedback destination.
 *
 * Deliberately not /admin/feedback: that is the HQ triage console showing every
 * venue's submissions. This page is the venue's own way in, and it opens the
 * same FeedbackSheet that the sidebar's quick trigger uses rather than
 * reimplementing the form — one submission path, one set of validation.
 */
const CHANNELS = [
  {
    icon: MessageCircle,
    title: "Get help",
    description: "Stuck on something? Describe what you were trying to do and we'll follow up.",
  },
  {
    icon: Bug,
    title: "Report a bug",
    description: "Something behaving wrongly? Attach a screenshot and we can reproduce it faster.",
  },
  {
    icon: Lightbulb,
    title: "Suggest an idea",
    description: "Tell us what would make Hello to Cheers better — and vote on what other venues asked for.",
  },
  {
    icon: Star,
    title: "Rate Hello to Cheers",
    description: "Tell us how likely you'd be to recommend us, and why.",
  },
];

export default function FeedbackPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Feedback"
        description="Talk to the people who build Hello to Cheers — ask for help, report a problem, or tell us what to build next."
        actions={
          <FeedbackSheet surface="venue">
            <Button>Share feedback</Button>
          </FeedbackSheet>
        }
      />

      <div className="grid gap-2 sm:grid-cols-2">
        {CHANNELS.map(({ icon: Icon, title, description }) => (
          <div
            key={title}
            className="flex h-full items-start gap-3 rounded-sm border border-border bg-card p-4"
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
              <Icon className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1 space-y-1">
              <p className="text-sm font-medium text-heading">{title}</p>
              <p className="text-xs text-muted-foreground">{description}</p>
            </div>
          </div>
        ))}
      </div>

      <p className="text-xs text-muted-foreground">
        Looking for your venue&rsquo;s own reference material instead? That lives under{" "}
        Your Venue &rarr; Venue Guide. For how to use Hello to Cheers, see Overview &rarr; Guidance.
      </p>
    </div>
  );
}
