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

// Redirects based on isSupabaseConfigured before touching a dynamic API —
// without this, Next.js can statically prerender that redirect at build
// time and cache it indefinitely, serving it to every request regardless
// of actual session state.
export const dynamic = "force-dynamic";

/**
 * Venue Setup entry. Requires an authenticated user (defense in depth
 * alongside the proxy). If a venue has already completed setup, the
 * workspace exists — send the user there instead of re-running setup.
 *
 * Financial/accounting setup (QuickBooks/Stripe connect) is not part of
 * this wizard — those integrations live in Settings, reachable once the
 * venue has finished initial setup.
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
