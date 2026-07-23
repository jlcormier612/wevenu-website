import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { SetupWizard } from "@/components/setup/setup-wizard";
import { createClient } from "@/integrations/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { getCurrentVenue, getVenueSettings } from "@/lib/venue/service";
import { SETUP_STEPS, type SetupStepId } from "@/lib/venue/validation";

export const metadata: Metadata = {
  title: "Set up your venue",
};

/**
 * Venue Setup entry. Requires an authenticated user (defense in depth
 * alongside the proxy). If a venue has already completed setup, the
 * workspace exists — send the user there instead of re-running setup.
 *
 * Guided Setup §1.2 (2026-07-22): Financial Setup (QuickBooks/Stripe
 * connect) used to be a separate post-creation ?financial=1 screen here,
 * reached only after the wizard finished. It's now the wizard's own
 * "payments" step (components/setup/setup-steps.tsx's PaymentsStep) — this
 * page no longer has a financial-specific branch. The QuickBooks/Stripe
 * OAuth callbacks still redirect back to this plain URL when initiated
 * from onboarding; since setup isn't complete yet at that point, the
 * resume logic below naturally lands back on the "payments" step.
 */
export default async function SetupPage() {
  if (!isSupabaseConfigured) {
    redirect("/login");
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  const venue = await getCurrentVenue();

  if (venue?.setupCompleted) {
    redirect("/dashboard");
  }

  // Guided Setup, Phase 1 — a venue row may already exist, partially filled
  // in, from an earlier progress-saved attempt (or an abandoned session).
  // Resume at the step AFTER the furthest one actually completed
  // (setup_last_step) — not "the first step that fails validation": most
  // steps' fields are optional with real defaults (timezone, brand colors,
  // currency), so they'd validate successfully without ever having been
  // visited, and "first invalid step" would skip straight past Venue
  // Details/Hours/Brand to Owner. See docs/hospitality-success-platform-
  // implementation-plan.md §1.2.
  if (venue) {
    const settings = await getVenueSettings();
    if (settings) {
      const lastIndex = settings.setupLastStep
        ? SETUP_STEPS.indexOf(settings.setupLastStep as SetupStepId)
        : -1;
      const resumeStep: SetupStepId = SETUP_STEPS[lastIndex + 1] ?? "review";
      return (
        <SetupWizard
          ownerEmail={user.email ?? ""}
          initialInput={settings.input}
          resumeStep={resumeStep}
        />
      );
    }
  }

  return <SetupWizard ownerEmail={user.email ?? ""} />;
}
