"use client";

/** Work Package D7C — "Save Report" (brief §20). Reads exactly the same pathname/searchParams DateRangeControl itself already reads, so this always saves precisely what's on screen. */
import * as React from "react";

import { Bookmark, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { createSavedReportAction } from "@/app/(app)/reporting/saved-reports-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { SAVED_REPORT_PATHS, SAVED_REPORT_PATH_LABEL, type SavedReportPath } from "@/lib/saved-reports/types";
import type { DateRangePreset } from "@/lib/reporting/date-range";

export function SaveReportButton({
  pathname, preset, customFrom, customTo,
}: { pathname: string; preset: DateRangePreset; customFrom?: string; customTo?: string }) {
  const [open, setOpen] = React.useState(false);
  const [name, setName] = React.useState("");
  const [pending, startTransition] = React.useTransition();

  const reportPath = SAVED_REPORT_PATHS.includes(pathname as SavedReportPath) ? (pathname as SavedReportPath) : null;
  if (!reportPath) return null;

  function handleSave() {
    startTransition(async () => {
      const result = await createSavedReportAction({
        name, reportPath: reportPath!, datePreset: preset,
        customFrom: preset === "custom" ? customFrom : undefined,
        customTo: preset === "custom" ? customTo : undefined,
      });
      if (result.ok) {
        toast.success("Saved. You can find this report anytime in Saved Reports.");
        setOpen(false); setName("");
      } else toast.error(result.message ?? "Could not save report.");
    });
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Bookmark className="mr-1.5 h-3.5 w-3.5" />Save Report
      </Button>
      <SheetContent side="right" className="w-full sm:max-w-sm">
        <SheetHeader className="mb-6">
          <SheetTitle>Save Report</SheetTitle>
          <p className="text-sm text-muted-foreground">{SAVED_REPORT_PATH_LABEL[reportPath]} — save this view so you can come back to it, or have it delivered on a schedule.</p>
        </SheetHeader>
        <div className="space-y-1.5">
          <Label className="text-sm font-medium text-heading">Name</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Monday Revenue Check" autoFocus />
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={pending}>Cancel</Button>
          <Button type="button" disabled={!name.trim() || pending} onClick={handleSave}>
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
