/**
 * Staff-facing tour title/contact identity.
 *
 * When a tour is attached to a Lead, the authoritative customer identity is
 * the live Lead row (leadDisplayName). tour_appointments.contact_name is only
 * a denormalized snapshot for walk-ins / orphan rows and for consumers that
 * read the column after Lead edits sync it.
 */
import { leadDisplayName } from "@/lib/leads/constants";

export type TourLeadNameFields = {
  first_name?: string | null;
  last_name?: string | null;
  partner_first_name?: string | null;
  partner_last_name?: string | null;
};

/** Canonical contact label written onto tour_appointments.contact_name. */
export function tourContactNameFromLeadIdentity(input: {
  firstName: string;
  lastName: string;
  partnerFirstName?: string | null;
  partnerLastName?: string | null;
}): string {
  return leadDisplayName(
    input.firstName,
    input.lastName,
    input.partnerFirstName,
    input.partnerLastName,
  );
}

/**
 * Prefer live Lead identity when the appointment is attached to a usable Lead.
 * Fall back to the stored contact_name snapshot otherwise.
 */
export function resolveTourContactDisplayName(opts: {
  contactName: string | null | undefined;
  lead: TourLeadNameFields | null | undefined;
}): string | null {
  const lead = opts.lead;
  if (lead && (lead.first_name?.trim() || lead.last_name?.trim())) {
    return leadDisplayName(
      lead.first_name ?? "",
      lead.last_name ?? "",
      lead.partner_first_name,
      lead.partner_last_name,
    );
  }
  return opts.contactName ?? null;
}
