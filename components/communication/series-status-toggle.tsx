"use client";

import * as React from "react";

import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { setSeriesStatusAction } from "@/app/(app)/communication/series/actions";
import { LeadLifecycleConfirmDialog } from "@/components/leads/lifecycle-confirm-dialog";
import { Button } from "@/components/ui/button";
import type { MessageSequence } from "@/lib/message-sequences/types";

const PAUSE_DESCRIPTION =
  "New people won’t enter this automation, and people already in it won’t receive scheduled messages until you resume it. This does not delete anyone or their past messages.";

export function SeriesStatusToggle({ seriesId, status }: { seriesId: string; status: MessageSequence["status"] }) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [confirmPause, setConfirmPause] = React.useState(false);

  function apply(next: "active" | "paused") {
    startTransition(async () => {
      const result = await setSeriesStatusAction(seriesId, next);
      if (result.ok) {
        toast.success(
          next === "active"
            ? "Automation resumed — new people can join and scheduled messages can send again."
            : "Automation paused for everyone.",
        );
        setConfirmPause(false);
        router.refresh();
      } else {
        toast.error(result.message ?? "Could not update status.");
      }
    });
  }

  function onClick() {
    if (status === "active") {
      setConfirmPause(true);
      return;
    }
    apply("active");
  }

  return (
    <>
      <Button type="button" variant="outline" size="sm" onClick={onClick} disabled={pending}>
        {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : status === "active" ? "Pause automation" : "Resume automation"}
      </Button>
      <LeadLifecycleConfirmDialog
        open={confirmPause}
        title="Pause this automation?"
        description={PAUSE_DESCRIPTION}
        confirmLabel="Pause automation"
        confirming={pending}
        onConfirm={() => apply("paused")}
        onCancel={() => { if (!pending) setConfirmPause(false); }}
      />
    </>
  );
}
