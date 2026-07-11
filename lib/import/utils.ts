import { ENTITY_FIELDS, type EntityType, type FieldMapping, type ImportFieldDef } from "./types";
import type { ClientInput } from "@/lib/clients/types";
import type { LeadInput } from "@/lib/leads/types";
import type { VendorInput } from "@/lib/vendors/types";
import type { PackageInput } from "@/lib/packages/types";

type CsvRow = Record<string, string>;

/**
 * Inventory's categoryId is a resolved uuid, not free text — CSV rows only
 * ever carry the category's name. Category resolution (find-or-create) needs
 * a DB call, so it happens server-side in importInventoryAction; this stays
 * a plain string here, the same shape every other row conversion uses.
 */
export type InventoryImportRow = {
  name: string; categoryName: string; quantityAvailable: string;
  width: string; length: string; height: string; shape: string; color: string; printableName: string;
};

function val(row: CsvRow, mapping: FieldMapping, key: string): string {
  const col = mapping[key];
  return col ? (row[col] ?? "").trim() : "";
}

export function rowToClientInput(row: CsvRow, mapping: FieldMapping): ClientInput {
  return {
    firstName:        val(row, mapping, "firstName"),
    lastName:         val(row, mapping, "lastName"),
    email:            val(row, mapping, "email"),
    phone:            val(row, mapping, "phone"),
    partnerFirstName: val(row, mapping, "partnerFirstName"),
    partnerLastName:  val(row, mapping, "partnerLastName"),
    partnerEmail:     "",
    eventType:        val(row, mapping, "eventType"),
    eventDate:        val(row, mapping, "eventDate"),
    endDate:          "",
    guestCount:       val(row, mapping, "guestCount"),
    ceremonyTime:     "",
    receptionTime:    "",
    rehearsalDate:    "",
    internalNotes:    val(row, mapping, "internalNotes"),
  };
}

export function rowToLeadInput(row: CsvRow, mapping: FieldMapping): LeadInput {
  return {
    firstName:        val(row, mapping, "firstName"),
    lastName:         val(row, mapping, "lastName"),
    email:            val(row, mapping, "email"),
    phone:            val(row, mapping, "phone"),
    partnerFirstName: "",
    partnerLastName:  "",
    partnerEmail:     "",
    eventType:        val(row, mapping, "eventType"),
    eventDate:        val(row, mapping, "eventDate"),
    endDate:          "",
    guestCount:       "",
    estimatedBudget:  val(row, mapping, "estimatedBudget"),
    source:           val(row, mapping, "source"),
    inquiryMessage:   val(row, mapping, "inquiryMessage"),
    inquiryDate:      "",
  };
}

export function rowToVendorInput(row: CsvRow, mapping: FieldMapping): VendorInput {
  return {
    businessName:    val(row, mapping, "businessName"),
    category:        val(row, mapping, "category"),
    contactName:     val(row, mapping, "contactName"),
    email:           val(row, mapping, "email"),
    phone:           val(row, mapping, "phone"),
    websiteUrl:      val(row, mapping, "websiteUrl"),
    instagramUrl:       "",
    facebookUrl:        "",
    pinterestUrl:       "",
    tiktokUrl:          "",
    preferenceLevel:    "preferred",
    description:        "",
    logoUrl:            "",
    pricingTier:        val(row, mapping, "pricingTier"),
    notes:              val(row, mapping, "notes"),
    specialPricingNote: "",
  };
}

export function rowToInventoryInput(row: CsvRow, mapping: FieldMapping): InventoryImportRow {
  return {
    name:              val(row, mapping, "name"),
    categoryName:      val(row, mapping, "category"),
    quantityAvailable: val(row, mapping, "quantity"),
    width:             val(row, mapping, "width"),
    length:            val(row, mapping, "length"),
    height:            val(row, mapping, "height"),
    shape:             val(row, mapping, "shape"),
    color:             val(row, mapping, "color"),
    printableName:     val(row, mapping, "printableName"),
  };
}

export function rowToPackageInput(row: CsvRow, mapping: FieldMapping): PackageInput {
  return {
    name:        val(row, mapping, "name"),
    description: val(row, mapping, "description"),
    basePrice:   val(row, mapping, "basePrice"),
    category:    val(row, mapping, "category"),
    isActive:    true,
  };
}

