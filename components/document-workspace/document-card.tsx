"use client";

import * as React from "react";

import {
  ClipboardList, Download, Eye, ExternalLink, FileSignature, FileText,
  Loader2, MapPin, MoreHorizontal, Receipt, Share2, Star, History,
} from "lucide-react";
import { toast } from "sonner";

import { WorkspaceCategoryBadge, WorkspaceStatusBadge } from "@/components/document-workspace/badges";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { downloadFile } from "@/lib/download-file";
import { formatBytes } from "@/lib/documents/constants";
import { pinDocumentAction, recordDocumentInteractionAction, unpinDocumentAction } from "@/lib/document-workspace/actions";
import type { WorkspaceDocument } from "@/lib/document-workspace/types";
import { computeVenuePermissions } from "@/lib/document-workspace/permissions";

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function DocIcon({ doc }: { doc: WorkspaceDocument }) {
  const cls = "h-4 w-4";
  switch (doc.docType) {
    case "contract": return <FileSignature className={cls} />;
    case "invoice": return <Receipt className={cls} />;
    case "questionnaire": return <ClipboardList className={cls} />;
    case "floor_plan": return <MapPin className={cls} />;
    default: return <FileText className={cls} />;
  }
}

function ownerLabel(doc: WorkspaceDocument): string {
  return doc.uploadedByType === "vendor" ? "Vendor" : "Venue";
}

function relationshipLabel(doc: WorkspaceDocument): string | null {
  return doc.relationshipName ?? doc.eventName ?? null;
}

export function WorkspaceDocumentCard({
  doc,
  pinned,
  onOpenPreview,
  onOpenVersionHistory,
  onPinChange,
  pinningEnabled = true,
}: {
  doc: WorkspaceDocument;
  pinned: boolean;
  onOpenPreview: (doc: WorkspaceDocument) => void;
  onOpenVersionHistory: (doc: WorkspaceDocument) => void;
  onPinChange?: (pinned: boolean) => void;
  /** Pinned Documents is venue-tenant state (document_workspace_pins is RLS-scoped to current_user_venue_id()) — a vendor session has no venue_id, so pinning cannot function there. False hides the control rather than surfacing an action that would just fail. */
  pinningEnabled?: boolean;
}) {
  const [pinBusy, startPin] = React.useTransition();
  const [isPinned, setIsPinned] = React.useState(pinned);
  const [downloading, setDownloading] = React.useState(false);
  const perms = computeVenuePermissions(doc);

  React.useEffect(() => setIsPinned(pinned), [pinned]);

  function togglePin() {
    startPin(async () => {
      const result = isPinned
        ? await unpinDocumentAction(doc.docType, doc.id)
        : await pinDocumentAction(doc.docType, doc.id);
      if (result.ok) {
        const next = !isPinned;
        setIsPinned(next);
        onPinChange?.(next);
      } else toast.error(result.message ?? "Could not update pin.");
    });
  }

  function handlePreview() {
    void recordDocumentInteractionAction(doc.docType, doc.id, "viewed");
    onOpenPreview(doc);
  }

  function handleOpen() {
    void recordDocumentInteractionAction(doc.docType, doc.id, "viewed");
    if (doc.fileUrl) window.open(doc.fileUrl, "_blank", "noopener,noreferrer");
    else onOpenPreview(doc);
  }

  async function handleDownload() {
    if (!doc.fileUrl) return;
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

  const relationship = relationshipLabel(doc);

  return (
    <div className="group flex items-start gap-3 rounded-sm border border-border bg-card px-4 py-3 hover:bg-muted/20 transition-colors">
      <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
        <DocIcon doc={doc} />
      </div>

      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <button type="button" onClick={handlePreview} className="text-sm font-medium text-heading truncate hover:underline text-left">
            {doc.name}
          </button>
          <WorkspaceCategoryBadge category={doc.category} />
          <WorkspaceStatusBadge status={doc.status} />
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
          {relationship && <span>{relationship}</span>}
          <span>v{doc.currentVersion}</span>
          <span>Updated {fmtDate(doc.updatedAt)}</span>
          <span>{ownerLabel(doc)}</span>
          {doc.fileSize != null && <span>{formatBytes(doc.fileSize)}</span>}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-0.5">
        {pinningEnabled && (
          <button
            type="button"
            onClick={togglePin}
            disabled={pinBusy}
            aria-label={isPinned ? "Unpin" : "Pin"}
            title={isPinned ? "Pinned — click to unpin" : "Pin to keep this always visible"}
            className={`rounded p-1.5 hover:bg-muted ${isPinned ? "text-warning-foreground" : "text-muted-foreground opacity-0 group-hover:opacity-100"}`}
          >
            {pinBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Star className={`h-3.5 w-3.5 ${isPinned ? "fill-current" : ""}`} />}
          </button>
        )}

        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <button type="button" onClick={handleOpen} className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground" aria-label="Open">
            <ExternalLink className="h-3.5 w-3.5" />
          </button>
          <button type="button" onClick={handlePreview} className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground" aria-label="Preview">
            <Eye className="h-3.5 w-3.5" />
          </button>
          {perms.share && (
            <button type="button" onClick={handlePreview} className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground" aria-label="Share">
              <Share2 className="h-3.5 w-3.5" />
            </button>
          )}
          {perms.download && (
            <button type="button" onClick={handleDownload} disabled={downloading} className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground" aria-label="Download">
              {downloading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
            </button>
          )}
          <button type="button" onClick={() => onOpenVersionHistory(doc)} className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground" aria-label="Version History">
            <History className="h-3.5 w-3.5" />
          </button>
          <DropdownMenu>
            <DropdownMenuTrigger render={
              <button type="button" className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground" aria-label="More">
                <MoreHorizontal className="h-3.5 w-3.5" />
              </button>
            } />
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handlePreview}>View details</DropdownMenuItem>
              {perms.edit && <DropdownMenuItem disabled>Edit (from its own list)</DropdownMenuItem>}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  );
}
