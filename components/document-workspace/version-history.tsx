"use client";

import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import type { WorkspaceDocument, WorkspaceVersion } from "@/lib/document-workspace/types";

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
}

/**
 * Step 5 — every version history behaves identically. No producer in this
 * app carries a real multi-version chain today (Step 1 finding): this
 * builds the honest version list derivable from what each producer
 * actually stores — one "Version 1" entry, plus a second "Edited" entry
 * only when updatedAt genuinely differs from createdAt. Nothing further is
 * invented; a true version chain is Document Domain producer-integration
 * work, out of this phase's scope.
 */
function buildVersions(doc: WorkspaceDocument): WorkspaceVersion[] {
  const versions: WorkspaceVersion[] = [
    {
      versionNumber: 1,
      createdBy: doc.uploadedByType === "vendor" ? "Vendor" : "Venue",
      createdAt: doc.createdAt,
      reason: doc.docType === "document" ? "Uploaded" : "Created",
      current: doc.updatedAt === doc.createdAt,
      locked: doc.status === "complete",
      representation: doc.fileUrl ? "File" : "Record",
    },
  ];
  if (doc.updatedAt !== doc.createdAt) {
    versions.push({
      versionNumber: 2,
      createdBy: doc.uploadedByType === "vendor" ? "Vendor" : "Venue",
      createdAt: doc.updatedAt,
      reason: "Edited",
      current: true,
      locked: doc.status === "complete",
      representation: doc.fileUrl ? "File" : "Record",
    });
  }
  return versions.sort((a, b) => b.versionNumber - a.versionNumber);
}

export function VersionHistorySheet({
  doc,
  open,
  onOpenChange,
}: {
  doc: WorkspaceDocument | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const versions = doc ? buildVersions(doc) : [];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-sm">
        <SheetHeader className="mb-4">
          <SheetTitle>Version History{doc ? ` — ${doc.name}` : ""}</SheetTitle>
        </SheetHeader>
        <div className="px-4 pb-4 space-y-2 overflow-y-auto">
          {versions.map((v) => (
            <div key={v.versionNumber} className="rounded-sm border border-border p-3 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-heading">Version {v.versionNumber}</span>
                <div className="flex gap-1">
                  {v.current && <Badge variant="success">Current</Badge>}
                  {v.locked && <Badge variant="muted">Locked</Badge>}
                </div>
              </div>
              <p className="text-xs text-muted-foreground">{v.createdBy} · {fmtDate(v.createdAt)}</p>
              <p className="text-xs text-muted-foreground">{v.reason} · {v.representation}</p>
            </div>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}
