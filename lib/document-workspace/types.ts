/**
 * Canonical Document Workspace — data shapes.
 *
 * WorkspaceDocument normalizes five existing, untouched producers
 * (documents / contracts / invoices / floor_plans / event_questionnaires,
 * via get_venue_documents()) into one shape every canonical component
 * renders. Producer tables are never altered — this is a read-model only.
 */

/** The five real producer tables get_venue_documents() unions. Matches the CHECK constraint on document_workspace_pins/interactions.doc_type. */
export type WorkspaceDocType = "document" | "contract" | "invoice" | "floor_plan" | "questionnaire";

/** The brief's fixed, 12-value category list (Step 2, Section 3). No additional categories. */
export type WorkspaceCategory =
  | "Contracts"
  | "Invoices"
  | "Questionnaires"
  | "Planning"
  | "Floor Plans"
  | "Wedding Website"
  | "Photos"
  | "Vendor Documents"
  | "Financial"
  | "Communication"
  | "Exports"
  | "Other";

export const WORKSPACE_CATEGORIES: WorkspaceCategory[] = [
  "Contracts", "Invoices", "Questionnaires", "Planning", "Floor Plans",
  "Wedding Website", "Photos", "Vendor Documents", "Financial",
  "Communication", "Exports", "Other",
];

/** Normalized 3-tier status for the card/badge — each producer's own status maps down to this. Not a redesign of any producer's real status (still carried as rawStatus for the Preview panel). */
export type WorkspaceStatus = "action_needed" | "in_progress" | "complete" | "none";

export type WorkspaceOwnerType = "lead" | "client" | "event" | "vendor" | "venue";

export type WorkspaceDocument = {
  docType: WorkspaceDocType;
  id: string;
  name: string;
  category: WorkspaceCategory;
  /** The producer's own raw status string (e.g. "sent", "paid", "submitted") — shown in the Preview panel, not redesigned. */
  rawStatus: string | null;
  status: WorkspaceStatus;
  currentVersion: number;
  ownerType: WorkspaceOwnerType;
  leadId: string | null;
  clientId: string | null;
  eventId: string | null;
  vendorId: string | null;
  relationshipName: string | null;
  eventName: string | null;
  fileUrl: string | null;
  fileSize: number | null;
  mimeType: string | null;
  isCoupleVisible: boolean;
  isVendorVisible: boolean;
  uploadedByType: "venue" | "vendor";
  /** Type-specific extras the Preview panel's Representation section reads — never rendered generically. */
  amount?: number | null;
  balanceDue?: number | null;
  signToken?: string | null;
  signedAt?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type WorkspaceScope = {
  leadId?: string;
  clientId?: string;
  eventId?: string;
  vendorId?: string;
};

export type WorkspaceFilters = {
  category?: WorkspaceCategory;
  status?: WorkspaceStatus;
  shared?: boolean;
  signed?: boolean;
};

export type WorkspaceSort = "recent" | "name" | "relationship" | "category" | "created" | "modified" | "status";

/** Version History — Step 5. Producers today carry no real multi-version chain (confirmed in Step 1); every document normalizes to at least one entry, honestly labeled, not fabricated. */
export type WorkspaceVersion = {
  versionNumber: number;
  createdBy: string;
  createdAt: string;
  reason: string;
  current: boolean;
  locked: boolean;
  representation: string;
};

/** Document Activity — Step 2, Section 5. */
export type WorkspaceActivityAction =
  | "generated" | "uploaded" | "edited" | "shared" | "viewed" | "signed" | "downloaded" | "archived";

export type WorkspaceActivityEntry = {
  id: string;
  action: WorkspaceActivityAction;
  occurredAt: string;
  actor?: string | null;
};

/** Step 11 — surfaced from existing authorization only, not redesigned. "Comment" is the brief's own future placeholder. */
export type WorkspacePermissions = {
  read: boolean;
  edit: boolean;
  comment: false;
  share: boolean;
  download: boolean;
  archive: boolean;
  lock: boolean;
};
