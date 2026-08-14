"use client";

/**
 * Add Hello to Cheers starter messages again — never overwrites customized
 * venue copies; creates new independent rows from protected masters.
 */

import * as React from "react";

import { useRouter } from "next/navigation";
import { BookPlus, Loader2 } from "lucide-react";
import { toast } from "sonner";

import {
  addStarterMessageAgainAction,
  provisionMissingStartersAction,
} from "@/app/(app)/communication/templates/actions";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { StarterMessageMasterKey } from "@/lib/message-templates/starters";

export function AddHelloToCheersStarters({
  missingMasters,
}: {
  missingMasters: { key: StarterMessageMasterKey; name: string }[];
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();

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
        <DropdownMenuItem onClick={() => addOne("MSG-01")}>Add New Inquiry Response again</DropdownMenuItem>
        <DropdownMenuItem onClick={() => addOne("MSG-02")}>Add Tour Confirmation again</DropdownMenuItem>
        <DropdownMenuItem onClick={() => addOne("MSG-03")}>Add Tour Reminder again</DropdownMenuItem>
        <DropdownMenuItem onClick={() => addOne("MSG-04")}>Add Tour Follow-Up again</DropdownMenuItem>
        <DropdownMenuItem onClick={() => addOne("MSG-05")}>Add Proposal Follow-Up again</DropdownMenuItem>
        <DropdownMenuItem onClick={() => addOne("MSG-06")}>Add Contract Reminder again</DropdownMenuItem>
        <DropdownMenuItem onClick={() => addOne("MSG-07")}>Add Final Details Reminder again</DropdownMenuItem>
        <DropdownMenuItem onClick={() => addOne("MSG-08")}>Add Final Guest Count Reminder again</DropdownMenuItem>
        <DropdownMenuItem onClick={() => addOne("MSG-09")}>Add Almost Here again</DropdownMenuItem>
        <DropdownMenuItem onClick={() => addOne("MSG-10")}>Add Payment Reminder again</DropdownMenuItem>
        <DropdownMenuItem onClick={() => addOne("MSG-11")}>Add Post-Event Thank You again</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
