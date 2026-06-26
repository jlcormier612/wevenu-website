/**
 * Leads business logic: validation rules.
 * Pure functions — no side effects, no framework/database imports.
 */
import { LEAD_STATUSES } from "@/lib/leads/constants";
import type { LeadErrors, LeadInput, LeadStatus, TaskInput } from "@/lib/leads/types";

function isValidEmail(v: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());
}

export function validateLeadInput(input: LeadInput): LeadErrors {
  const errors: LeadErrors = {};

  if (!input.firstName.trim()) errors.firstName = "First name is required.";
  if (!input.lastName.trim()) errors.lastName = "Last name is required.";

  if (input.email.trim() && !isValidEmail(input.email))
    errors.email = "Enter a valid email address.";
  if (input.partnerEmail.trim() && !isValidEmail(input.partnerEmail))
    errors.partnerEmail = "Enter a valid email address.";

  if (input.guestCount.trim()) {
    const n = Number(input.guestCount);
    if (!Number.isInteger(n) || n < 0)
      errors.guestCount = "Guest count must be a whole number.";
    else if (n > 100_000) errors.guestCount = "That number looks too large.";
  }

  if (input.estimatedBudget.trim()) {
    const n = Number(input.estimatedBudget.replace(/[$,]/g, ""));
    if (isNaN(n) || n < 0)
      errors.estimatedBudget = "Enter a valid dollar amount.";
  }

  if (input.eventDate && input.endDate && input.endDate < input.eventDate)
    errors.endDate = "End date must be on or after the event date.";

  return errors;
}

export function validateStatus(status: string): status is LeadStatus {
  return LEAD_STATUSES.some((s) => s.value === status);
}

export function validateTaskInput(input: TaskInput): LeadErrors {
  const errors: LeadErrors = {};
  if (!input.title.trim()) errors.title = "Task title is required.";
  return errors;
}
