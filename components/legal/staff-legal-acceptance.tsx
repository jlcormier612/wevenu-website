"use client";

/**
 * Staff-style legal acceptance gate (venue workspace + vendor portal).
 * Blocks the app shell until the signed-in user accepts current active versions.
 */

import * as React from "react";
import { useRouter } from "next/navigation";

import { Loader2 } from "lucide-react";

import { Wordmark } from "@/components/brand/wordmark";
import type {
  AuthenticatedLegalPortal,
  LegalGateDocumentLink,
} from "@/lib/legal/types";

export function StaffLegalAcceptance({
  portal,
  documents,
  title,
  description,
  checkboxLabel,
}: {
  portal: AuthenticatedLegalPortal;
  documents: LegalGateDocumentLink[];
  title?: string;
  description?: string;
  checkboxLabel?: string;
}) {
  const router = useRouter();
  const [checked, setChecked] = React.useState(false);
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const heading =
    title ??
    (portal === "vendor"
      ? "Review vendor terms"
      : "Review updated terms");
  const body =
    description ??
    "Before continuing, please review and accept the current versions of the following documents.";
  const agreeLabel =
    checkboxLabel ??
    "I have read and agree to the Terms and Privacy Policy.";

  async function handleContinue() {
    if (!checked || pending) return;
    setPending(true);
    setError(null);
    try {
      const res = await fetch("/api/legal/gate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ portal, legalAccepted: true }),
      });
      const data = (await res.json().catch(() => null)) as {
        ok?: boolean;
        error?: string;
      } | null;
      if (!res.ok || !data?.ok) {
        setError(
          data?.error ??
            "Unable to record your acceptance. Please try again.",
        );
        setPending(false);
        return;
      }
      router.refresh();
    } catch {
      setError("Unable to record your acceptance. Please try again.");
      setPending(false);
    }
  }

  return (
    <main
      className="flex min-h-svh flex-col items-center justify-center px-4 py-12"
      style={{
        background:
          "color-mix(in oklch, var(--linen), var(--taupe-dark) 45%)",
      }}
    >
      <div className="flex w-full max-w-md flex-col gap-6">
        <div className="flex justify-center">
          <Wordmark />
        </div>
        <div className="rounded-lg border border-[color-mix(in_srgb,var(--taupe-medium)_40%,transparent)] bg-[var(--true-white)] px-7 py-8 shadow-sm sm:px-8">
          <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[color-mix(in_oklch,var(--forest-sage)_70%,transparent)]">
            Legal update
          </p>
          <h1 className="mt-3 font-heading text-2xl font-medium tracking-tight text-[var(--forest-sage)] sm:text-[1.75rem]">
            {heading}
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-[color-mix(in_oklch,var(--forest-sage)_75%,transparent)]">
            {body}
          </p>

          <ul className="mt-4 space-y-2 text-sm text-[var(--forest-sage)]">
            {documents.length > 0 ? (
              documents.map((doc) => (
                <li key={doc.id}>
                  <a
                    href={doc.path}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline underline-offset-2 hover:opacity-80"
                  >
                    {doc.title}
                  </a>
                  <span className="ml-2 text-xs text-[color-mix(in_oklch,var(--forest-sage)_55%,transparent)]">
                    v{doc.version}
                  </span>
                </li>
              ))
            ) : (
              <li className="text-[color-mix(in_oklch,var(--forest-sage)_70%,transparent)]">
                Required legal documents are not available yet. Please try again
                shortly.
              </li>
            )}
          </ul>

          <label className="mt-7 flex cursor-pointer items-start gap-3 text-sm leading-relaxed text-[var(--forest-sage)]">
            <input
              type="checkbox"
              checked={checked}
              onChange={(e) => setChecked(e.target.checked)}
              disabled={pending || documents.length === 0}
              className="mt-0.5 size-4 shrink-0 rounded border-[color-mix(in_srgb,var(--taupe-medium)_55%,transparent)] accent-[var(--heritage-sage)]"
            />
            <span>{agreeLabel}</span>
          </label>

          {error ? (
            <p
              role="alert"
              className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
            >
              {error}
            </p>
          ) : null}

          <button
            type="button"
            onClick={() => void handleContinue()}
            disabled={!checked || pending || documents.length === 0}
            className="mt-7 inline-flex w-full items-center justify-center gap-2 rounded-md bg-[var(--forest-sage)] px-5 py-3 text-sm font-medium text-[var(--true-white)] transition-opacity hover:bg-[var(--heritage-sage)] disabled:opacity-50"
          >
            {pending ? (
              <>
                <Loader2 className="size-4 animate-spin" aria-hidden />
                Continuing…
              </>
            ) : (
              "Continue"
            )}
          </button>
        </div>
      </div>
    </main>
  );
}
