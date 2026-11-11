"use client";

/**
 * Template-level name / description — Inventory templates have no event-type
 * or space columns in the current model.
 */

import * as React from "react";

import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { updateInventoryTemplateDetailsAction } from "@/app/(app)/events/[id]/event-inventory-actions";
import { LIBRARY_LABELS } from "@/components/library/labels";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import type { InventoryTemplate } from "@/lib/event-inventory/types";

export function InventoryTemplateDetailsSheet({
  template,
  open,
  onOpenChange,
}: {
  template: InventoryTemplate;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [name, setName] = React.useState(template.name);
  const [description, setDescription] = React.useState(template.description ?? "");
  const [pending, startTransition] = React.useTransition();

  React.useEffect(() => {
    if (open) {
      setName(template.name);
      setDescription(template.description ?? "");
    }
  }, [open, template]);

  function save() {
    if (!name.trim()) {
      toast.error("Template name is required.");
      return;
    }
    startTransition(async () => {
      const result = await updateInventoryTemplateDetailsAction(template.id, {
        name: name.trim(),
        description: description.trim() || null,
      });
      if (result.ok) {
        toast.success(LIBRARY_LABELS.saved);
        onOpenChange(false);
        router.refresh();
      } else {
        toast.error(result.errors?.name ?? result.message ?? "Could not save template details.");
      }
    });
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader className="mb-4">
          <SheetTitle>{LIBRARY_LABELS.editDetails}</SheetTitle>
          <p className="text-sm text-muted-foreground">
            Rename this template and update its description. Inventory templates are not scoped to an
            event type or venue space in Hello to Cheers — apply them from an event when needed.
            This does not change individual items.
          </p>
        </SheetHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs">Name</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              data-testid="inventory-template-details-name"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Description</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="Optional"
              data-testid="inventory-template-details-description"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" disabled={pending} onClick={() => onOpenChange(false)}>
              {LIBRARY_LABELS.cancel}
            </Button>
            <Button type="button" disabled={pending} onClick={save} data-testid="inventory-template-details-save">
              {pending ? (
                <>
                  <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                  {LIBRARY_LABELS.saving}
                </>
              ) : (
                LIBRARY_LABELS.saveChanges
              )}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
