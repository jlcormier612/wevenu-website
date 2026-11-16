"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import { markWelcomeExploredAction } from "@/app/(app)/setup-hub/actions";
import { Button } from "@/components/ui/button";

export function PhaseAFirstVisitWelcome({
  milestonesHeadingId = "setup-journey-heading",
}: {
  milestonesHeadingId?: string;
}) {
  const [pending, startTransition] = React.useTransition();

  const [persistError, setPersistError] = React.useState<string | null>(null);

  function explore() {
    startTransition(async () => {
      setPersistError(null);
      const result = await markWelcomeExploredAction().catch((e: unknown) => ({
        ok: false as const,
        error: e instanceof Error ? e.message : "Could not save progress",
      }));
      const heading = document.getElementById(milestonesHeadingId);
      heading?.scrollIntoView({ behavior: "smooth", block: "start" });
      heading?.focus({ preventScroll: true });
      if (!result?.ok) {
        setPersistError(
          result && "error" in result && result.error
            ? result.error
            : "Could not save that you explored setup. Please try again.",
        );
      }
    });
  }

  return (
    <section
      className="rounded-xl border border-border bg-card p-6 sm:p-8"
      data-testid="phase-a-welcome-first"
    >
      <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
        <div className="max-w-xl space-y-3">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            WELCOME TO HELLO TO CHEERS
          </p>
          <h1 className="font-serif text-3xl font-semibold tracking-tight text-heading sm:text-4xl">
            Let&apos;s get your venue ready.
          </h1>
          <p className="text-sm leading-relaxed text-muted-foreground sm:text-base">
            Your space to organize your business, personalize your experience, and welcome your
            clients with confidence.
          </p>
          <p className="text-sm text-muted-foreground">
            We&apos;ll guide you through it, one step at a time.
          </p>
        </div>
        <Button
          type="button"
          size="lg"
          className="w-full shrink-0 sm:w-auto"
          disabled={pending}
          onClick={explore}
          data-testid="phase-a-explore-setup"
        >
          Explore your setup
        </Button>
      </div>
      {persistError ? (
        <p className="mt-4 text-sm text-destructive" role="alert" data-testid="phase-a-welcome-persist-error">
          {persistError}
        </p>
      ) : null}
    </section>
  );
}

export function PhaseAReturningWelcome({ continueHref }: { continueHref: string }) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();

  function continueSetup() {
    startTransition(async () => {
      await markWelcomeExploredAction();
      router.push(continueHref);
    });
  }

  return (
    <section
      className="flex flex-col gap-4 rounded-xl border border-border bg-card p-5 sm:flex-row sm:items-center sm:justify-between"
      data-testid="phase-a-welcome-returning"
    >
      <p className="text-base font-medium text-heading">
        Welcome back. Let&apos;s pick up where you left off.
      </p>
      <Button
        type="button"
        className="w-full shrink-0 sm:w-auto"
        disabled={pending}
        onClick={continueSetup}
        data-testid="phase-a-continue-setup"
      >
        Continue setup
      </Button>
    </section>
  );
}
