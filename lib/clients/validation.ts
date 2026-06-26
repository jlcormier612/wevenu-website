/**
 * Clients business-logic: validation rules. Pure functions.
 */
import { CLIENT_STATUSES } from "@/lib/clients/constants";
import type { ClientErrors, ClientInput, ClientStatus, KeyDateInput } from "@/lib/clients/types";

function isValidEmail(v: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());
}

export function validateClientInput(input: ClientInput): ClientErrors {
  const errors: ClientErrors = {};
  if (!input.firstName.trim()) errors.firstName = "First name is required.";
  if (!input.lastName.trim()) errors.lastName = "Last name is required.";
  if (input.email.trim() && !isValidEmail(input.email))
    errors.email = "Enter a valid email address.";
  if (input.partnerEmail.trim() && !isValidEmail(input.partnerEmail))
    errors.partnerEmail = "Enter a valid email address.";
  if (input.guestCount.trim()) {
    const n = Number(input.guestCount);
    if (!Number.isInteger(n) || n < 0) errors.guestCount = "Guest count must be a whole number.";
  }
  if (input.eventDate && input.endDate && input.endDate < input.eventDate)
    errors.endDate = "End date must be on or after the event date.";
  if (input.eventDate && input.rehearsalDate && input.rehearsalDate >= input.eventDate)
    errors.rehearsalDate = "Rehearsal should be before the event date.";
  return errors;
}

export function validateClientStatus(status: string): status is ClientStatus {
  return CLIENT_STATUSES.some((s) => s.value === status);
}

export function validateKeyDateInput(input: KeyDateInput): ClientErrors {
  const errors: ClientErrors = {};
  if (!input.label.trim()) errors.label = "A label is required.";
  if (!input.date) errors.date = "A date is required.";
  return errors;
}
