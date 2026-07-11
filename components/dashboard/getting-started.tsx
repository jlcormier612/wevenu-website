import Link from "next/link";
import { ArrowRight, Building2, Check, Clock, Sparkles } from "lucide-react";

import { dismissOnboardingAction } from "@/app/(app)/dashboard/actions";
import { LuvHeart } from "@/components/dashboard/luv-widget";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from "@/components/ui/card";
import type { OnboardingStatus } from "@/lib/dashboard/types";

/**
 * Venue onboarding card — "Welcome to Wevenu / You're X% set up."
 *
 * Three states:
 *   1. Checklist — not complete; shows steps, Luv nudge, time estimates
 *   2. Milestone — a step was just completed (?milestone=step_id in URL)
 *   3. Graduation — 100% complete; becomes a live operating summary
 *
 * Pure server component — dismiss uses a form server action.
 */

const MILESTONE_COPY: Record<string, { headline: string; body: string }> = {
  tour_scheduling:   { headline: "Tour scheduling enabled!", body: "Clients can now book appointments with you online, any time of day." },
  venue_guide:       { headline: "Venue Guide started!", body: "Clients and their families will thank you for this." },
  preferred_vendors: { headline: "Vendors added!", body: "Clients now have a trusted starting point when they ask about vendors." },
  task_playbook:     { headline: "Planning Playbook created!", body: "Every new event you create can now use this workflow automatically." },
  profile_complete:  { headline: "Venue profile complete!", body: "Clients and coordinators can now find and reach you." },
  first_inquiry:     { headline: "First inquiry in!", body: "Your pipeline is live. Keep the momentum going." },
  first_booking:     { headline: "First client booked!", body: "This is what it's all about. Congratulations." },
};

export function GettingStartedCard({
  onboarding,
  milestone,
}: {
  onboarding: OnboardingStatus;
  milestone?: string;
}) {
  const pct = Math.round(
    (onboarding.completedCount / onboarding.totalSteps) * 100,
  );
  const isNew = pct < 50;
  const remaining = onboarding.totalSteps - onboarding.completedCount;
  const nextStep = onboarding.steps.find((s) => !s.completed && s.ctaHref);

  // ── Graduation card ─────────────────────────────────────────────────────────
  if (onboarding.allComplete) {
    const s = onboarding.summary;
    return (
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="py-5">
          <div className="flex items-start gap-4">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Sparkles className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1 space-y-3">
              <p className="font-heading text-lg font-semibold text-heading">
                You&apos;re fully set up.
              </p>
              {s && (
                <ul className="space-y-1 text-sm text-foreground">
                  {s.weeklyInquiries > 0 && (
                    <li>• {s.weeklyInquiries} new {s.weeklyInquiries === 1 ? "inquiry" : "inquiries"} this week</li>
                  )}
                  {s.upcomingTourCount > 0 && (
                    <li>• {s.upcomingTourCount} upcoming {s.upcomingTourCount === 1 ? "tour" : "tours"}</li>
                  )}
                  {s.openTaskCount > 0 && (
                    <li>• {s.openTaskCount} open {s.openTaskCount === 1 ? "task" : "tasks"}</li>
                  )}
                  {s.weeklyInquiries === 0 && s.upcomingTourCount === 0 && s.openTaskCount === 0 && (
                    <li className="text-muted-foreground">Your workspace is ready. Start by adding your first inquiry.</li>
                  )}
                </ul>
              )}
              <div className="flex items-center gap-1.5 text-sm">
                <span className="shrink-0">
                  <LuvHeart size={12} />
                </span>
                <span className="text-muted-foreground">
                  Need help?{" "}
                  <Link href="/leads" className="font-medium text-primary hover:underline">
                    Ask Luv
                  </Link>
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // ── Milestone celebration banner (shown when ?milestone=X matches a completed step) ──
  const celebratedStep = milestone
    ? onboarding.steps.find((s) => s.id === milestone && s.completed)
    : null;
  const milestoneCopy = celebratedStep ? MILESTONE_COPY[celebratedStep.id] : null;

  // ── Checklist card ──────────────────────────────────────────────────────────
  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardHeader className="pb-3">
        {/* Welcome header — shown until halfway */}
        {isNew && (
          <div className="mb-3 flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-md bg-primary/10 text-primary">
              <Building2 className="h-3.5 w-3.5" />
            </span>
            <span className="text-xs font-semibold uppercase tracking-widest text-primary">
              Welcome to Wevenu
            </span>
          </div>
        )}

        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="font-heading text-2xl font-semibold text-heading">
              You&apos;re {pct}% set up
            </p>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {isNew
                ? "A few more steps and your workspace will be ready to take leads."
                : `${remaining} step${remaining === 1 ? "" : "s"} left to finish your setup.`}
            </p>
          </div>
          <span className="shrink-0 text-sm tabular-nums text-muted-foreground">
            {onboarding.completedCount}&nbsp;/&nbsp;{onboarding.totalSteps}
          </span>
        </div>

        {/* Progress bar */}
        <div
          className="mt-3 h-2 w-full overflow-hidden rounded-full bg-muted/60"
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div
            className="h-full rounded-full bg-primary transition-all duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Milestone celebration */}
        {milestoneCopy && (
          <div className="flex items-start gap-2.5 rounded-xl border border-primary/20 bg-primary/5 p-3.5">
            <span className="text-base">🎉</span>
            <div>
              <p className="text-sm font-semibold text-heading">{milestoneCopy.headline}</p>
              <p className="text-sm text-muted-foreground">{milestoneCopy.body}</p>
            </div>
          </div>
        )}

        {/* Luv coaching block */}
        {onboarding.luvNudge && !milestoneCopy && (
          <div className="flex gap-2.5 rounded-xl bg-white/60 p-3.5 shadow-sm ring-1 ring-border/40">
            <span className="mt-0.5 shrink-0">
              <LuvHeart size={13} />
            </span>
            <p className="text-sm text-foreground">{onboarding.luvNudge}</p>
          </div>
        )}

        {/* Steps — 2-column grid */}
        <ul className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
          {onboarding.steps.map((step) => (
            <li key={step.id} className="flex items-start gap-2.5">
              <span
                className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-colors ${
                  step.completed
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-background"
                }`}
              >
                {step.completed && <Check className="h-3 w-3" />}
              </span>
              <div className="min-w-0">
                <p
                  className={`text-sm leading-snug ${
                    step.completed
                      ? "text-muted-foreground line-through"
                      : "font-medium text-foreground"
                  }`}
                >
                  {step.title}
                </p>
                {!step.completed && (
                  <div className="flex items-center gap-2">
                    {step.timeEstimate && (
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {step.timeEstimate}
                      </span>
                    )}
                    {step.ctaHref && (
                      <Link
                        href={step.ctaHref}
                        className="text-xs text-primary hover:underline"
                      >
                        {step.ctaLabel} →
                      </Link>
                    )}
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
      </CardContent>

      <CardFooter className="flex items-center justify-between gap-4 pt-2">
        <form action={dismissOnboardingAction}>
          <Button
            type="submit"
            variant="ghost"
            size="sm"
            className="text-muted-foreground hover:text-foreground"
          >
            Dismiss
          </Button>
        </form>
        {nextStep?.ctaHref && (
          <Button render={<Link href={nextStep.ctaHref} />} size="sm">
            {nextStep.ctaLabel}
            <ArrowRight className="ml-1 h-3.5 w-3.5" />
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}
