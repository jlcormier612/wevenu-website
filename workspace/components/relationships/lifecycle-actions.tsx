"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { greetingFirstName } from "@shared/relationships/normalize";

type OwnerPanel = "task" | "message" | "note" | null;

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
  ownerEmail?: string;
  ownerFirstName?: string;
  venueName?: string;
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
  ownerEmail,
  ownerFirstName,
  venueName,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [checkoutUrl, setCheckoutUrl] = useState<string | null>(null);
  const [plan, setPlan] = useState(planId === "none" ? "gather" : planId);
  const [wg, setWg] = useState(onboardingType === "white_glove");

  const greetName = greetingFirstName({
    firstName: ownerFirstName,
    email: ownerEmail,
  });
  const replyGreeting = `Hi ${greetName},\n\n`;

  const [ownerPanel, setOwnerPanel] = useState<OwnerPanel>(null);
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
    setOwnerPanel((cur) => (cur === panel ? null : panel));
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
        {showCustomerActions && canSendLink ? (
          <ActionButton disabled={pending} onClick={() => run("resend_welcome")}>
            Resend Welcome Email
          </ActionButton>
        ) : null}
        {showCustomerActions &&
        canLaunch &&
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
          </>
        ) : null}
        {showCustomerActions && canManageBilling ? (
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

      {canOwnerTools && ownerPanel === "task" ? (
        <div className="mt-4 space-y-3 rounded-sm border border-[color-mix(in_srgb,var(--taupe-medium)_45%,transparent)] bg-[var(--true-white)] p-4">
          <p className="ws-eyebrow">Set a Task</p>
          <label className="block text-sm">
            <span className="ws-muted">Title</span>
            <input
              className="mt-1 w-full rounded-sm border border-[color-mix(in_srgb,var(--taupe-medium)_55%,transparent)] bg-[var(--true-white)] px-3 py-2 text-sm"
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
                className="mt-1 w-full rounded-sm border border-[color-mix(in_srgb,var(--taupe-medium)_55%,transparent)] bg-[var(--true-white)] px-3 py-2 text-sm"
                value={taskDue}
                onChange={(e) => setTaskDue(e.target.value)}
                disabled={ownerBusy}
              />
            </label>
            <label className="block text-sm sm:col-span-1">
              <span className="ws-muted">Notes (optional)</span>
              <input
                className="mt-1 w-full rounded-sm border border-[color-mix(in_srgb,var(--taupe-medium)_55%,transparent)] bg-[var(--true-white)] px-3 py-2 text-sm"
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
              className="mt-1 w-full rounded-sm border border-[color-mix(in_srgb,var(--taupe-medium)_55%,transparent)] bg-[var(--true-white)] px-3 py-2 text-sm"
              value={msgSubject}
              onChange={(e) => setMsgSubject(e.target.value)}
              disabled={ownerBusy}
            />
          </label>
          <label className="block text-sm">
            <span className="ws-muted">Message</span>
            <textarea
              rows={8}
              className="mt-1 w-full rounded-sm border border-[color-mix(in_srgb,var(--taupe-medium)_55%,transparent)] bg-[var(--true-white)] px-3 py-2 text-sm leading-relaxed"
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
              Send message
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
              className="mt-1 w-full rounded-sm border border-[color-mix(in_srgb,var(--taupe-medium)_55%,transparent)] bg-[var(--true-white)] px-3 py-2 text-sm leading-relaxed"
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
