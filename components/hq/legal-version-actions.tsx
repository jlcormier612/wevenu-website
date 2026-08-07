"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

import {
  activateLegalVersionAction,
  deactivateLegalVersionAction,
} from "@/app/admin/legal/actions";
import { Button } from "@/components/ui/button";
import type { LegalDocumentType } from "@/lib/legal/types";

export function LegalVersionActions({
  id,
  documentType,
  isActive,
}: {
  id: string;
  documentType: LegalDocumentType;
  isActive: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function handleActivate() {
    if (
      !confirm(
        "Activate this version? The previous active version of this document will be deactivated.",
      )
    ) {
      return;
    }
    startTransition(async () => {
      const result = await activateLegalVersionAction(id, documentType);
      if (result.ok) {
        toast.success("Version activated.");
        router.refresh();
      } else {
        toast.error(result.message);
      }
    });
  }

  function handleDeactivate() {
    if (
      !confirm(
        "Deactivate this version? No active version will remain for this document until you activate another.",
      )
    ) {
      return;
    }
    startTransition(async () => {
      const result = await deactivateLegalVersionAction(id, documentType);
      if (result.ok) {
        toast.success("Version deactivated.");
        router.refresh();
      } else {
        toast.error(result.message);
      }
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {isActive ? (
        <Button
          variant="outline"
          disabled={pending}
          onClick={handleDeactivate}
        >
          Deactivate Version
        </Button>
      ) : (
        <Button variant="outline" disabled={pending} onClick={handleActivate}>
          Activate Version
        </Button>
      )}
    </div>
  );
}
