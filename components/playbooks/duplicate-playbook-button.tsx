"use client";

import * as React from "react";

import { useRouter } from "next/navigation";
import { Copy, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { duplicateTemplateAction } from "@/app/(app)/playbooks/actions";
import { Button } from "@/components/ui/button";

export function DuplicatePlaybookButton({ templateId, templateName }: { templateId: string; templateName: string }) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();

  function handleDuplicate() {
    startTransition(async () => {
      const result = await duplicateTemplateAction(templateId, `${templateName} (Copy)`);
      if (result.ok) { toast.success("Template duplicated."); router.push(`/library/playbooks/${result.templateId}`); }
      else toast.error(result.message ?? "Could not duplicate template.");
    });
  }

  return (
    <Button type="button" variant="outline" size="sm" onClick={handleDuplicate} disabled={pending}>
      {pending ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Copy className="mr-1.5 h-3.5 w-3.5" />}
      Duplicate
    </Button>
  );
}
