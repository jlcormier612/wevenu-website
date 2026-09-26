/**
 * Current client contact lives on `clients`. The enduring relationship
 * stores the primary name and email used for identity. Inquiry text and
 * source stay on the historical lead and are not part of this patch.
 */
export type RelationshipContactPatch = {
  first_name: string;
  last_name: string;
  email: string | null;
};

export function relationshipContactPatch(input: {
  firstName: string;
  lastName: string;
  email: string;
}): RelationshipContactPatch {
  return {
    first_name: input.firstName.trim(),
    last_name: input.lastName.trim(),
    email: input.email.trim() || null,
  };
}

/**
 * Identity fields that stay in lockstep on the linked `clients` row when
 * the venue edits the originating lead. Same customer — same client_id.
 * Event/date fields are not part of this patch.
 */
export type LinkedClientIdentityPatch = {
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  partner_first_name: string | null;
  partner_last_name: string | null;
  partner_email: string | null;
};

export function linkedClientIdentityPatch(input: {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  partnerFirstName: string;
  partnerLastName: string;
  partnerEmail: string;
}): LinkedClientIdentityPatch {
  return {
    first_name: input.firstName.trim(),
    last_name: input.lastName.trim(),
    email: input.email.trim() || null,
    phone: input.phone.trim() || null,
    partner_first_name: input.partnerFirstName.trim() || null,
    partner_last_name: input.partnerLastName.trim() || null,
    partner_email: input.partnerEmail.trim() || null,
  };
}
