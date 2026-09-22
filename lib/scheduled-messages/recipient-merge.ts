/**
 * Recipient-specific merge perspective for primary vs partner email destinations.
 * client_name (couple display) never swaps. first_name / partner_* swap by role.
 */
import type { MergeContext } from "@/lib/message-templates/merge";
import type { EmailDestinationRole } from "@/lib/scheduled-messages/email-destinations";

function present(value: string | null | undefined): string | null {
  const t = value?.trim();
  return t ? t : null;
}

/**
 * Build merge context for the person receiving the message.
 * role=primary → self is primary person; partner_* is partner.
 * role=partner → self is partner; partner_* is the primary person.
 */
export function mergeContextForEmailDestination(
  base: MergeContext,
  role: EmailDestinationRole,
): MergeContext {
  const primaryFirst = present(base.clientFirstName);
  const primaryLast = present(base.clientLastName);
  const partnerFirst = present(base.partnerFirstName);
  const partnerLast = present(base.partnerLastName);

  if (role === "primary") {
    return {
      ...base,
      clientFirstName: primaryFirst,
      clientLastName: primaryLast,
      partnerFirstName: partnerFirst,
      partnerLastName: partnerLast,
    };
  }

  return {
    ...base,
    clientFirstName: partnerFirst,
    clientLastName: partnerLast,
    partnerFirstName: primaryFirst,
    partnerLastName: primaryLast,
  };
}
