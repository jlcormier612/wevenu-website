"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

type Props = {
  relationshipId: string;
  planId: string;
  onboardingType: string;
  status: string;
  hasStripeCustomer: boolean;
  canSendLink: boolean;
  canManualSub: boolean;
  canLaunch: boolean;
  canSuspend: boolean;
  canManageBilling: boolean;
};

export function LifecycleActions({
  relationshipId,
  planId,
  onboardingType,
  status,
  hasStripeCustomer,
  canSendLink,
  canManualSub,
  canLaunch,
  canSuspend,
  canManageBilling,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [checkoutUrl, setCheckoutUrl] = useState<string | null>(null);
  const [plan, setPlan] = useState(planId === "none" ? "gather" : planId);
  const [wg, setWg] = useState(onboardingType === "white_glove");

  async function run(action: string, extra: Record<string, unknown> = {}) {
    setMessage(null);
    const res = await fetch("/api/relationships/lifecycle", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action,
        relationshipId,
        plan,
        onboardingType: wg ? "white_glove" : "self_guided",
        ...extra,
      }),
    });
    const data = (await res.json()) as {
      ok?: boolean;
      error?: string;
      message?: string;
      url?: string;
      emailed?: boolean;
      activateUrl?: string;
    };
    if (!res.ok) {
      setMessage(data.error || "Action failed");
      return data;
    }
    if (data.url) setCheckoutUrl(data.url);
    setMessage(data.message || data.activateUrl || "Done.");
    startTransition(() => router.refresh());
    return data;
  }

  async function copyUrl() {
    if (!checkoutUrl) return;
    try {
      await navigator.clipboard.writeText(checkoutUrl);
      setMessage("Checkout link copied to clipboard.");
    } catch {
      setMessage("Could not copy — select the link below.");
    }
  }

  return (
    <section className="ws-panel border-[color-mix(in_srgb,var(--taupe-medium)_40%,transparent)] p-5 md:p-6">
      <p className="ws-eyebrow">Lifecycle actions</p>
      <h2 className="mt-1 font-heading text-2xl tracking-tight">Owner actions</h2>
      <p className="mt-1 text-sm ws-muted">
        Status: {status.replace(/_/g, " ")}. Does not redesign the workspace — appends timeline only.
      </p>

      <div className="mt-4 flex flex-wrap items-end gap-3">
        <label className="text-sm">
          <span className="ws-eyebrow block mb-1">Plan</span>
          <select
            className="rounded-sm border border-[color-mix(in_srgb,var(--taupe-medium)_55%,transparent)] bg-[var(--true-white)] px-3 py-2 text-sm"
            value={plan}
            onChange={(e) => setPlan(e.target.value)}
            disabled={pending}
          >
            <option value="gather">Gather / Starter</option>
            <option value="celebrate">Celebrate / Growing</option>
            <option value="flourish">Flourish / Professional</option>
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm pb-2">
          <input
            type="checkbox"
            checked={wg}
            onChange={(e) => setWg(e.target.checked)}
            disabled={pending}
          />
          White Glove
        </label>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {canSendLink ? (
          <>
            <ActionButton
              disabled={pending}
              onClick={() => run("send_subscription_link", { emailLink: true })}
            >
              Send Subscription Link
            </ActionButton>
            <ActionButton
              disabled={pending}
              onClick={async () => {
                const data = await run("send_subscription_link", { emailLink: false });
                if (data?.url) {
                  try {
                    await navigator.clipboard.writeText(data.url);
                    setMessage("Link generated and copied — not emailed.");
                  } catch {
                    /* url shown below */
                  }
                }
              }}
            >
              Copy Subscription Link
            </ActionButton>
          </>
        ) : null}
        {canManualSub ? (
          <ActionButton
            disabled={pending}
            onClick={() => {
              if (
                !window.confirm(
                  "Create a manual subscription on this Relationship (no Stripe)?",
                )
              ) {
                return;
              }
              void run("manual_subscription");
            }}
          >
            Manual Subscription
          </ActionButton>
        ) : null}
        {canSendLink ? (
          <ActionButton disabled={pending} onClick={() => run("resend_welcome")}>
            Resend Welcome Email
          </ActionButton>
        ) : null}
        {canLaunch &&
        (status === "white_glove_implementation" ||
          status === "onboarding" ||
          onboardingType === "white_glove") ? (
          <>
            <ActionButton
              disabled={pending}
              onClick={() => run("launch_workspace")}
              primary
            >
              Launch Workspace
            </ActionButton>
            {canManualSub ? (
              <ActionButton
                disabled={pending}
                onClick={() => {
                  if (
                    !window.confirm(
                      "Owner override: launch even if checklist incomplete?",
                    )
                  ) {
                    return;
                  }
                  void run("launch_workspace", { ownerOverride: true });
                }}
              >
                Launch (Owner Override)
              </ActionButton>
            ) : null}
          </>
        ) : null}
        {canSuspend ? (
          <>
            <ActionButton
              disabled={pending}
              onClick={() => {
                if (!window.confirm("Suspend account access? Data is preserved.")) {
                  return;
                }
                void run("suspend");
              }}
            >
              Suspend Account
            </ActionButton>
            <ActionButton disabled={pending} onClick={() => run("reactivate")}>
              Reactivate Account
            </ActionButton>
          </>
        ) : null}
        {canManageBilling ? (
          <>
            <ActionButton
              disabled={pending}
              onClick={() => run("send_payment_reminder")}
            >
              Send Payment Reminder
            </ActionButton>
            {hasStripeCustomer ? (
              <ActionButton
                disabled={pending}
                onClick={async () => {
                  const data = await run("view_billing");
                  if (data?.url) window.open(data.url, "_blank", "noopener,noreferrer");
                }}
              >
                View Billing
              </ActionButton>
            ) : null}
          </>
        ) : null}
      </div>

      {checkoutUrl ? (
        <div className="mt-4 rounded-sm border border-[color-mix(in_srgb,var(--soft-sage)_50%,transparent)] bg-[color-mix(in_srgb,var(--soft-sage)_12%,var(--true-white))] p-3 text-sm">
          <p className="ws-eyebrow">Checkout URL</p>
          <p className="mt-1 break-all font-mono text-xs">{checkoutUrl}</p>
          <button
            type="button"
            className="mt-2 text-sm text-[var(--heritage-sage)] underline-offset-4 hover:underline"
            onClick={() => void copyUrl()}
          >
            Copy to clipboard
          </button>
        </div>
      ) : null}

      {message ? (
        <p className="mt-3 text-sm text-[var(--forest-sage)]" role="status">
          {message}
        </p>
      ) : null}
    </section>
  );
}

function ActionButton({
  children,
  onClick,
  disabled,
  primary,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  primary?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={
        primary
          ? "rounded-sm bg-[var(--heritage-sage)] px-3.5 py-2 text-sm font-medium text-[var(--true-white)] hover:opacity-95 disabled:opacity-50"
          : "rounded-sm border border-[color-mix(in_srgb,var(--taupe-medium)_55%,transparent)] bg-[var(--true-white)] px-3.5 py-2 text-sm font-medium text-[var(--forest-sage)] hover:border-[var(--heritage-sage)] disabled:opacity-50"
      }
    >
      {children}
    </button>
  );
}
