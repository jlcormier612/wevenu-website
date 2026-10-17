"use client";

import * as React from "react";
import { Download, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

function filenameFromDisposition(header: string | null): string | null {
  if (!header) return null;
  const match = /filename="([^"]+)"/.exec(header);
  return match?.[1] ?? null;
}

export function DataExportSection() {
  const [pending, setPending] = React.useState(false);

  async function handleExport() {
    setPending(true);
    try {
      const response = await fetch("/api/venue/export", { method: "GET" });
      if (!response.ok) {
        const body = await response.json().catch(() => null) as { message?: string } | null;
        toast.error(body?.message ?? "Could not export your data.");
        return;
      }
      const blob = await response.blob();
      const filename = filenameFromDisposition(response.headers.get("Content-Disposition"))
        ?? `hello-to-cheers-venue-export-${new Date().toISOString().slice(0, 10)}.zip`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success("Your data has been exported.");
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
