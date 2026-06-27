/**
 * Vendor business-logic: validation rules. Pure functions.
 */
import type { VendorAssignmentInput, VendorErrors, VendorInput } from "@/lib/vendors/types";

export function validateVendorInput(input: VendorInput): VendorErrors {
  const errors: VendorErrors = {};
  if (!input.name.trim()) errors.name = "Vendor name is required.";
  if (input.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email))
    errors.email = "Enter a valid email address.";
  return errors;
}

export function validateAssignmentInput(input: VendorAssignmentInput): VendorErrors {
  const errors: VendorErrors = {};
  if (!input.vendorId) errors.vendorId = "Select a vendor to assign.";
  return errors;
}
