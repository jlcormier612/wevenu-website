import type { Metadata } from "next";
import { createVendorClient } from "@/integrations/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { VendorAcceptAuthedPanel } from "@/components/vendor-app/vendor-accept-authed-panel";
import { VendorAcceptUnauthPanel } from "@/components/vendor-app/vendor-accept-unauth-panel";

export const metadata: Metadata = { title: "Accept Invitation — Hello to Cheers" };

type Props = { searchParams: Promise<{ token?: string }> };

/**
 * Vendor invitation claim. Auth state is read from the vendor cookie jar only
 * so an existing venue session in the same browser never auto-claims.
 */
export default async function VendorAcceptPage({ searchParams }: Props) {
  const { token } = await searchParams;

  if (!token) {
    return <InvalidToken />;
  }

  const supabase = await createVendorClient();
  const { data: vendor } = isSupabaseConfigured
    ? await supabase.rpc("get_vendor_by_claim_token", { p_token: token })
    : { data: null };

  if (!vendor) {
    return <InvalidToken />;
  }

  const [{ data: { user } }, { data: invitePreview }] = isSupabaseConfigured
    ? await Promise.all([
        supabase.auth.getUser(),
        supabase.rpc("get_invitation_preview", { p_token: token }),
      ])
    : [{ data: { user: null } }, { data: null }];

  const vendorName = vendor.businessName ?? "your business";
  const category = vendor.category ?? null;
  const inviteEmail =
    invitePreview && typeof invitePreview === "object" && "email" in invitePreview
      ? String((invitePreview as { email?: string }).email ?? "").trim() || null
      : null;

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
      <div className="w-full max-w-md bg-background border border-border rounded-2xl p-8 shadow-sm space-y-6">
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            You&apos;ve been invited
          </p>
          <h1 className="font-heading text-2xl font-medium text-heading">{vendorName}</h1>
          {category && (
            <p className="text-sm text-muted-foreground capitalize">{category.replace(/_/g, " ")}</p>
          )}
        </div>

        <div className="rounded-lg border border-border bg-muted/40 p-4 text-sm text-foreground leading-relaxed space-y-3">
          <p>
            A venue would love to connect with you on Hello to Cheers. They&apos;ve added{" "}
            {vendorName} to their trusted vendor network and created a starting profile for your business.
          </p>
          <p>
            Claiming your profile lets you keep your business information up to date, manage the
            services and packages you offer, share your availability, and build venue relationships —
            all in one place.
          </p>
          <p>It only takes a minute to get started.</p>
        </div>

        {user ? (
          <VendorAcceptAuthedPanel
            token={token}
            sessionEmail={user.email ?? null}
            inviteEmail={inviteEmail}
          />
        ) : (
          <VendorAcceptUnauthPanel token={token} inviteEmail={inviteEmail} />
        )}
      </div>
    </div>
  );
}

function InvalidToken() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
      <div className="w-full max-w-md bg-background border border-border rounded-2xl p-8 shadow-sm text-center space-y-3">
        <h1 className="font-heading text-2xl font-medium text-heading">Link invalid or expired</h1>
        <p className="text-sm text-muted-foreground">
          This invitation link has already been used or is no longer valid.
          Ask your venue contact to resend the invitation.
        </p>
      </div>
    </div>
  );
}
