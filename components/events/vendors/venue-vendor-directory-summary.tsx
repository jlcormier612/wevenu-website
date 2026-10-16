"use client";

import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { VendorCategoryBadge } from "@/components/vendors/vendor-category-badge";
import { vendorCategoryLabel } from "@/lib/vendors/constants";
import { vendorPreferenceBadgeKind } from "@/lib/vendors/list-presentation";
import type { Vendor } from "@/lib/vendors/types";

/**
 * Venue directory for the pre-booking workspace.
 * Labels come from the existing relationship. Nothing here writes an assignment.
 */
export function VenueVendorDirectorySummary({ vendors }: { vendors: Vendor[] }) {
  return (
    <div className="space-y-3" data-testid="venue-vendor-directory">
      <p className="text-sm text-muted-foreground">
        Vendors you make available to couples. Preferred and recommended are guidance.
        Required and in-house are venue policy. These labels do not assign a vendor to this event.
      </p>
      {vendors.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          <Link href="/vendors/new" className="font-medium text-primary hover:underline">
            Add vendors to your directory
          </Link>{" "}
          before assigning anyone to this event.
        </p>
      ) : (
        <ul className="space-y-2">
          {vendors.map((vendor) => {
            const preference = vendorPreferenceBadgeKind(vendor.preferenceLevel);
            return (
              <li
                key={vendor.id}
                className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-card px-3 py-2"
                data-testid={`directory-vendor-${vendor.id}`}
              >
                <Link href={`/vendors/${vendor.id}`} className="text-sm font-medium text-foreground hover:text-primary">
                  {vendor.businessName}
                </Link>
                {vendor.category ? <VendorCategoryBadge category={vendor.category} /> : null}
                {preference === "preferred" && <Badge variant="outline">Preferred</Badge>}
                {preference === "recommended" && <Badge variant="outline">Recommended</Badge>}
                {preference === "approved" && (
                  <Badge variant="outline" className="text-muted-foreground">Approved</Badge>
                )}
                {vendor.isRequired && <Badge className="bg-foreground text-background hover:bg-foreground">Required</Badge>}
                {vendor.isInHouse && <Badge variant="secondary">In-house</Badge>}
                <span className="sr-only">{vendorCategoryLabel(vendor.category)}</span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
