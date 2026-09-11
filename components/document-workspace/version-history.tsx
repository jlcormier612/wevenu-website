"use client";

import * as React from "react";
import Link from "next/link";

import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { getWorkspaceFileVersionsAction } from "@/lib/document-workspace/actions";
import type { WorkspaceDocument, WorkspaceVersion } from "@/lib/document-workspace/types";

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
}

/**
 * Version History — prefer real producer lineage (contracts via amends_contract_id).
 * Do not invent Version 2 from createdAt/updatedAt timestamps.
 */
function buildVersions(doc: WorkspaceDocument): WorkspaceVersion[] {
  if (doc.versionFamily && doc.versionFamily.length > 0) {
    return [...doc.versionFamily].sort((a, b) => b.versionNumber - a.versionNumber);
  }
  if (doc.isCompanionUpload) {
    return [
      {
        versionNumber: 1,
        createdBy: doc.uploadedByType === "vendor" ? "Vendor" : "Venue",
        createdAt: doc.createdAt,
        reason: "Uploaded file (not the authoritative signed contract)",
        current: true,
        locked: false,
        representation: "File",
      },
    ];
  }
  return [
    {
      versionNumber: doc.currentVersion || 1,
      createdBy: doc.uploadedByType === "vendor" ? "Vendor" : "Venue",
      createdAt: doc.createdAt,
      reason: doc.docType === "document" ? "Uploaded" : "Created",
      current: true,
      locked: doc.status === "complete",
      representation: doc.fileUrl ? "File" : "Record",
    },
  ];
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
  const [fileVersions, setFileVersions] = React.useState<WorkspaceVersion[] | null>(null);

  React.useEffect(() => {
    if (!open || !doc || doc.docType !== "document") {
      setFileVersions(null);
      return;
    }
    getWorkspaceFileVersionsAction(doc).then(setFileVersions).catch(() => setFileVersions(null));
  }, [open, doc]);

  const versions = fileVersions && fileVersions.length > 0
    ? fileVersions
    : doc
      ? buildVersions(doc)
      : [];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-sm">
        <SheetHeader className="mb-4">
          <SheetTitle>Version History{doc ? ` — ${doc.name}` : ""}</SheetTitle>
        </SheetHeader>
        <div className="px-4 pb-4 space-y-2 overflow-y-auto">
          {doc?.isCompanionUpload && (
            <p className="text-xs text-muted-foreground mb-2">
              This is an uploaded file. The authoritative signed contract lives on the Contracts record / Final PDF when present.
            </p>
          )}
          {versions.map((v) => (
            <div key={`${v.versionNumber}-${v.createdAt}`} className="rounded-sm border border-border p-3 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-heading">Version {v.versionNumber}</span>
                <div className="flex gap-1">
                  {v.current && <Badge variant="success">Current</Badge>}
                  {v.locked && <Badge variant="muted">Locked</Badge>}
                </div>
              </div>
              <p className="text-xs text-muted-foreground">{v.createdBy} · {fmtDate(v.createdAt)}</p>
              <p className="text-xs text-muted-foreground">{v.reason} · {v.representation}</p>
              {v.href && (
                <Link href={v.href} className="text-xs underline text-muted-foreground hover:text-foreground">
                  Open this version
                </Link>
              )}
            </div>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}
