/**
 * Event Order Templates — reusable delivery structure:
 * sections + optional snapshot offerings (priced or not).
 * Applying copies snapshots into the event-specific Event Order.
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

export type EventOrderTemplateWithDetails = EventOrderTemplate & {
  sections: EventOrderTemplateSection[];
  lines: EventOrderTemplateLine[];
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
