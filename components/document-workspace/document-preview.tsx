"use client";

import * as React from "react";

import { Download, ExternalLink, History, Loader2, Share2 } from "lucide-react";
import { toast } from "sonner";

import { WorkspaceCategoryBadge, WorkspaceStatusBadge } from "@/components/document-workspace/badges";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { downloadFile } from "@/lib/download-file";
import { formatBytes } from "@/lib/documents/constants";
import { getDocumentActivityAction, recordDocumentInteractionAction } from "@/lib/document-workspace/actions";
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

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader className="mb-2">
          <div className="flex items-center gap-2 flex-wrap">
            <SheetTitle>{doc.name}</SheetTitle>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <WorkspaceCategoryBadge category={doc.category} />
            <WorkspaceStatusBadge status={doc.status} />
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
          </section>

          {/* Work Package D6 — this section header used to read
              "Representation," a Document Domain engineering term that had
              leaked straight into customer-facing UI. Renamed to "Details";
              still type-specific facts only, never a new layout. */}
          <section className="space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Details</h3>
            {doc.docType === "contract" && (
              <>
                <Row label="Status" value={doc.rawStatus} />
                {doc.signedAt && <Row label="Signed" value={fmtDate(doc.signedAt)} />}
                {doc.signToken && (
                  <a href={`/sign/${doc.signToken}`} target="_blank" rel="noopener noreferrer" className="block">
                    <Button size="sm" variant="outline" className="mt-1">Open signing link</Button>
                  </a>
                )}
              </>
            )}
            {doc.docType === "invoice" && (
              <>
                <Row label="Total" value={doc.amount != null ? fmtCurrency(doc.amount) : null} />
                <Row label="Balance due" value={doc.balanceDue != null ? fmtCurrency(doc.balanceDue) : null} />
              </>
            )}
            {doc.docType === "floor_plan" && <Row label="Background reference" value={doc.fileUrl ? "Attached" : "None"} />}
            {doc.docType === "questionnaire" && <Row label="Status" value={doc.rawStatus} />}
            {doc.docType === "document" && <Row label="Sharing" value={doc.isCoupleVisible ? "Shared with couple" : doc.isVendorVisible ? "Shared with vendors" : "Private"} />}
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
            {doc.fileUrl && (
              <a href={doc.fileUrl} target="_blank" rel="noopener noreferrer">
                <Button size="sm" variant="outline"><ExternalLink className="mr-1 h-3.5 w-3.5" />Open</Button>
              </a>
            )}
            {perms.download && (
              <Button size="sm" variant="outline" disabled={downloading} onClick={handleDownload}>
                {downloading ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Download className="mr-1 h-3.5 w-3.5" />}Download
              </Button>
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
