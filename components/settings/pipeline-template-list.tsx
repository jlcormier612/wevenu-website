"use client";

/**
 * Pipeline Templates list — Template Platform Release Readiness parity pass.
 * Brings this card grid up to the same Duplicate + Archive/Restore actions
 * Packages already has, and Playbooks/Timeline Templates/Floor Plan
 * Templates have had all along, instead of Edit being the only action here.
 * "Active"/"Inactive" is the same underlying is_active column Phase 1 (this
 * template's own foundation) already built — only the label and the actions
 * around it are new, so it reads the same as "Archive"/"Restore" everywhere
 * else in the Template Platform.
 */

import * as React from "react";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Archive, ArchiveRestore, Copy, Loader2, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

import {
  deletePipelineTemplateAction, duplicatePipelineTemplateAction, setPipelineTemplateActiveAction,
} from "@/app/(app)/library/pipeline-templates/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { PipelineTemplate } from "@/lib/pipeline-templates/types";

export function PipelineTemplateList({ initialTemplates }: { initialTemplates: PipelineTemplate[] }) {
  const router = useRouter();
  const [templates, setTemplates] = React.useState(initialTemplates);
  const [pendingId, setPendingId] = React.useState<string | null>(null);

  async function handleToggleArchived(t: PipelineTemplate) {
    setPendingId(t.id);
    const result = await setPipelineTemplateActiveAction(t.id, !t.isActive);
    setPendingId(null);
    if (result.ok) setTemplates((p) => p.map((x) => x.id === t.id ? { ...x, isActive: !t.isActive } : x));
    else toast.error(result.message ?? "Could not update template.");
  }

  async function handleDuplicate(t: PipelineTemplate) {
    setPendingId(t.id);
    const result = await duplicatePipelineTemplateAction(t.id, `${t.name} (Copy)`);
    setPendingId(null);
    if (result.ok) { toast.success("Pipeline template duplicated."); router.push(`/library/pipeline-templates/${result.templateId}/edit`); }
    else toast.error(result.message ?? "Could not duplicate template.");
  }

  async function handleDelete(t: PipelineTemplate) {
    if (!confirm(`Delete "${t.name}"? This can't be undone.`)) return;
    setPendingId(t.id);
    const result = await deletePipelineTemplateAction(t.id);
    setPendingId(null);
    if (result.ok) { toast.success("Pipeline template deleted."); setTemplates((p) => p.filter((x) => x.id !== t.id)); }
    else toast.error(result.message ?? "Could not delete template.");
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {templates.map((t) => (
        <Card key={t.id}>
          <CardHeader>
            <div className="flex items-start justify-between gap-2">
              <CardTitle className="text-base">{t.name}</CardTitle>
              <div className="flex shrink-0 items-center gap-1">
                {!t.isActive && <Badge variant="muted" className="text-[10px]">Archived</Badge>}
                <DropdownMenu>
                  <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" aria-label="Pipeline template options" />}>
                    {pendingId === t.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <MoreHorizontal className="h-3.5 w-3.5" />}
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem render={<Link href={`/library/pipeline-templates/${t.id}/edit`} />}>
                      <Pencil className="mr-2 h-3.5 w-3.5" /> Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleDuplicate(t)}>
                      <Copy className="mr-2 h-3.5 w-3.5" /> Duplicate
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleToggleArchived(t)}>
                      {t.isActive ? <Archive className="mr-2 h-3.5 w-3.5" /> : <ArchiveRestore className="mr-2 h-3.5 w-3.5" />}
                      {t.isActive ? "Archive" : "Restore"}
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
            <Button size="sm" variant="outline" render={<Link href={`/library/pipeline-templates/${t.id}/edit`} />}>
              Edit
            </Button>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
