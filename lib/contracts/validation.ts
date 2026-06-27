/**
 * Contracts validation. Pure functions.
 */
import type { ContractErrors, NewContractInput, TemplateInput } from "@/lib/contracts/types";

export function validateTemplateInput(input: TemplateInput): ContractErrors {
  const errors: ContractErrors = {};
  if (!input.name.trim()) errors.name = "Template name is required.";
  if (!input.content.trim()) errors.content = "Template content is required.";
  return errors;
}

export function validateNewContractInput(input: NewContractInput): ContractErrors {
  const errors: ContractErrors = {};
  if (!input.title.trim()) errors.title = "Contract title is required.";
  if (!input.clientId) errors.clientId = "Select a client for this contract.";
  if (!input.content.trim()) errors.content = "Contract content cannot be empty.";
  return errors;
}

export function validateSignerName(name: string): ContractErrors {
  const errors: ContractErrors = {};
  if (!name.trim()) errors.signerName = "Please enter your full name to sign.";
  if (name.trim().length < 2) errors.signerName = "Enter your full name.";
  return errors;
}
