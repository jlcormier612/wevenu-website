import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { VendorVenuesList } from "@/components/vendor-app/vendor-venues-list";
import { getVendorUser } from "@/lib/vendor-auth/service";
import { createClient } from "@/integrations/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import type { VendorDashboardVenue } from "@/lib/vendors/types";

export const metadata: Metadata = { title: "Venues — Vendor Portal" };

export default async function VendorVenuesPage() {
  const vendorUser = await getVendorUser();
  if (!vendorUser) redirect("/login");

  let venues: VendorDashboardVenue[] = [];
  if (isSupabaseConfigured) {
    const supabase = await createClient();
    const { data } = await supabase
      .from("venue_vendor_relationships")
      .select("id, venue_id, status, added_at, venues(name)")
      .eq("vendor_id", vendorUser.vendorId)
      .neq("status", "removed")
      .order("added_at", { ascending: false });

    type Row = { id: string; venue_id: string; status: string; added_at: string; venues: { name: string } | null };
    venues = ((data ?? []) as unknown as Row[]).map((r) => ({
      id:        r.id,
      venueId:   r.venue_id,
      venueName: r.venues?.name ?? "Unknown Venue",
      status:    r.status,
      addedAt:   r.added_at,
    }));
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Venues</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Venues you're connected to on Wevenu.
        </p>
      </div>
      <VendorVenuesList venues={venues} />
    </div>
  );
}
