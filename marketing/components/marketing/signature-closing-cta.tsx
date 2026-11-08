import Link from "next/link";
import type { ReactNode } from "react";

import { ClosingCta } from "@/components/marketing/closing-cta";
import { MORE_INFO_CTA, PRIMARY_CTA } from "@/lib/marketing/nav";
import { cn } from "@/lib/utils";

import "@/app/signature-closing-cta.css";

export type SignatureClosingSurface =
  | "white"
  | "linen"
  | "story-linen"
  | "warm-beige"
  /** Full-bleed botanical band — “Everything connected.” closing */
  | "botanical"
  /** Elevated white invitation card (Platform /product) */
  | "white-card";

export type SignatureClosingAction = {
  href: string;
  label: string;
  variant?: "primary" | "secondary";
};

type SignatureClosingCtaProps = {
  id?: string;
  headingId?: string;
  eyebrow?: string;
  headline: string;
  /** Supporting copy — one string or multiple paragraphs/lines */
  body: string | readonly string[];
  /**
   * lines — short stacked lines (Home / Product / Pricing)
   * paragraphs — longer body copy with paragraph spacing (Our Story / Features)
   */
  bodyVariant?: "lines" | "paragraphs";
  /** Quiet reassurance under the button group (Our Story) */
  note?: ReactNode;
  /** Page-level surface — preserve approved color rhythm */
  surface?: SignatureClosingSurface;
  className?: string;
  primaryLabel?: string;
  secondaryLabel?: string;
  /**
   * Optional explicit action list. When omitted, Schedule + Request more
   * information (Home / Product / Our Story / Pricing). Features may pass
   * three pill actions without changing those two-button layouts.
   */
  actions?: readonly SignatureClosingAction[];
};

/**
 * Signature Closing CTA — one Hello to Cheers end-of-page design.
 * Cormorant headline, charcoal body, blush heart, then pill CTAs.
 */
export function SignatureClosingCta({
  id,
  headingId = "signature-closing-heading",
  eyebrow,
  headline,
  body,
  bodyVariant = "paragraphs",
  note,
  surface = "white",
  className,
  primaryLabel = PRIMARY_CTA.label,
  secondaryLabel = "Request More Information",
  actions,
}: SignatureClosingCtaProps) {
  const lines = typeof body === "string" ? [body] : [...body];
  const resolvedActions: readonly SignatureClosingAction[] = actions ?? [
    { href: PRIMARY_CTA.href, label: primaryLabel, variant: "primary" },
    { href: MORE_INFO_CTA.href, label: secondaryLabel, variant: "secondary" },
  ];

  return (
    <section
      id={id}
      className={cn(
        "signature-closing",
        surface === "white" && "signature-closing--white",
        surface === "linen" && "signature-closing--linen",
        surface === "story-linen" && "signature-closing--story-linen",
        surface === "warm-beige" && "signature-closing--warm-beige",
        surface === "botanical" && "signature-closing--botanical",
        surface === "white-card" && "signature-closing--white-card",
        className,
      )}
      aria-labelledby={headingId}
    >
      <div className="signature-closing-inner">
        {eyebrow ? (
          <p className="signature-closing-eyebrow">{eyebrow}</p>
        ) : null}
        <h2 id={headingId} className="signature-closing-headline">
          {headline}
        </h2>
        <div
          className={
            bodyVariant === "lines"
              ? "signature-closing-lines"
              : "signature-closing-body"
          }
        >
          {lines.map((line) => (
            <p key={line}>{line}</p>
          ))}
        </div>
        <ClosingCta className="signature-closing-actions">
          <div
            className={cn(
              "signature-closing-cta-row",
              resolvedActions.length >= 3 && "signature-closing-cta-row--triple",
            )}
          >
            {resolvedActions.map((action) => (
              <Link
                key={`${action.href}-${action.label}`}
                href={action.href}
                className={cn(
                  "signature-closing-btn",
                  action.variant === "primary"
                    ? "signature-closing-btn-primary"
                    : "signature-closing-btn-secondary",
                )}
              >
                {action.label}
              </Link>
            ))}
          </div>
        </ClosingCta>
        {note ? <p className="signature-closing-note">{note}</p> : null}
      </div>
    </section>
  );
}
