"use client";

/**
 * Template-level name / purpose — questionnaires have no event-type or space
 * columns; kind is immutable after create.
 */

import * as React from "react";

import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { updateQuestionnaireTemplateDetailsAction } from "@/app/(app)/events/[id]/questionnaire-actions";
import { LIBRARY_LABELS } from "@/components/library/labels";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import type { QuestionnaireTemplate } from "@/lib/questionnaire-templates/service";

export function QuestionnaireTemplateDetailsSheet({
  template,
  open,
  onOpenChange,
  onSaved,
}: {
  template: QuestionnaireTemplate;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Keep the authoring workspace name/purpose fields in sync after save. */
  onSaved?: (next: { name: string; description: string }) => void;
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
      const result = await updateQuestionnaireTemplateDetailsAction(template.id, {
        name: name.trim(),
        description: description.trim() || null,
      });
      if (result.ok) {
        toast.success(LIBRARY_LABELS.saved);
        onSaved?.({ name: name.trim(), description: description.trim() });
        onOpenChange(false);
        router.refresh();
      } else {
        toast.error(result.message ?? "Could not save template details.");
      }
    });
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader className="mb-4">
          <SheetTitle>{LIBRARY_LABELS.editDetails}</SheetTitle>
          <p className="text-sm text-muted-foreground">
            Rename this questionnaire and update its purpose. Kind (Client Planning, Final Details,
            or Feedback) cannot change after create. Questionnaires are not scoped to an event type
            or venue space. This does not change individual questions.
          </p>
        </SheetHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs">Name</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              data-testid="questionnaire-template-details-name"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Purpose</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="Optional"
              data-testid="questionnaire-template-details-description"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" disabled={pending} onClick={() => onOpenChange(false)}>
              {LIBRARY_LABELS.cancel}
            </Button>
            <Button type="button" disabled={pending} onClick={save} data-testid="questionnaire-template-details-save">
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
