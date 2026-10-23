/**
 * P2-D — Surface the shared final Event Order in the couple Documents list.
 * Reuses get_event_order_for_portal authority (shared_at only); no second store.
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

export type SharedEventOrderForDocuments = {
  id: string;
  sharedAt: string | null;
  clientAgreedAt?: string | null;
  revision?: number | null;
};

/**
 * Prepend a synthetic event_order document when a shared portal order exists
 * and the list does not already include that order id / docType.
 * Unshared / missing orders → no change (draft never appears).
 */
export function mergeSharedEventOrderIntoCoupleDocuments<T extends CouplePortalDocumentLike>(
  documents: T[],
  eventOrder: SharedEventOrderForDocuments | null | undefined,
): T[] {
  if (!eventOrder?.id || !eventOrder.sharedAt) return documents;

  const already = documents.some(
    (d) =>
      d.docType === "event_order"
      || d.id === eventOrder.id
      || (typeof d.id === "string" && d.id.startsWith(`event-order:${eventOrder.id}`)),
  );
  if (already) return documents;

  const synthetic = {
    id: `event-order:${eventOrder.id}`,
    docType: "event_order",
    name: "Event Order",
    status: eventOrder.clientAgreedAt ? "agreed" : "shared",
    signedAt: null,
    amount: null,
    fileUrl: null,
    uploadedBy: "venue",
    vendorName: null,
    createdAt: eventOrder.sharedAt,
    eventOrderId: eventOrder.id,
    revision: eventOrder.revision ?? null,
    clientAgreedAt: eventOrder.clientAgreedAt ?? null,
    portalSection: "event-order",
  } as unknown as T;

  return [synthetic, ...documents];
}
