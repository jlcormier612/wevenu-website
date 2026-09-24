"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Eye, EyeOff } from "lucide-react";

import { activateAccountAction } from "@/app/activate/actions";
import {
  ACTIVATE_PASSWORD_MIN_LENGTH,
  ACTIVATE_PASSWORD_MISMATCH_ERROR,
  activatePasswordInputType,
  activatePasswordToggleLabel,
  canSubmitActivateAccount,
} from "@/lib/program4/activate-account-form";

const PRODUCT_APP_URL = (
  process.env.NEXT_PUBLIC_PRODUCT_APP_URL?.trim() ||
  process.env.NEXT_PUBLIC_APP_URL?.trim() ||
  "http://localhost:3000"
).replace(/\/$/, "");

const VENUE_TERMS_URL = `${PRODUCT_APP_URL}/legal/venue_terms_of_service`;
const PRIVACY_POLICY_URL = `${PRODUCT_APP_URL}/legal/privacy_policy`;

function readActivateFormState(form: HTMLFormElement): {
  password: string;
  confirm: string;
  legalAccepted: boolean;
  ownershipChoice: "" | "owner" | "on_behalf";
  invitedOwnerName: string;
  invitedOwnerEmail: string;
} {
  const data = new FormData(form);
  const legal = form.elements.namedItem("legalAccepted");
  const choice = String(data.get("ownershipChoice") || "");
  return {
    password: String(data.get("password") || ""),
    confirm: String(data.get("confirm") || ""),
    legalAccepted:
      legal instanceof HTMLInputElement ? legal.checked : false,
    ownershipChoice:
      choice === "owner" || choice === "on_behalf" ? choice : "",
    invitedOwnerName: String(data.get("invitedOwnerName") || ""),
    invitedOwnerEmail: String(data.get("invitedOwnerEmail") || ""),
  };
}

function applyPasswordMatchValidity(form: HTMLFormElement) {
  const password = form.elements.namedItem("password");
  const confirm = form.elements.namedItem("confirm");
  if (
    !(password instanceof HTMLInputElement) ||
    !(confirm instanceof HTMLInputElement)
  ) {
    return;
  }
  if (confirm.value && password.value !== confirm.value) {
    confirm.setCustomValidity(ACTIVATE_PASSWORD_MISMATCH_ERROR);
  } else {
    confirm.setCustomValidity("");
  }
}

