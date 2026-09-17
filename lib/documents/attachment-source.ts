/**
 * Where an attached file comes from — one vocabulary for every venue-facing
 * attachment surface.
 *
 * After setup, the files a venue shares over and over already live in Hello to
 * Cheers: the insurance certificate, the pricing guide, the floor plan, the
 * rain plan, the preferred-vendor sheet. The computer is where you go for the
 * exception, not the rule. So the Documents already in the product are offered
 * first, and uploading is the secondary path for something genuinely new.
 *
 * That ordering is the whole product decision. It is kept here rather than
 * retyped per surface so the four places that offer both sources cannot drift
 * into four different mental models — which is exactly what happened when the
 * Inbox grew a separate "From Library" button beside "Attach" and left staff to
 * work out that the two words meant two different filing cabinets.
 *
 * Deliberately absent from every string below: bucket, storage object, signed
 * URL, delivery copy, entity-scoped. Those are true of the implementation and
 * meaningless to someone trying to send a brochure.
 */

/** The single entry point into choosing a file, where a surface has one. */
export const ATTACHMENT_ENTRY_LABEL = "Add a document";

export const ATTACHMENT_SOURCE_LABELS = {
  /** Primary: something already in Hello to Cheers. */
  fromDocuments: "Choose from Documents",
  /** Secondary: something that isn't in Hello to Cheers yet. */
  fromComputer: "Upload from computer",
} as const;

export type AttachmentSource = keyof typeof ATTACHMENT_SOURCE_LABELS;

/**
 * Presentation order. Documents first is not a layout preference — it is the
 * product decision, and tests assert each surface renders in this order.
 */
export const ATTACHMENT_SOURCE_ORDER: readonly AttachmentSource[] = [
  "fromDocuments",
  "fromComputer",
] as const;

/** Shown when a venue has no Documents yet, so the list isn't just empty. */
export const ATTACHMENT_NO_DOCUMENTS_HINT =
  "You haven’t added any documents yet. Upload one from your computer and it’ll be here next time.";
