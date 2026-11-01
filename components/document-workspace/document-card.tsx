"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import {
  ClipboardList, Download, Eye, ExternalLink, FileSignature, FileText, Info,
  Loader2, MapPin, MoreHorizontal, Receipt, Share2, Star, History, ListOrdered,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import { WorkspaceCategoryBadge, WorkspaceStatusBadge } from "@/components/document-workspace/badges";
import { LibraryDeleteConfirmDialog } from "@/components/library/library-delete-confirm-dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { deleteDocumentAction } from "@/app/(app)/documents/actions";
import { deleteLibraryDocumentAction } from "@/app/(app)/library/documents/actions";
import { downloadFile } from "@/lib/download-file";
import { formatBytes } from "@/lib/documents/constants";
import type { DocumentEntityType } from "@/lib/documents/types";
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
    case "event_order": return <ListOrdered className={cls} />;
    default: return <FileText className={cls} />;
  }
}

function ownerLabel(doc: WorkspaceDocument): string {
  return doc.originLabel ?? (doc.uploadedByType === "vendor" ? "Vendor" : "Venue");
}

function relationshipLabel(doc: WorkspaceDocument): string | null {
  return doc.relationshipName ?? doc.eventName ?? null;
}

function resolveEntity(doc: WorkspaceDocument): { type: DocumentEntityType; id: string } | null {
  if (doc.eventId) return { type: "event", id: doc.eventId };
  if (doc.clientId) return { type: "client", id: doc.clientId };
  if (doc.leadId) return { type: "lead", id: doc.leadId };
  if (doc.vendorId) return { type: "vendor", id: doc.vendorId };
  return null;
}

export function WorkspaceDocumentCard({
  doc,
  pinned,
  onOpenPreview,
  onOpenView,
  onOpenVersionHistory,
  onPinChange,
  pinningEnabled = true,
  onDeleted,
}: {
  doc: WorkspaceDocument;
  pinned: boolean;
  onOpenPreview: (doc: WorkspaceDocument) => void;
  /** Opens the readable document; the details panel stays on Details. */
  onOpenView: (doc: WorkspaceDocument) => void;
  onOpenVersionHistory: (doc: WorkspaceDocument) => void;
  onPinChange?: (pinned: boolean) => void;
  /** Pinned Documents is venue-tenant state (document_workspace_pins is RLS-scoped to current_user_venue_id()) — a vendor session has no venue_id, so pinning cannot function there. False hides the control rather than surfacing an action that would just fail. */
  pinningEnabled?: boolean;
  onDeleted?: (doc: WorkspaceDocument) => void;
}) {
  const router = useRouter();
  const [pinBusy, startPin] = React.useTransition();
  const [isPinned, setIsPinned] = React.useState(pinned);
  const [downloading, setDownloading] = React.useState(false);
  const [confirmDelete, setConfirmDelete] = React.useState(false);
  const [deletePending, setDeletePending] = React.useState(false);
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

  function handleView() {
    void recordDocumentInteractionAction(doc.docType, doc.id, "viewed");
    onOpenView(doc);
  }

  function handleOpen() {
    void recordDocumentInteractionAction(doc.docType, doc.id, "viewed");
    if (doc.producerHref) window.location.assign(doc.producerHref);
    else if (doc.fileUrl) window.open(doc.fileUrl, "_blank", "noopener,noreferrer");
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

  async function confirmDeleteDocument() {
    setDeletePending(true);
    const entity = resolveEntity(doc);
    const result = entity
      ? await deleteDocumentAction(doc.id, entity.type, entity.id)
      : await deleteLibraryDocumentAction(doc.id);
    setDeletePending(false);
    if (!result.ok) {
      toast.error(result.message ?? "Could not delete this document.");
      return;
    }
    setConfirmDelete(false);
    toast.success("Document deleted.");
    onDeleted?.(doc);
    router.refresh();
  }

  const relationship = relationshipLabel(doc);

  return (
    <div className="group flex items-start gap-3 rounded-sm border border-border bg-card px-4 py-3 hover:bg-muted/20 transition-colors">
      <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
        <DocIcon doc={doc} />
      </div>

      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <button type="button" onClick={handleView} className="text-sm font-medium text-heading truncate hover:underline text-left" data-testid="workspace-doc-title">
            {doc.name}
          </button>
          <WorkspaceCategoryBadge category={doc.category} />
          <WorkspaceStatusBadge status={doc.status} experienceStatus={doc.experienceStatus} docType={doc.docType} />
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
          {relationship && <span className="truncate max-w-[14rem]">{relationship}</span>}
          {doc.eventName && doc.eventName !== relationship && (
            <span className="truncate max-w-[14rem]">{doc.eventName}</span>
          )}
          {doc.docType === "invoice" && doc.invoiceNumber && (
            <span className="tabular-nums">{doc.invoiceNumber}</span>
          )}
          {doc.nextActionLabel && <span className="text-heading">{doc.nextActionLabel}</span>}
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
            className={`rounded p-1.5 hover:bg-muted ${isPinned ? "text-warning-foreground" : "text-muted-foreground sm:opacity-0 sm:group-hover:opacity-100"}`}
          >
            {pinBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Star className={`h-3.5 w-3.5 ${isPinned ? "fill-current" : ""}`} />}
          </button>
        )}

        <div className="flex items-center gap-0.5 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
          <button type="button" onClick={handleOpen} className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground" aria-label="Open">
            <ExternalLink className="h-3.5 w-3.5" />
          </button>
          <button type="button" onClick={handleView} className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground" aria-label="View">
            <Eye className="h-3.5 w-3.5" />
          </button>
          <button type="button" onClick={handlePreview} className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground" aria-label="Details">
            <Info className="h-3.5 w-3.5" />
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
              {perms.delete && (
                <DropdownMenuItem
                  variant="destructive"
                  data-testid="workspace-doc-delete"
                  onClick={() => setConfirmDelete(true)}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <LibraryDeleteConfirmDialog
        open={confirmDelete}
        itemName={doc.name}
        itemLabel="document"
        permanent
        pending={deletePending}
        onConfirm={() => void confirmDeleteDocument()}
        onCancel={() => { if (!deletePending) setConfirmDelete(false); }}
      />
    </div>
  );
}
