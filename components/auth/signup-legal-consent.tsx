"use client";

/**
 * Affirmative Terms + Privacy acknowledgment for account-creation forms.
 * Unchecked by default — mirrors venue Activate Account legal checkbox.
 */

import * as React from "react";

import {
  signupLegalLinks,
  type SignupLegalAudience,
} from "@/lib/legal/signup-consent";

export function SignupLegalConsent({
  audience,
  id = "signup-legal-accepted",
}: {
  audience: SignupLegalAudience;
  id?: string;
}) {
  const links = signupLegalLinks(audience);
  const copyId = `${id}-copy`;

  return (
    <div
      className="flex items-start gap-3 text-sm leading-relaxed text-foreground"
      data-testid="signup-legal-consent"
      data-signup-legal-audience={audience}
    >
      <input
        id={id}
        name="legalAccepted"
        type="checkbox"
        value="true"
        required
        aria-labelledby={copyId}
        data-testid="signup-legal-accepted"
        className="mt-1 size-4 shrink-0 rounded border-border accent-primary"
      />
      <span id={copyId} className="cursor-default">
        I have read and agree to the{" "}
        <a
          href={links.termsHref}
          target="_blank"
          rel="noopener noreferrer"
          className="underline underline-offset-2 text-primary hover:text-foreground"
          data-testid="signup-legal-terms-link"
        >
          {links.termsLabel}
        </a>{" "}
        and{" "}
        <a
          href={links.privacyHref}
          target="_blank"
          rel="noopener noreferrer"
          className="underline underline-offset-2 text-primary hover:text-foreground"
          data-testid="signup-legal-privacy-link"
        >
          {links.privacyLabel}
        </a>
        .
      </span>
    </div>
  );
}
