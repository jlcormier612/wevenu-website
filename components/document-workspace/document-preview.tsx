"use client";

import * as React from "react";

import { Download, ExternalLink, History, Loader2, Share2, Upload } from "lucide-react";
import { toast } from "sonner";

import { WorkspaceCategoryBadge, WorkspaceStatusBadge } from "@/components/document-workspace/badges";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { downloadFile } from "@/lib/download-file";
import { formatBytes } from "@/lib/documents/constants";
import {
  downloadContractFinalPdfAction,
  downloadEventOrderPdfAction,
  getDocumentActivityAction,
  recordDocumentInteractionAction,
} from "@/lib/document-workspace/actions";
import { questionnaireStatusLabel } from "@/lib/events/questionnaire-constants";
import { computeVenuePermissions } from "@/lib/document-workspace/permissions";
import type { WorkspaceActivityEntry, WorkspaceDocument } from "@/lib/document-workspace/types";

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function fmtCurrency(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(n);
}

const ACTIVITY_LABEL: Record<WorkspaceActivityEntry["action"], string> = {
  generated: "Generated", uploaded: "Uploaded", edited: "Edited", shared: "Shared",
  viewed: "Viewed", signed: "Signed", downloaded: "Downloaded", archived: "Archived",
};

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  if (value === null || value === undefined || value === "") return null;
  return (
    <div className="flex items-center justify-between gap-3 py-1.5 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-heading font-medium text-right">{value}</span>
    </div>
  );
}

