import { createAdminClient } from "@/integrations/supabase/admin";
import { isSupabaseConfigured } from "@/lib/env";
import { WhiteGloveIntakeClient } from "@/components/onboarding/white-glove-intake-client";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ token: string }> };

export default async function WhiteGloveIntakePage({ params }: PageProps) {
  const { token: raw } = await params;
  const token = raw?.trim() || "";

  if (!isSupabaseConfigured || !token) {
    return (
      <main className="mx-auto max-w-xl px-4 py-16">
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
      "id, venue_id, venue_name, owner_email, owner_first_name, owner_last_name, onboarding_type, white_glove_status, status",
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
        <h1 className="text-2xl font-medium">Link unavailable</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          This intake link is invalid or your workspace access has already been activated.
        </p>
      </main>
    );
  }

  if (
    enrollment.white_glove_status === "waiting" ||
    enrollment.white_glove_status === "in_progress" ||
    enrollment.white_glove_status === "setup_complete_access_pending" ||
    enrollment.white_glove_status === "complete"
  ) {
    const { redirect } = await import("next/navigation");
    redirect(`/onboarding/white-glove/${encodeURIComponent(token)}/waiting`);
  }

  const contactName = [enrollment.owner_first_name, enrollment.owner_last_name]
    .filter(Boolean)
    .join(" ");

  return (
    <main className="min-h-screen bg-background px-4 py-10">
      <WhiteGloveIntakeClient
        intakeToken={token}
        prefill={{
          venueName: enrollment.venue_name,
          contactEmail: enrollment.owner_email,
          primaryContactName: contactName || undefined,
        }}
      />
    </main>
  );
}
