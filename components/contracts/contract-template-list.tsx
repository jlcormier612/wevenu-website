"use client";

/**
 * Contract Templates list — Template Platform Release Readiness parity pass.
 * Brings this grid up to the same Duplicate + Archive/Restore actions
 * Playbooks/Timeline Templates/Floor Plan Templates already have, instead of
 * hard-delete being the only removal path.
 */

import * as React from "react";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Archive, ArchiveRestore, Copy, Loader2, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

import {
  deleteTemplateAction, duplicateTemplateAction, setTemplateArchivedAction,
} from "@/app/(app)/contracts/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { ContractTemplate } from "@/lib/contracts/types";

export function ContractTemplateList({ initialTemplates }: { initialTemplates: ContractTemplate[] }) {
  const router = useRouter();
  const [templates, setTemplates] = React.useState(initialTemplates);
  const [showArchived, setShowArchived] = React.useState(false);
  const [pendingId, setPendingId] = React.useState<string | null>(null);

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
      {archivedCount > 0 && (
        <button type="button" onClick={() => setShowArchived((v) => !v)} className="text-xs text-muted-foreground hover:text-foreground underline">
          {showArchived ? "Hide archived" : `Show ${archivedCount} archived`}
        </button>
      )}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {visible.map((t) => (
          <Card key={t.id} className={t.isDefault ? "border-primary/30" : t.isArchived ? "opacity-60" : ""}>
            <CardHeader>
              <div className="flex items-start justify-between gap-2">
                <CardTitle className="text-base">{t.name}</CardTitle>
                <div className="flex shrink-0 items-center gap-1">
                  {t.isDefault && <Badge variant="default">Default</Badge>}
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
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="outline" render={<Link href={`/contracts/templates/${t.id}/edit`} />}>
                  Edit
                </Button>
                <Button size="sm" render={<Link href="/contracts/new" />}>
                  Use
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
