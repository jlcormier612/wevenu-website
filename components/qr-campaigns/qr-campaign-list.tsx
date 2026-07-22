"use client";

import * as React from "react";

import { Archive, Copy, Plus, RotateCcw } from "lucide-react";
import { toast } from "sonner";

import {
  archiveQrCampaignAction,
  createQrCampaignAction,
  reactivateQrCampaignAction,
} from "@/app/(app)/library/qr-campaigns/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { QrCampaign, QrCampaignAnalytics, QrDestinationType } from "@/lib/qr-campaigns/types";

const DESTINATION_LABELS: Record<QrDestinationType, string> = {
  inquiry_form: "Inquiry form",
  tour_booking: "Tour booking",
  wedding_website: "A couple's wedding website",
  external_url: "External URL",
};

function CampaignRow({
  campaign, appUrl, analytics,
}: {
  campaign: QrCampaign;
  appUrl: string;
  analytics: QrCampaignAnalytics | undefined;
}) {
  const [pending, startTransition] = React.useTransition();
  const scanUrl = `${appUrl}/qr/${campaign.code}`;
  const imageUrl = `/api/qr-campaigns/image?url=${encodeURIComponent(scanUrl)}`;

  function toggleArchive() {
    startTransition(async () => {
      const result = campaign.status === "active"
        ? await archiveQrCampaignAction(campaign.id)
        : await reactivateQrCampaignAction(campaign.id);
      if (!result.ok) toast.error(result.message ?? "Could not update campaign.");
    });
  }

  return (
    <div className="flex items-start gap-4 rounded-lg border border-border p-4">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={imageUrl} alt={`QR code for ${campaign.name}`} className="h-20 w-20 shrink-0 rounded border border-border bg-white" />
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium text-heading">{campaign.name}</p>
          {campaign.status === "archived" && <Badge variant="muted">Archived</Badge>}
        </div>
        <p className="text-xs text-muted-foreground">{DESTINATION_LABELS[campaign.destinationType]}</p>
        <div className="flex items-center gap-2">
          <code className="rounded bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground truncate">{scanUrl}</code>
          <button type="button" onClick={() => { navigator.clipboard.writeText(scanUrl); toast.success("Copied!"); }} className="text-muted-foreground hover:text-foreground">
            <Copy className="h-3 w-3" />
          </button>
        </div>
        <div className="flex gap-4 pt-1 text-xs text-muted-foreground">
          <span><span className="font-medium text-heading">{analytics?.scans ?? 0}</span> scans</span>
          <span><span className="font-medium text-heading">{analytics?.conversions ?? 0}</span> leads created</span>
        </div>
      </div>
      <Button type="button" variant="outline" size="sm" onClick={toggleArchive} disabled={pending}>
        {campaign.status === "active" ? <><Archive className="mr-1 h-3.5 w-3.5" />Archive</> : <><RotateCcw className="mr-1 h-3.5 w-3.5" />Reactivate</>}
      </Button>
    </div>
  );
}

export function QrCampaignList({
  initialCampaigns, analytics, appUrl,
}: {
  initialCampaigns: QrCampaign[];
  analytics: QrCampaignAnalytics[];
  appUrl: string;
}) {
  const [campaigns, setCampaigns] = React.useState(initialCampaigns);
  const [showForm, setShowForm] = React.useState(false);
  const [name, setName] = React.useState("");
  const [destinationType, setDestinationType] = React.useState<QrDestinationType>("inquiry_form");
  const [destinationUrl, setDestinationUrl] = React.useState("");
  const [pending, startTransition] = React.useTransition();

  const analyticsById = new Map(analytics.map((a) => [a.id, a]));
  const active = campaigns.filter((c) => c.status === "active");
  const archived = campaigns.filter((c) => c.status === "archived");

  function handleCreate() {
    startTransition(async () => {
      const result = await createQrCampaignAction({ name, destinationType, destinationUrl: destinationUrl || undefined });
      if (!result.ok) { toast.error(result.message ?? "Could not create campaign."); return; }
      toast.success("QR campaign created.");
      setName(""); setDestinationUrl(""); setDestinationType("inquiry_form"); setShowForm(false);
      // Reflected via server revalidation on next navigation; append optimistically for immediate feedback.
      setCampaigns((prev) => [{ id: result.id ?? crypto.randomUUID(), venueId: "", name, code: "", destinationType, destinationUrl: destinationUrl || null, status: "active", createdAt: new Date().toISOString() }, ...prev]);
    });
  }

  return (
    <div className="space-y-6">
      {!showForm ? (
        <Button type="button" onClick={() => setShowForm(true)}>
          <Plus className="mr-1 h-4 w-4" /> New QR Campaign
        </Button>
      ) : (
        <div className="space-y-3 rounded-lg border border-border p-4">
          <div className="space-y-1.5">
            <Label className="text-xs">Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Bridal Show, Front Gate, Brochure…" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Destination</Label>
            <select
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              value={destinationType}
              onChange={(e) => setDestinationType(e.target.value as QrDestinationType)}
            >
              {Object.entries(DESTINATION_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>
          {(destinationType === "wedding_website" || destinationType === "external_url") && (
            <div className="space-y-1.5">
              <Label className="text-xs">Destination URL</Label>
              <Input value={destinationUrl} onChange={(e) => setDestinationUrl(e.target.value)} placeholder="https://…" />
            </div>
          )}
          <div className="flex gap-2">
            <Button type="button" size="sm" onClick={handleCreate} disabled={pending || !name.trim()}>
              {pending ? "Creating…" : "Create Campaign"}
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => setShowForm(false)}>Cancel</Button>
          </div>
        </div>
      )}

      {campaigns.length === 0 && !showForm ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card/40 py-16 text-center">
          <p className="font-heading text-lg font-medium text-heading">No QR campaigns yet</p>
          <p className="mt-1 text-sm text-muted-foreground">Create one for your next bridal show or printed brochure.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {active.map((c) => <CampaignRow key={c.id} campaign={c} appUrl={appUrl} analytics={analyticsById.get(c.id)} />)}
          {archived.length > 0 && (
            <details className="pt-2">
              <summary className="cursor-pointer text-xs font-medium text-muted-foreground">Archived ({archived.length})</summary>
              <div className="mt-2 space-y-3">
                {archived.map((c) => <CampaignRow key={c.id} campaign={c} appUrl={appUrl} analytics={analyticsById.get(c.id)} />)}
              </div>
            </details>
          )}
        </div>
      )}
    </div>
  );
}
