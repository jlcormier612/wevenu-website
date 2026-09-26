"use client";

import * as React from "react";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import {
  createChoicesTemplateAction,
  deleteChoicesTemplateAction,
  setChoicesTemplateArchivedAction,
} from "@/app/(app)/library/choices-templates/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import type { ChoicesTemplate } from "@/lib/client-choices-templates/types";

export function ChoicesTemplateList({ templates }: { templates: ChoicesTemplate[] }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [name, setName] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [pending, startTransition] = React.useTransition();

  const active = templates.filter((t) => !t.isArchived);
  const archived = templates.filter((t) => t.isArchived);

  function handleCreate() {
    startTransition(async () => {
      const result = await createChoicesTemplateAction({ name, description });
      if (!result.ok) {
        toast.error(result.errors?.name ?? result.message ?? "Could not create template.");
        return;
      }
      toast.success("Choices template created.");
      setOpen(false);
      setName("");
      setDescription("");
      router.push(`/library/choices-templates/${result.templateId}`);
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Reusable menus, bar packages, rentals, and other client choices — create once, send per event.
        </p>
        <Button type="button" size="sm" onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4" /> New template
        </Button>
      </div>

      {active.length === 0 ? (
        <div className="rounded-sm border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
          No Choices templates yet. Create one such as “Wedding Dinner Selection”.
        </div>
      ) : (
        <ul className="divide-y divide-border rounded-sm border border-border">
          {active.map((t) => (
            <li key={t.id} className="flex items-center justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <Link href={`/library/choices-templates/${t.id}`} className="text-sm font-medium text-heading hover:underline">
                  {t.name}
                </Link>
                {t.description ? (
                  <p className="text-xs text-muted-foreground truncate">{t.description}</p>
                ) : null}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => startTransition(async () => {
                    await setChoicesTemplateArchivedAction(t.id, true);
                    router.refresh();
                  })}
                >
                  Archive
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => startTransition(async () => {
                    if (!confirm("Delete this template permanently?")) return;
                    await deleteChoicesTemplateAction(t.id);
                    router.refresh();
                  })}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {archived.length > 0 ? (
        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Archived</p>
          <ul className="space-y-1">
            {archived.map((t) => (
              <li key={t.id} className="flex items-center justify-between text-sm text-muted-foreground">
                <span>{t.name}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => startTransition(async () => {
                    await setChoicesTemplateArchivedAction(t.id, false);
                    router.refresh();
                  })}
                >
                  Restore
                </Button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="w-full sm:max-w-md">
          <SheetHeader className="mb-4">
            <SheetTitle>New Choices template</SheetTitle>
          </SheetHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="cc-name">Name</Label>
              <Input id="cc-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Wedding Dinner Selection" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cc-desc">Description</Label>
              <Textarea id="cc-desc" value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
            </div>
            <Button type="button" disabled={pending || !name.trim()} onClick={handleCreate}>
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create"}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
