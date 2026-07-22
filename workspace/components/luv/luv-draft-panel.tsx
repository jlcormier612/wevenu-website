"use client";

import { useMemo, useState, useTransition } from "react";

import {
  createLuvTaskAction,
  dismissLuvInsightAction,
  useLuvDraftAction,
} from "@/app/(app)/luv/actions";
import { LuvMark } from "@/components/luv/luv-mark";
import type { LuvDraft, LuvInsight } from "@/lib/luv/types";

export function LuvDraftPanel({
  open,
  onClose,
  drafts: initialDrafts,
  title = "Luv drafts",
  subtitle = "Suggestions first — edit, copy, or save to the timeline.",
}: {
  open: boolean;
  onClose: () => void;
  drafts: LuvDraft[];
  title?: string;
  subtitle?: string;
}) {
  const [expandedId, setExpandedId] = useState<string | null>(initialDrafts[0]?.id ?? null);
  const [edits, setEdits] = useState<Record<string, { subject: string; body: string }>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState<string | null>(null);

  const drafts = useMemo(() => initialDrafts, [initialDrafts]);

  if (!open) return null;

  function current(draft: LuvDraft) {
    return {
      subject: edits[draft.id]?.subject ?? draft.subject,
      body: edits[draft.id]?.body ?? draft.body,
    };
  }

  function update(draftId: string, patch: Partial<{ subject: string; body: string }>) {
    setEdits((prev) => ({
      ...prev,
      [draftId]: {
        subject: patch.subject ?? prev[draftId]?.subject ?? "",
        body: patch.body ?? prev[draftId]?.body ?? "",
      },
    }));
  }

  async function copyText(draft: LuvDraft) {
    const { subject, body } = current(draft);
    const text = subject ? `Subject: ${subject}\n\n${body}` : body;
    await navigator.clipboard.writeText(text);
    setCopiedId(draft.id);
    setTimeout(() => setCopiedId(null), 2000);
  }

  function saveDraft(draft: LuvDraft, mode: "note" | "send") {
    const { subject, body } = current(draft);
    const fd = new FormData();
    fd.set("relationshipId", draft.relationshipId);
    fd.set("subject", subject);
    fd.set("body", body);
    fd.set("channel", draft.channel);
    fd.set("mode", mode);
    startTransition(async () => {
      const res = await useLuvDraftAction(fd);
      if (!res.ok) {
        setStatus("Could not save.");
        return;
      }
      if (mode === "note") {
        setStatus("Saved to timeline.");
        return;
      }
      if (res.delivery === "sent") {
        setStatus("Email sent via Resend. Logged on timeline.");
      } else if (res.delivery === "failed") {
        setStatus("Send failed — timeline still updated.");
      } else {
        setStatus("Dry-run (no RESEND_API_KEY). Timeline logged as simulated.");
      }
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-[color-mix(in_srgb,var(--forest-sage)_28%,transparent)]">
      <button
        type="button"
        className="absolute inset-0 cursor-default"
        aria-label="Close drafts"
        onClick={onClose}
      />
      <aside className="relative flex h-full w-full max-w-lg flex-col border-l border-[color-mix(in_srgb,var(--taupe-medium)_55%,transparent)] bg-[var(--natural-cream)] shadow-[-12px_0_40px_rgba(79,95,79,0.08)]">
        <header className="border-b border-[color-mix(in_srgb,var(--taupe-medium)_40%,transparent)] px-6 py-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="ws-eyebrow flex items-center gap-2">
                <LuvMark size={12} />
                Luv
              </p>
              <h2 className="mt-2 font-heading text-2xl tracking-tight">{title}</h2>
              <p className="mt-1 text-sm ws-muted">{subtitle}</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-sm px-2 py-1 text-sm ws-muted hover:text-[var(--forest-sage)]"
            >
              Close
            </button>
          </div>
          {status ? <p className="mt-3 text-sm text-[var(--heritage-sage)]">{status}</p> : null}
        </header>

        <div className="flex-1 space-y-3 overflow-y-auto px-5 py-5">
          {drafts.length === 0 ? (
            <p className="text-sm ws-muted">No drafts suggested right now.</p>
          ) : (
            drafts.map((draft) => {
              const openRow = expandedId === draft.id;
              const values = current(draft);
              return (
                <article
                  key={draft.id}
                  className="rounded-sm border border-[color-mix(in_srgb,var(--taupe-medium)_45%,transparent)] bg-[var(--true-white)]"
                >
                  <button
                    type="button"
                    className="flex w-full items-start justify-between gap-3 px-4 py-3 text-left"
                    onClick={() => setExpandedId(openRow ? null : draft.id)}
                  >
                    <div>
                      <p className="text-xs tracking-wide text-[var(--heritage-sage)]">{draft.label}</p>
                      <p className="mt-1 font-medium">{draft.venueName}</p>
                      <p className="mt-0.5 text-sm ws-muted line-clamp-1">{values.subject}</p>
                    </div>
                    <span className="text-xs ws-muted">{openRow ? "Hide" : "Edit"}</span>
                  </button>

                  {openRow ? (
                    <div className="space-y-3 border-t border-[color-mix(in_srgb,var(--taupe-medium)_35%,transparent)] px-4 py-4">
                      <label className="block">
                        <span className="ws-eyebrow">Subject</span>
                        <input
                          className="mt-1.5 w-full rounded-sm border border-[color-mix(in_srgb,var(--taupe-medium)_55%,transparent)] bg-[var(--warm-gray)] px-3 py-2 text-sm"
                          value={values.subject}
                          onChange={(e) => {
                            if (!edits[draft.id]) {
                              update(draft.id, { subject: e.target.value, body: draft.body });
                            } else {
                              update(draft.id, { subject: e.target.value });
                            }
                          }}
                        />
                      </label>
                      <label className="block">
                        <span className="ws-eyebrow">Body</span>
                        <textarea
                          rows={12}
                          className="mt-1.5 w-full rounded-sm border border-[color-mix(in_srgb,var(--taupe-medium)_55%,transparent)] bg-[var(--warm-gray)] px-3 py-2 text-sm leading-relaxed"
                          value={values.body}
                          onChange={(e) => {
                            if (!edits[draft.id]) {
                              update(draft.id, { subject: draft.subject, body: e.target.value });
                            } else {
                              update(draft.id, { body: e.target.value });
                            }
                          }}
                        />
                      </label>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => void copyText(draft)}
                          className="rounded-sm border border-[color-mix(in_srgb,var(--taupe-medium)_55%,transparent)] px-3 py-2 text-sm hover:border-[var(--heritage-sage)]"
                        >
                          {copiedId === draft.id ? "Copied" : "Copy"}
                        </button>
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() => saveDraft(draft, "note")}
                          className="rounded-sm border border-[color-mix(in_srgb,var(--taupe-medium)_55%,transparent)] px-3 py-2 text-sm hover:border-[var(--heritage-sage)]"
                        >
                          Use draft
                        </button>
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() => saveDraft(draft, "send")}
                          className="rounded-sm bg-[var(--forest-sage)] px-3 py-2 text-sm text-[var(--natural-cream)] hover:opacity-90"
                        >
                          Send
                        </button>
                      </div>
                      <p className="text-xs ws-muted">
                        Use draft saves an internal note. Send uses Resend when configured; otherwise
                        dry-runs and still logs email_sent on the timeline.
                      </p>
                    </div>
                  ) : null}
                </article>
              );
            })
          )}
        </div>
      </aside>
    </div>
  );
}

