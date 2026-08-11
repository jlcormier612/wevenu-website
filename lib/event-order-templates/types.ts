/**
 * Event Order Templates — Work Package D7A.
 * A reusable starting point for what an Event Order will contain: section
 * names + standard lines (description/quantity/price). Purely structural —
 * never a live Package/Inventory reference, never a price/total calculated
 * here. See supabase/migrations/20261261000000_event_order_templates.sql.
 */

export type EventOrderTemplate = {
  id: string;
  venueId: string;
  name: string;
  description: string | null;
  /** Hello to Cheers master key (EO-01 / EO-02) when provisioned from a starter. */
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
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

export type EventOrderTemplateLine = {
  id: string;
  templateId: string;
  venueId: string;
  sectionId: string | null;
  description: string;
  quantity: number;
  unitPrice: number;
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
  quantity: string;    // raw form input, parsed server-side — matches AddCustomLineInput's own shape
  unitPrice: string;
  sectionId: string | null;
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
