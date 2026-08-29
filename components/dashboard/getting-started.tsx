import Link from "next/link";
import { ArrowRight, Check, Clock, Sparkles } from "lucide-react";

import { dismissOnboardingAction } from "@/app/(app)/dashboard/actions";
import { LuvHeart } from "@/components/dashboard/luv-widget";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import type { OnboardingStatus, OnboardingStep } from "@/lib/dashboard/types";

/**
 * Dashboard "Your Next Steps" card.
 *
 * The old Getting Started card mixed foundational setup with product-adoption
 * milestones (contracts, payments, portal usage, team activity). That made
 * the checklist feel like setup work even when the venue was already live.
 *
 * This presentation layer keeps Activation Engine truth intact but separates
 * the journey into two useful groups:
 *   - Finish your setup: only the foundational profile/package actions.
 *   - Build momentum: meaningful post-setup actions that help a venue get
 *     value from Hello to Cheers.
 *
 * It intentionally shows only incomplete actions. Completed milestones are
 * celebrated elsewhere by the dashboard milestone toast rather than left as
 * a growing crossed-out checklist.
 *
 * Pure server component — dismiss uses the existing server action.
 */

const SETUP_STEP_IDS = new Set(["profile_complete", "first_package"]);

const MOMENTUM_STEP_IDS = new Set([
  "first_portal_invite",
  "first_portal_open",
  "three_couples_active",
  "first_contract_signed",
  "first_payment_received",
  "first_vendor_assigned",
  "first_team_invite",
  "first_team_login",
  "team_active_recently",
]);

function StepCard({ step, featured = false }: { step: OnboardingStep; featured?: boolean }) {
  return (
    <div
      className={`group flex min-h-[128px] flex-col justify-between rounded-xl border p-4 transition-colors ${
        featured
          ? "border-primary/25 bg-primary/5 hover:bg-primary/10"
          : "border-border bg-card hover:bg-muted/30"
      }`}
    >
      <div>
        <div className="mb-2 flex items-start justify-between gap-3">
          <span
            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
              featured ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
            }`}
          >
            {featured ? <Sparkles className="h-4 w-4" /> : <Check className="h-4 w-4" />}
          </span>
          {step.timeEstimate && (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />
              {step.timeEstimate}
            </span>
          )}
        </div>
        <p className="text-sm font-semibold leading-snug text-heading">{step.title}</p>
        <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
          {step.description}
        </p>
      </div>
      {step.ctaHref && (
        <div className="mt-3 flex items-center gap-3">
          <Link
            href={step.ctaHref}
            className="inline-flex items-center text-xs font-semibold text-primary hover:underline"
          >
            {step.ctaLabel} <ArrowRight className="ml-1 h-3 w-3" />
          </Link>
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
  );
}

export function GettingStartedCard({
  onboarding,
  venueName,
}: {
  onboarding: OnboardingStatus;
  milestone?: string;
  venueName?: string;
}) {
  const name = venueName?.trim() || "your venue";
  const setupSteps = onboarding.steps.filter(
    (step) => SETUP_STEP_IDS.has(step.id) && !step.completed,
  );
  const momentumSteps = onboarding.steps.filter(
    (step) => MOMENTUM_STEP_IDS.has(step.id) && !step.completed,
  );

  const hasSetup = setupSteps.length > 0;
  const visibleMomentum = momentumSteps.slice(0, 2);
  const firstMomentum = visibleMomentum[0];

  // Nothing useful to show — let the dashboard reclaim the space.
  if (!hasSetup && momentumSteps.length === 0) return null;

  return (
    <Card id="getting-started" className="overflow-hidden border-primary/15 bg-card">
      <CardHeader className="border-b border-border/70 bg-primary/[0.035] pb-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="mb-2 flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <LuvHeart size={14} />
              </span>
              <span className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">
                Your next steps
              </span>
            </div>
            <p className="font-heading text-xl font-semibold text-heading">
              {hasSetup ? `A few things to finish, ${name}.` : "Keep the momentum going."}
            </p>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              {hasSetup
                ? "Finish the basics first, then use Hello to Cheers to keep your business moving."
                : "Your setup foundation is in place. Here are the next things that can help you get more value from Hello to Cheers."}
            </p>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-5 p-4 sm:p-5">
        {hasSetup && (
          <div>
            <div className="mb-3 flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-heading">Finish your setup</p>
                <p className="text-xs text-muted-foreground">The few foundational pieces that make everything else work.</p>
              </div>
              <span className="text-xs font-medium text-muted-foreground">{setupSteps.length} left</span>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {setupSteps.map((step) => <StepCard key={step.id} step={step} featured />)}
            </div>
          </div>
        )}

        {momentumSteps.length > 0 && (
          <div>
            <div className="mb-3 flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-heading">Build momentum</p>
                <p className="text-xs text-muted-foreground">Turn setup into real progress with your couples, team, and events.</p>
              </div>
              {momentumSteps.length > 2 && (
                <Link href={firstMomentum?.ctaHref ?? "/clients"} className="hidden text-xs font-medium text-primary hover:underline sm:block">
                  See next →
                </Link>
              )}
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {visibleMomentum.map((step) => <StepCard key={step.id} step={step} />)}
            </div>
          </div>
        )}
      </CardContent>

      <CardFooter className="flex items-center justify-between border-t border-border/70 bg-muted/20 px-4 py-3 sm:px-5">
        <form action={dismissOnboardingAction}>
          <Button
            type="submit"
            variant="ghost"
            size="sm"
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            Dismiss
          </Button>
        </form>
        {firstMomentum?.ctaHref && !hasSetup && (
          <Button render={<Link href={firstMomentum.ctaHref} />} size="sm">
            {firstMomentum.ctaLabel}
            <ArrowRight className="ml-1 h-3.5 w-3.5" />
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}
