/**
 * Resolve which email to use when creating an account from a client/couple
 * invitation. The invitation token is authoritative — never trust a blank
 * submitted email from a disabled form field.
 */
export function resolveInvitationAccountEmail(input: {
  invitationEmail: string | null | undefined;
  submittedEmail: string;
}): { ok: true; email: string } | { ok: false; error: string } {
  const invited = (input.invitationEmail ?? "").trim().toLowerCase();
  if (!invited || !invited.includes("@")) {
    return {
      ok: false,
      error: "This invitation is missing an email address. Ask your venue to resend it.",
    };
  }

  const submitted = input.submittedEmail.trim().toLowerCase();
  if (submitted && submitted !== invited) {
    return {
      ok: false,
      error: "Use the email address this invitation was sent to.",
    };
  }

  return { ok: true, email: invited };
}
