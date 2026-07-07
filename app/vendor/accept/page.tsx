import type { Metadata } from "next";
import { createClient } from "@/integrations/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { ClaimButton } from "@/components/vendor-app/claim-button";

export const metadata: Metadata = { title: "Accept Invitation — Wevenu" };

type Props = { searchParams: Promise<{ token?: string }> };

export default async function VendorAcceptPage({ searchParams }: Props) {
  const { token } = await searchParams;

  if (!token) {
    return <InvalidToken />;
  }

  // Security-definer RPC — works pre-auth (reads vendor by claim_token)
  const supabase = await createClient();
  const { data: vendor } = isSupabaseConfigured
    ? await supabase.rpc("get_vendor_by_claim_token", { p_token: token })
    : { data: null };

  if (!vendor) {
    return <InvalidToken />;
  }

  const { data: { user } } = isSupabaseConfigured
    ? await supabase.auth.getUser()
    : { data: { user: null } };

  const vendorName = vendor.businessName ?? "your business";
  const category   = vendor.category ?? null;

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
      <div className="w-full max-w-md bg-background border border-border rounded-2xl p-8 shadow-sm space-y-6">
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            You've been invited
          </p>
          <h1 className="text-2xl font-bold text-foreground">{vendorName}</h1>
          {category && (
            <p className="text-sm text-muted-foreground capitalize">{category.replace(/_/g, " ")}</p>
          )}
        </div>

        <div className="rounded-lg border border-border bg-muted/40 p-4 text-sm text-foreground leading-relaxed">
          A venue has set up this profile for your business on Wevenu. Claim it to manage your
          profile, service packages, availability, and venue relationships — all in one place.
        </div>

        {user ? (
          <ClaimButton token={token} />
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Sign in or create an account to claim this profile.
            </p>
            <a
              href={`/login?next=${encodeURIComponent(`/vendor/accept?token=${token}`)}`}
              className="block w-full text-center rounded-lg bg-foreground text-background font-semibold py-3 text-sm hover:opacity-90 transition-opacity"
            >
              Sign in or Create Account
            </a>
          </div>
        )}
      </div>
    </div>
  );
}

function InvalidToken() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
      <div className="w-full max-w-md bg-background border border-border rounded-2xl p-8 shadow-sm text-center space-y-3">
        <h1 className="text-xl font-bold text-foreground">Link Invalid or Expired</h1>
        <p className="text-sm text-muted-foreground">
          This invitation link has already been used or is no longer valid.
          Ask your venue contact to resend the invitation.
        </p>
      </div>
    </div>
  );
}