/** Step 4 — one Preview panel, every document renders the same sections. Type-specific facts live only inside "Details," never a new layout. */
export function DocumentPreviewSheet({
  doc,
  open,
  onOpenChange,
  onOpenVersionHistory,
}: {
  doc: WorkspaceDocument | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOpenVersionHistory: (doc: WorkspaceDocument) => void;
}) {
  const [activity, setActivity] = React.useState<WorkspaceActivityEntry[]>([]);
  const [loadingActivity, setLoadingActivity] = React.useState(false);
  const [downloading, setDownloading] = React.useState(false);
  const [replacing, setReplacing] = React.useState(false);
  const replaceRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (!open || !doc) return;
    setLoadingActivity(true);
    getDocumentActivityAction(doc).then(setActivity).finally(() => setLoadingActivity(false));
  }, [open, doc]);

  if (!doc) return null;
  const perms = computeVenuePermissions(doc);

  async function handleDownload() {
    if (!doc?.fileUrl) return;
    setDownloading(true);
    try {
      await downloadFile(doc.fileUrl, doc.name);
      void recordDocumentInteractionAction(doc.docType, doc.id, "downloaded");
    } catch {
      toast.error("Could not download this file.");
    } finally {
      setDownloading(false);
    }
  }

  async function handleFinalPdf() {
    if (!doc) return;
    setDownloading(true);
    try {
      const result = await downloadContractFinalPdfAction(doc.id);
      if (!result.ok) {
        toast.error(result.message ?? "Final PDF is not available yet.");
        return;
      }
      await downloadFile(result.url, `${doc.name}.pdf`);
      void recordDocumentInteractionAction(doc.docType, doc.id, "downloaded");
    } catch {
      toast.error("Could not download the Final PDF.");
    } finally {
      setDownloading(false);
    }
  }

  async function handleEventOrderPdf() {
    if (!doc) return;
    setDownloading(true);
    try {
      const result = await downloadEventOrderPdfAction(doc.id);
      if (!result.ok) {
        toast.error(result.message ?? "Shared PDF is not available yet.");
        return;
      }
      await downloadFile(result.url, `${doc.name}.pdf`);
      void recordDocumentInteractionAction(doc.docType, doc.id, "downloaded");
    } catch {
      toast.error("Could not download the Event Order PDF.");
    } finally {
      setDownloading(false);
    }
  }

  async function handleReplace(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !doc) return;
    setReplacing(true);
    try {
      const form = new FormData();
      form.set("file", file);
      const res = await fetch(`/api/documents/${doc.id}/replace`, { method: "POST", body: form });
      const json = await res.json().catch(() => ({ ok: false }));
      if (!json.ok) {
        toast.error(json.message ?? "Could not replace this file.");
        return;
      }
      toast.success("File replaced. Previous file kept in version history.");
    } catch {
      toast.error("Could not replace this file.");
    } finally {
      setReplacing(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader className="mb-2">
          <div className="flex items-center gap-2 flex-wrap">
            <SheetTitle>{doc.name}</SheetTitle>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <WorkspaceCategoryBadge category={doc.category} />
            <WorkspaceStatusBadge status={doc.status} experienceStatus={doc.experienceStatus} />
          </div>
        </SheetHeader>

        <div className="px-4 pb-6 space-y-6">
          {/* Metadata */}
          <section className="divide-y divide-border/60 border-y border-border/60">
            <Row label="Created" value={fmtDate(doc.createdAt)} />
            <Row label="Last updated" value={fmtDate(doc.updatedAt)} />
            {doc.fileSize != null && <Row label="File size" value={formatBytes(doc.fileSize)} />}
            {doc.mimeType && <Row label="File type" value={doc.mimeType} />}
          </section>

          {/* Version */}
          <section className="space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Version</h3>
            <div className="flex items-center justify-between">
              <span className="text-sm text-heading">Version {doc.currentVersion} (current)</span>
              <Button size="sm" variant="ghost" onClick={() => onOpenVersionHistory(doc)}>
                <History className="mr-1 h-3.5 w-3.5" />History
              </Button>
            </div>
          </section>

          {/* Relationship */}
          <section className="space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Relationship</h3>
            <Row label="Relationship" value={doc.relationshipName} />
            <Row label="Event" value={doc.eventName} />
            <Row label="Owner" value={doc.uploadedByType === "vendor" ? "Vendor" : "Venue"} />
            {doc.nextActionLabel && <Row label="Next" value={doc.nextActionLabel} />}
          </section>

          {/* Work Package D6 — this section header used to read
              "Representation," a Document Domain engineering term that had
              leaked straight into customer-facing UI. Renamed to "Details";
              still type-specific facts only, never a new layout. */}
          <section className="space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Details</h3>
            {doc.docType === "contract" && (
              <>
                <Row label="Contract status" value={doc.rawStatus} />
                <Row label="Version" value={`Version ${doc.currentVersion}`} />
                {doc.amendsContractId && (
                  <Row label="Based on" value={`Prior version (${doc.amendsContractId.slice(0, 8)}…)`} />
                )}
                {doc.signedAt && <Row label="Signed" value={fmtDate(doc.signedAt)} />}
                {doc.hasFinalArtifact ? (
                  <p className="text-xs text-muted-foreground">
                    Final PDF is the authoritative signed contract. This Documents row is a link to that artifact — not a second signed copy.
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Working contract record. The Final PDF becomes the authoritative artifact after finalize.
                  </p>
                )}
                {doc.signToken && (
                  <a href={`/sign/${doc.signToken}`} target="_blank" rel="noopener noreferrer" className="block">
                    <Button size="sm" variant="outline" className="mt-1">Open signing link</Button>
                  </a>
                )}
                <a href={`/contracts/${doc.id}`} className="block">
                  <Button size="sm" variant="ghost" className="mt-1">Open contract</Button>
                </a>
              </>
            )}
            {doc.docType === "invoice" && (
              <>
                <Row label="Total" value={doc.amount != null ? fmtCurrency(doc.amount) : null} />
                <Row label="Balance due" value={doc.balanceDue != null ? fmtCurrency(doc.balanceDue) : null} />
                <a href={`/invoices/${doc.id}`} className="block">
                  <Button size="sm" variant="ghost" className="mt-1">Open invoice</Button>
                </a>
              </>
            )}
            {doc.docType === "floor_plan" && (
              <>
                <p className="text-xs text-muted-foreground">Floor Plans remain the editor for this artifact. Documents is a link only.</p>
                {doc.producerHref && (
                  <a href={doc.producerHref} className="block">
                    <Button size="sm" variant="ghost" className="mt-1">Open floor plan</Button>
                  </a>
                )}
              </>
            )}
            {doc.docType === "questionnaire" && (
              <>
                <Row label="Questionnaire" value={questionnaireStatusLabel(doc.rawStatus ?? "")} />
                {doc.producerHref && (
                  <a href={doc.producerHref} className="block">
                    <Button size="sm" variant="ghost" className="mt-1">Open questionnaire</Button>
                  </a>
                )}
              </>
            )}
            {doc.docType === "event_order" && (
              <>
                <p className="text-xs text-muted-foreground">
                  Event Order lives on the event. Documents shows the working record and, when shared, the Final PDF link.
                </p>
                {doc.producerHref && (
                  <a href={doc.producerHref} className="block">
                    <Button size="sm" variant="ghost" className="mt-1">Open Event Order</Button>
                  </a>
                )}
              </>
            )}
            {doc.docType === "document" && (
              <>
                <Row label="Sharing" value={doc.isCoupleVisible ? "Shared with couple" : doc.isVendorVisible ? "Shared with vendors" : "Private"} />
                {doc.isCompanionUpload && (
                  <p className="text-xs text-muted-foreground">
                    Uploaded file — not the authoritative signed contract or Final PDF. Deleting this file does not change the contract.
                  </p>
                )}
              </>
            )}
          </section>

          {/* Activity */}
          <section className="space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Activity</h3>
            {loadingActivity ? (
              <p className="text-xs text-muted-foreground">Loading…</p>
            ) : activity.length === 0 ? (
              <p className="text-xs text-muted-foreground">No activity recorded yet.</p>
            ) : (
              <ul className="space-y-1.5">
                {activity.map((entry) => (
                  <li key={entry.id} className="flex items-center justify-between text-xs">
                    <span className="text-heading">{ACTIVITY_LABEL[entry.action]}</span>
                    <span className="text-muted-foreground">{fmtDate(entry.occurredAt)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Actions */}
          <section className="flex flex-wrap gap-2">
            {doc.producerHref && (
              <a href={doc.producerHref}>
                <Button size="sm" variant="outline"><ExternalLink className="mr-1 h-3.5 w-3.5" />Open</Button>
              </a>
            )}
            {!doc.producerHref && doc.fileUrl && (
              <a href={doc.fileUrl} target="_blank" rel="noopener noreferrer">
                <Button size="sm" variant="outline"><ExternalLink className="mr-1 h-3.5 w-3.5" />Open</Button>
              </a>
            )}
            {doc.docType === "document" && doc.fileUrl && (
              <Button size="sm" variant="outline" disabled={downloading} onClick={handleDownload}>
                {downloading ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Download className="mr-1 h-3.5 w-3.5" />}Download
              </Button>
            )}
            {doc.docType === "contract" && doc.hasFinalArtifact && (
              <Button size="sm" variant="outline" disabled={downloading} onClick={handleFinalPdf}>
                {downloading ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Download className="mr-1 h-3.5 w-3.5" />}Final PDF
              </Button>
            )}
            {doc.docType === "event_order" && doc.hasFinalArtifact && (
              <Button size="sm" variant="outline" disabled={downloading} onClick={handleEventOrderPdf}>
                {downloading ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Download className="mr-1 h-3.5 w-3.5" />}Shared PDF
              </Button>
            )}
            {doc.docType === "document" && (
              <>
                <input ref={replaceRef} type="file" className="sr-only" onChange={handleReplace} />
                <Button size="sm" variant="ghost" disabled={replacing} onClick={() => replaceRef.current?.click()}>
                  {replacing ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Upload className="mr-1 h-3.5 w-3.5" />}Replace file
                </Button>
              </>
            )}
            {perms.share && (
              <Button size="sm" variant="ghost" disabled>
                <Share2 className="mr-1 h-3.5 w-3.5" />{doc.isCoupleVisible || doc.isVendorVisible ? "Shared" : "Share from its own list"}
              </Button>
            )}
          </section>

          {/* Comments — future placeholder only, per the brief */}
          <section className="space-y-2 opacity-50">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Comments</h3>
            <p className="text-xs text-muted-foreground">Coming soon.</p>
          </section>
        </div>
      </SheetContent>
    </Sheet>
  );
}
