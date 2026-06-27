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