export function ActivateAccountForm({
  token,
  email,
  venueName,
  setupPersonName,
  relationshipId,
}: {
  token: string;
  email: string;
  venueName: string;
  setupPersonName?: string;
  relationshipId?: string | null;
}) {
  const [state, action, pending] = useActionState(activateAccountAction, null);
  const formRef = useRef<HTMLFormElement>(null);
  const [hydrated, setHydrated] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [legalAccepted, setLegalAccepted] = useState(false);
  const [ownershipChoice, setOwnershipChoice] = useState<"" | "owner" | "on_behalf">("");
  const [invitedOwnerName, setInvitedOwnerName] = useState("");
  const [invitedOwnerEmail, setInvitedOwnerEmail] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const syncFromForm = (form: HTMLFormElement) => {
    applyPasswordMatchValidity(form);
    const next = readActivateFormState(form);
    setPassword(next.password);
    setConfirm(next.confirm);
    setLegalAccepted(next.legalAccepted);
    setOwnershipChoice(next.ownershipChoice);
    setInvitedOwnerName(next.invitedOwnerName);
    setInvitedOwnerEmail(next.invitedOwnerEmail);
  };

  useEffect(() => {
    setHydrated(true);
    if (formRef.current) {
      applyPasswordMatchValidity(formRef.current);
      const next = readActivateFormState(formRef.current);
      setPassword(next.password);
      setConfirm(next.confirm);
      setLegalAccepted(next.legalAccepted);
      setOwnershipChoice(next.ownershipChoice);
      setInvitedOwnerName(next.invitedOwnerName);
      setInvitedOwnerEmail(next.invitedOwnerEmail);
    }
  }, []);

  const canSubmit = canSubmitActivateAccount({
    password,
    confirm,
    legalAccepted,
    ownershipChoice,
    invitedOwnerName,
    invitedOwnerEmail,
  });

  return (
    <form
      ref={formRef}
      action={action}
      className="activate-account-form mt-8 space-y-4"
      onInput={(e) => syncFromForm(e.currentTarget)}
      onChange={(e) => syncFromForm(e.currentTarget)}
    >
      <input type="hidden" name="token" value={token} />
      <input type="hidden" name="email" value={email} />
      {relationshipId ? (
        <input type="hidden" name="relationshipId" value={relationshipId} />
      ) : null}
      <div className="rounded-sm border border-border/60 bg-muted/60 px-4 py-3 text-sm">
        <p className="font-medium text-foreground">{venueName}</p>
      </div>
      {state?.error ? (
        <p
          role="alert"
          className="rounded-sm border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
        >
          {state.error}
        </p>
      ) : null}

      <fieldset className="space-y-3 rounded-sm border border-border/60 px-4 py-3">
        <legend className="ws-eyebrow px-1">Who owns this venue?</legend>
        <p className="text-sm text-muted-foreground">
          You&apos;re setting up Hello to Cheers for:
        </p>
        <div className="rounded-sm bg-muted/60 px-3 py-2 text-sm">
          {setupPersonName ? (
            <p className="font-medium text-foreground">{setupPersonName}</p>
          ) : null}
          <p className={setupPersonName ? "text-muted-foreground" : "font-medium text-foreground"}>
            {email}
          </p>
        </div>
        <p className="text-sm font-medium text-foreground">Are you an owner of this venue?</p>
        <label className="flex cursor-pointer items-start gap-3 text-sm">
          <input
            type="radio"
            name="ownershipChoice"
            value="owner"
            required
            disabled={pending}
            className="mt-1"
          />
          <span>
            <span className="font-medium text-foreground">Yes, I&apos;m an owner</span>
            <span className="mt-0.5 block text-muted-foreground">
              I&apos;m one of the people who owns this venue.
            </span>
          </span>
        </label>
        <label className="flex cursor-pointer items-start gap-3 text-sm">
          <input
            type="radio"
            name="ownershipChoice"
            value="on_behalf"
            required
            disabled={pending}
            className="mt-1"
          />
          <span>
            <span className="font-medium text-foreground">
              No, I&apos;m setting this up for someone else
            </span>
            <span className="mt-0.5 block text-muted-foreground">
              I&apos;ll manage the venue in HTC, and I&apos;ll add the owner(s).
            </span>
          </span>
        </label>
      </fieldset>

      {ownershipChoice === "on_behalf" ? (
        <div className="space-y-3 rounded-sm border border-border/60 px-4 py-3">
          <p className="text-sm font-medium text-foreground">Who owns this venue?</p>
          <p className="text-sm text-muted-foreground">
            Add an owner now, or add them after you sign in. You can invite them now or record them without inviting yet.
          </p>
          <label className="block">
            <span className="ws-eyebrow">Full name</span>
            <input
              name="invitedOwnerName"
              type="text"
              disabled={pending}
              autoComplete="name"
              className="ws-control mt-2 w-full rounded-sm px-3 py-2.5 text-sm outline-none focus:border-[var(--heritage-sage)]"
            />
          </label>
          <label className="block">
            <span className="ws-eyebrow">Email address</span>
            <input
              name="invitedOwnerEmail"
              type="email"
              disabled={pending}
              autoComplete="email"
              className="ws-control mt-2 w-full rounded-sm px-3 py-2.5 text-sm outline-none focus:border-[var(--heritage-sage)]"
            />
          </label>
          <fieldset className="space-y-2">
            <legend className="ws-eyebrow">Invite to Hello to Cheers</legend>
            <label className="flex cursor-pointer items-start gap-3 text-sm">
              <input
                type="radio"
                name="inviteOwnerNow"
                value="later"
                defaultChecked
                disabled={pending}
                className="mt-1"
              />
              <span>Invite later</span>
            </label>
            <label className="flex cursor-pointer items-start gap-3 text-sm">
              <input
                type="radio"
                name="inviteOwnerNow"
                value="now"
                disabled={pending}
                className="mt-1"
              />
              <span>Invite now</span>
            </label>
          </fieldset>
        </div>
      ) : null}

      <label className="block">
        <span className="ws-eyebrow">Email</span>
        <input
          type="email"
          value={email}
          readOnly
          autoComplete="username"
          aria-readonly="true"
          className="ws-control-muted mt-2 w-full cursor-default rounded-sm px-3 py-2.5 text-sm outline-none"
        />
      </label>
      <div>
        <label htmlFor="activate-password" className="block">
          <span className="ws-eyebrow">Create password</span>
        </label>
        <div className="relative mt-2">
          <input
            id="activate-password"
            name="password"
            type={activatePasswordInputType(showPassword)}
            required
            minLength={ACTIVATE_PASSWORD_MIN_LENGTH}
            autoComplete="new-password"
            aria-describedby="activate-password-hint"
            className="ws-control w-full rounded-sm px-3 py-2.5 pr-10 text-sm outline-none focus:border-[var(--heritage-sage)]"
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            aria-label={activatePasswordToggleLabel(showPassword, "password")}
            tabIndex={-1}
          >
            {showPassword ? (
              <EyeOff className="h-4 w-4" />
            ) : (
              <Eye className="h-4 w-4" />
            )}
          </button>
        </div>
        <span id="activate-password-hint" className="mt-1.5 block text-xs ws-muted">
          At least 8 characters.
        </span>
      </div>
      <div>
        <label htmlFor="activate-confirm" className="block">
          <span className="ws-eyebrow">Confirm password</span>
        </label>
        <div className="relative mt-2">
          <input
            id="activate-confirm"
            name="confirm"
            type={activatePasswordInputType(showConfirm)}
            required
            minLength={ACTIVATE_PASSWORD_MIN_LENGTH}
            autoComplete="new-password"
            className="ws-control w-full rounded-sm px-3 py-2.5 pr-10 text-sm outline-none focus:border-[var(--heritage-sage)]"
          />
          <button
            type="button"
            onClick={() => setShowConfirm((v) => !v)}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            aria-label={activatePasswordToggleLabel(showConfirm, "confirm")}
            tabIndex={-1}
          >
            {showConfirm ? (
              <EyeOff className="h-4 w-4" />
            ) : (
              <Eye className="h-4 w-4" />
            )}
          </button>
        </div>
      </div>
      <div className="flex items-start gap-3 text-sm leading-relaxed text-foreground">
        <input
          id="activate-legal-accepted"
          name="legalAccepted"
          type="checkbox"
          value="true"
          required
          disabled={pending}
          aria-labelledby="activate-legal-copy"
          className="mt-1 size-4 shrink-0 rounded border-border accent-[var(--heritage-sage)]"
        />
        <span
          id="activate-legal-copy"
          className="cursor-pointer"
          onClick={(e) => {
            if ((e.target as HTMLElement).closest("a")) return;
            const form = formRef.current;
            const el = form?.elements.namedItem("legalAccepted");
            if (!(form instanceof HTMLFormElement)) return;
            if (!(el instanceof HTMLInputElement) || el.disabled) return;
            el.checked = !el.checked;
            syncFromForm(form);
          }}
        >
          I have read and agree to the{" "}
          <a
            href={VENUE_TERMS_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-2 text-[var(--heritage-sage)] hover:text-foreground"
          >
            Terms of Service
          </a>{" "}
          and{" "}
          <a
            href={PRIVACY_POLICY_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-2 text-[var(--heritage-sage)] hover:text-foreground"
          >
            Privacy Policy
          </a>
          .
        </span>
      </div>
      <button
        type="submit"
        data-activate-submit
        disabled={pending || (hydrated && !canSubmit)}
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
