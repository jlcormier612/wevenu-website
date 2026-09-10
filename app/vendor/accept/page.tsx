import type { Metadata } from "next";
import { createVendorClient } from "@/integrations/supabase/server";
import { createAdminClient } from "@/integrations/supabase/admin";
import { isSupabaseConfigured } from "@/lib/env";
import { VendorAcceptAuthedPanel } from "@/components/vendor-app/vendor-accept-authed-panel";
import { VendorAcceptUnauthPanel } from "@/components/vendor-app/vendor-accept-unauth-panel";

export const metadata: Metadata = { title: "Claim Your Vendor Profile — Hello to Cheers" };

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
  // Prefer invitation preview; fall back to claim-token payload (covers claim_token
  // invites that predate / sit outside vendor_invitations.token matching).
  const venueNameFromPreview =
    invitePreview && typeof invitePreview === "object" && "venueName" in invitePreview
      ? String((invitePreview as { venueName?: string }).venueName ?? "").trim() || null
      : null;
  const venueNameFromVendor =
    vendor && typeof vendor === "object" && "venueName" in vendor
      ? String((vendor as { venueName?: string }).venueName ?? "").trim() || null
      : null;
  let venueName = venueNameFromPreview ?? venueNameFromVendor;

  // Final fallback: resolve inviting venue from the vendor network relationship.
  // Covers claim_token invites when get_invitation_preview has no matching
  // vendor_invitations.token and the claim-token RPC lacks venueName yet.
  if (!venueName && isSupabaseConfigured && vendor?.id) {
    try {
      const admin = createAdminClient();
      const { data: rel } = await admin
        .from("venue_vendor_relationships")
        .select("venues(name)")
        .eq("vendor_id", vendor.id)
        .neq("status", "inactive")
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      const nested = rel?.venues as { name?: string } | { name?: string }[] | null;
      const name = Array.isArray(nested) ? nested[0]?.name : nested?.name;
      if (name?.trim()) venueName = name.trim();
    } catch {
      // Non-fatal — page still renders without venue name.
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
      <div className="w-full max-w-md bg-background border border-border rounded-2xl p-8 shadow-sm space-y-6">
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            {venueName ? `Invitation from ${venueName}` : "You've been invited"}
          </p>
          <h1 className="font-heading text-2xl font-medium text-heading">{vendorName}</h1>
          {category && (
            <p className="text-sm text-muted-foreground capitalize">{category.replace(/_/g, " ")}</p>
          )}
        </div>

        <div className="rounded-lg border border-border bg-muted/40 p-4 text-sm text-foreground leading-relaxed space-y-3">
          <p>
            {venueName ? (
              <>
                <strong className="font-medium">{venueName}</strong> has included {vendorName} as
                one of the vendors they make available to couples on Hello to Cheers.
              </>
            ) : (
              <>
                A venue has included {vendorName} as one of the vendors they make available to
                couples on Hello to Cheers.
              </>
            )}
          </p>
          <p>
            Claiming your vendor profile is free. You&apos;ll take ownership of your business
            information, share a richer profile, receive messages from couples, and collaborate on
            events once you&apos;re selected.
          </p>
          <p className="text-muted-foreground text-xs">
            After you claim, you&apos;ll review the Hello to Cheers Vendor Terms and Privacy Policy
            before opening your portal.
          </p>
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
          This invitation link has already been used, expired, or is no longer valid.
          Ask your venue contact to send a new invitation.
        </p>
      </div>
    </div>
  );
}
