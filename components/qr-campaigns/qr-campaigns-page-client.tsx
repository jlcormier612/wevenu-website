"use client";

import * as React from "react";

import { Plus } from "lucide-react";

import { CollectionBackLink } from "@/components/library/collection-back-link";
import { LibraryDependencyNote, LibraryHowItWorks } from "@/components/library/library-guidance";
import { QrCampaignList } from "@/components/qr-campaigns/qr-campaign-list";
import { QrStarterExamples } from "@/components/qr-campaigns/qr-starter-examples";
import { PageHeader } from "@/components/shell/module-placeholder";
import { Button } from "@/components/ui/button";
import type { QrCampaign, QrCampaignAnalytics } from "@/lib/qr-campaigns/types";

export function QrCampaignsPageClient({
  campaigns,
  analytics,
  appUrl,
  publishedPublicForms,
  existingMasterKeys,
}: {
  campaigns: QrCampaign[];
  analytics: QrCampaignAnalytics[];
  appUrl: string;
  publishedPublicForms: Array<{ id: string; internalName: string; publicTitle: string }>;
  existingMasterKeys: string[];
}) {
  const listRef = React.useRef<{ openCreate: () => void } | null>(null);

  return (
    <div className="space-y-6">
      <CollectionBackLink href="/library" label="Templates" />
      <PageHeader
        title="QR Campaigns"
        description="Printable QR codes for bridal shows, open houses, brochures, and signs — with scan tracking."
        actions={
          <Button type="button" onClick={() => listRef.current?.openCreate()}>
            <Plus className="mr-1 h-4 w-4" /> New QR Campaign
          </Button>
        }
      />
      <LibraryHowItWorks>
        Create the form first, then point a QR campaign at it. Download the PNG to print or share.
      </LibraryHowItWorks>
      <LibraryDependencyNote
        detail="Need to create or edit the form a QR opens? Manage Public Forms. When you create or edit a campaign, choose that form (or enter another destination URL)."
        action={{ href: "/library/public-forms", label: "Manage Public Forms" }}
      >
        QR campaigns can open a Public Form from your venue.
      </LibraryDependencyNote>
      <QrStarterExamples existingMasterKeys={existingMasterKeys} />
      <QrCampaignList
        ref={listRef}
        initialCampaigns={campaigns}
        analytics={analytics}
        appUrl={appUrl}
        publishedPublicForms={publishedPublicForms}
        headerCreate={false}
      />
    </div>
  );
}
