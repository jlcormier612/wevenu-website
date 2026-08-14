/**
 * Hello to Cheers — Starter Packages (PKG-01 / PKG-02 / PKG-03).
 *
 * Catalog structure only: name, description, inclusions. No prices.
 * Venues customize spaces, services, and pricing to match what they offer.
 * Masters are code fixtures — never editable DB rows.
 */

export type PackageStarterMasterKey = "PKG-01" | "PKG-02" | "PKG-03";

export type PackageStarterItem = {
  description: string;
  quantity: number;
  unit: string | null;
};

export type PackageStarterMaster = {
  key: PackageStarterMasterKey;
  name: string;
  description: string;
  /** Existing packages.category freeform — use Venue (not invented Wedding category). */
  category: string;
  sortOrder: number;
  items: PackageStarterItem[];
};

const item = (description: string, quantity = 1, unit: string | null = null): PackageStarterItem => ({
  description,
  quantity,
  unit,
});

/**
 * PKG-01 — venue-focused foundation.
 * PKG-02 — Essential + more convenience (not a duplicate of PKG-01).
 * PKG-03 — highest-touch planning / setup / support examples the model supports.
 *
 * No capacity claims, catering/alcohol promises, legal policies, or prices.
 */
export const PACKAGE_STARTER_MASTERS: readonly PackageStarterMaster[] = [
  {
    key: "PKG-01",
    name: "Essential Wedding",
    description:
      "A simple starting package for couples who want a beautiful venue and the flexibility to make the celebration their own. Customize the included spaces, services, and pricing to match your venue.",
    category: "Venue",
    sortOrder: 0,
    items: [
      item("Exclusive use of selected venue spaces for contracted event hours", 1, "event"),
      item("Ceremony seating furniture setup", 1, "setup"),
      item("Reception tables and chairs setup", 1, "setup"),
      item("Day-of venue contact", 1, "event"),
      item("Client planning portal access", 1, "booking"),
    ],
  },
  {
    key: "PKG-02",
    name: "Signature Wedding",
    description:
      "A more complete wedding experience with the essentials handled for you. Customize the included services, spaces, and enhancements to reflect what your venue provides.",
    category: "Venue",
    sortOrder: 1,
    items: [
      item("Exclusive use of selected venue spaces for contracted event hours", 1, "event"),
      item("Ceremony and reception furniture setup", 1, "setup"),
      item("Guest table linens (as provided by venue)", 1, "set"),
      item("Day-of venue coordination", 1, "event"),
      item("Planning timeline guidance", 1, "booking"),
      item("Client planning portal access", 1, "booking"),
    ],
  },
  {
    key: "PKG-03",
    name: "Full-Service Wedding",
    description:
      "A comprehensive starting package designed to take more of the event details off the couple's plate. Customize the included services, spaces, and enhancements to match what your venue actually provides.",
    category: "Venue",
    sortOrder: 2,
    items: [
      item("Exclusive use of selected venue spaces for contracted event hours", 1, "event"),
      item("Ceremony and reception furniture setup", 1, "setup"),
      item("Guest table linens (as provided by venue)", 1, "set"),
      item("Place-setting setup support (as provided by venue)", 1, "set"),
      item("Expanded day-of venue coordination", 1, "event"),
      item("Planning timeline guidance and check-ins", 1, "booking"),
      item("Vendor load-in and load-out coordination support", 1, "event"),
      item("Client planning portal access", 1, "booking"),
    ],
  },
] as const;

export function getPackageStarterMaster(key: string): PackageStarterMaster | undefined {
  return PACKAGE_STARTER_MASTERS.find((m) => m.key === key);
}

/**
 * Pure skip rules used by provision (unit-tested). Never overwrite an existing
 * key or same-named customized package for the venue.
 */
export function shouldSkipPackageStarterProvision(opts: {
  masterKey: string;
  masterName: string;
  existingByKey: Set<string>;
  existingNames: Set<string>;
}): "skip_key" | "skip_name" | "create" {
  if (opts.existingByKey.has(opts.masterKey)) return "skip_key";
  if (opts.existingNames.has(opts.masterName)) return "skip_name";
  return "create";
}
