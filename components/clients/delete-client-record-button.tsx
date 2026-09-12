"use client";

import {
  deleteClientRecordAction,
  previewDeleteClientAction,
} from "@/app/(app)/clients/[id]/actions";
import { DeleteRecordButton } from "@/components/records/delete-record-button";

export function DeleteClientRecordButton({
  clientId,
  fallbackName,
}: {
  clientId: string;
  fallbackName: string;
}) {
  return (
    <DeleteRecordButton
      kind="client"
      recordId={clientId}
      fallbackName={fallbackName}
      previewAction={previewDeleteClientAction}
      deleteAction={deleteClientRecordAction}
    />
  );
}
