"use client";

import * as React from "react";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Archive, ArchiveRestore, Copy, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";

import {
  deletePipelineTemplateAction, duplicatePipelineTemplateAction, setPipelineTemplateActiveAction,
} from "@/app/(app)/library/pipeline-templates/actions";
import { LibraryAssetCard } from "@/components/library/library-asset-card";
import { LibraryDeleteConfirmDialog } from "@/components/library/library-delete-confirm-dialog";
import { LIBRARY_LABELS } from "@/components/library/labels";
import type { PipelineTemplate } from "@/lib/pipeline-templates/types";

export function PipelineTemplateList({ initialTemplates }: { initialTemplates: PipelineTemplate[] }) {
  const router = useRouter();
  const [templates, setTemplates] = React.useState(initialTemplates);
  const [pendingId, setPendingId] = React.useState<string | null>(null);
  const [deleting, setDeleting] = React.useState<PipelineTemplate | null>(null);
  const [deletePending, setDeletePending] = React.useState(false);

  async function handleToggleArchived(t: PipelineTemplate) {
    setPendingId(t.id);
    const result = await setPipelineTemplateActiveAction(t.id, !t.isActive);
    setPendingId(null);
    if (result.ok) {
      setTemplates((p) => p.map((x) => x.id === t.id ? { ...x, isActive: !t.isActive } : x));
      toast.success(t.isActive ? "Pipeline template archived." : "Pipeline template restored.");
    } else toast.error(result.message ?? "Could not update template.");
  }

  async function handleDuplicate(t: PipelineTemplate) {
    setPendingId(t.id);
    const result = await duplicatePipelineTemplateAction(t.id, `${t.name} (Copy)`);
    setPendingId(null);
    if (result.ok) {
      toast.success("Pipeline template duplicated.");
      router.push(`/library/pipeline-templates/${result.templateId}/edit`);
    } else toast.error(result.message ?? "Could not duplicate template.");
  }

  async function handleDeleteConfirmed() {
    if (!deleting) return;
    setDeletePending(true);
    const result = await deletePipelineTemplateAction(deleting.id);
    setDeletePending(false);
    if (result.ok) {
      toast.success("Pipeline template deleted.");
      setTemplates((p) => p.filter((x) => x.id !== deleting.id));
      setDeleting(null);
    } else toast.error(result.message ?? "Could not delete template.");
  }

  return (
    <div className="space-y-3">
      {templates.map((t) => (
        <LibraryAssetCard
          key={t.id}
          layout="row"
          title={t.name}
          description={t.description}
          meta={t.isActive ? "Active pipeline" : "Archived pipeline"}
          isArchived={!t.isActive}
          primaryActions={t.isActive
            ? [
                { id: "preview", label: LIBRARY_LABELS.preview, href: `/library/pipeline-templates/${t.id}/preview`, emphasis: "preview" },
                { id: "edit", label: LIBRARY_LABELS.edit, href: `/library/pipeline-templates/${t.id}/edit`, emphasis: "edit" },
              ]
            : [
                { id: "preview", label: LIBRARY_LABELS.preview, href: `/library/pipeline-templates/${t.id}/preview`, emphasis: "preview" },
                { id: "restore", label: LIBRARY_LABELS.restore, onClick: () => handleToggleArchived(t), emphasis: "edit", disabled: pendingId === t.id },
              ]}
          overflowPending={pendingId === t.id}
          overflowItems={t.isActive ? [
            {
              id: "duplicate",
              label: LIBRARY_LABELS.duplicate,
              onClick: () => handleDuplicate(t),
              icon: <Copy className="mr-2 h-3.5 w-3.5" />,
            },
            {
              id: "archive",
              label: LIBRARY_LABELS.archive,
              onClick: () => handleToggleArchived(t),
              icon: <Archive className="mr-2 h-3.5 w-3.5" />,
            },
            {
              id: "delete",
              label: LIBRARY_LABELS.delete,
              onClick: () => setDeleting(t),
              destructive: true,
              icon: <Trash2 className="mr-2 h-3.5 w-3.5" />,
            },
          ] : [
            {
              id: "restore",
              label: LIBRARY_LABELS.restore,
              onClick: () => handleToggleArchived(t),
              icon: <ArchiveRestore className="mr-2 h-3.5 w-3.5" />,
            },
            {
              id: "delete",
              label: LIBRARY_LABELS.delete,
              onClick: () => setDeleting(t),
              destructive: true,
              icon: <Trash2 className="mr-2 h-3.5 w-3.5" />,
            },
          ]}
        />
      ))}
      <LibraryDeleteConfirmDialog
        open={!!deleting}
        itemName={deleting?.name ?? ""}
        itemLabel="pipeline template"
        pending={deletePending}
        onConfirm={handleDeleteConfirmed}
        onCancel={() => setDeleting(null)}
      />
    </div>
  );
}
