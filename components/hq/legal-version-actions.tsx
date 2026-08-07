"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

import {
  activateLegalVersionAction,
  deactivateLegalVersionAction,
} from "@/app/admin/legal/actions";
import { Button } from "@/components/ui/button";
import { canDeactivateLegalVersion } from "@/lib/legal/admin-helpers";
import type { LegalDocumentType } from "@/lib/legal/types";

export function LegalVersionActions({
  id,
  documentType,
  isActive,
  activeCountForType,
}: {
  id: string;
  documentType: LegalDocumentType;
  isActive: boolean;
  activeCountForType: number;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const canDeactivate = canDeactivateLegalVersion({
    isActive,
    activeCountForType,
  });

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
        "Deactivate this version? Only allowed when another active version already exists.",
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
          disabled={pending || !canDeactivate}
          title={
            canDeactivate
              ? undefined
              : "Cannot deactivate the only active version"
          }
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