export function getSampleValue(
  rows: CsvRow[],
  header: string,
): string {
  for (const row of rows.slice(0, 5)) {
    const v = (row[header] ?? "").trim();
    if (v) return v;
  }
  return "";
}

// One realistic example value per field key, so a downloaded template
// isn't just bare column headers — it shows the expected shape (date
// format, what "Category" means for a vendor, etc.) without anyone having
// to guess or reverse-engineer it from an error message after uploading.
// One realistic example value per (entity, field key), so a downloaded
// template isn't just bare column headers — it shows the expected shape
// (date format, what "Category" means for a vendor vs. an inventory item,
// etc.) without anyone having to guess or reverse-engineer it from an error
// message after uploading. Scoped per entity — several entities share
// generically-named keys (name, category) that mean very different things.
const TEMPLATE_SAMPLE_VALUES: Record<EntityType, Record<string, string>> = {
  couples: {
    firstName: "Emma", lastName: "Johnson",
    partnerFirstName: "James", partnerLastName: "Smith",
    email: "emma.johnson@example.com", phone: "555-0142",
    eventDate: "2027-06-12", eventType: "Wedding", guestCount: "120",
    internalNotes: "Prefers weekend tours",
  },
  leads: {
    firstName: "Emma", lastName: "Johnson",
    email: "emma.johnson@example.com", phone: "555-0142",
    eventDate: "2027-06-12", eventType: "Wedding",
    estimatedBudget: "15000", source: "Website",
    inquiryMessage: "Interested in a June 2027 date",
  },
  vendors: {
    businessName: "Bloom & Co Florals", category: "Florist",
    contactName: "Maria Chen", email: "maria@abcflorals.com", phone: "555-0142",
    websiteUrl: "https://example.com", pricingTier: "$$",
    notes: "Preferred vendor, responsive",
  },
  inventory: {
    name: "60\" Round Table", category: "Tables", quantity: "20",
    width: "60", length: "60", height: "30", shape: "round", color: "White",
    printableName: "Round Table (Seats 8)",
  },
  packages: {
    name: "Silver Package", description: "Includes linens, chairs, and centerpieces for up to 100 guests.",
    basePrice: "2500", category: "Reception",
  },
};

/** Builds a downloadable CSV template for an entity: header row + one example row. */
export function buildTemplateCsv(entity: EntityType): string {
  const fields: ImportFieldDef[] = ENTITY_FIELDS[entity];
  const samples = TEMPLATE_SAMPLE_VALUES[entity];
  const escape = (v: string) => (v.includes(",") || v.includes('"') ? `"${v.replace(/"/g, '""')}"` : v);
  const header = fields.map((f) => escape(f.label)).join(",");
  const sample = fields.map((f) => escape(samples[f.key] ?? "")).join(",");
  return `${header}\n${sample}\n`;
}

export function validateRequiredFields(
  fields: ImportFieldDef[],
  mapping: FieldMapping,
  rows: CsvRow[],
): { readyCount: number; issueCount: number } {
  const requiredKeys = fields.filter((f) => f.required).map((f) => f.key);
  let issues = 0;
  for (const row of rows) {
    const missing = requiredKeys.some((k) => {
      const col = mapping[k];
      return !col || !(row[col] ?? "").trim();
    });
    if (missing) issues++;
  }
  return { readyCount: rows.length - issues, issueCount: issues };
}

export function localStorageKey(entity: EntityType): string {
  return `wevenu-import-mapping-${entity}`;
}

export function loadSavedMapping(entity: EntityType, headers: string[]): FieldMapping | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(localStorageKey(entity));
    if (!raw) return null;
    const saved: { headers: string[]; mapping: FieldMapping } = JSON.parse(raw);
    if (JSON.stringify(saved.headers.slice().sort()) !== JSON.stringify(headers.slice().sort())) return null;
    return saved.mapping;
  } catch {
    return null;
  }
}

export function saveMapping(entity: EntityType, headers: string[], mapping: FieldMapping): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(localStorageKey(entity), JSON.stringify({ headers, mapping }));
  } catch {
    // localStorage quota exceeded — ignore
  }
}
