/**
 * Surface finalized Inventory Agreement in the couple Documents list.
 * Mirrors couple-documents-event-order.ts — no second store.
 */

export type CouplePortalDocumentLike = {
  id?: string;
  docType?: string;
  name?: string;
  status?: string | null;
  uploadedBy?: string;
  createdAt?: string;
  [key: string]: unknown;
};

export type FinalizedInventoryForDocuments = {
  id: string;
  finalizedAt: string | null;
  status: string;
};

/**
 * Prepend a synthetic inventory document when inventory is finalized.
 * Draft/shared/submitted without finalize → no change.
 */
export function mergeFinalizedInventoryIntoCoupleDocuments<T extends CouplePortalDocumentLike>(
  documents: T[],
  inventory: FinalizedInventoryForDocuments | null | undefined,
): T[] {
  if (!inventory?.id || inventory.status !== "finalized" || !inventory.finalizedAt) {
    return documents;
  }

  const already = documents.some(
    (d) =>
      d.docType === "event_inventory"
      || d.id === inventory.id
      || (typeof d.id === "string" && d.id.startsWith(`event-inventory:${inventory.id}`)),
  );
  if (already) return documents;

  const synthetic = {
    id: `event-inventory:${inventory.id}`,
    docType: "event_inventory",
    name: "Inventory Agreement",
    status: "finalized",
    signedAt: null,
    amount: null,
    fileUrl: null,
    uploadedBy: "venue",
    vendorName: null,
    createdAt: inventory.finalizedAt,
    eventInventoryId: inventory.id,
    portalSection: "inventory",
  } as unknown as T;

  return [synthetic, ...documents];
}
