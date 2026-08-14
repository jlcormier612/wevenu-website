import { FolderOpen, Loader2, SearchX, ShieldOff } from "lucide-react";

/** Step 10 — exactly four, no custom empty states anywhere else in the workspace. */
export type WorkspaceEmptyStateKind = "no_documents" | "no_results" | "no_permission" | "loading";

const META: Record<WorkspaceEmptyStateKind, { icon: React.ElementType; title: string; body: string }> = {
  no_documents: { icon: FolderOpen, title: "No documents yet", body: "Contracts, invoices, and files will appear here as they're created or shared." },
  no_results:   { icon: SearchX,    title: "No results",       body: "Try a different search term or clear your filters." },
  no_permission:{ icon: ShieldOff,  title: "No permission",    body: "You don't have access to view documents here." },
  loading:      { icon: Loader2,    title: "Loading…",         body: "" },
};

export function WorkspaceEmptyState({ kind }: { kind: WorkspaceEmptyStateKind }) {
  const meta = META[kind];
  const Icon = meta.icon;
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-sm border border-dashed border-border py-16 text-center">
      <Icon className={`h-8 w-8 text-muted-foreground ${kind === "loading" ? "animate-spin" : ""}`} />
      <p className="text-sm font-medium text-heading">{meta.title}</p>
      {meta.body && <p className="text-xs text-muted-foreground max-w-xs">{meta.body}</p>}
    </div>
  );
}
