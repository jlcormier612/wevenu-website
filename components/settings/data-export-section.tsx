"use client";

import * as React from "react";
import { Download, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { exportVenueDataAction } from "@/app/(app)/settings/actions";
import { Button } from "@/components/ui/button";

function downloadJson(json: string, filename: string) {
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function DataExportSection() {
  const [pending, setPending] = React.useState(false);

  async function handleExport() {
    setPending(true);
    try {
      const result = await exportVenueDataAction();
      if (result.ok) {
        const date = new Date().toISOString().slice(0, 10);
        downloadJson(result.json, `wevenu-export-${date}.json`);
        toast.success("Your data has been exported.");
      } else {
        toast.error(result.message ?? "Could not export your data.");
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <Button type="button" variant="outline" onClick={handleExport} disabled={pending}>
      {pending
        ? <><Loader2 className="mr-1.5 h-4 w-4 animate-spin" />Preparing export…</>
        : <><Download className="mr-1.5 h-4 w-4" />Export my data</>}
    </Button>
  );
}
