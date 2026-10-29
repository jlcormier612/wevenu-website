import { createAdminClient } from "@/integrations/supabase/admin";
import { isSupabaseConfigured } from "@/lib/env";
import { WhiteGloveBrandChrome } from "@/components/onboarding/white-glove-brand-chrome";
import { WhiteGloveWaitingClient } from "@/components/onboarding/white-glove-waiting-client";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ token: string }> };

export default async function WhiteGloveWaitingPage({ params }: PageProps) {
  const { token: raw } = await params;
  const token = raw?.trim() || "";

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
    .select("id, venue_id, venue_name, onboarding_type, status")
    .eq("intake_token", token)
    .maybeSingle();

  if (!enrollment || enrollment.onboarding_type !== "white_glove" || !enrollment.venue_id) {
    return (
      <main className="mx-auto max-w-xl px-4 py-16">
        <WhiteGloveBrandChrome />
        <h1 className="text-2xl font-medium">Link unavailable</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          This intake link is invalid or expired.
        </p>
      </main>
    );
  }

  return (
    <WhiteGloveWaitingClient
      intakeToken={token}
      venueName={enrollment.venue_name}
      activated={enrollment.status === "activated"}
    />
  );
}
