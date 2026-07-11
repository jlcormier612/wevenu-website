export type EntityType = "couples" | "leads" | "vendors" | "inventory" | "packages";

export type ImportFieldDef = {
  key: string;
  label: string;
  required: boolean;
};

export const COUPLE_FIELDS: ImportFieldDef[] = [
  { key: "firstName",        label: "Partner 1 First Name",    required: true  },
  { key: "lastName",         label: "Partner 1 Last Name",     required: true  },
  { key: "partnerFirstName", label: "Partner 2 First Name",    required: false },
  { key: "partnerLastName",  label: "Partner 2 Last Name",     required: false },
  { key: "email",            label: "Email",                   required: false },
  { key: "phone",            label: "Phone",                   required: false },
  { key: "eventDate",        label: "Event Date (YYYY-MM-DD)", required: false },
  { key: "eventType",        label: "Event Type",              required: false },
  { key: "guestCount",       label: "Guest Count",             required: false },
  { key: "internalNotes",    label: "Notes",                   required: false },
];

export const LEAD_FIELDS: ImportFieldDef[] = [
  { key: "firstName",       label: "First Name",              required: true  },
  { key: "lastName",        label: "Last Name",               required: true  },
  { key: "email",           label: "Email",                   required: false },
  { key: "phone",           label: "Phone",                   required: false },
  { key: "eventDate",       label: "Event Date (YYYY-MM-DD)", required: false },
  { key: "eventType",       label: "Event Type",              required: false },
  { key: "estimatedBudget", label: "Budget",                  required: false },
  { key: "source",          label: "Source",                  required: false },
  { key: "inquiryMessage",  label: "Inquiry Notes",           required: false },
];

export const VENDOR_FIELDS: ImportFieldDef[] = [
  { key: "businessName", label: "Business Name", required: true  },
  { key: "category",     label: "Category",      required: false },
  { key: "contactName",  label: "Contact Name",  required: false },
  { key: "email",        label: "Email",         required: false },
  { key: "phone",        label: "Phone",         required: false },
  { key: "websiteUrl",   label: "Website",       required: false },
  { key: "pricingTier",  label: "Pricing Tier",  required: false },
  { key: "notes",        label: "Notes",         required: false },
];

export const INVENTORY_FIELDS: ImportFieldDef[] = [
  { key: "name",           label: "Item Name",              required: true  },
  { key: "category",       label: "Category",               required: false },
  { key: "quantity",       label: "Quantity Available",     required: false },
  { key: "width",          label: "Width (in)",             required: false },
  { key: "length",         label: "Length (in)",            required: false },
  { key: "height",         label: "Height (in)",            required: false },
  { key: "shape",          label: "Shape",                  required: false },
  { key: "color",          label: "Color",                  required: false },
  { key: "printableName",  label: "Printable Name",         required: false },
];

export const PACKAGE_FIELDS: ImportFieldDef[] = [
  { key: "name",        label: "Package Name", required: true  },
  { key: "description", label: "Description",  required: false },
  { key: "basePrice",   label: "Base Price",   required: false },
  { key: "category",    label: "Category",     required: false },
];

export const ENTITY_FIELDS: Record<EntityType, ImportFieldDef[]> = {
  couples:   COUPLE_FIELDS,
  leads:     LEAD_FIELDS,
  vendors:   VENDOR_FIELDS,
  inventory: INVENTORY_FIELDS,
  packages:  PACKAGE_FIELDS,
};

export type FieldMapping = Record<string, string | null>;

export type ImportRowError = { row: number; message: string; kind: "skipped" | "error" };

export type ImportResult = {
  imported: number;
  errors: ImportRowError[];
};
