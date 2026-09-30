"use client";

/**
 * Add Hello to Cheers starter messages — never overwrites customized
 * venue copies; creates new independent rows from protected masters.
 * Distinct from Duplicate (which copies an existing venue-owned template).
 */

import * as React from "react";

import { useRouter } from "next/navigation";
import { BookPlus, Loader2 } from "lucide-react";
import { toast } from "sonner";

import {
  addStarterMessageAgainAction,
  provisionMissingStartersAction,
} from "@/app/(app)/communication/templates/actions";
import { starterInsertLabel } from "@/components/library/labels";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  STARTER_MESSAGE_MASTERS,
  type StarterMessageMasterKey,
} from "@/lib/message-templates/starters";

export function AddHelloToCheersStarters({
  missingMasters,
  presentKeys = [],
}: {
  missingMasters: { key: StarterMessageMasterKey; name: string }[];
  presentKeys?: string[];
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const present = new Set(presentKeys);

  function addOne(key: StarterMessageMasterKey) {
    startTransition(async () => {
      const result = await addStarterMessageAgainAction(key);
      if (result.ok) {
        toast.success("Starter added — your earlier customizations were left alone.");
        router.refresh();
      } else {
        toast.error(result.message ?? "Could not add starter.");
      }
    });
  }

  function addMissing() {
    startTransition(async () => {
      const result = await provisionMissingStartersAction();
      if (result.ok) {
        const n = result.created?.length ?? 0;
        toast.success(n > 0 ? `Added ${n} Hello to Cheers starter${n === 1 ? "" : "s"}.` : "All starters are already in your library.");
        router.refresh();
      } else {
        toast.error(result.message ?? "Could not add starters.");
      }
    });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button type="button" variant="outline" disabled={pending} />}>
        {pending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <BookPlus className="mr-1.5 h-4 w-4" />}
        Hello to Cheers starters
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        {missingMasters.length > 0 && (
          <DropdownMenuItem onClick={addMissing}>
            Add missing starters ({missingMasters.length})
          </DropdownMenuItem>
        )}
        {STARTER_MESSAGE_MASTERS.map((m) => (
          <DropdownMenuItem key={m.key} onClick={() => addOne(m.key)}>
            {starterInsertLabel(m.name, present.has(m.key))}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
