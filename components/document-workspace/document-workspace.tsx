"use client";

import * as React from "react";

import { WorkspaceDocumentCard } from "@/components/document-workspace/document-card";
import { DocumentPreviewSheet } from "@/components/document-workspace/document-preview";
import { VersionHistorySheet } from "@/components/document-workspace/version-history";
import { WorkspaceEmptyState } from "@/components/document-workspace/empty-states";
import { WorkspaceUploadButton } from "@/components/document-workspace/upload-button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { filterDocuments, searchDocuments, sortDocuments } from "@/lib/document-workspace/filter-sort";
import { workspaceDocKey } from "@/lib/document-workspace/normalize";
import { useSyncedState } from "@/lib/hooks/use-synced-state";
import { WORKSPACE_CATEGORIES } from "@/lib/document-workspace/types";
import type { DocumentEntityType } from "@/lib/documents/types";
import type { WorkspaceCategory, WorkspaceDocument, WorkspaceFilters, WorkspaceSort, WorkspaceStatus } from "@/lib/document-workspace/types";

const SORT_OPTIONS: { value: WorkspaceSort; label: string }[] = [
  { value: "recent", label: "Most Recent" },
  { value: "name", label: "Name" },
  { value: "relationship", label: "Relationship" },
  { value: "category", label: "Category" },
  { value: "created", label: "Created" },
  { value: "modified", label: "Modified" },
  { value: "status", label: "Status" },
];

