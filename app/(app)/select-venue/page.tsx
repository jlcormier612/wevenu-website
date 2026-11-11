import { redirect } from "next/navigation";

import { VenueSelectForm } from "@/components/venue/venue-select-form";
import { isSupabaseConfigured } from "@/lib/env";
import { bootstrapActiveVenueContext } from "@/lib/venue/active-context";

export const dynamic = "force-dynamic";

/**
 * Minimal Wave 2 venue picker. Shown when a user has multiple memberships
 * and no valid active venue context (fail closed).
 */
export default async function SelectVenuePage() {
  if (!isSupabaseConfigured) redirect("/login");

  const boot = await bootstrapActiveVenueContext();
  if (boot.status === "unauthenticated") redirect("/login");
  if (boot.status === "no_memberships") redirect("/onboarding/intake");
  if (boot.status === "ready") redirect("/dashboard");

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-md flex-col justify-center gap-4 px-4 py-12">
      <div className="space-y-1">
        <h1 className="font-heading text-2xl font-semibold text-heading">Select a venue</h1>
        <p className="text-sm text-muted-foreground">
          You belong to more than one venue. Choose which one to work in.
          Switching venues does not change your role or access at any venue.
        </p>
      </div>
      <VenueSelectForm memberships={boot.memberships} />
    </div>
  );
}
