"use client";

import * as React from "react";

import { useRouter } from "next/navigation";
import { Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { deleteTemplateAction } from "@/app/(app)/communication/templates/actions";
import { LibraryDeleteConfirmDialog } from "@/components/library/library-delete-confirm-dialog";
import { Button } from "@/components/ui/button";

export function DeleteTemplateButton({ templateId, templateName }: { templateId: string; templateName: string }) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [confirmOpen, setConfirmOpen] = React.useState(false);

  function handleDeleteConfirmed() {
    startTransition(async () => {
      const result = await deleteTemplateAction(templateId);
      if (result.ok) {
        toast.success("Template deleted.");
        router.push("/communication/templates");
      } else {
        toast.error(result.message ?? "Could not delete template.");
        setConfirmOpen(false);
      }
    });
  }

  return (
    <>
      <Button type="button" variant="ghost" size="sm" onClick={() => setConfirmOpen(true)} disabled={pending}
        className="text-muted-foreground hover:text-destructive">
        {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
      </Button>
      <LibraryDeleteConfirmDialog
        open={confirmOpen}
        itemName={templateName}
        itemLabel="template"
        pending={pending}
        onConfirm={handleDeleteConfirmed}
        onCancel={() => setConfirmOpen(false)}
      />
    </>
  );
}
