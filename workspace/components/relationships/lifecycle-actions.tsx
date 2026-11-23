"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { greetingFirstName } from "@shared/relationships/normalize";

type OwnerPanel = "task" | "message" | "note" | null;
type ReviewMode = "send" | "copy" | null;
type ConfirmSendKind = "resend_welcome" | "send_payment_reminder" | null;

type SubscriptionPreview = {
  mode: "send" | "copy";
  relationshipId: string;
  venueName: string;
  recipientName: string;
  recipientEmail: string;
  planId: string;
  onboardingType: "self_guided" | "white_glove";
  terms: {
    planDisplayName: string;
    listAmountLabel: string;
    eligibilityLabel: string;
    discountBasis: string;
    recurringMonthlyLabel: string;
    whiteGloveLabel: string;
    initialChargeLabel: string;
    taxesNote: string;
    billingTerms: string;
  };
  email: { subject: string; text: string; html: string };
  checkoutLinkNote: string;
  expiresNote: string;
};

type Props = {
  relationshipId: string;
  planId: string;
  onboardingType: string;
  status: string;
  hasStripeCustomer: boolean;
  /** Same hard switch as snapshot (`subscribedAt` / CS) — customer-only actions stay hidden on Sales. */
  showCustomerActions: boolean;
  canSendLink: boolean;
  canManualSub: boolean;
  canLaunch: boolean;
  canSuspend: boolean;
  canManageBilling: boolean;
  /** Set a Task / Send a Message / Make a Note — Sales + CS when permitted. */
  canOwnerTools: boolean;
  /** Owner/Admin — Create Custom Offer */
  canCreateCustomOffer?: boolean;
  ownerEmail?: string;
  ownerFirstName?: string;
  venueName?: string;
  /** Product venue UUID for Configure Workspace (no customer access). */
  productVenueId?: string | null;
  configureWorkspaceUrl?: string | null;
};