const STATUS_OPTIONS: { value: WorkspaceStatus; label: string }[] = [
  { value: "action_needed", label: "Needs attention" },
  { value: "in_progress", label: "In progress" },
  { value: "complete", label: "Complete" },
  { value: "none", label: "No status" },
];

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function DocumentWorkspace({
  title,
  description,
  documents: documentsProp,
  initialPinnedKeys,
  initialRecentEntries,
  uploadTarget,
  pinningEnabled = true,
}: {
  title: string;
  description?: string;
  documents: WorkspaceDocument[];
  initialPinnedKeys: string[];
  /** [docKey, occurredAtIso][] — Map isn't serializable across the server/client boundary, so this crosses as an array and is rehydrated into a Map on mount. */
  initialRecentEntries: [string, string][];
  /** When set, renders the Workspace's upload affordance — every Relationship/Vendor Workspace entry point this replaces could already upload; omitted (as before) for the Global view, which never had one. */
  uploadTarget?: { entityType: DocumentEntityType; entityId: string; venueId: string };
  /** False for vendor-session contexts — document_workspace_pins is venue-tenant RLS, which a vendor session can't satisfy. Hides Pinned entirely rather than showing a section that can never populate. */
  pinningEnabled?: boolean;
}) {
  const [documents, setDocuments] = useSyncedState(documentsProp);
  const [query, setQuery] = React.useState("");
  const [category, setCategory] = React.useState<WorkspaceCategory | "all">("all");
  const [status, setStatus] = React.useState<WorkspaceStatus | "all">("all");
  const [sort, setSort] = React.useState<WorkspaceSort>("recent");
  const [pinnedKeys, setPinnedKeys] = React.useState<Set<string>>(new Set(initialPinnedKeys));
  const [previewDoc, setPreviewDoc] = React.useState<WorkspaceDocument | null>(null);
  const [previewOpen, setPreviewOpen] = React.useState(false);
  const [historyDoc, setHistoryDoc] = React.useState<WorkspaceDocument | null>(null);
  const [historyOpen, setHistoryOpen] = React.useState(false);

  const recentMap = React.useMemo(() => new Map(initialRecentEntries), [initialRecentEntries]);

  function openPreview(doc: WorkspaceDocument) { setPreviewDoc(doc); setPreviewOpen(true); }
  function openHistory(doc: WorkspaceDocument) { setHistoryDoc(doc); setHistoryOpen(true); }

  const filters: WorkspaceFilters = {
    category: category === "all" ? undefined : category,
    status: status === "all" ? undefined : status,
  };

  const filtered = sortDocuments(filterDocuments(searchDocuments(documents, query), filters), sort);
  const hasAnyFilterActive = query.trim() !== "" || category !== "all" || status !== "all";

  const pinned = documents.filter((d) => pinnedKeys.has(workspaceDocKey(d.docType, d.id)));
  const recent = [...documents]
    .filter((d) => recentMap.has(workspaceDocKey(d.docType, d.id)))
    .sort((a, b) => (recentMap.get(workspaceDocKey(b.docType, b.id))!).localeCompare(recentMap.get(workspaceDocKey(a.docType, a.id))!))
    .slice(0, 25);

  const categoryCounts = React.useMemo(() => {
    const counts = new Map<WorkspaceCategory, number>();
    for (const c of WORKSPACE_CATEGORIES) counts.set(c, 0);
    for (const d of documents) counts.set(d.category, (counts.get(d.category) ?? 0) + 1);
    return counts;
  }, [documents]);

  // Document Activity — derived from each document's own real facts
  // (created/updated/shared/signed). Per-document Viewed/Downloaded live in
  // the Preview panel's own Activity section (fetched on open, not
  // duplicated here across the whole scope).
  const activity = React.useMemo(() => {
    type Entry = { key: string; label: string; docName: string; occurredAt: string };
    const entries: Entry[] = [];
    for (const d of documents) {
      entries.push({ key: `${d.docType}-${d.id}-c`, label: d.docType === "document" ? "Uploaded" : "Generated", docName: d.name, occurredAt: d.createdAt });
      if (d.updatedAt !== d.createdAt) entries.push({ key: `${d.docType}-${d.id}-u`, label: "Edited", docName: d.name, occurredAt: d.updatedAt });
      if (d.signedAt) entries.push({ key: `${d.docType}-${d.id}-s`, label: "Signed", docName: d.name, occurredAt: d.signedAt });
    }
    return entries.sort((a, b) => b.occurredAt.localeCompare(a.occurredAt)).slice(0, 15);
  }, [documents]);

  function handlePinChange(key: string, next: boolean) {
    setPinnedKeys((prev) => {
      const copy = new Set(prev);
      if (next) copy.add(key); else copy.delete(key);
      return copy;
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="font-heading text-2xl font-medium text-heading">{title}</h1>
          {description && <p className="text-sm text-muted-foreground mt-0.5">{description}</p>}
        </div>
        {uploadTarget && (
          <WorkspaceUploadButton
            entityType={uploadTarget.entityType}
            entityId={uploadTarget.entityId}
            venueId={uploadTarget.venueId}
            onUploaded={(doc) => setDocuments((prev) => [doc, ...prev])}
          />
        )}
      </div>

      {documents.length === 0 ? (
        <WorkspaceEmptyState kind="no_documents" />
      ) : (
        <>
          {/* Pinned Documents */}
          {pinningEnabled && pinned.length > 0 && (
            <section className="space-y-2">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Pinned</h2>
              <div className="space-y-2">
                {pinned.map((d) => (
                  <WorkspaceDocumentCard key={workspaceDocKey(d.docType, d.id)} doc={d} pinned onOpenPreview={openPreview} onOpenVersionHistory={openHistory} onPinChange={(next) => handlePinChange(workspaceDocKey(d.docType, d.id), next)} pinningEnabled={pinningEnabled} />
                ))}
              </div>
            </section>
          )}

          {/* Recent Documents */}
          {recent.length > 0 && (
            <section className="space-y-2">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Recent</h2>
              <div className="space-y-2">
                {recent.map((d) => (
                  <WorkspaceDocumentCard key={workspaceDocKey(d.docType, d.id)} doc={d} pinned={pinnedKeys.has(workspaceDocKey(d.docType, d.id))} onOpenPreview={openPreview} onOpenVersionHistory={openHistory} onPinChange={(next) => handlePinChange(workspaceDocKey(d.docType, d.id), next)} pinningEnabled={pinningEnabled} />
                ))}
              </div>
            </section>
          )}

          {/* Document Categories */}
          <section className="space-y-2">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Categories</h2>
            <div className="flex flex-wrap gap-1.5">
              <button type="button" onClick={() => setCategory("all")}>
                <Badge variant={category === "all" ? "default" : "outline"}>All ({documents.length})</Badge>
              </button>
              {WORKSPACE_CATEGORIES.map((c) => (
                <button key={c} type="button" onClick={() => setCategory(c)}>
                  <Badge variant={category === c ? "default" : "outline"}>{c} ({categoryCounts.get(c) ?? 0})</Badge>
                </button>
              ))}
            </div>
          </section>

          {/* Search / Filter / Sort */}
          <section className="flex flex-wrap items-center gap-2">
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search documents…" className="max-w-xs" />
            <Select value={status} onValueChange={(v) => setStatus(v as WorkspaceStatus | "all")}>
              <SelectTrigger className="w-auto"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                {STATUS_OPTIONS.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={sort} onValueChange={(v) => setSort(v as WorkspaceSort)}>
              <SelectTrigger className="w-auto"><SelectValue /></SelectTrigger>
              <SelectContent>
                {SORT_OPTIONS.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </section>

          {/* All Documents */}
          <section className="space-y-2">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {category === "all" ? "All Documents" : category} ({filtered.length})
            </h2>
            {filtered.length === 0 ? (
              <WorkspaceEmptyState kind={hasAnyFilterActive ? "no_results" : "no_documents"} />
            ) : (
              <div className="space-y-2">
                {filtered.map((d) => (
                  <WorkspaceDocumentCard key={workspaceDocKey(d.docType, d.id)} doc={d} pinned={pinnedKeys.has(workspaceDocKey(d.docType, d.id))} onOpenPreview={openPreview} onOpenVersionHistory={openHistory} onPinChange={(next) => handlePinChange(workspaceDocKey(d.docType, d.id), next)} pinningEnabled={pinningEnabled} />
                ))}
              </div>
            )}
          </section>

          {/* Document Activity */}
          {activity.length > 0 && (
            <section className="space-y-2">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Activity</h2>
              <div className="rounded-sm border border-border divide-y divide-border">
                {activity.map((entry) => (
                  <div key={entry.key} className="flex items-center justify-between px-3 py-2 text-xs">
                    <span className="text-heading"><span className="font-medium">{entry.label}</span> · {entry.docName}</span>
                    <span className="text-muted-foreground">{fmtDate(entry.occurredAt)}</span>
                  </div>
                ))}
              </div>
            </section>
          )}
        </>
      )}

      <DocumentPreviewSheet doc={previewDoc} open={previewOpen} onOpenChange={setPreviewOpen} onOpenVersionHistory={openHistory} />
      <VersionHistorySheet doc={historyDoc} open={historyOpen} onOpenChange={setHistoryOpen} />
    </div>
  );
}
