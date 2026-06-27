export type PackageItem = {
  id: string;
  packageId: string;
  venueId: string;
  description: string;
  quantity: number;
  unit: string | null;
  sortOrder: number;
  createdAt: string;
};

export type Package = {
  id: string;
  venueId: string;
  name: string;
  description: string | null;
  basePrice: number;
  category: string | null;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

export type PackageWithItems = Package & { items: PackageItem[] };

export type PackageItemInput = { description: string; quantity: string; unit: string };

export type PackageInput = {
  name: string;
  description: string;
  basePrice: string;
  category: string;
  isActive: boolean;
};

export type PackageErrors = Record<string, string>;

export type PackageActionResult =
  | { ok: true }
  | { ok: false; errors?: PackageErrors; message?: string };

export type CreatePackageResult =
  | { ok: true; packageId: string }
  | { ok: false; errors?: PackageErrors; message?: string };
