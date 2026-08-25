"use client";

/**
 * Message Templates list — active Primary Edit; Archived Preview/Restore (edit only).
 * Templates never send from the Library list — send happens in Messaging with confirmation.
 */

import * as React from "react";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Archive, ArchiveRestore, Copy, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

import {
  deleteTemplateAction, duplicateTemplateAction, setTemplateArchivedAction,
} from "@/app/(app)/communication/templates/actions";
import { LIBRARY_LABELS, archiveToggleLabel } from "@/components/library/labels";
import { LibraryArchivedSection } from "@/components/library/library-archived-section";
import { LibraryAssetCard } from "@/components/library/library-asset-card";
import { LibraryDeleteConfirmDialog } from "@/components/library/library-delete-confirm-dialog";
import { partitionArchived } from "@/components/library/partition-archived";
import { Badge } from "@/components/ui/badge";
import { categoryLabel } from "@/lib/message-templates/constants";
import type { MessageTemplate } from "@/lib/message-templates/types";

export function MessageTemplateList({ initialTemplates }: { initialTemplates: MessageTemplate[] }) {
  const router = useRouter();
  const [templates, setTemplates] = React.useState(initialTemplates);
  const [pendingId, setPendingId] = React.useState<string | null>(null);
  const [deleting, setDeleting] = React.useState<MessageTemplate | null>(null);
  const [deletePending, setDeletePending] = React.useState(false);

  React.useEffect(() => { setTemplates(initialTemplates); }, [initialTemplates]);

  const { active, archived } = partitionArchived(templates, (t) => t.isArchived);

  async function handleToggleArchived(t: MessageTemplate) {
    setPendingId(t.id);
    const result = await setTemplateArchivedAction(t.id, !t.isArchived);
    setPendingId(null);
    if (result.ok) {
      setTemplates((p) => p.map((x) => x.id === t.id ? { ...x, isArchived: !t.isArchived } : x));
      toast.success(t.isArchived ? "Template restored." : "Template archived.");
    } else toast.error(result.message ?? "Could not update template.");
  }

  async function handleDuplicate(t: MessageTemplate) {
    setPendingId(t.id);
    const result = await duplicateTemplateAction(t.id, `${t.name} (Copy)`);
    setPendingId(null);
    if (result.ok) { toast.success("Template duplicated."); router.push(`/communication/templates/${result.templateId}/edit`); }
    else toast.error(result.message ?? "Could not duplicate template.");
  }

  async function handleDeleteConfirmed() {
    if (!deleting) return;
    setDeletePending(true);
    const result = await deleteTemplateAction(deleting.id);
    setDeletePending(false);
    if (result.ok) {
      toast.success("Template deleted.");
      setTemplates((p) => p.filter((x) => x.id !== deleting.id));
      setDeleting(null);
    } else {
      toast.error(result.message ?? "Could not delete template.");
    }
  }

  function cardFor(t: MessageTemplate, archivedView: boolean) {
    return (
      <LibraryAssetCard
        key={t.id}
        title={t.name}
        description={categoryLabel(t.category)}
        isStarter={Boolean(t.sourceMasterKey)}
        isArchived={t.isArchived}
        badges={
          <>
            {t.emailBody && <Badge variant="muted" className="text-[10px]">Email</Badge>}
            {t.smsBody && <Badge variant="muted" className="text-[10px]">SMS</Badge>}
          </>
        }
        primaryActions={archivedView
          ? [
              { id: "edit", label: LIBRARY_LABELS.edit, href: `/communication/templates/${t.id}/edit`, emphasis: "edit" },
              { id: "restore", label: LIBRARY_LABELS.restore, onClick: () => handleToggleArchived(t), emphasis: "edit" },
            ]
          : [
              { id: "edit", label: LIBRARY_LABELS.edit, href: `/communication/templates/${t.id}/edit`, emphasis: "edit" },
            ]}
        overflowPending={pendingId === t.id}
        overflowItems={archivedView ? [] : [
          {
            id: "edit",
            label: LIBRARY_LABELS.edit,
            href: `/communication/templates/${t.id}/edit`,
            icon: <Pencil className="mr-2 h-3.5 w-3.5" />,
          },
          {
            id: "duplicate",
            label: LIBRARY_LABELS.duplicate,
            onClick: () => handleDuplicate(t),
            icon: <Copy className="mr-2 h-3.5 w-3.5" />,
          },
          {
            id: "archive",
            label: archiveToggleLabel(t.isArchived),
            onClick: () => handleToggleArchived(t),
            icon: t.isArchived
              ? <ArchiveRestore className="mr-2 h-3.5 w-3.5" />
              : <Archive className="mr-2 h-3.5 w-3.5" />,
          },
          {
            id: "delete",
            label: LIBRARY_LABELS.delete,
            onClick: () => setDeleting(t),
            destructive: true,
            separatorBefore: true,
            icon: <Trash2 className="mr-2 h-3.5 w-3.5" />,
          },
        ]}
      />
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Editing a template never sends a message. Send from Messaging after you review the draft.
      </p>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {active.map((t) => cardFor(t, false))}
      </div>
      {active.length === 0 && (
        <p className="text-sm text-muted-foreground">
          No active templates.{" "}
          <Link href="/communication/templates/new" className="underline hover:text-foreground">
            Create one
          </Link>
          .
        </p>
      )}
      <LibraryArchivedSection count={archived.length}>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {archived.map((t) => cardFor(t, true))}
        </div>
      </LibraryArchivedSection>
      <LibraryDeleteConfirmDialog
        open={!!deleting}
        itemName={deleting?.name ?? ""}
        itemLabel="template"
        pending={deletePending}
        onConfirm={handleDeleteConfirmed}
        onCancel={() => setDeleting(null)}
      />
    </div>
  );
}
