"use client";

/**
 * Couple portal Welcome + legal acceptance gate.
 * Soft romantic styling — invitation atmosphere, not staff UI.
 */

import * as React from "react";

import { Loader2 } from "lucide-react";

import type { CouplePortalLegalDocumentLink } from "@/lib/legal/types";

const ROSE = "#D8A7AA";
const ROSE_DEEP = "#C17F84";
const INK = "#5C5348";
const MUTED = "#8A7F72";
/** Hello to Cheers product chrome — not venue brand palette. */
const HTC_PRIMARY = "#5D6F5D";
const HTC_NEUTRAL = "#F7F5F1";

export function CoupleLegalWelcome({
  token,
  documents,
  venuePrimary: _venuePrimary,
  venueNeutral: _venueNeutral,
  onAccepted,
}: {
  token: string;
  documents: CouplePortalLegalDocumentLink[];
  /** @deprecated Ignored — portal chrome uses HTC tokens. */
  venuePrimary?: string;
  /** @deprecated Ignored — portal chrome uses HTC tokens. */
  venueNeutral?: string;
  onAccepted: () => void;
}) {
  const [checked, setChecked] = React.useState(false);
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const terms =
    documents.find((d) => d.documentType === "couple_end_user_terms") ?? null;
  const privacy =
    documents.find((d) => d.documentType === "privacy_policy") ?? null;
  const docsReady = Boolean(terms && privacy);

  const termsHref = terms?.path ?? "/end-user-terms";
  const privacyHref = privacy?.path ?? "/legal/privacy_policy";

  async function handleContinue() {
    if (!checked || pending || !docsReady) return;
    setPending(true);
    setError(null);
    try {
      const res = await fetch("/api/portal/legal", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token, legalAccepted: true }),
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
      onAccepted();
    } catch {
      setError("Unable to record your acceptance. Please try again.");
      setPending(false);
    }
  }

  return (
    <div
      className="flex min-h-svh flex-col items-center justify-center px-4 py-12"
      style={{
        background: `linear-gradient(165deg, ${HTC_NEUTRAL} 0%, color-mix(in srgb, ${ROSE} 18%, ${HTC_NEUTRAL}) 48%, ${HTC_NEUTRAL} 100%)`,
      }}
    >
      <div
        className="w-full max-w-md rounded-2xl border bg-white/90 px-7 py-9 shadow-[0_18px_50px_-28px_rgba(92,83,72,0.35)] backdrop-blur-sm sm:px-9 sm:py-10"
        style={{ borderColor: "color-mix(in srgb, #DED6CA 80%, transparent)" }}
      >
        <p
          className="text-[11px] font-medium uppercase tracking-[0.22em]"
          style={{ color: ROSE_DEEP }}
        >
          Hello to Cheers
        </p>
        <h1
          className="mt-3 font-heading text-3xl font-medium tracking-tight sm:text-[2rem]"
          style={{ color: INK }}
        >
          Welcome to Hello to Cheers
        </h1>
        <p className="mt-4 text-sm leading-relaxed" style={{ color: MUTED }}>
          Your venue has invited you to collaborate on your event through Hello
          to Cheers.
        </p>
        <p className="mt-5 text-sm leading-relaxed" style={{ color: INK }}>
          Before continuing, please review and accept the following:
        </p>
        <ul className="mt-3 space-y-2 text-sm" style={{ color: INK }}>
          {docsReady ? (
            <>
              <li>
                <a
                  href={termsHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline underline-offset-2 transition-colors hover:opacity-80"
                  style={{ color: HTC_PRIMARY }}
                >
                  End User Terms
                </a>
                {terms?.version ? (
                  <span className="ml-2 text-xs" style={{ color: MUTED }}>
                    v{terms.version}
                  </span>
                ) : null}
              </li>
              <li>
                <a
                  href={privacyHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline underline-offset-2 transition-colors hover:opacity-80"
                  style={{ color: HTC_PRIMARY }}
                >
                  Privacy Policy
                </a>
                {privacy?.version ? (
                  <span className="ml-2 text-xs" style={{ color: MUTED }}>
                    v{privacy.version}
                  </span>
                ) : null}
              </li>
            </>
          ) : (
            <li style={{ color: MUTED }}>
              Required legal documents are not available yet. Please try again
              shortly.
            </li>
          )}
        </ul>

        <label
          className="mt-7 flex cursor-pointer items-start gap-3 text-sm leading-relaxed"
          style={{ color: INK }}
        >
          <input
            type="checkbox"
            checked={checked}
            onChange={(e) => setChecked(e.target.checked)}
            disabled={pending || !docsReady}
            className="mt-0.5 size-4 shrink-0 rounded border-[#DED6CA]"
            style={{ accentColor: HTC_PRIMARY }}
          />
          <span>
            I have read and agree to the End User Terms and Privacy Policy.
          </span>
        </label>

        {error ? (
          <p
            role="alert"
            className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
          >
            {error}
          </p>
        ) : null}

        <button
          type="button"
          onClick={() => void handleContinue()}
          disabled={!checked || pending || !docsReady}
          className="mt-7 inline-flex w-full items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-medium text-white transition-opacity disabled:opacity-50"
          style={{ background: HTC_PRIMARY }}
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
  );
}
