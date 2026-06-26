import Link from "next/link";
import { Check, PartyPopper, Sparkles } from "lucide-react";

import { dismissOnboardingAction } from "@/app/(app)/dashboard/actions";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { OnboardingStatus } from "@/lib/dashboard/types";

/**
 * Getting Started checklist card.
 *
 * Rendered as a pure server component — the dismiss uses a <form> with a
 * server action so no client-side JavaScript is required. Onboarding state is
 * derived entirely from existing venue + lead data; no separate progress table.
 */
export function GettingStartedCard({
  onboarding,
}: {
  onboarding: OnboardingStatus;
}) {
  const pct = Math.round(
    (onboarding.completedCount / onboarding.totalSteps) * 100,
  );

  // All done — show a brief celebration state (card hides on next load
  // because allComplete makes show=false; this state is a brief transition
  // for users who just completed the last step).
  if (onboarding.allComplete) {
    return (
      <Card className="border-success/20 bg-success/5">
        <CardContent className="flex items-center gap-4 py-6">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-success/15 text-success">
            <PartyPopper className="h-6 w-6" />
          </span>
          <div className="space-y-0.5">
            <p className="font-heading text-base font-medium text-heading">
              You're all set — great work!
            </p>
            <p className="text-sm text-muted-foreground">
              Your workspace is fully operational. This guide will now step
              aside.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardHeader className="pb-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <CardTitle className="text-base">Getting Started</CardTitle>
          </div>
          <span className="text-sm text-muted-foreground">
            {onboarding.completedCount} of {onboarding.totalSteps} complete
          </span>
        </div>
        <CardDescription>
          Complete these steps to get the most out of your daily workspace.
        </CardDescription>
        {/* Progress bar */}
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted/60">
          <div
            className="h-full rounded-full bg-primary transition-all duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>
      </CardHeader>

      <CardContent>
        <ul className="space-y-3">
          {onboarding.steps.map((step) => (
            <li key={step.id} className="flex items-start gap-3">
              {/* Checkmark */}
              <span
                className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-colors ${
                  step.completed
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-background"
                }`}
              >
                {step.completed && <Check className="h-3 w-3" />}
              </span>

              {/* Title + description */}
              <div className="min-w-0 flex-1 space-y-0.5">
                <p
                  className={`text-sm font-medium leading-snug ${
                    step.completed
                      ? "text-muted-foreground line-through"
                      : "text-foreground"
                  }`}
                >
                  {step.title}
                </p>
                {!step.completed && (
                  <p className="text-xs text-muted-foreground">
                    {step.description}
                  </p>
                )}
              </div>

              {/* CTA link */}
              {!step.completed && step.ctaHref ? (
                <Link
                  href={step.ctaHref}
                  className="mt-0.5 shrink-0 text-xs font-medium text-primary hover:underline"
                >
                  {step.ctaLabel} →
                </Link>
              ) : null}
            </li>
          ))}
        </ul>
      </CardContent>

      <CardFooter className="justify-between gap-4 pt-2">
        <p className="text-xs text-muted-foreground">
          You can dismiss this at any time — it won't come back.
        </p>
        <form action={dismissOnboardingAction}>
          <Button
            type="submit"
            variant="ghost"
            size="sm"
            className="shrink-0 text-muted-foreground hover:text-foreground"
          >
            I'm all set
          </Button>
        </form>
      </CardFooter>
    </Card>
  );
}
