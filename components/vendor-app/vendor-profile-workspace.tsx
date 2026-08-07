"use client";

import * as React from "react";

import { VendorProfileForm } from "@/components/vendor-app/vendor-profile-form";
import { VendorPackagesManager } from "@/components/vendor-app/vendor-packages-manager";
import { VendorFaqsManager } from "@/components/vendor-app/vendor-faqs-manager";
import { VendorAvailabilityManager } from "@/components/vendor-app/vendor-availability-manager";
import { VendorLegalHistorySection } from "@/components/legal/legal-history-section";
import type { LegalAcceptanceHistoryItem } from "@/lib/legal/types";
import type { VendorProfile, VendorPackage, VendorFaq, VendorAvailability } from "@/lib/vendors/types";

type Tab = "profile" | "packages" | "faqs" | "availability";
const TABS: { id: Tab; label: string }[] = [
  { id: "profile",      label: "Profile"      },
  { id: "packages",     label: "Packages"     },
  { id: "faqs",         label: "FAQs"         },
  { id: "availability", label: "Availability" },
];

/**
 * Vendor Workspace Realignment, Phase 11 (2026-07-22): Profile exists for
 * one purpose — helping venues present the vendor in the Venue Directory —
 * and that purpose explicitly includes packages and availability, per the
 * Phase 1 audit. Packages and Availability were their own top-level nav
 * destinations; they fold in here as tabs, reusing both components
 * unchanged, rather than living as separate CRM-flavored pages.
 *
 * FAQs (Program 4, Initiative C, Phase 16, 2026-07-23) joins the same way —
 * one more thing "The Vendor Profile exists to help Venues market trusted
 * partners" explicitly names.
 */
export function VendorProfileWorkspace({
  profile,
  packages,
  faqs,
  availability,
  year,
  month,
  legalHistory,
}: {
  profile: VendorProfile;
  packages: VendorPackage[];
  faqs: VendorFaq[];
  availability: VendorAvailability[];
  year: number;
  month: number;
  legalHistory: LegalAcceptanceHistoryItem[];
}) {
  const [tab, setTab] = React.useState<Tab>("profile");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-medium text-heading">Profile</h1>
        <p className="text-sm text-muted-foreground mt-1">How venues and clients see you in their Vendor Directory.</p>
      </div>

      <div className="flex items-center gap-1 rounded-sm bg-muted/60 p-1 w-fit">
        {TABS.map((t) => (
          <button key={t.id} type="button" onClick={() => setTab(t.id)}
            className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-all ${
              tab === t.id ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === "profile" && <VendorProfileForm profile={profile} />}
      {tab === "packages" && <VendorPackagesManager packages={packages} />}
      {tab === "faqs" && <VendorFaqsManager faqs={faqs} />}
      {tab === "availability" && (
        <VendorAvailabilityManager
          availability={availability}
          year={year}
          month={month}
          acceptingInquiries={profile.acceptingInquiries}
          availabilityNotes={profile.availabilityNotes}
        />
      )}

      <VendorLegalHistorySection items={legalHistory} />
    </div>
  );
}
