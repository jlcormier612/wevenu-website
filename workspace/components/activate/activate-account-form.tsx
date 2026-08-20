"use client";

import { useActionState, useState } from "react";

import { activateAccountAction } from "@/app/activate/actions";

const PRODUCT_APP_URL = (
  process.env.NEXT_PUBLIC_PRODUCT_APP_URL?.trim() ||
  process.env.NEXT_PUBLIC_APP_URL?.trim() ||
  "http://localhost:3000"
).replace(/\/$/, "");

const VENUE_TERMS_URL = `${PRODUCT_APP_URL}/legal/venue_terms_of_service`;
const PRIVACY_POLICY_URL = `${PRODUCT_APP_URL}/legal/privacy_policy`;

export function ActivateAccountForm({
  token,
  email,
  venueName,
  relationshipId,
}: {
  token: string;
  email: string;
  venueName: string;
  relationshipId?: string | null;
}) {
  const [state, action, pending] = useActionState(activateAccountAction, null);
  const [legalAccepted, setLegalAccepted] = useState(false);

  return (
    <form action={action} className="mt-8 space-y-4">
      <input type="hidden" name="token" value={token} />
      <input type="hidden" name="email" value={email} />
      {relationshipId ? (
        <input type="hidden" name="relationshipId" value={relationshipId} />
      ) : null}
      <input
        type="hidden"
        name="legalAccepted"
        value={legalAccepted ? "true" : "false"}
      />
      <div className="rounded-sm border border-[color-mix(in_srgb,var(--taupe-light)_80%,transparent)] bg-[var(--warm-gray)]/40 px-4 py-3 text-sm">
        <p className="font-medium text-[var(--forest-sage)]">{venueName}</p>
      </div>
      {state?.error ? (
        <p
          role="alert"
          className="rounded-sm border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
        >
          {state.error}
        </p>
      ) : null}
      <label className="block">
        <span className="ws-eyebrow">Email</span>
        <input
          type="email"
          value={email}
          readOnly
          autoComplete="username"
          aria-readonly="true"
          className="mt-2 w-full cursor-default rounded-sm border border-[color-mix(in_srgb,var(--taupe-medium)_40%,transparent)] bg-[var(--warm-gray)]/50 px-3 py-2.5 text-sm text-[var(--forest-sage)] outline-none"
        />
      </label>
      <label className="block">
        <span className="ws-eyebrow">Create password</span>
        <input
          name="password"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          aria-describedby="activate-password-hint"
          className="mt-2 w-full rounded-sm border border-[color-mix(in_srgb,var(--taupe-medium)_55%,transparent)] bg-[var(--true-white)] px-3 py-2.5 text-sm outline-none focus:border-[var(--heritage-sage)]"
        />
        <span id="activate-password-hint" className="mt-1.5 block text-xs ws-muted">
          At least 8 characters.
        </span>
      </label>
      <label className="block">
        <span className="ws-eyebrow">Confirm password</span>
        <input
          name="confirm"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          className="mt-2 w-full rounded-sm border border-[color-mix(in_srgb,var(--taupe-medium)_55%,transparent)] bg-[var(--true-white)] px-3 py-2.5 text-sm outline-none focus:border-[var(--heritage-sage)]"
        />
      </label>
      <label className="flex cursor-pointer items-start gap-3 text-sm leading-relaxed text-[var(--forest-sage)]/85">
        <input
          type="checkbox"
          checked={legalAccepted}
          onChange={(e) => setLegalAccepted(e.target.checked)}
          disabled={pending}
          className="mt-1 size-4 shrink-0 rounded border-[color-mix(in_srgb,var(--taupe-medium)_55%,transparent)] accent-[var(--heritage-sage)]"
        />
        <span>
          I have read and agree to the{" "}
          <a
            href={VENUE_TERMS_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-2 hover:text-[var(--forest-sage)]"
            onClick={(e) => e.stopPropagation()}
          >
            Terms of Service
          </a>{" "}
          and{" "}
          <a
            href={PRIVACY_POLICY_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-2 hover:text-[var(--forest-sage)]"
            onClick={(e) => e.stopPropagation()}
          >
            Privacy Policy
          </a>
          .
        </span>
      </label>
      <button
        type="submit"
        disabled={pending || !legalAccepted}
        className="w-full rounded-sm bg-[var(--forest-sage)] px-4 py-3 text-sm font-medium text-[var(--true-white)] transition-colors duration-200 hover:bg-[var(--heritage-sage)] disabled:opacity-60 motion-reduce:transition-none"
      >
        {pending ? "Activating…" : "Let's go"}
      </button>
      <p className="text-center text-xs leading-relaxed ws-muted">
        We&apos;ll start with a few simple details about your venue.
      </p>
    </form>
  );
}
