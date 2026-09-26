export type ChoicesTemplate = {
  id: string;
  venueId: string;
  name: string;
  description: string | null;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
};

export type ChoicesTemplateSection = {
  id: string;
  templateId: string;
  venueId: string;
  name: string;
  guidance: string | null;
  sortOrder: number;
};

export type ChoicesTemplateGroup = {
  id: string;
  templateId: string;
  venueId: string;
  sectionId: string | null;
  name: string;
  instructions: string | null;
  selectionMode: "single" | "multi";
  minSelect: number;
  maxSelect: number | null;
  allowQuantity: boolean;
  sortOrder: number;
};

export type ChoicesTemplateOption = {
  id: string;
  templateId: string;
  venueId: string;
  groupId: string;
  offeringId: string | null;
  label: string;
  description: string | null;
  isIncluded: boolean;
  unitPrice: number | null;
  sortOrder: number;
};

export type ChoicesTemplateWithDetails = ChoicesTemplate & {
  sections: ChoicesTemplateSection[];
  groups: ChoicesTemplateGroup[];
  options: ChoicesTemplateOption[];
};

export type ChoicesTemplateInput = { name: string; description: string };

export type ChoicesTemplateActionResult =
  | { ok: true }
  | { ok: false; message?: string; errors?: Record<string, string> };

export type CreateChoicesTemplateResult =
  | { ok: true; templateId: string }
  | { ok: false; message?: string; errors?: Record<string, string> };
