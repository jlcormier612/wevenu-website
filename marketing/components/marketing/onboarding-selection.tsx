"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";

import type { OnboardingType } from "@/lib/marketing/enrollment";
import {
  getDefaultOnboardingType,
  ONBOARDING_PACKAGES,
  ONBOARDING_SELECTION_COPY,
} from "@/lib/marketing/onboarding-packages";
import { HOVER_FILL, HOVER_OUTLINE } from "@/lib/marketing/rhythm";
import { cn } from "@/lib/utils";

type OnboardingSelectionProps = {
  open: boolean;
  planLabel: string;
  loading?: boolean;
  error?: string | null;
  onClose: () => void;
  onContinue: (selection: {
    onboardingType: OnboardingType;
    welcomeBack: boolean;
  }) => void;
};

/**
 * Pre-checkout step: Welcome Back optional flag + onboarding package choice.
 * Does not leave the pricing page — overlays as a focused selection sheet.
 */
export function OnboardingSelection({
  open,
  planLabel,
  loading = false,
  error = null,
  onClose,
  onContinue,
}: OnboardingSelectionProps) {
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);
  const [selected, setSelected] = useState<OnboardingType>(getDefaultOnboardingType);
  const [welcomeBack, setWelcomeBack] = useState(false);
  const [pendingType, setPendingType] = useState<OnboardingType | null>(null);

  useEffect(() => {
    if (!open) return;
    setSelected(getDefaultOnboardingType());
    setWelcomeBack(false);
    setPendingType(null);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  useEffect(() => {
    if (!loading) setPendingType(null);
  }, [loading]);

  function continueWith(type: OnboardingType) {
    setSelected(type);
    setPendingType(type);
    onContinue({ onboardingType: type, welcomeBack });
  }

  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !loading) onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, loading, onClose]);

  if (!open) return null;

  const copy = ONBOARDING_SELECTION_COPY;

  return createPortal(
    <div className="fixed inset-0 z-[100] overflow-y-auto overscroll-contain">
      <div className="flex min-h-full items-start justify-center p-4 sm:items-center sm:p-6">
        <button
          type="button"
          aria-label="Close onboarding selection"
          className="fixed inset-0 bg-[var(--forest-sage)]/35 backdrop-blur-[2px]"
          onClick={() => {
            if (!loading) onClose();
          }}
        />
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          className="relative z-10 my-auto flex max-h-[min(92vh,calc(100dvh-2rem))] w-full max-w-2xl flex-col overflow-hidden border border-[var(--taupe-medium)]/50 bg-[var(--true-white)] shadow-[0_28px_80px_-40px_rgba(47,55,47,0.45)] sm:rounded-sm"
        >
          <div className="flex shrink-0 items-start justify-between gap-4 border-b border-[var(--taupe-medium)]/40 px-6 py-5 md:px-8">
            <div>
              <p className="text-[0.7125rem] tracking-[0.22em] uppercase text-[var(--heritage-sage)]/82">
                {planLabel}
              </p>
              <h2
                id={titleId}
                className="mt-3 font-heading text-2xl font-medium text-[var(--forest-sage)] md:text-3xl"
              >
                {copy.title}
              </h2>
            </div>
            <button
              ref={closeRef}
              type="button"
              onClick={onClose}
              disabled={loading}
              className="mt-1 text-sm tracking-wide text-[var(--forest-sage)]/55 transition hover:text-[var(--forest-sage)] disabled:opacity-50"
            >
              Close
            </button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6 md:px-8 md:py-8">
            <div className="max-w-[65ch] space-y-4 text-base leading-[1.7] text-[var(--forest-sage)]/70">
              {copy.intro.map((line) => (
                <p key={line}>{line}</p>
              ))}
            </div>

            <div className="mt-8 space-y-3 border-t border-[var(--taupe-medium)]/40 pt-8">
              <p className="text-sm leading-[1.6] text-[var(--forest-sage)]/70">
                {copy.welcomeBack.prompt}
              </p>
              <label className="flex cursor-pointer items-start gap-3 text-sm leading-[1.6] text-[var(--forest-sage)]/80">
                <input
                  type="checkbox"
                  checked={welcomeBack}
                  onChange={(e) => setWelcomeBack(e.target.checked)}
                  disabled={loading}
                  className="mt-1 size-4 shrink-0 rounded border-[var(--taupe-medium)] text-[var(--heritage-sage)] accent-[var(--heritage-sage)]"
                />
                <span>{copy.welcomeBack.checkboxLabel}</span>
              </label>
            </div>

            <div className="mt-8 grid gap-4 md:grid-cols-2">
              {ONBOARDING_PACKAGES.map((pkg) => {
                const isSelected = selected === pkg.id;
                return (
                  <article
                    key={pkg.id}
                    className={cn(
                      "flex flex-col border px-5 py-6 transition duration-200 ease-out md:px-6 md:py-7",
                      isSelected
                        ? "border-[var(--heritage-sage)] bg-[var(--linen)]/70"
                        : "border-[var(--taupe-medium)]/50 bg-[var(--linen)]/30",
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => setSelected(pkg.id)}
                      disabled={loading}
                      className="w-full text-left disabled:opacity-60"
                    >
                      <div className="flex items-baseline justify-between gap-3">
                        <h3 className="font-heading text-2xl text-[var(--forest-sage)]">
                          {pkg.title}
                        </h3>
                        <span
                          className={cn(
                            "size-4 shrink-0 rounded-full border",
                            isSelected
                              ? "border-[var(--heritage-sage)] bg-[var(--heritage-sage)]"
                              : "border-[var(--taupe-medium)] bg-transparent",
                          )}
                          aria-hidden
                        />
                      </div>
                      <p className="mt-3 text-sm tracking-wide text-[var(--heritage-sage)]">
                        {pkg.priceLabel}
                      </p>
                      <p className="mt-4 text-sm leading-[1.7] text-[var(--forest-sage)]/70">
                        {pkg.description}
                      </p>
                    </button>
                    <button
                      type="button"
                      onClick={() => continueWith(pkg.id)}
                      disabled={loading}
                      className={cn(
                        "mt-8 inline-flex w-full items-center justify-center rounded-full px-5 py-3 text-sm tracking-wide transition duration-200 ease-out disabled:opacity-60",
                        isSelected
                          ? `bg-[var(--heritage-sage)] text-[var(--true-white)] ${HOVER_FILL}`
                          : `border border-[var(--heritage-sage)]/35 bg-transparent text-[var(--forest-sage)] ${HOVER_OUTLINE}`,
                      )}
                    >
                      {loading && pendingType === pkg.id
                        ? "Opening checkout…"
                        : pkg.ctaLabel}
                    </button>
                  </article>
                );
              })}
            </div>

            {error ? (
              <p className="mt-6 text-center text-xs leading-[1.7] text-[var(--forest-sage)]/55">
                {error}
              </p>
            ) : null}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