export function LuvInsightActions({
  insight,
  showWelcomeBackVerify,
  onDraft,
}: {
  insight: LuvInsight;
  showWelcomeBackVerify?: boolean;
  onDraft?: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const primary =
    insight.primaryAction ??
    insight.actions.find((a) => a !== "dismiss") ??
    "draft";

  const showDraft =
    insight.actions.includes("draft") || insight.actions.includes("send_email");
  const showTask = insight.actions.includes("create_task");
  const showVerify =
    insight.actions.includes("verify_welcome_back") && showWelcomeBackVerify;
  const showDismiss = insight.actions.includes("dismiss");

  const draftLabel = insight.actions.includes("send_email") && primary === "send_email"
    ? "Send email"
    : insight.draftKind === "welcome"
      ? "Draft welcome"
      : insight.draftKind === "launch_checklist"
        ? "Draft checklist"
        : "Draft";

  function btnClass(action: string) {
    const isPrimary = action === primary;
    return isPrimary
      ? "rounded-sm bg-[var(--forest-sage)] px-3 py-1.5 text-xs text-[var(--natural-cream)] hover:opacity-90"
      : "rounded-sm border border-[color-mix(in_srgb,var(--taupe-medium)_55%,transparent)] px-3 py-1.5 text-xs hover:border-[var(--heritage-sage)]";
  }

  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {showVerify ? (
        <a
          href="#welcome-back-verify"
          className={btnClass("verify_welcome_back")}
        >
          Verify Welcome Back
        </a>
      ) : null}
      {showDraft && onDraft ? (
        <button
          type="button"
          onClick={onDraft}
          className={
            primary === "draft" || primary === "send_email"
              ? btnClass(primary === "send_email" ? "send_email" : "draft")
              : "rounded-sm border border-[color-mix(in_srgb,var(--dusty-rose)_45%,var(--taupe-medium))] px-3 py-1.5 text-xs text-[var(--forest-sage)] hover:border-[var(--dusty-rose)]"
          }
        >
          {draftLabel}
        </button>
      ) : null}
      {showTask ? (
        <button
          type="button"
          disabled={pending}
          className={btnClass("create_task")}
          onClick={() => {
            const fd = new FormData();
            fd.set("relationshipId", insight.relationshipId);
            const taskTitle =
              insight.type === "launch_checklist"
                ? `Send Launch Checklist — ${insight.venueName}`
                : insight.type === "welcome_missing"
                  ? `Send Welcome email — ${insight.venueName}`
                  : insight.type === "kickoff_overdue"
                    ? `Reschedule kickoff — ${insight.venueName}`
                    : insight.type === "implementation_waiting"
                      ? `Follow up on implementation — ${insight.venueName}`
                      : `Follow up — ${insight.venueName}: ${insight.message.slice(0, 72)}`;
            fd.set("title", taskTitle);
            fd.set("insightId", insight.id);
            startTransition(async () => {
              await createLuvTaskAction(fd);
            });
          }}
        >
          Create task
        </button>
      ) : null}
      {showDismiss ? (
        <button
          type="button"
          disabled={pending}
          className="rounded-sm px-3 py-1.5 text-xs ws-muted hover:text-[var(--forest-sage)]"
          onClick={() => {
            const fd = new FormData();
            fd.set("insightId", insight.id);
            fd.set("relationshipId", insight.relationshipId);
            startTransition(async () => {
              await dismissLuvInsightAction(fd);
            });
          }}
        >
          Dismiss
        </button>
      ) : null}
    </div>
  );
}
