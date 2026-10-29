import { createAdminClient } from "@/integrations/supabase/admin";
import { isSupabaseConfigured } from "@/lib/env";
import { getIntakeForVenue } from "@/lib/onboarding/intake-service";
import { WhiteGloveBrandChrome } from "@/components/onboarding/white-glove-brand-chrome";
import { WhiteGloveIntakeClient } from "@/components/onboarding/white-glove-intake-client";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ edit?: string }>;
};

export default async function WhiteGloveIntakePage({ params, searchParams }: PageProps) {
  const { token: raw } = await params;
  const { edit } = await searchParams;
  const token = raw?.trim() || "";
  const wantsEdit = edit === "1" || edit === "true";

  if (!isSupabaseConfigured || !token) {
    return (
      <main className="mx-auto max-w-xl px-4 py-16">
        <WhiteGloveBrandChrome />
        <h1 className="text-2xl font-medium">Link unavailable</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          This intake link is invalid or expired. Reply to your welcome email and we&apos;ll
          help.
        </p>
      </main>
    );
  }

  const admin = createAdminClient();
  const { data: enrollment } = await admin
    .from("venue_enrollments")
    .select(
      "id, venue_id, venue_name, owner_email, owner_first_name, owner_last_name, onboarding_type, white_glove_status, status, stripe_checkout_session_id",
    )
    .eq("intake_token", token)
    .maybeSingle();

  if (
    !enrollment ||
    enrollment.onboarding_type !== "white_glove" ||
    !enrollment.venue_id ||
    enrollment.status === "activated"
  ) {
    return (
      <main className="mx-auto max-w-xl px-4 py-16">
        <WhiteGloveBrandChrome />
        <h1 className="text-2xl font-medium">Link unavailable</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          This intake link is invalid or your workspace access has already been activated.
        </p>
      </main>
    );
  }

  const postSubmitStatuses = new Set([
    "waiting",
    "in_progress",
    "setup_complete_access_pending",
    "complete",
  ]);
  const alreadySubmitted = postSubmitStatuses.has(enrollment.white_glove_status ?? "");

  // Default after submit: waiting hub. Explicit ?edit=1 reopens the form for corrections.
  if (alreadySubmitted && !wantsEdit) {
    const { redirect } = await import("next/navigation");
    redirect(`/onboarding/white-glove/${encodeURIComponent(token)}/waiting`);
  }

  const existingIntake = await getIntakeForVenue(enrollment.venue_id);

  // Billing address is never auto-applied as venue location — only suggest when we have
  // nothing better and label it clearly in the form via prefill flag.
  const billingSuggestion = null as {
    addressLine1?: string | null;
    city?: string | null;
    stateRegion?: string | null;
    postalCode?: string | null;
    country?: string | null;
  } | null;

  return (
    <main className="min-h-screen bg-background px-4 py-8 sm:py-10">
      <div className="mx-auto max-w-xl space-y-3">
        <WhiteGloveBrandChrome />
        <div
          className="rounded-md border border-border/70 bg-muted/10 px-3 py-2.5 text-sm"
          data-testid="wg-welcome-box"
        >
          <p className="font-medium text-foreground">Welcome to White Glove Setup!</p>
          <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
            We&apos;re excited to help you get Hello to Cheers ready for your venue. Let&apos;s
            start with a few details about your space and how you work. We&apos;ll take care of
            the setup from there.
          </p>
          <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
            Your account login is already set. The contact information you provide below helps us
            configure your venue and communicate with you during setup.
          </p>
        </div>
      </div>
      <WhiteGloveIntakeClient
        intakeToken={token}
        mode={alreadySubmitted ? "edit" : "create"}
        knownMaterialsCount={0}
        prefill={{
          venueName: existingIntake?.venueName || enrollment.venue_name,
          addressLine1: existingIntake?.addressLine1 ?? billingSuggestion?.addressLine1 ?? undefined,
          addressLine2: existingIntake?.addressLine2 ?? undefined,
          city: existingIntake?.city ?? billingSuggestion?.city ?? undefined,
          stateRegion: existingIntake?.stateRegion ?? billingSuggestion?.stateRegion ?? undefined,
          postalCode: existingIntake?.postalCode ?? billingSuggestion?.postalCode ?? undefined,
          country: existingIntake?.country ?? billingSuggestion?.country ?? undefined,
          primaryContactName: existingIntake?.primaryContactName ?? undefined,
          contactEmail: existingIntake?.contactEmail ?? undefined,
          contactPhone: existingIntake?.contactPhone ?? undefined,
          website: existingIntake?.website ?? undefined,
          spaceMode: existingIntake?.spaceMode,
          spaces: existingIntake?.spaces,
          offersTours: existingIntake?.offersTours,
          offersTastingsOrAppointments: existingIntake?.offersTastingsOrAppointments ?? undefined,
          appointmentTypeKeys: existingIntake?.appointmentTypeKeys,
          appointmentTypesOther: existingIntake?.appointmentTypesOther ?? undefined,
          inquirySources: existingIntake?.inquirySources,
          inquirySourcesOther: existingIntake?.inquirySourcesOther ?? undefined,
          bringBusinessChoice: existingIntake?.bringBusinessChoice,
          acceptStarters: existingIntake?.acceptStarters,
          addressSourceLabel: billingSuggestion && !existingIntake?.addressLine1
            ? "Suggested from billing — confirm this is your venue location, or replace it."
            : undefined,
        }}
      />
    </main>
  );
}
