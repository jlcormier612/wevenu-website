"use client";

/**
 * Message Templates list — Template Platform Release Readiness parity pass.
 * Brings this grid up to the same Duplicate + Archive/Restore actions
 * Playbooks/Timeline Templates/Floor Plan Templates already have, instead of
 * Edit/Delete being the only two options.
 */

import * as React from "react";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Archive, ArchiveRestore, Copy, Loader2, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

import {
  deleteTemplateAction, duplicateTemplateAction, setTemplateArchivedAction,
} from "@/app/(app)/communication/templates/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { categoryLabel } from "@/lib/message-templates/constants";
import type { MessageTemplate } from "@/lib/message-templates/types";

export function MessageTemplateList({ initialTemplates }: { initialTemplates: MessageTemplate[] }) {
  const router = useRouter();
  const [templates, setTemplates] = React.useState(initialTemplates);
  const [showArchived, setShowArchived] = React.useState(false);
  const [pendingId, setPendingId] = React.useState<string | null>(null);

  const visible = templates.filter((t) => showArchived || !t.isArchived);
  const archivedCount = templates.filter((t) => t.isArchived).length;

  async function handleToggleArchived(t: MessageTemplate) {
    setPendingId(t.id);
    const result = await setTemplateArchivedAction(t.id, !t.isArchived);
    setPendingId(null);
    if (result.ok) setTemplates((p) => p.map((x) => x.id === t.id ? { ...x, isArchived: !t.isArchived } : x));
    else toast.error(result.message ?? "Could not update template.");
  }

  async function handleDuplicate(t: MessageTemplate) {
    setPendingId(t.id);
    const result = await duplicateTemplateAction(t.id, `${t.name} (Copy)`);
    setPendingId(null);
    if (result.ok) { toast.success("Template duplicated."); router.push(`/communication/templates/${result.templateId}/edit`); }
    else toast.error(result.message ?? "Could not duplicate template.");
  }

  async function handleDelete(t: MessageTemplate) {
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
          <Card key={t.id} className={t.isArchived ? "opacity-60" : undefined}>
            <CardHeader>
              <div className="flex items-start justify-between gap-2">
                <CardTitle className="text-base">{t.name}</CardTitle>
                <div className="flex shrink-0 items-center gap-1">
                  {t.emailBody && <Badge variant="muted" className="text-[10px]">Email</Badge>}
                  {t.smsBody && <Badge variant="muted" className="text-[10px]">SMS</Badge>}
                  {t.isArchived && <Badge variant="muted" className="text-[10px]">Archived</Badge>}
                  <DropdownMenu>
                    <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" aria-label="Template options" />}>
                      {pendingId === t.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <MoreHorizontal className="h-3.5 w-3.5" />}
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem render={<Link href={`/communication/templates/${t.id}/edit`} />}>
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
              <CardDescription>{categoryLabel(t.category)}</CardDescription>
            </CardHeader>
            <CardContent>
              <Button size="sm" variant="outline" render={<Link href={`/communication/templates/${t.id}/edit`} />}>
                Edit
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
