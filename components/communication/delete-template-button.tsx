"use client";

import * as React from "react";

import { useRouter } from "next/navigation";
import { Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { deleteTemplateAction } from "@/app/(app)/communication/templates/actions";
import { Button } from "@/components/ui/button";

export function DeleteTemplateButton({ templateId, templateName }: { templateId: string; templateName: string }) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();

  function handleDelete() {
    if (!confirm(`Delete "${templateName}"? This can't be undone.`)) return;
    startTransition(async () => {
      const result = await deleteTemplateAction(templateId);
      if (result.ok) {
        toast.success("Template deleted.");
        router.push("/communication/templates");
      } else {
        toast.error(result.message ?? "Could not delete template.");
      }
    });
  }

  return (
    <Button type="button" variant="ghost" size="sm" onClick={handleDelete} disabled={pending}
      className="text-muted-foreground hover:text-destructive">
      {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
    </Button>
  );
}
