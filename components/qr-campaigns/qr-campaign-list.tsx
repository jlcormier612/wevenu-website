"use client";

import * as React from "react";

import Link from "next/link";
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
import { resolveArchiveToggle } from "@/lib/qr-campaigns/archive-ui-state";
import { buildQrCreateReturnPath } from "@/lib/qr-campaigns/qr-form-return";
import type { QrCampaign, QrCampaignAnalytics, QrDestinationType } from "@/lib/qr-campaigns/types";

const DESTINATION_LABELS: Record<QrDestinationType, string> = {
  public_form: "Custom public form",
  inquiry_form: "Inquiry form",
  tour_booking: "Tour booking",
  wedding_website: "A couple's wedding website",
  external_url: "External URL",
};

export type QrPublicFormOption = {
  id: string;
  internalName: string;
  publicTitle: string;
  status: "draft" | "published";
};

function statusLabel(status: QrPublicFormOption["status"]): string {
  return status === "published" ? "Published" : "Draft";
}

function CampaignRow({
  campaign, appUrl, analytics, onStatusChange, publicFormLabel,
}: {
  campaign: QrCampaign;
  appUrl: string;
  analytics: QrCampaignAnalytics | undefined;
  onStatusChange: (id: string, status: QrCampaign["status"]) => void;
  publicFormLabel?: string | null;
}) {
  const [pending, startTransition] = React.useTransition();
  const scanUrl = `${appUrl}/qr/${campaign.code}`;
  const imageUrl = `/api/qr-campaigns/image?url=${encodeURIComponent(scanUrl)}`;

  function toggleArchive() {
    startTransition(async () => {
      const nextStatus = campaign.status === "active" ? "archived" : "active";
      const result = nextStatus === "archived"
        ? await archiveQrCampaignAction(campaign.id)
        : await reactivateQrCampaignAction(campaign.id);
      const outcome = resolveArchiveToggle([campaign], campaign.id, nextStatus, result);
      if (outcome.kind === "error") {
        toast.error(outcome.message);
        return;
      }
      onStatusChange(campaign.id, nextStatus);
      toast.success(outcome.message);
    });
  }

  const destLabel =
    campaign.destinationType === "public_form" && publicFormLabel
      ? `${DESTINATION_LABELS.public_form}: ${publicFormLabel}`
      : DESTINATION_LABELS[campaign.destinationType];

  return (
    <div className="flex items-start gap-4 rounded-lg border border-border p-4">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={imageUrl} alt={`QR code for ${campaign.name}`} className="h-20 w-20 shrink-0 rounded border border-border bg-white" />
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium text-heading">{campaign.name}</p>
          {campaign.sourceMasterKey && <Badge variant="muted" className="text-[10px]">Starter</Badge>}
          {campaign.status === "archived" && <Badge variant="muted">Archived</Badge>}
        </div>
        <p className="text-xs text-muted-foreground">{destLabel}</p>
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
  initialCampaigns,
  analytics,
  appUrl,
  publicForms = [],
  initialOpenCreate = false,
  initialDestinationType = null,
  initialPublicFormId = null,
  initialName = null,
}: {
  initialCampaigns: QrCampaign[];
  analytics: QrCampaignAnalytics[];
  appUrl: string;
  /** Draft + published Public Forms for the Custom public form destination. */
  publicForms?: QrPublicFormOption[];
  initialOpenCreate?: boolean;
  initialDestinationType?: QrDestinationType | null;
  initialPublicFormId?: string | null;
  initialName?: string | null;
}) {
  const [campaigns, setCampaigns] = React.useState(initialCampaigns);
  const [showForm, setShowForm] = React.useState(initialOpenCreate);
  const [name, setName] = React.useState(initialName ?? "");
  const [destinationType, setDestinationType] = React.useState<QrDestinationType>(
    initialDestinationType ?? "inquiry_form",
  );
  const [destinationUrl, setDestinationUrl] = React.useState("");
  const [publicFormId, setPublicFormId] = React.useState(initialPublicFormId ?? "");
  const [pending, startTransition] = React.useTransition();

  React.useEffect(() => {
    setCampaigns(initialCampaigns);
  }, [initialCampaigns]);

  React.useEffect(() => {
    if (initialOpenCreate) setShowForm(true);
    if (initialDestinationType) setDestinationType(initialDestinationType);
    if (initialPublicFormId) setPublicFormId(initialPublicFormId);
    if (initialName) setName(initialName);
  }, [initialOpenCreate, initialDestinationType, initialPublicFormId, initialName]);

  const analyticsById = new Map(analytics.map((a) => [a.id, a]));
  const formById = new Map(publicForms.map((f) => [f.id, f]));
  const selectedForm = publicFormId ? formById.get(publicFormId) ?? null : null;
  const active = campaigns.filter((c) => c.status === "active");
  const archived = campaigns.filter((c) => c.status === "archived");

  const returnToAfterFormEdit = buildQrCreateReturnPath({
    publicFormId: publicFormId || null,
    name: name || null,
  });

  const createNewFormHref = `/library/public-forms?create=1&returnTo=${encodeURIComponent(
    buildQrCreateReturnPath({ name: name || null }),
  )}`;

  const customizeFormHref = selectedForm
    ? `/library/public-forms/${selectedForm.id}?returnTo=${encodeURIComponent(
        buildQrCreateReturnPath({ publicFormId: selectedForm.id, name: name || null }),
      )}`
    : null;

  function handleStatusChange(id: string, status: QrCampaign["status"]) {
    setCampaigns((prev) => prev.map((c) => (c.id === id ? { ...c, status } : c)));
  }

  function handleCreate() {
    startTransition(async () => {
      const result = await createQrCampaignAction({
        name,
        destinationType,
        destinationUrl: destinationUrl || undefined,
        publicFormId: destinationType === "public_form" ? publicFormId || undefined : undefined,
      });
      if (!result.ok) { toast.error(result.message ?? "Could not create campaign."); return; }
      toast.success("QR campaign created.");
      setName(""); setDestinationUrl(""); setDestinationType("inquiry_form"); setPublicFormId(""); setShowForm(false);
      setCampaigns((prev) => [{
        id: result.id ?? crypto.randomUUID(),
        venueId: "",
        name,
        code: "",
        destinationType,
        destinationUrl: destinationUrl || null,
        publicFormId: destinationType === "public_form" ? publicFormId || null : null,
        status: "active",
        sourceMasterKey: null,
        createdAt: new Date().toISOString(),
      }, ...prev]);
    });
  }

  const publicFormReady =
    destinationType !== "public_form" ||
    (Boolean(publicFormId) && selectedForm?.status === "published");

  const canCreate =
    name.trim() &&
    publicFormReady &&
    ((destinationType !== "wedding_website" && destinationType !== "external_url") || destinationUrl.trim());

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
              onChange={(e) => {
                setDestinationType(e.target.value as QrDestinationType);
                setPublicFormId("");
              }}
            >
              {Object.entries(DESTINATION_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>
          {destinationType === "public_form" && (
            <div className="space-y-3 rounded-md border border-dashed border-border bg-muted/20 p-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Choose a form</Label>
                <select
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                  value={publicFormId}
                  onChange={(e) => setPublicFormId(e.target.value)}
                >
                  <option value="">Select a public form…</option>
                  {publicForms.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.internalName} — {statusLabel(f.status)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-wrap gap-2">
                <Link
                  href={createNewFormHref}
                  className="inline-flex h-7 items-center rounded-lg border border-border bg-background px-2.5 text-[0.8rem] font-medium hover:bg-muted"
                >
                  + Create new form
                </Link>
                {customizeFormHref && (
                  <Link
                    href={customizeFormHref}
                    className="inline-flex h-7 items-center rounded-lg border border-border bg-background px-2.5 text-[0.8rem] font-medium hover:bg-muted"
                  >
                    Customize form
                  </Link>
                )}
              </div>

              {publicForms.length === 0 && (
                <p className="text-[11px] text-muted-foreground">
                  No public forms yet. Create a new form, customize it, publish it, then return here to finish this QR.
                </p>
              )}

              {selectedForm?.status === "draft" && (
                <p className="text-[11px] text-muted-foreground">
                  This form is still a draft. Customize and publish it before creating the QR — the public link is not live until published.
                </p>
              )}

              {selectedForm?.status === "published" && (
                <p className="text-[11px] text-muted-foreground">
                  Selected: {selectedForm.internalName} (Published). Several QR codes can share this same form.
                </p>
              )}

              {/* Keep returnTo in the DOM for tests / return-path continuity when customizing */}
              <input type="hidden" name="returnTo" value={returnToAfterFormEdit} readOnly />
            </div>
          )}
          {(destinationType === "wedding_website" || destinationType === "external_url") && (
            <div className="space-y-1.5">
              <Label className="text-xs">Destination URL</Label>
              <Input value={destinationUrl} onChange={(e) => setDestinationUrl(e.target.value)} placeholder="https://…" />
            </div>
          )}
          <div className="flex gap-2">
            <Button type="button" size="sm" onClick={handleCreate} disabled={pending || !canCreate}>
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
          {active.map((c) => (
            <CampaignRow
              key={c.id}
              campaign={c}
              appUrl={appUrl}
              analytics={analyticsById.get(c.id)}
              onStatusChange={handleStatusChange}
              publicFormLabel={c.publicFormId ? formById.get(c.publicFormId)?.internalName : null}
            />
          ))}
          {archived.length > 0 && (
            <details className="pt-2">
              <summary className="cursor-pointer text-xs font-medium text-muted-foreground">Archived ({archived.length})</summary>
              <div className="mt-2 space-y-3">
                {archived.map((c) => (
                  <CampaignRow
                    key={c.id}
                    campaign={c}
                    appUrl={appUrl}
                    analytics={analyticsById.get(c.id)}
                    onStatusChange={handleStatusChange}
                    publicFormLabel={c.publicFormId ? formById.get(c.publicFormId)?.internalName : null}
                  />
                ))}
              </div>
            </details>
          )}
        </div>
      )}
    </div>
  );
}