export function LifecycleActions({
  relationshipId,
  planId,
  onboardingType,
  status,
  hasStripeCustomer,
  showCustomerActions,
  canSendLink,
  canManualSub,
  canLaunch,
  canSuspend,
  canManageBilling,
  canOwnerTools,
  canCreateCustomOffer = false,
  ownerEmail,
  ownerFirstName,
  venueName,
  productVenueId,
  configureWorkspaceUrl,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [checkoutUrl, setCheckoutUrl] = useState<string | null>(null);
  const [checkoutExpiresAt, setCheckoutExpiresAt] = useState<string | null>(
    null,
  );
  const [plan, setPlan] = useState(planId === "none" ? "gather" : planId);
  const [wg, setWg] = useState(onboardingType === "white_glove");

  const greetName = greetingFirstName({
    firstName: ownerFirstName,
    email: ownerEmail,
  });
  const replyGreeting = `Hi ${greetName},\n\n`;

  const [ownerPanel, setOwnerPanel] = useState<OwnerPanel>(null);
  const [reviewMode, setReviewMode] = useState<ReviewMode>(null);
  const [preview, setPreview] = useState<SubscriptionPreview | null>(null);
  const [termsFingerprint, setTermsFingerprint] = useState<string | null>(null);
  const [reviewBusy, setReviewBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [confirmSendKind, setConfirmSendKind] = useState<ConfirmSendKind>(null);
  const [taskTitle, setTaskTitle] = useState("");
  const [taskDue, setTaskDue] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 2);
    return d.toISOString().slice(0, 10);
  });
  const [taskDescription, setTaskDescription] = useState("");
  const [msgSubject, setMsgSubject] = useState(
    venueName ? `Following up — ${venueName}` : "Following up",
  );
  const [msgBody, setMsgBody] = useState(replyGreeting);
  const [noteText, setNoteText] = useState("");
  const [ownerBusy, setOwnerBusy] = useState(false);

  function toggleOwnerPanel(panel: Exclude<OwnerPanel, null>) {
    setMessage(null);
    setReviewMode(null);
    setPreview(null);
    setConfirmSendKind(null);
    setOwnerPanel((cur) => (cur === panel ? null : panel));
  }

  function closeReview() {
    setReviewMode(null);
    setPreview(null);
    setTermsFingerprint(null);
    setReviewBusy(false);
    setConfirming(false);
  }

  async function openSubscriptionReview(mode: "send" | "copy") {
    setMessage(null);
    setOwnerPanel(null);
    setConfirmSendKind(null);
    setCheckoutUrl(null);
    setCheckoutExpiresAt(null);
    setReviewMode(mode);
    setReviewBusy(true);
    setPreview(null);
    try {
      const res = await fetch("/api/relationships/lifecycle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "preview_subscription_link",
          relationshipId,
          plan,
          onboardingType: wg ? "white_glove" : "self_guided",
          previewMode: mode,
        }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        error?: string;
        preview?: SubscriptionPreview;
        termsFingerprint?: string;
      };
      if (!res.ok || !data.preview) {
        setMessage(data.error || "Could not load subscription review");
        closeReview();
        return;
      }
      setPreview(data.preview);
      setTermsFingerprint(data.termsFingerprint ?? null);
    } catch {
      setMessage("Could not load subscription review");
      closeReview();
    } finally {
      setReviewBusy(false);
    }
  }

  async function confirmSubscriptionReview() {
    if (!reviewMode || confirming) return;
    setConfirming(true);
    setMessage(null);
    try {
      const res = await fetch("/api/relationships/lifecycle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "send_subscription_link",
          relationshipId,
          plan,
          onboardingType: wg ? "white_glove" : "self_guided",
          emailLink: reviewMode === "send",
          confirm: true,
          termsFingerprint,
        }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        error?: string;
        message?: string;
        url?: string;
        emailed?: boolean;
        emailDelivery?: string;
        emailError?: string;
        expiresAt?: string;
        recovery?: string;
      };
      if (!res.ok) {
        setMessage(data.error || "Confirmation failed");
        return;
      }
      if (data.url) {
        setCheckoutUrl(data.url);
        setCheckoutExpiresAt(data.expiresAt ?? null);
        if (reviewMode === "copy") {
          try {
            await navigator.clipboard.writeText(data.url);
          } catch {
            /* compact link shown below */
          }
        }
      }
      setMessage(
        data.emailError
          ? data.message || data.emailError
          : data.message || "Done.",
      );
      closeReview();
      startTransition(() => router.refresh());
    } finally {
      setConfirming(false);
    }
  }

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
      note?: string;
      stripe?: { customerId?: string | null; subscriptionId?: string | null };
      product?: { venue?: { entitlement_status?: string | null } };
      result?: { detail?: string; ok?: boolean };
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

  async function runOwnerAction(
    action: "create_task" | "send_message" | "add_note",
    payload: Record<string, unknown>,
  ) {
    setMessage(null);
    setOwnerBusy(true);
    try {
      const res = await fetch("/api/relationships/owner-actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ relationshipId, action, ...payload }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        error?: string;
        message?: string;
        delivery?: string;
      };
      if (!res.ok) {
        setMessage(data.error || "Action failed");
        return;
      }
      setMessage(data.message || "Done.");
      if (action === "create_task") {
        setTaskTitle("");
        setTaskDescription("");
      } else if (action === "send_message") {
        setMsgBody(replyGreeting);
      } else {
        setNoteText("");
      }
      setOwnerPanel(null);
      startTransition(() => router.refresh());
    } catch {
      setMessage("Network error");
    } finally {
      setOwnerBusy(false);
    }
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
            className="rounded-sm border border-[color-mix(in_srgb,var(--taupe-medium)_55%,transparent)] bg-[var(--true-white)] px-3 py-2 text-sm text-foreground"
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
        {canOwnerTools ? (
          <>
            <ActionButton
              disabled={pending || ownerBusy}
              onClick={() => toggleOwnerPanel("task")}
              active={ownerPanel === "task"}
            >
              Set a Task
            </ActionButton>
            <ActionButton
              disabled={pending || ownerBusy}
              onClick={() => toggleOwnerPanel("message")}
              active={ownerPanel === "message"}
            >
              Send a Message
            </ActionButton>
            <ActionButton
              disabled={pending || ownerBusy}
              onClick={() => toggleOwnerPanel("note")}
              active={ownerPanel === "note"}
            >
              Make a Note
            </ActionButton>
          </>
        ) : null}
        {canSendLink ? (
          <>
            <ActionButton
              disabled={pending || reviewBusy || confirming}
              onClick={() => void openSubscriptionReview("send")}
              active={reviewMode === "send"}
            >
              Send Subscription Link
            </ActionButton>
            <ActionButton
              disabled={pending || reviewBusy || confirming}
              onClick={() => void openSubscriptionReview("copy")}
              active={reviewMode === "copy"}
            >
              Copy Subscription Link
            </ActionButton>
          </>
        ) : null}
        {canCreateCustomOffer && !showCustomerActions ? (
          <Link
            href={`/relationships/${relationshipId}/offers/new`}
            className="inline-flex items-center rounded-sm border border-[color-mix(in_srgb,var(--taupe-medium)_55%,transparent)] bg-[var(--true-white)] px-3.5 py-2 text-sm font-medium text-[var(--forest-sage)] hover:border-[var(--heritage-sage)]"
            data-testid="create-custom-offer-action"
          >
            Create Custom Offer
          </Link>
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
        {showCustomerActions && canSendLink ? (
          <ActionButton
            disabled={pending}
            active={confirmSendKind === "resend_welcome"}
            onClick={() => {
              setMessage(null);
              setConfirmSendKind((cur) =>
                cur === "resend_welcome" ? null : "resend_welcome",
              );
            }}
          >
            Resend Welcome Email
          </ActionButton>
        ) : null}
        {showCustomerActions &&
        canLaunch &&
        (status === "white_glove_implementation" ||
          status === "onboarding" ||
          onboardingType === "white_glove") ? (
          <>
            {configureWorkspaceUrl && productVenueId ? (
              <a
                href={configureWorkspaceUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center rounded-sm border border-[color-mix(in_srgb,var(--taupe-medium)_55%,transparent)] px-3 py-1.5 text-sm text-[var(--forest-sage)] hover:bg-[color-mix(in_srgb,var(--soft-sage)_35%,transparent)]"
              >
                Configure Workspace
              </a>
            ) : null}
            <ActionButton
              disabled={pending}
              onClick={() => run("launch_workspace")}
              primary
            >
              Mark Implementation Complete
            </ActionButton>
            {canManualSub ? (
              <ActionButton
                disabled={pending}
                onClick={() => {
                  if (
                    !window.confirm(
                      "Owner override: mark implementation complete even if checklist incomplete?",
                    )
                  ) {
                    return;
                  }
                  void run("launch_workspace", { ownerOverride: true });
                }}
              >
                Mark Complete (Owner Override)
              </ActionButton>
            ) : null}
          </>
        ) : null}
        {showCustomerActions && canSuspend ? (
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
            <ActionButton
              disabled={pending}
              onClick={async () => {
                const data = await run("get_entitlement");
                if (data) {
                  setMessage(
                    `Stripe customer ${data.stripe?.customerId ?? "—"} · product ${
                      data.product?.venue?.entitlement_status ??
                      data.note ??
                      "n/a"
                    }`,
                  );
                }
              }}
            >
              View Entitlement
            </ActionButton>
            <ActionButton
              disabled={pending}
              onClick={() => {
                const until = window.prompt(
                  "Extend access until (YYYY-MM-DD). Access-only — does not change Stripe invoices.",
                );
                if (!until) return;
                const reason = window.prompt("Reason for this override?");
                if (!reason?.trim()) return;
                void run("founder_extend_access", {
                  accessOverrideUntil: `${until}T23:59:59.000Z`,
                  reason: reason.trim(),
                });
              }}
            >
              Extend Access
            </ActionButton>
            <ActionButton
              disabled={pending}
              onClick={() => {
                const reason = window.prompt("Reason to pause billing suspension?");
                if (!reason?.trim()) return;
                void run("founder_pause_suspend", {
                  pauseBillingSuspend: true,
                  reason: reason.trim(),
                });
              }}
            >
              Pause Billing Suspend
            </ActionButton>
            <ActionButton
              disabled={pending}
              onClick={() => {
                const reason = window.prompt("Reason to clear access override / pause?");
                if (!reason?.trim()) return;
                void run("founder_clear_override", { reason: reason.trim() });
              }}
            >
              Clear Override
            </ActionButton>
            <ActionButton
              disabled={pending}
              onClick={() => {
                const reason = window.prompt("Reason for retention hold?");
                if (!reason?.trim()) return;
                void run("founder_retention_hold", {
                  retentionHold: true,
                  reason: reason.trim(),
                });
              }}
            >
              Retention Hold
            </ActionButton>
            <ActionButton
              disabled={pending}
              onClick={() => {
                const reason = window.prompt(
                  "Reason for SECURITY lock? Payment success will NOT clear this.",
                );
                if (!reason?.trim()) return;
                if (
                  !window.confirm(
                    "Set independent security lock? This blocks access even after payment.",
                  )
                ) {
                  return;
                }
                void run("founder_security_lock", {
                  manualSecurityLock: true,
                  reason: reason.trim(),
                });
              }}
            >
              Security Lock
            </ActionButton>
            <ActionButton
              disabled={pending}
              onClick={() => {
                const reason = window.prompt("Reason to clear security lock?");
                if (!reason?.trim()) return;
                void run("founder_security_lock", {
                  manualSecurityLock: false,
                  reason: reason.trim(),
                });
              }}
            >
              Clear Security Lock
            </ActionButton>
          </>
        ) : null}
        {showCustomerActions && canManageBilling ? (
          <>
            <ActionButton
              disabled={pending}
              active={confirmSendKind === "send_payment_reminder"}
              onClick={() => {
                setMessage(null);
                setConfirmSendKind((cur) =>
                  cur === "send_payment_reminder" ? null : "send_payment_reminder",
                );
              }}
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

      {reviewMode ? (
        <div
          className="mt-4 space-y-4 rounded-sm border border-[color-mix(in_srgb,var(--heritage-sage)_40%,transparent)] bg-[var(--true-white)] p-4"
          data-testid="subscription-link-review"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="ws-eyebrow">
                {reviewMode === "send"
                  ? "Review — Send Subscription Link"
                  : "Review — Copy Subscription Link"}
              </p>
              <p className="mt-1 text-sm ws-muted">
                Nothing is sent and no Stripe Checkout Session is created until
                you confirm.
              </p>
            </div>
            <ActionButton disabled={reviewBusy || confirming} onClick={closeReview}>
              Cancel
            </ActionButton>
          </div>

          {reviewBusy || !preview ? (
            <p className="text-sm ws-muted">Loading commercial terms…</p>
          ) : (
            <>
              <dl className="grid gap-3 text-sm sm:grid-cols-2">
                <div>
                  <dt className="ws-muted">Customer / venue</dt>
                  <dd className="font-medium">{preview.venueName}</dd>
                </div>
                <div>
                  <dt className="ws-muted">Recipient</dt>
                  <dd className="font-medium">
                    {preview.recipientName}
                    <span className="mt-0.5 block text-xs ws-muted">
                      {preview.recipientEmail || "No email on file"}
                    </span>
                  </dd>
                </div>
                <div>
                  <dt className="ws-muted">Subscription tier</dt>
                  <dd className="font-medium">{preview.terms.planDisplayName}</dd>
                </div>
                <div>
                  <dt className="ws-muted">Standard monthly price</dt>
                  <dd className="font-medium">{preview.terms.listAmountLabel}</dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="ws-muted">Standard discount</dt>
                  <dd className="font-medium">{preview.terms.eligibilityLabel}</dd>
                  <dd className="mt-0.5 text-xs ws-muted">
                    {preview.terms.discountBasis}
                  </dd>
                </div>
                <div>
                  <dt className="ws-muted">Recurring monthly amount</dt>
                  <dd className="font-medium">
                    {preview.terms.recurringMonthlyLabel}
                  </dd>
                </div>
                <div>
                  <dt className="ws-muted">White Glove</dt>
                  <dd className="font-medium">{preview.terms.whiteGloveLabel}</dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="ws-muted">Expected initial charge</dt>
                  <dd className="font-medium">
                    {preview.terms.initialChargeLabel}
                  </dd>
                  <dd className="mt-0.5 text-xs ws-muted">
                    {preview.terms.taxesNote}
                  </dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="ws-muted">Billing terms</dt>
                  <dd className="text-sm">{preview.terms.billingTerms}</dd>
                </div>
              </dl>

              {reviewMode === "send" ? (
                <div className="rounded-sm border border-[var(--htc-border)] bg-[var(--htc-linen)]/40 p-3">
                  <p className="ws-eyebrow">Customer email</p>
                  <p className="mt-2 text-sm font-medium">{preview.email.subject}</p>
                  <pre className="mt-2 max-h-56 overflow-auto whitespace-pre-wrap rounded-sm bg-[var(--true-white)] p-3 text-xs leading-relaxed text-foreground">
                    {preview.email.text}
                  </pre>
                </div>
              ) : null}

              <p className="text-sm ws-muted">{preview.checkoutLinkNote}</p>
              <p className="text-xs ws-muted">{preview.expiresNote}</p>

              <div className="flex flex-wrap gap-2">
                <ActionButton
                  primary
                  disabled={
                    confirming ||
                    (reviewMode === "send" && !preview.recipientEmail)
                  }
                  onClick={() => void confirmSubscriptionReview()}
                >
                  {confirming
                    ? "Working…"
                    : reviewMode === "send"
                      ? "Confirm & Send"
                      : "Confirm & Generate Link"}
                </ActionButton>
                <ActionButton disabled={confirming} onClick={closeReview}>
                  Cancel
                </ActionButton>
              </div>
            </>
          )}
        </div>
      ) : null}

      {confirmSendKind === "resend_welcome" ? (
        <div className="mt-4 space-y-3 rounded-sm border border-[var(--htc-border)] bg-[var(--true-white)] p-4">
          <p className="ws-eyebrow">Confirm — Resend Welcome Email</p>
          <p className="text-sm">
            Recipient:{" "}
            <strong>{ownerEmail?.trim() || "No owner email"}</strong>
          </p>
          <p className="text-sm ws-muted">
            Sends the welcome / activation email for this customer relationship.
          </p>
          <div className="flex flex-wrap gap-2">
            <ActionButton
              primary
              disabled={pending || !ownerEmail?.trim()}
              onClick={() => {
                setConfirmSendKind(null);
                void run("resend_welcome");
              }}
            >
              Confirm & Send
            </ActionButton>
            <ActionButton onClick={() => setConfirmSendKind(null)}>
              Cancel
            </ActionButton>
          </div>
        </div>
      ) : null}

      {confirmSendKind === "send_payment_reminder" ? (
        <div className="mt-4 space-y-3 rounded-sm border border-[var(--htc-border)] bg-[var(--true-white)] p-4">
          <p className="ws-eyebrow">Confirm — Send Payment Reminder</p>
          <p className="text-sm">
            Recipient:{" "}
            <strong>{ownerEmail?.trim() || "No owner email"}</strong>
          </p>
          <p className="text-sm ws-muted">
            Sends a payment reminder email. May also record a payment-failed
            dunning signal.
          </p>
          <div className="flex flex-wrap gap-2">
            <ActionButton
              primary
              disabled={pending || !ownerEmail?.trim()}
              onClick={() => {
                setConfirmSendKind(null);
                void run("send_payment_reminder");
              }}
            >
              Confirm & Send
            </ActionButton>
            <ActionButton onClick={() => setConfirmSendKind(null)}>
              Cancel
            </ActionButton>
          </div>
        </div>
      ) : null}

      {canOwnerTools && ownerPanel === "task" ? (
        <div className="mt-4 space-y-3 rounded-sm border border-[color-mix(in_srgb,var(--taupe-medium)_45%,transparent)] bg-[var(--true-white)] p-4">
          <p className="ws-eyebrow">Set a Task</p>
          <label className="block text-sm">
            <span className="ws-muted">Title</span>
            <input
              className="mt-1 w-full rounded-sm border border-[color-mix(in_srgb,var(--taupe-medium)_55%,transparent)] bg-[var(--true-white)] px-3 py-2 text-sm text-foreground"
              value={taskTitle}
              onChange={(e) => setTaskTitle(e.target.value)}
              placeholder="e.g. Follow up on walkthrough"
              disabled={ownerBusy}
            />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="ws-muted">Due date</span>
              <input
                type="date"
                className="mt-1 w-full rounded-sm border border-[color-mix(in_srgb,var(--taupe-medium)_55%,transparent)] bg-[var(--true-white)] px-3 py-2 text-sm text-foreground"
                value={taskDue}
                onChange={(e) => setTaskDue(e.target.value)}
                disabled={ownerBusy}
              />
            </label>
            <label className="block text-sm sm:col-span-1">
              <span className="ws-muted">Notes (optional)</span>
              <input
                className="mt-1 w-full rounded-sm border border-[color-mix(in_srgb,var(--taupe-medium)_55%,transparent)] bg-[var(--true-white)] px-3 py-2 text-sm text-foreground"
                value={taskDescription}
                onChange={(e) => setTaskDescription(e.target.value)}
                placeholder="Context for the assignee"
                disabled={ownerBusy}
              />
            </label>
          </div>
          <div className="flex flex-wrap gap-2">
            <ActionButton
              primary
              disabled={ownerBusy || !taskTitle.trim()}
              onClick={() =>
                void runOwnerAction("create_task", {
                  title: taskTitle,
                  dueDate: taskDue,
                  description: taskDescription || null,
                })
              }
            >
              Create task
            </ActionButton>
            <ActionButton disabled={ownerBusy} onClick={() => setOwnerPanel(null)}>
              Cancel
            </ActionButton>
          </div>
        </div>
      ) : null}

      {canOwnerTools && ownerPanel === "message" ? (
        <div className="mt-4 space-y-3 rounded-sm border border-[color-mix(in_srgb,var(--taupe-medium)_45%,transparent)] bg-[var(--true-white)] p-4">
          <p className="ws-eyebrow">Send a Message</p>
          <p className="text-sm ws-muted">
            To: {ownerEmail?.trim() || "No owner email on this relationship"}
          </p>
          <label className="block text-sm">
            <span className="ws-muted">Subject</span>
            <input
              className="mt-1 w-full rounded-sm border border-[color-mix(in_srgb,var(--taupe-medium)_55%,transparent)] bg-[var(--true-white)] px-3 py-2 text-sm text-foreground"
              value={msgSubject}
              onChange={(e) => setMsgSubject(e.target.value)}
              disabled={ownerBusy}
            />
          </label>
          <label className="block text-sm">
            <span className="ws-muted">Message</span>
            <textarea
              rows={8}
              className="mt-1 w-full rounded-sm border border-[color-mix(in_srgb,var(--taupe-medium)_55%,transparent)] bg-[var(--true-white)] px-3 py-2 text-sm leading-relaxed text-foreground"
              value={msgBody}
              onChange={(e) => setMsgBody(e.target.value)}
              disabled={ownerBusy}
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <ActionButton
              primary
              disabled={
                ownerBusy ||
                !msgSubject.trim() ||
                !msgBody.trim() ||
                !ownerEmail?.trim()
              }
              onClick={() =>
                void runOwnerAction("send_message", {
                  subject: msgSubject,
                  body: msgBody,
                })
              }
            >
              Confirm & Send
            </ActionButton>
            <ActionButton disabled={ownerBusy} onClick={() => setOwnerPanel(null)}>
              Cancel
            </ActionButton>
          </div>
        </div>
      ) : null}

      {canOwnerTools && ownerPanel === "note" ? (
        <div className="mt-4 space-y-3 rounded-sm border border-[color-mix(in_srgb,var(--taupe-medium)_45%,transparent)] bg-[var(--true-white)] p-4">
          <p className="ws-eyebrow">Make a Note</p>
          <p className="text-sm ws-muted">
            Internal only — not emailed to the venue owner.
          </p>
          <label className="block text-sm">
            <span className="ws-muted">Note</span>
            <textarea
              rows={5}
              className="mt-1 w-full rounded-sm border border-[color-mix(in_srgb,var(--taupe-medium)_55%,transparent)] bg-[var(--true-white)] px-3 py-2 text-sm leading-relaxed text-foreground"
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              placeholder="Capture context for the team…"
              disabled={ownerBusy}
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <ActionButton
              primary
              disabled={ownerBusy || !noteText.trim()}
              onClick={() =>
                void runOwnerAction("add_note", {
                  note: noteText,
                  subject: "Internal note",
                })
              }
            >
              Save note
            </ActionButton>
            <ActionButton disabled={ownerBusy} onClick={() => setOwnerPanel(null)}>
              Cancel
            </ActionButton>
          </div>
        </div>
      ) : null}

      {checkoutUrl ? (
        <div
          className="mt-4 rounded-sm border border-[color-mix(in_srgb,var(--soft-sage)_50%,transparent)] bg-[color-mix(in_srgb,var(--soft-sage)_12%,var(--true-white))] p-3 text-sm"
          data-testid="generated-checkout-link"
        >
          <p className="ws-eyebrow">Checkout link</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <code className="max-w-full truncate rounded-sm bg-[var(--true-white)] px-2 py-1 font-mono text-xs">
              {checkoutUrl.length > 64
                ? `${checkoutUrl.slice(0, 40)}…${checkoutUrl.slice(-12)}`
                : checkoutUrl}
            </code>
            <button
              type="button"
              className="text-sm text-[var(--heritage-sage)] underline-offset-4 hover:underline"
              onClick={() => void copyUrl()}
            >
              Copy link
            </button>
          </div>
          {checkoutExpiresAt ? (
            <p className="mt-2 text-xs ws-muted">
              Typically expires ~24h after creation (
              {new Date(checkoutExpiresAt).toLocaleString()}). Generate a new
              link if needed. Copying does not email the customer.
            </p>
          ) : (
            <p className="mt-2 text-xs ws-muted">
              Copying does not email the customer. Generate a new link if the
              previous session expired.
            </p>
          )}
        </div>
      ) : null}

      {message ? (
        <p className="mt-3 text-sm text-foreground" role="status">
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
  active,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  primary?: boolean;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={
        primary
          ? "rounded-sm bg-[var(--heritage-sage)] px-3.5 py-2 text-sm font-medium text-[var(--true-white)] hover:opacity-95 disabled:opacity-50"
          : active
            ? "rounded-sm border border-[var(--heritage-sage)] bg-[color-mix(in_srgb,var(--soft-sage)_18%,var(--true-white))] px-3.5 py-2 text-sm font-medium text-[var(--forest-sage)] disabled:opacity-50"
            : "rounded-sm border border-[color-mix(in_srgb,var(--taupe-medium)_55%,transparent)] bg-[var(--true-white)] px-3.5 py-2 text-sm font-medium text-[var(--forest-sage)] hover:border-[var(--heritage-sage)] disabled:opacity-50"
      }
    >
      {children}
    </button>
  );
}
