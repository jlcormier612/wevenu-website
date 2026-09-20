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
