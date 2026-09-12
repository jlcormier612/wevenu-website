/**
 * Event Order Templates — reusable delivery structure only:
 * section names + optional section guidance.
 * Applying a template to an Event Order copies sections — not checklist lines.
 */

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
