"use client";

import * as React from "react";

import { useRouter } from "next/navigation";
import { Archive, ArchiveRestore, Copy, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";

import {
  createBrochureAction, deleteBrochureAction, duplicateBrochureAction, setBrochureArchivedAction,
} from "@/app/(app)/library/brochures/actions";
import { LIBRARY_LABELS, archiveToggleLabel } from "@/components/library/labels";
import { LibraryArchivedSection } from "@/components/library/library-archived-section";
import { LibraryAssetCard } from "@/components/library/library-asset-card";
import { partitionArchived } from "@/components/library/partition-archived";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { formatRelative } from "@/lib/leads/constants";
import type { Brochure } from "@/lib/brochures/types";

function NewBrochureSheet() {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [name, setName] = React.useState("");
  const [error, setError] = React.useState("");
  const [pending, startTransition] = React.useTransition();

  function handleCreate() {
    startTransition(async () => {
      const result = await createBrochureAction({ name, welcomeText: "", includePackages: true, includeFaqs: false, closingText: "" });
      if (result.ok) {
        setOpen(false); setName(""); setError("");
        toast.success("Brochure created.");
        router.push(`/library/brochures/${result.brochureId}`);
      } else setError(result.errors?.name ?? result.message ?? "Could not create brochure.");
    });
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <Button type="button" onClick={() => setOpen(true)}>+ New Brochure</Button>
      <SheetContent side="right" className="w-full sm:max-w-md">
        <SheetHeader className="mb-6">
          <SheetTitle>New Brochure</SheetTitle>
          <p className="text-sm text-muted-foreground">A reusable, brandable overview of your venue — the next screen lets you choose what&apos;s in it.</p>
        </SheetHeader>
        <div className="space-y-1.5">
          <Label className="text-sm font-medium text-heading">Name</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Wedding Brochure" autoFocus />
        </div>
        {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
        <div className="mt-6 flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={pending}>{LIBRARY_LABELS.cancel}</Button>
          <Button type="button" disabled={!name.trim() || pending} onClick={handleCreate}>
            {pending ? <><Loader2 className="mr-1.5 h-4 w-4 animate-spin" />Creating…</> : "Create"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function BrochureCard({ brochure, archivedView }: { brochure: Brochure; archivedView?: boolean }) {
  const router = useRouter();
  const [pendingId, setPendingId] = React.useState<string | null>(null);
  const pending = pendingId === brochure.id;

  async function handleArchiveToggle() {
    setPendingId(brochure.id);
    const result = await setBrochureArchivedAction(brochure.id, !brochure.isArchived);
    setPendingId(null);
    if (!result.ok) toast.error(result.message ?? "Could not update brochure.");
    else toast.success(brochure.isArchived ? "Brochure restored." : "Brochure archived.");
  }

  async function handleDuplicate() {
    setPendingId(brochure.id);
    const result = await duplicateBrochureAction(brochure.id, `${brochure.name} (Copy)`);
    setPendingId(null);
    if (result.ok) { toast.success("Brochure duplicated."); router.push(`/library/brochures/${result.brochureId}`); }
    else toast.error(result.message ?? "Could not duplicate brochure.");
  }

  async function handleDelete() {
    if (!confirm(`Delete "${brochure.name}"? This can't be undone.`)) return;
    setPendingId(brochure.id);
    const result = await deleteBrochureAction(brochure.id);
    setPendingId(null);
    if (result.ok) toast.success("Brochure deleted.");
    else toast.error(result.message ?? "Could not delete brochure.");
  }

  return (
    <LibraryAssetCard
      layout="row"
      title={brochure.name}
      meta={`Updated ${formatRelative(brochure.updatedAt)}`}
      href={archivedView ? undefined : `/library/brochures/${brochure.id}`}
      isStarter={Boolean(brochure.sourceMasterKey)}
      isArchived={brochure.isArchived}
      primaryActions={archivedView
        ? [
            {
              id: "preview",
              label: LIBRARY_LABELS.preview,
              onClick: () => window.open(`/api/brochures/${brochure.id}/pdf`, "_blank", "noopener,noreferrer"),
              emphasis: "preview",
            },
            { id: "restore", label: LIBRARY_LABELS.restore, onClick: handleArchiveToggle, emphasis: "edit" },
          ]
        : [
            { id: "edit", label: LIBRARY_LABELS.edit, href: `/library/brochures/${brochure.id}`, emphasis: "edit" },
            {
              id: "preview",
              label: LIBRARY_LABELS.preview,
              onClick: () => window.open(`/api/brochures/${brochure.id}/pdf`, "_blank", "noopener,noreferrer"),
              emphasis: "preview",
            },
          ]}
      overflowPending={pending}
      overflowItems={archivedView ? [] : [
        { id: "duplicate", label: LIBRARY_LABELS.duplicate, onClick: handleDuplicate, icon: <Copy className="mr-2 h-3.5 w-3.5" /> },
        {
          id: "archive",
          label: archiveToggleLabel(brochure.isArchived),
          onClick: handleArchiveToggle,
          icon: brochure.isArchived ? <ArchiveRestore className="mr-2 h-3.5 w-3.5" /> : <Archive className="mr-2 h-3.5 w-3.5" />,
        },
        {
          id: "delete",
          label: LIBRARY_LABELS.delete,
          onClick: handleDelete,
          destructive: true,
          separatorBefore: true,
          icon: <Trash2 className="mr-2 h-3.5 w-3.5" />,
        },
      ]}
    />
  );
}

export function BrochureList({ brochures }: { brochures: Brochure[] }) {
  const { active, archived } = partitionArchived(brochures, (b) => b.isArchived);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          Edit and preview here. Share with a prospect from the brochure detail — Share emails a view link.
        </p>
        <NewBrochureSheet />
      </div>
      {active.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-sm border border-dashed border-border bg-card/40 py-16 text-center">
          <p className="font-heading text-lg font-medium text-heading">No brochures yet</p>
          <p className="mt-1 text-sm text-muted-foreground">Create a brochure, then share it with a prospect when you&apos;re ready.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {active.map((b) => <BrochureCard key={b.id} brochure={b} />)}
        </div>
      )}
      <LibraryArchivedSection count={archived.length}>
        <div className="space-y-2">
          {archived.map((b) => <BrochureCard key={b.id} brochure={b} archivedView />)}
        </div>
      </LibraryArchivedSection>
    </div>
  );
}
