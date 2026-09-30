/**
 * Event Order Templates — reusable commercial build sheets:
 * fixed lines + selectable groups/options with rules and snapshot pricing.
 * Applying / Use / Send freezes snapshots into the event-specific Event Order.
 * The Event Order remains the source of truth; templates are not commitments.
 */

import type { TemplatePricingModel } from "@/lib/event-order-templates/offerings";

export type EventOrderTemplate = {
  id: string;
  venueId: string;
  name: string;
  description: string | null;
  /** Hello to Cheers master key (EO-D-01 / EO-D-02, or legacy EO-01 / EO-02). */
  sourceMasterKey: string | null;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
};

export type EventOrderTemplateSection = {
  id: string;
  templateId: string;
  venueId: string;
  name: string;
  guidance: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

export type EventOrderTemplateLine = {
  id: string;
  templateId: string;
  venueId: string;
  sectionId: string | null;
  /** Offering name (stored as description). */
  description: string;
  descriptionDetail: string | null;
  quantity: number;
  unitPrice: number | null;
  pricingModel: TemplatePricingModel;
  unit: string | null;
  includedByDefault: boolean;
  offeringId: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

export type EventOrderTemplateSelectionMode = "single" | "multi";

/** Selectable commercial group (e.g. Bar — choose one). */
export type EventOrderTemplateGroup = {
  id: string;
  templateId: string;
  venueId: string;
  sectionId: string | null;
  name: string;
  instructions: string | null;
  selectionMode: EventOrderTemplateSelectionMode;
  minSelect: number;
  maxSelect: number | null;
  allowQuantity: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

/** Option inside a choice group (Offering ref and/or custom label). */
export type EventOrderTemplateOption = {
  id: string;
  templateId: string;
  venueId: string;
  groupId: string;
  offeringId: string | null;
  label: string;
  description: string | null;
  isIncluded: boolean;
  unitPrice: number | null;
  isDefault: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

export type EventOrderTemplateWithDetails = EventOrderTemplate & {
  sections: EventOrderTemplateSection[];
  lines: EventOrderTemplateLine[];
  groups: EventOrderTemplateGroup[];
  options: EventOrderTemplateOption[];
};

export type EventOrderTemplateInput = { name: string; description: string };

export type AddTemplateLineInput = {
  description: string;
  descriptionDetail?: string;
  quantity: string;
  unitPrice: string;
  hasPrice?: boolean;
  pricingModel?: string;
  unit?: string;
  includedByDefault?: boolean;
  offeringId?: string | null;
  sectionId: string | null;
};

export type UpdateTemplateLineInput = AddTemplateLineInput;

export type AddTemplateGroupInput = {
  sectionId: string | null;
  name: string;
  instructions?: string;
  selectionMode: EventOrderTemplateSelectionMode;
  minSelect: number;
  maxSelect: number | null;
  allowQuantity: boolean;
};

export type AddTemplateOptionInput = {
  groupId: string;
  offeringId?: string | null;
  label: string;
  description?: string;
  isIncluded?: boolean;
  unitPrice?: string | null;
  isDefault?: boolean;
};

export type EventOrderTemplateErrors = Record<string, string>;

export type EventOrderTemplateActionResult =
  | { ok: true }
  | { ok: false; message?: string; errors?: EventOrderTemplateErrors };

export type CreateEventOrderTemplateResult =
  | { ok: true; templateId: string }
  | { ok: false; message?: string; errors?: EventOrderTemplateErrors };

export type AddTemplateSectionResult =
  | { ok: true; section: EventOrderTemplateSection }
  | { ok: false; message?: string };

export type AddTemplateLineResult =
  | { ok: true; line: EventOrderTemplateLine }
  | { ok: false; message?: string; errors?: EventOrderTemplateErrors };

export type AddTemplateGroupResult =
  | { ok: true; group: EventOrderTemplateGroup }
  | { ok: false; message?: string; errors?: EventOrderTemplateErrors };

export type AddTemplateOptionResult =
  | { ok: true; option: EventOrderTemplateOption }
  | { ok: false; message?: string; errors?: EventOrderTemplateErrors };
