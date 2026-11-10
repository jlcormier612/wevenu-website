import type { Metadata } from "next";
import Link from "next/link";

import { Wordmark } from "@/components/brand/wordmark";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Temporarily unavailable",
};

export const dynamic = "force-dynamic";

/**
 * Fail-closed recovery surface when legal proxy enforcement cannot run.
 * Skipped by legal middleware so redirects here cannot loop.
 * Does not record legal acceptances and does not imply the user rejected terms.
 */
export default function LegalEnforcementUnavailablePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-[var(--true-white)] px-6 py-16 text-center">
      <Wordmark forceLight className="mb-10" />
      <h1 className="font-heading text-2xl font-medium text-[var(--forest-sage)] md:text-3xl">
        We&apos;ll be right back
      </h1>
      <p className="mt-4 max-w-md text-sm leading-relaxed text-[var(--forest-sage)]/85 md:text-base">
        Hello to Cheers couldn&apos;t complete a required compliance check just
        now. Your account and documents are unchanged. Please try again in a
        moment, or sign in again if the problem continues.
      </p>
      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <Link href="/dashboard" className={cn(buttonVariants())}>
          Try again
        </Link>
        <Link
          href="/login"
          className={cn(buttonVariants({ variant: "outline" }))}
        >
          Back to sign in
        </Link>
      </div>
      <p className="mt-8 text-xs text-muted-foreground">
        Need help? Contact Hello to Cheers Support.
      </p>
    </main>
  );
}
