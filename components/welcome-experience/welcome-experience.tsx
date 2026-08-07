"use client";

/**
 * Welcome Experience — universal legal acceptance UI (WP3).
 * Presentational only: caller supplies copy + documents and records
 * acceptances in onContinue. Does not navigate or call the engine itself.
 */

import * as React from "react";
import type { CSSProperties } from "react";
import { Loader2 } from "lucide-react";

import { Wordmark } from "@/components/brand/wordmark";
import { cn } from "@/lib/utils";

import { WelcomeExperienceDocumentList } from "./welcome-experience-document-list";
import { WelcomeExperienceErrorAlert } from "./welcome-experience-error-alert";
import {
  WELCOME_AGREE_LABEL,
  WELCOME_CONTINUE_LABEL,
  WELCOME_SAVING_LABEL,
  WELCOME_SUPPORT_BODY,
  WELCOME_SUPPORT_HEADING,
  attemptWelcomeContinue,
  canContinue,
  isAlreadyCompliant,
  normalizeIntroduction,
  shouldShowAgreementCheckbox,
} from "./welcome-experience-helpers";
import type { WelcomeExperienceProps } from "./types";

/**
 * Fixed light brand surface (same approach as auth login) so the experience
 * stays warm and hospitality-first regardless of app dark mode.
 */
const LIGHT_THEME_VARS = {
  "--background": "var(--true-white)",
  "--foreground": "var(--black)",
  "--heading": "var(--forest-sage)",
  "--muted-foreground":
    "color-mix(in oklch, var(--forest-sage) 70%, transparent)",
  "--border": "var(--taupe-light)",
  "--ring": "var(--heritage-sage)",
} as CSSProperties;

const AGREE_CHECKBOX_ID = "welcome-experience-agree";

export function WelcomeExperience({
  heading,
  introduction,
  documents,
  onContinue,
  onSuccess,
  className,
}: WelcomeExperienceProps) {
  const [agreed, setAgreed] = React.useState(false);
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState(false);

  const paragraphs = normalizeIntroduction(introduction);
  const alreadyCompliant = isAlreadyCompliant(documents);
  const showCheckbox = shouldShowAgreementCheckbox(documents);
  const continueEnabled = canContinue({ documents, agreed, pending });

  async function handleContinue() {
    if (!continueEnabled) return;
    setPending(true);
    setError(false);
    const result = await attemptWelcomeContinue({ onContinue, onSuccess });
    if (result === "error") {
      setError(true);
    }
    setPending(false);
  }

  return (
    <main
      className={cn(
        // Responsive: same centered stack on mobile / tablet / desktop.
        "flex min-h-svh w-full flex-col items-center justify-center px-4 py-10 sm:px-6 sm:py-12 md:px-8",
        className,
      )}
      style={{
        background:
          "color-mix(in oklch, var(--linen), var(--taupe-dark) 45%)",
        ...LIGHT_THEME_VARS,
      }}
      data-welcome-experience
      data-already-compliant={alreadyCompliant ? "true" : "false"}
    >
      <div className="flex w-full max-w-md flex-col items-stretch">
        <div className="flex justify-center">
          <Wordmark forceLight sizeClassName="h-9 w-auto" />
        </div>

        <div className="mt-8 rounded-lg border border-[color-mix(in_srgb,var(--taupe-medium)_40%,transparent)] bg-[var(--true-white)] px-6 py-8 shadow-sm sm:mt-10 sm:px-8 sm:py-9">
          <h1 className="text-center font-heading text-2xl font-medium tracking-tight text-[var(--forest-sage)] sm:text-[1.75rem]">
            {heading}
          </h1>

          <div className="mt-4 space-y-3 text-center text-sm leading-relaxed text-[color-mix(in_oklch,var(--forest-sage)_75%,transparent)]">
            {paragraphs.map((paragraph, index) => (
              <p key={`intro-${index}`}>{paragraph}</p>
            ))}
          </div>

          <WelcomeExperienceDocumentList documents={documents} />

          {showCheckbox ? (
            <div className="mt-8">
              <label
                htmlFor={AGREE_CHECKBOX_ID}
                className="flex cursor-pointer items-start gap-3 text-left text-sm leading-relaxed text-[var(--forest-sage)]"
              >
                <input
                  id={AGREE_CHECKBOX_ID}
                  type="checkbox"
                  checked={agreed}
                  onChange={(e) => setAgreed(e.target.checked)}
                  disabled={pending}
                  className="mt-0.5 size-4 shrink-0 rounded border-[color-mix(in_srgb,var(--taupe-medium)_55%,transparent)] accent-[var(--heritage-sage)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--heritage-sage)]/40"
                />
                <span>{WELCOME_AGREE_LABEL}</span>
              </label>
            </div>
          ) : null}

          {error ? <WelcomeExperienceErrorAlert /> : null}

          <button
            type="button"
            onClick={() => void handleContinue()}
            disabled={!continueEnabled}
            aria-busy={pending || undefined}
            className="mt-7 inline-flex w-full items-center justify-center gap-2 rounded-md bg-[var(--forest-sage)] px-5 py-3 text-sm font-medium text-[var(--true-white)] transition-opacity hover:bg-[var(--heritage-sage)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--heritage-sage)]/45 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--true-white)] disabled:opacity-50"
          >
            {pending ? (
              <>
                <Loader2 className="size-4 animate-spin" aria-hidden />
                {WELCOME_SAVING_LABEL}
              </>
            ) : (
              WELCOME_CONTINUE_LABEL
            )}
          </button>

          <div className="mt-8 text-center text-xs leading-relaxed text-[color-mix(in_oklch,var(--forest-sage)_58%,transparent)]">
            <p className="font-medium text-[color-mix(in_oklch,var(--forest-sage)_70%,transparent)]">
              {WELCOME_SUPPORT_HEADING}
            </p>
            <p className="mt-1">{WELCOME_SUPPORT_BODY}</p>
          </div>
        </div>
      </div>
    </main>
  );
}
