"use client";

import * as React from "react";
import { QrCode } from "lucide-react";
import { toast } from "sonner";

import { createQrCampaignAction } from "@/app/(app)/library/qr-campaigns/actions";
import { LibraryAssetCard } from "@/components/library/library-asset-card";
import type { QrDestinationType } from "@/lib/qr-campaigns/types";

const STARTERS: {
  id: string;
  name: string;
  description: string;
  destinationType: QrDestinationType;
  destinationLabel: string;
}[] = [
  {
    id: "bridal-show",
    name: "Bridal Show Lead Capture",
    description: "A ready-to-name starting point for printed signage at bridal shows and open houses.",
    destinationType: "inquiry_form",
    destinationLabel: "Inquiry form",
  },
  {
    id: "front-gate",
    name: "Front Gate Lead Capture",
    description: "A simple starting point for a permanent sign that turns venue visits into inquiries.",
    destinationType: "tour_booking",
    destinationLabel: "Tour booking",
  },
  {
    id: "brochure",
    name: "Brochure QR",
    description: "A starting point for printed brochures that sends a prospective couple into your lead journey.",
    destinationType: "inquiry_form",
    destinationLabel: "Inquiry form",
  },
];

export function QrStarterExamples({ hasCampaigns }: { hasCampaigns: boolean }) {
  const [pending, setPending] = React.useState<string | null>(null);
  if (hasCampaigns) return null;

  async function useStarter(starter: typeof STARTERS[number]) {
    setPending(starter.id);
    const result = await createQrCampaignAction({
      name: starter.name,
      destinationType: starter.destinationType,
    });
    setPending(null);
    if (!result.ok) {
      toast.error(result.message ?? "Could not create QR campaign.");
      return;
    }
    toast.success("QR campaign created. Your new code is ready below.");
    window.location.reload();
  }

  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <QrCode className="h-4 w-4 text-muted-foreground" />
        <div>
          <p className="text-sm font-medium text-heading">Starter examples</p>
          <p className="text-xs text-muted-foreground">Choose a common use case to create your first campaign.</p>
        </div>
      </div>
      {STARTERS.map((starter) => (
        <LibraryAssetCard
          key={starter.id}
          title={starter.name}
          description={starter.description}
          meta={starter.destinationLabel}
          isStarter
          primaryActions={[{
            id: `use-${starter.id}`,
            label: pending === starter.id ? "Creating…" : "Use this starter",
            onClick: () => useStarter(starter),
            emphasis: "use",
            disabled: pending !== null,
          }]}
        />
      ))}
    </section>
  );
}
