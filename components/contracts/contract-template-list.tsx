"use client";

/**
 * Contract Templates list — includes Hello to Cheers Wedding Venue Agreement
 * starter badge + Add starter again (non-destructive).
 */

import * as React from "react";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Archive, ArchiveRestore, BookPlus, Copy, Loader2, MoreHorizontal, Pencil, Trash2,
} from "lucide-react";
import { toast } from "sonner";

import {
  addContractStarterAgainAction,
  deleteTemplateAction,
  duplicateTemplateAction,
  setTemplateArchivedAction,
} from "@/app/(app)/contracts/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { formatRelative } from "@/lib/leads/constants";
import type { ContractTemplate } from "@/lib/contracts/types";

function TemplatePreviewSheet({
  template, open, onOpenChange,
}: { template: ContractTemplate | null; open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader className="mb-2">
          <SheetTitle>{template?.name}</SheetTitle>
          <div className="flex items-center gap-2 flex-wrap text-xs text-muted-foreground">
            <span>Contract Template</span>
            {template?.sourceMasterKey && <Badge variant="muted">Starter</Badge>}
            {template?.isDefault && <Badge variant="default">Default</Badge>}
            {template && <span>· Updated {formatRelative(template.updatedAt)}</span>}
          </div>
        </SheetHeader>
        {template && (
          <div className="px-4 pb-6 space-y-4">
            {template.description && <p className="text-sm text-muted-foreground">{template.description}</p>}
            <div className="rounded-lg border border-border bg-background p-4 font-sans text-sm text-foreground whitespace-pre-wrap leading-relaxed max-h-[60vh] overflow-y-auto">
              {template.content}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" render={<Link href={`/contracts/templates/${template.id}/edit`} />}>
                Edit
              </Button>
              <Button size="sm" render={<Link href={`/contracts/new?templateId=${template.id}`} />}>
                Use Template
              </Button>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

export function ContractTemplateList({
  initialTemplates,
  showAddStarter = true,
}: {
  initialTemplates: ContractTemplate[];
  showAddStarter?: boolean;
}) {
  const router = useRouter();
  const [templates, setTemplates] = React.useState(initialTemplates);
  const [showArchived, setShowArchived] = React.useState(false);
  const [pendingId, setPendingId] = React.useState<string | null>(null);
  const [previewing, setPreviewing] = React.useState<ContractTemplate | null>(null);
  const [addingStarter, startAddStarter] = React.useTransition();

  React.useEffect(() => { setTemplates(initialTemplates); }, [initialTemplates]);

  const visible = templates.filter((t) => showArchived || !t.isArchived);
  const archivedCount = templates.filter((t) => t.isArchived).length;

  async function handleToggleArchived(t: ContractTemplate) {
    setPendingId(t.id);
    const result = await setTemplateArchivedAction(t.id, !t.isArchived);
    setPendingId(null);
    if (result.ok) setTemplates((p) => p.map((x) => x.id === t.id ? { ...x, isArchived: !t.isArchived } : x));
    else toast.error(result.message ?? "Could not update template.");
  }

  async function handleDuplicate(t: ContractTemplate) {
    setPendingId(t.id);
    const result = await duplicateTemplateAction(t.id, `${t.name} (Copy)`);
    setPendingId(null);
    if (result.ok) { toast.success("Template duplicated."); router.push(`/contracts/templates/${result.templateId}/edit`); }
    else toast.error(result.message ?? "Could not duplicate template.");
  }

  async function handleDelete(t: ContractTemplate) {
    if (!confirm(`Delete "${t.name}"? This can't be undone.`)) return;
    setPendingId(t.id);
    const result = await deleteTemplateAction(t.id);
    setPendingId(null);
    if (result.ok) { toast.success("Template deleted."); setTemplates((p) => p.filter((x) => x.id !== t.id)); }
    else toast.error(result.message ?? "Could not delete template.");
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        {archivedCount > 0 ? (
          <button type="button" onClick={() => setShowArchived((v) => !v)} className="text-xs text-muted-foreground hover:text-foreground underline">
            {showArchived ? "Hide archived" : `Show ${archivedCount} archived`}
          </button>
        ) : <span />}
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
            Add Wedding Venue Agreement again
          </Button>
        )}
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {visible.map((t) => (
          <Card key={t.id} className={t.isDefault ? "border-primary/30" : t.isArchived ? "opacity-60" : ""}>
            <CardHeader>
              <div className="flex items-start justify-between gap-2">
                <CardTitle className="text-base">{t.name}</CardTitle>
                <div className="flex shrink-0 items-center gap-1">
                  {t.sourceMasterKey && !t.isArchived && <Badge variant="muted" className="text-[10px]">Starter</Badge>}
                  {t.isDefault && <Badge variant="default" className="text-[10px]">Default</Badge>}
                  {t.isArchived && <Badge variant="muted" className="text-[10px]">Archived</Badge>}
                  <DropdownMenu>
                    <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" aria-label="Template options" />}>
                      {pendingId === t.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <MoreHorizontal className="h-3.5 w-3.5" />}
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem render={<Link href={`/contracts/templates/${t.id}/edit`} />}>
                        <Pencil className="mr-2 h-3.5 w-3.5" /> Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleDuplicate(t)}>
                        <Copy className="mr-2 h-3.5 w-3.5" /> Duplicate
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleToggleArchived(t)}>
                        {t.isArchived ? <ArchiveRestore className="mr-2 h-3.5 w-3.5" /> : <Archive className="mr-2 h-3.5 w-3.5" />}
                        {t.isArchived ? "Restore" : "Archive"}
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleDelete(t)} className="text-destructive focus:text-destructive">
                        <Trash2 className="mr-2 h-3.5 w-3.5" /> Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
              {t.description && <CardDescription>{t.description}</CardDescription>}
              <p className="text-xs text-muted-foreground">Updated {formatRelative(t.updatedAt)}</p>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2 flex-wrap">
                <Button size="sm" variant="ghost" onClick={() => setPreviewing(t)}>
                  Preview
                </Button>
                <Button size="sm" variant="outline" render={<Link href={`/contracts/templates/${t.id}/edit`} />}>
                  Edit
                </Button>
                <Button size="sm" render={<Link href={`/contracts/new?templateId=${t.id}`} />}>
                  Use Template
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      <TemplatePreviewSheet template={previewing} open={!!previewing} onOpenChange={(o) => { if (!o) setPreviewing(null); }} />
    </div>
  );
}
