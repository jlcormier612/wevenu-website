"use client";

import * as React from "react";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Archive, ArchiveRestore, Copy, Loader2, MoreVertical, Trash2 } from "lucide-react";
import { toast } from "sonner";

import {
  createBrochureAction, deleteBrochureAction, duplicateBrochureAction, setBrochureArchivedAction,
} from "@/app/(app)/library/brochures/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
          <p className="text-sm text-muted-foreground">A reusable, brandable overview of your venue — the next screen lets you choose what's in it.</p>
        </SheetHeader>
        <div className="space-y-1.5">
          <Label className="text-sm font-medium text-heading">Name</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Wedding Brochure" autoFocus />
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

function BrochureCard({ brochure }: { brochure: Brochure }) {
  const router = useRouter();
  const [pendingId, setPendingId] = React.useState<string | null>(null);
  const pending = pendingId === brochure.id;

  async function handleArchiveToggle() {
    setPendingId(brochure.id);
    const result = await setBrochureArchivedAction(brochure.id, !brochure.isArchived);
    setPendingId(null);
    if (!result.ok) toast.error(result.message ?? "Could not update brochure.");
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
    if (!result.ok) toast.error(result.message ?? "Could not delete brochure.");
  }

  return (
    <Card>
      <CardContent className="flex items-center justify-between gap-4 py-4">
        <Link href={`/library/brochures/${brochure.id}`} className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="font-medium text-heading">{brochure.name}</p>
            {brochure.sourceMasterKey && !brochure.isArchived && <Badge variant="muted">Starter</Badge>}
            {brochure.isArchived && <Badge variant="muted">Archived</Badge>}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">Updated {formatRelative(brochure.updatedAt)}</p>
        </Link>
        <DropdownMenu>
          <DropdownMenuTrigger render={
            <Button type="button" variant="ghost" size="sm" disabled={pending}>
              {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <MoreVertical className="h-3.5 w-3.5" />}
            </Button>
          } />
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={handleDuplicate}><Copy className="mr-2 h-3.5 w-3.5" />Duplicate</DropdownMenuItem>
            <DropdownMenuItem onClick={handleArchiveToggle}>
              {brochure.isArchived ? <ArchiveRestore className="mr-2 h-3.5 w-3.5" /> : <Archive className="mr-2 h-3.5 w-3.5" />}
              {brochure.isArchived ? "Restore" : "Archive"}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleDelete} className="text-destructive focus:text-destructive">
              <Trash2 className="mr-2 h-3.5 w-3.5" /> Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </CardContent>
    </Card>
  );
}

export function BrochureList({ brochures }: { brochures: Brochure[] }) {
  const [showArchived, setShowArchived] = React.useState(false);
  const archivedCount = brochures.filter((b) => b.isArchived).length;
  const visible = brochures.filter((b) => showArchived || !b.isArchived);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        {archivedCount > 0 ? (
          <button type="button" onClick={() => setShowArchived((v) => !v)} className="text-xs text-muted-foreground hover:text-foreground underline">
            {showArchived ? "Hide archived" : `Show ${archivedCount} archived`}
          </button>
        ) : <span />}
        <NewBrochureSheet />
      </div>
      {visible.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-sm border border-dashed border-border bg-card/40 py-16 text-center">
          <p className="font-heading text-lg font-medium text-heading">No brochures yet</p>
          <p className="mt-1 text-sm text-muted-foreground">Create one to send prospective couples a beautiful overview of your venue.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {visible.map((b) => <BrochureCard key={b.id} brochure={b} />)}
        </div>
      )}
    </div>
  );
}
