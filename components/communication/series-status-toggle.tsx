"use client";

import * as React from "react";

import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { setSeriesStatusAction } from "@/app/(app)/communication/series/actions";
import { Button } from "@/components/ui/button";
import type { MessageSequence } from "@/lib/message-sequences/types";

export function SeriesStatusToggle({ seriesId, status }: { seriesId: string; status: MessageSequence["status"] }) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();

  function toggle() {
    const next = status === "active" ? "paused" : "active";
    startTransition(async () => {
      const result = await setSeriesStatusAction(seriesId, next);
      if (result.ok) {
        toast.success(next === "active" ? "Automation resumed." : "Automation paused — no new steps will send.");
        router.refresh();
      } else {
        toast.error(result.message ?? "Could not update status.");
      }
    });
  }

  return (
    <Button type="button" variant="outline" size="sm" onClick={toggle} disabled={pending}>
      {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : status === "active" ? "Pause" : "Resume"}
    </Button>
  );
}
