"use client";

import * as React from "react";

import { useRouter } from "next/navigation";
import { Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { deleteSeriesAction } from "@/app/(app)/communication/series/actions";
import { Button } from "@/components/ui/button";

export function DeleteSeriesButton({ seriesId, seriesName }: { seriesId: string; seriesName: string }) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();

  function handleDelete() {
    if (!confirm(`Delete "${seriesName}"? Anyone currently enrolled will stop receiving its remaining steps. This can't be undone.`)) return;
    startTransition(async () => {
      const result = await deleteSeriesAction(seriesId);
      if (result.ok) {
        toast.success("Automation deleted.");
        router.push("/communication/series");
      } else {
        toast.error(result.message ?? "Could not delete automation.");
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
