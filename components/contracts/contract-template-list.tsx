"use client";

/**
 * Contract Templates list — Customize for HTC starters; Edit/Duplicate for venue-owned.
 * Use Template creates a draft. Add another copy re-provisions a fresh CTR-01 starter.
 */

import * as React from "react";

import { useRouter } from "next/navigation";
import {
  Archive, ArchiveRestore, BookPlus, Copy, Loader2, Pencil, Trash2,
} from "lucide-react";
import { toast } from "sonner";

import {
  addContractStarterAgainAction,
  deleteTemplateAction,
  duplicateTemplateAction,
  setTemplateArchivedAction,
} from "@/app/(app)/contracts/actions";
import { LIBRARY_LABELS, archiveToggleLabel } from "@/components/library/labels";
import { LibraryArchivedSection } from "@/components/library/library-archived-section";
import { LibraryAssetCard } from "@/components/library/library-asset-card";
import { LibraryDeleteConfirmDialog } from "@/components/library/library-delete-confirm-dialog";
import { partitionArchived } from "@/components/library/partition-archived";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatRelative } from "@/lib/leads/constants";
import type { ContractTemplate } from "@/lib/contracts/types";

export function ContractTemplateList({
  initialTemplates,
  showAddStarter = true,
}: {
  initialTemplates: ContractTemplate[];
  showAddStarter?: boolean;
}) {
  const router = useRouter();
  const [templates, setTemplates] = React.useState(initialTemplates);
  const [pendingId, setPendingId] = React.useState<string | null>(null);
  const [deleting, setDeleting] = React.useState<ContractTemplate | null>(null);
  const [deletePending, setDeletePending] = React.useState(false);
  const [addingStarter, startAddStarter] = React.useTransition();

  React.useEffect(() => { setTemplates(initialTemplates); }, [initialTemplates]);

  const { active, archived } = partitionArchived(templates, (t) => t.isArchived);

  async function handleToggleArchived(t: ContractTemplate) {
    setPendingId(t.id);
    const result = await setTemplateArchivedAction(t.id, !t.isArchived);
    setPendingId(null);
    if (result.ok) {
      setTemplates((p) => p.map((x) => x.id === t.id ? { ...x, isArchived: !t.isArchived } : x));
      toast.success(t.isArchived ? "Template restored." : "Template archived.");
    } else toast.error(result.message ?? "Could not update template.");
  }

  async function handleDuplicate(t: ContractTemplate) {
    setPendingId(t.id);
    const result = await duplicateTemplateAction(t.id, `${t.name} (Copy)`);
    setPendingId(null);
    if (result.ok) { toast.success("Template duplicated."); router.push(`/contracts/templates/${result.templateId}/edit`); }
    else toast.error(result.message ?? "Could not duplicate template.");
  }

  async function handleCustomize(t: ContractTemplate) {
    setPendingId(t.id);
    const suggested = t.name.replace(/\s*\(Starter\)\s*$/i, "").trim() || t.name;
    const result = await duplicateTemplateAction(t.id, `${suggested} — ${new Date().getFullYear()}`);
    setPendingId(null);
    if (result.ok && result.templateId) {
      toast.success("Created your venue’s copy. The original starter is unchanged.");
      router.push(`/contracts/templates/${result.templateId}/edit`);
    } else {
      toast.error((result as { message?: string }).message ?? "Could not create a copy.");
    }
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

  function cardFor(t: ContractTemplate, archivedView: boolean) {
    const isStarter = Boolean(t.sourceMasterKey);
    const primaryActions = archivedView
      ? [
          { id: "preview", label: LIBRARY_LABELS.preview, href: `/contracts/templates/${t.id}/preview`, emphasis: "preview" as const },
          { id: "restore", label: LIBRARY_LABELS.restore, onClick: () => handleToggleArchived(t), emphasis: "edit" as const },
        ]
      : isStarter
        ? [
            { id: "preview", label: LIBRARY_LABELS.preview, href: `/contracts/templates/${t.id}/preview`, emphasis: "preview" as const },
            {
              id: "customize",
              label: LIBRARY_LABELS.customize,
              onClick: () => handleCustomize(t),
              emphasis: "edit" as const,
              disabled: pendingId === t.id,
            },
            { id: "use", label: LIBRARY_LABELS.useTemplate, href: `/contracts/new?templateId=${t.id}`, emphasis: "use" as const },
          ]
        : [
            { id: "preview", label: LIBRARY_LABELS.preview, href: `/contracts/templates/${t.id}/preview`, emphasis: "preview" as const },
            { id: "edit", label: LIBRARY_LABELS.edit, href: `/contracts/templates/${t.id}/edit`, emphasis: "edit" as const },
            { id: "use", label: LIBRARY_LABELS.useTemplate, href: `/contracts/new?templateId=${t.id}`, emphasis: "use" as const },
          ];

    return (
      <LibraryAssetCard
        key={t.id}
        title={t.name}
        description={t.description}
        meta={`Updated ${formatRelative(t.updatedAt)}`}
        isStarter={isStarter}
        isArchived={t.isArchived}
        className={t.isDefault ? "border-primary/30" : undefined}
        badges={
          <>
            {!isStarter && !t.isArchived && (
              <Badge variant="outline" className="text-[10px]">{LIBRARY_LABELS.yourTemplate}</Badge>
            )}
            {t.isDefault ? <Badge variant="default" className="text-[10px]">Default</Badge> : null}
          </>
        }
        primaryActions={primaryActions}
        overflowPending={pendingId === t.id}
        overflowItems={archivedView ? [] : [
          ...(!isStarter
            ? [
                {
                  id: "edit",
                  label: LIBRARY_LABELS.edit,
                  href: `/contracts/templates/${t.id}/edit`,
                  icon: <Pencil className="mr-2 h-3.5 w-3.5" />,
                },
                {
                  id: "duplicate",
                  label: LIBRARY_LABELS.duplicate,
                  onClick: () => handleDuplicate(t),
                  icon: <Copy className="mr-2 h-3.5 w-3.5" />,
                },
              ]
            : []),
          {
            id: "archive",
            label: archiveToggleLabel(t.isArchived),
            onClick: () => handleToggleArchived(t),
            icon: t.isArchived ? <ArchiveRestore className="mr-2 h-3.5 w-3.5" /> : <Archive className="mr-2 h-3.5 w-3.5" />,
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
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          Customize a Hello to Cheers starter to create your venue’s editable copy — the original
          starter stays unchanged. Use Template creates a draft contract; sending for signature
          happens later on the contract itself.
        </p>
        {showAddStarter && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={addingStarter}
            onClick={() => startAddStarter(async () => {
              const r = await addContractStarterAgainAction();
              if (r.ok) {
                toast.success("Starter added — your earlier customizations were left alone.");
                router.refresh();
              } else toast.error(r.message ?? "Could not add starter.");
            })}
          >
            {addingStarter ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <BookPlus className="mr-1.5 h-4 w-4" />}
            Add another copy of Wedding Venue Agreement
          </Button>
        )}
      </div>
      <div className="space-y-2">
        {active.map((t) => cardFor(t, false))}
      </div>
      {active.length === 0 && (
        <p className="text-sm text-muted-foreground py-6 text-center">
          No contract templates yet. Add the starter agreement above, or build your own from your real
          venue contract — this is what you&apos;ll send couples to sign.
        </p>
      )}
      <LibraryArchivedSection count={archived.length}>
        <div className="space-y-2">
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
