import Link from "next/link";
import { ArrowRight, Building2, Check, Clock } from "lucide-react";

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
 * Venue onboarding card — "Welcome to Hello to Cheers / You're X% set up."
 *
 * Two states:
 *   1. Checklist — not complete; shows steps, Luv nudge, time estimates
 *   2. Milestone — a step was just completed (?milestone=step_id in URL)
 *
 * Doesn't render at all once every step is complete — `onboarding.show`
 * goes false and the dashboard reclaims the space, rather than this card
 * lingering as a permanent "you're done" summary.
 *
 * Pure server component — dismiss uses a form server action.
 */

const MILESTONE_COPY: Record<string, { headline: string; body: string }> = {
  profile_complete:       { headline: "Venue profile complete!", body: "Couples and coordinators can now actually find and reach you." },
  first_package:          { headline: "Your first package is live!", body: "There's finally something real for a couple to book." },
  first_portal_invite:    { headline: "First portal invite sent!", body: "Your couple now has a home for their planning." },
  first_portal_open:      { headline: "Your first couple opened their portal!", body: "They're in — this is the moment it starts working for them, too." },
  three_couples_active:   { headline: "3 couples active in their portals!", body: "This is what it feels like when Hello to Cheers runs your day-to-day." },
  first_contract_signed:  { headline: "First contract signed!", body: "That lead is officially a client now. Congratulations." },
  first_payment_received: { headline: "First payment received!", body: "Money's moving. This is what it's all about." },
  first_vendor_assigned:  { headline: "First vendor assigned!", body: "They now know exactly when and where to show up." },
  first_team_invite:      { headline: "Team member invited!", body: "You don't have to run this alone anymore." },
  first_team_login:       { headline: "Your team is in!", body: "They can actually help you now." },
  team_active_recently:   { headline: "Your team is active!", body: "This is becoming a real habit, not just a setup step." },
};

export function GettingStartedCard({
  onboarding,
  milestone,
  venueName,
}: {
  onboarding: OnboardingStatus;
  milestone?: string;
  venueName?: string;
}) {
  const pct = Math.round(
    (onboarding.completedCount / onboarding.totalSteps) * 100,
  );
  const isNew = pct < 50;
  const remaining = onboarding.totalSteps - onboarding.completedCount;
  const nextStep = onboarding.steps.find((s) => !s.completed && s.ctaHref);
  const name = venueName?.trim() || "your venue";

  // ── Milestone celebration banner (shown when ?milestone=X matches a completed step) ──
  const celebratedStep = milestone
    ? onboarding.steps.find((s) => s.id === milestone && s.completed)
    : null;
  const milestoneCopy = celebratedStep ? MILESTONE_COPY[celebratedStep.id] : null;

  // ── Checklist card ──────────────────────────────────────────────────────────
  return (
    <Card id="getting-started" className="border-primary/20 bg-primary/5">
      <CardHeader className="pb-3">
        {/* Welcome header — shown until halfway */}
        {isNew && (
          <div className="mb-3 flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-md bg-primary/10 text-primary">
              <Building2 className="h-3.5 w-3.5" />
            </span>
            <span className="text-xs font-semibold uppercase tracking-widest text-primary">
              Getting {name} ready
            </span>
          </div>
        )}

        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="font-heading text-3xl font-semibold text-heading">
              You&apos;re {pct}% set up
            </p>
            <p className="mt-0.5 text-[0.95rem] text-muted-foreground">
              {isNew
                ? `A few more steps and ${name} will be ready to welcome its next couple.`
                : `${remaining} step${remaining === 1 ? "" : "s"} left to finish getting ${name} ready.`}
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
          <div className="flex items-start gap-2.5 rounded-sm border border-primary/20 bg-primary/5 p-3.5">
            <span className="text-base">🎉</span>
            <div>
              <p className="text-sm font-semibold text-heading">{milestoneCopy.headline}</p>
              <p className="text-sm text-muted-foreground">{milestoneCopy.body}</p>
            </div>
          </div>
        )}

        {/* Luv coaching block */}
        {onboarding.luvNudge && !milestoneCopy && (
          <div className="flex gap-2.5 rounded-sm border border-border bg-card/80 p-3.5">
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
                    {/* Luv's Success Library §4.2 — secondary "read more"
                        affordance, always after the primary "let's do this
                        together" CTA above, never replacing it. */}
                    {step.articleHref && (
                      <Link
                        href={step.articleHref}
                        className="text-xs text-muted-foreground hover:text-foreground hover:underline"
                      >
                        Read more
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
