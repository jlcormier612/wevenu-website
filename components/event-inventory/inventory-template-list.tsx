"use client";

import * as React from "react";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { BookPlus, Loader2, Archive, ArchiveRestore } from "lucide-react";
import { toast } from "sonner";

import {
  addInventoryTemplateStarterAgainAction,
  createInventoryTemplateAction,
  setInventoryTemplateArchivedAction,
} from "@/app/(app)/events/[id]/event-inventory-actions";
import { LIBRARY_LABELS, archiveToggleLabel } from "@/components/library/labels";
import { LibraryArchivedSection } from "@/components/library/library-archived-section";
import { LibraryAssetCard } from "@/components/library/library-asset-card";
import { partitionArchived } from "@/components/library/partition-archived";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import type { InventoryTemplate } from "@/lib/event-inventory/types";
import { INVENTORY_TEMPLATE_STARTER_MASTERS, type InventoryTemplateStarterKey } from "@/lib/inventory/starters";
import { formatRelative } from "@/lib/leads/constants";

function CreateTemplateSheet() {
  const [open, setOpen] = React.useState(false);
  const [name, setName] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [error, setError] = React.useState("");
  const [pending, startTransition] = React.useTransition();

  function handleCreate() {
    startTransition(async () => {
      const result = await createInventoryTemplateAction(name, description);
      if (result.ok) { setOpen(false); setName(""); setDescription(""); setError(""); toast.success("Template created."); }
      else setError(result.errors?.name ?? result.message ?? "Could not create template.");
    });
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger render={<Button />}>+ New Template</SheetTrigger>
      <SheetContent side="right" className="w-full sm:max-w-md">
        <SheetHeader className="mb-6">
          <SheetTitle>New Inventory Template</SheetTitle>
          <p className="text-sm text-muted-foreground">A reusable list of what you typically use for this kind of event.</p>
        </SheetHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-heading">Name</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Our Standard Wedding Inventory" autoFocus />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-heading">Description</label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} placeholder="Optional" />
          </div>
        </div>
        {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
        <div className="mt-6 flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={pending}>Cancel</Button>
          <Button type="button" disabled={!name.trim() || pending} onClick={handleCreate}>
            {pending ? <><Loader2 className="mr-1.5 h-4 w-4 animate-spin" />Creating…</> : "Create"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function StarterMenu({ missingKeys }: { missingKeys: InventoryTemplateStarterKey[] }) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  if (missingKeys.length === 0) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={
        <Button type="button" variant="outline" size="sm" disabled={pending}>
          {pending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <BookPlus className="mr-1.5 h-4 w-4" />}
          Restore starters
        </Button>
      } />
      <DropdownMenuContent align="end">
        {INVENTORY_TEMPLATE_STARTER_MASTERS.filter((m) => missingKeys.includes(m.key)).map((m) => (
          <DropdownMenuItem
            key={m.key}
            onClick={() => startTransition(async () => {
              const r = await addInventoryTemplateStarterAgainAction(m.key);
              if (r.ok) {
                toast.success("Starter added — your earlier customizations were left alone.");
                router.refresh();
              } else toast.error(r.message ?? "Could not add starter.");
            })}
          >
            {m.name}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function TemplateCard({ template, archivedView }: { template: InventoryTemplate; archivedView?: boolean }) {
  const [pending, startTransition] = React.useTransition();
  function toggleArchive() {
    startTransition(async () => {
      const result = await setInventoryTemplateArchivedAction(template.id, !template.isArchived);
      if (!result.ok) toast.error(result.message ?? "Could not update.");
      else toast.success(template.isArchived ? "Template restored." : "Template archived.");
    });
  }
  return (
    <LibraryAssetCard
      layout="row"
      title={template.name}
      description={template.description}
      meta={`Updated ${formatRelative(template.updatedAt)}`}
      href={archivedView ? undefined : `/library/inventory-templates/${template.id}`}
      isStarter={Boolean(template.sourceMasterKey)}
      isArchived={template.isArchived}
      primaryActions={archivedView
        ? [{ id: "restore", label: LIBRARY_LABELS.restore, onClick: toggleArchive, emphasis: "edit" }]
        : [{ id: "edit", label: LIBRARY_LABELS.edit, href: `/library/inventory-templates/${template.id}`, emphasis: "edit" }]}
      overflowPending={pending}
      overflowItems={archivedView ? [] : [
        {
          id: "archive",
          label: archiveToggleLabel(template.isArchived),
          onClick: toggleArchive,
          icon: template.isArchived
            ? <ArchiveRestore className="mr-2 h-3.5 w-3.5" />
            : <Archive className="mr-2 h-3.5 w-3.5" />,
        },
      ]}
    />
  );
}

export function InventoryTemplateList({
  templates,
  missingStarterKeys = [],
}: {
  templates: InventoryTemplate[];
  missingStarterKeys?: InventoryTemplateStarterKey[];
}) {
  const { active, archived } = partitionArchived(templates, (t) => t.isArchived);
  return (
    <div className="space-y-4">
      <div className="flex justify-end gap-2 flex-wrap">
        <StarterMenu missingKeys={missingStarterKeys} />
        <CreateTemplateSheet />
      </div>
      <p className="text-xs text-muted-foreground">
        Templates are reusable packing lists. Applying one to an event happens on the booking — not as a client send from the Library.
      </p>
      {templates.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-sm border border-dashed border-border bg-card/40 py-16 text-center">
          <p className="font-heading text-lg font-medium text-heading">No inventory templates yet</p>
          <p className="mt-1 text-sm text-muted-foreground">Create one to reuse across events, or restore a Hello to Cheers starter.</p>
        </div>
      ) : (
        <>
          {active.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">No active inventory templates.</p>
          ) : (
            <div className="space-y-2">
              {active.map((t) => <TemplateCard key={t.id} template={t} />)}
            </div>
          )}
          <LibraryArchivedSection count={archived.length}>
            <div className="space-y-2">
              {archived.map((t) => <TemplateCard key={t.id} template={t} archivedView />)}
            </div>
          </LibraryArchivedSection>
        </>
      )}
    </div>
  );
}
