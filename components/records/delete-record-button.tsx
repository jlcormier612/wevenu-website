"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { LibraryDeleteConfirmDialog } from "@/components/library/library-delete-confirm-dialog";
import { Button } from "@/components/ui/button";
import type { DeletePreview } from "@/lib/records/delete-record";

type Kind = "lead" | "client";

export function DeleteRecordButton({
  kind,
  recordId,
  fallbackName,
  previewAction,
  deleteAction,
}: {
  kind: Kind;
  recordId: string;
  fallbackName: string;
  previewAction: (id: string) => Promise<DeletePreview>;
  deleteAction: (id: string) => Promise<{ ok: true } | { ok: false; message: string }>;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [pending, setPending] = React.useState(false);
  const [preview, setPreview] = React.useState<Extract<DeletePreview, { ok: true }> | null>(null);

  async function openConfirm() {
    setPending(true);
    const result = await previewAction(recordId);
    setPending(false);
    if (!result.ok) {
      toast.error(result.message);
      return;
    }
    setPreview(result);
    setOpen(true);
  }

  async function confirm() {
    setPending(true);
    const result = await deleteAction(recordId);
    setPending(false);
    if (!result.ok) {
      toast.error(result.message);
      return;
    }
    setOpen(false);
    toast.success(kind === "lead" ? "Lead deleted." : "Record deleted.");
    router.push(kind === "lead" ? "/leads" : "/clients");
    router.refresh();
  }

  const name = preview?.displayName ?? fallbackName;
  const label = kind === "lead" ? "lead" : "record";

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="text-destructive hover:text-destructive"
        disabled={pending && !open}
        onClick={() => void openConfirm()}
      >
        Delete
      </Button>
      <LibraryDeleteConfirmDialog
        open={open}
        itemName={name}
        itemLabel={label}
        title={kind === "lead" ? `Delete ${name}?` : `Delete ${name}?`}
        description={
          preview ? (
            <span className="block space-y-2">
              <span className="block">Reporting impact:</span>
              <ul className="list-disc space-y-1 pl-5">
                {preview.confirmation.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </span>
          ) : (
            "This will permanently remove this record."
          )
        }
        pending={pending}
        onConfirm={() => void confirm()}
        onCancel={() => {
          if (!pending) setOpen(false);
        }}
      />
    </>
  );
}
