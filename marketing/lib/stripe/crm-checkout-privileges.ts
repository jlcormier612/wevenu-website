/**
 * Resolve which Checkout privileges a caller may use after CRM auth is known.
 *
 * Public callers never receive relationship binding or existing-Customer reuse
 * from client-supplied ids — even when those ids are present in the body.
 */
export function resolveCrmCheckoutPrivileges(input: {
  crmAssisted: boolean;
  relationshipId?: string | null;
  stripeCustomerId?: string | null;
}): {
  relationshipId: string;
  stripeCustomerId: string;
  isPath2: boolean;
  rejectedUnauthCustomerReuse: boolean;
} {
  const rawCustomer = input.stripeCustomerId?.trim() || "";
  const rawRelationship = input.relationshipId?.trim() || "";

  if (!input.crmAssisted) {
    return {
      relationshipId: "",
      stripeCustomerId: "",
      isPath2: false,
      rejectedUnauthCustomerReuse: Boolean(rawCustomer),
    };
  }

  return {
    relationshipId: rawRelationship,
    stripeCustomerId: rawCustomer,
    isPath2: Boolean(rawRelationship),
    rejectedUnauthCustomerReuse: false,
  };
}
