"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";

import { greetingFirstName } from "@shared/relationships/normalize";

import {
  type SupportResolveItem,
  typeLabel,
} from "@/components/relationships/support-preview";

export function SupportResolveControl({
  relationshipId,
  venueName,
  ownerEmail,
  ownerFirstName,
  openCount,
  items,
  compact = false,
  autoFocus = false,
  focusItemId = null,
  canAct = true,
}: {
  relationshipId: string;
  venueName: string;
  ownerEmail?: string;
  ownerFirstName?: string;
  openCount: number;
  items: SupportResolveItem[];
  /** Today list — resolve shortcut */
  compact?: boolean;
  /** Scroll into view when deep-linked (`?panel=support`) */
  autoFocus?: boolean;
  /** Scroll + highlight a specific open item (`?item=`) */
  focusItemId?: string | null;
  /** Show Reply / Resolve controls */
  canAct?: boolean;
}) {
  const router = useRouter();
  const panelRef = useRef<HTMLDivElement>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [replyingId, setReplyingId] = useState<string | null>(null);
  const [replySubject, setReplySubject] = useState("");
  const [replyBody, setReplyBody] = useState("");
  const [sendingReply, setSendingReply] = useState(false);
  const [highlightedId, setHighlightedId] = useState<string | null>(null);

  const openItems = items.filter((i) => i.status === "open");
  const hasLegacyOnly = openCount > 0 && openItems.length === 0;
  const greetName = greetingFirstName({
    firstName: ownerFirstName,
    email: ownerEmail,
  });

  useEffect(() => {
    if (compact) return;
    const targetId = focusItemId?.trim() || null;
    if (!autoFocus && !targetId) return;

    const t = window.setTimeout(() => {
      if (targetId) {
        const row = document.getElementById(`support-item-${targetId}`);
        if (row) {
          row.scrollIntoView({ behavior: "smooth", block: "center" });
          setHighlightedId(targetId);
          return;
        }
      }
      const el = panelRef.current || document.getElementById("support");
      el?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 80);
    return () => window.clearTimeout(t);
  }, [autoFocus, compact, focusItemId, openCount]);

  useEffect(() => {
    if (!highlightedId) return;
    const t = window.setTimeout(() => setHighlightedId(null), 4000);
    return () => window.clearTimeout(t);
  }, [highlightedId]);

  async function onResolve(opts: { itemId?: string; all?: boolean }) {
    setError(null);
    setDone(null);
    try {
      const res = await fetch("/api/relationships/support", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          relationshipId,
          action: "resolve",
          itemId: opts.itemId,
          all: opts.all === true || (!opts.itemId && hasLegacyOnly),
        }),
      });
      const data = (await res.json()) as {
        error?: string;
        supportOpenCount?: number;
      };
      if (!res.ok) {
        setError(data.error || "Could not resolve");
        return;
      }
      setDone(
        opts.itemId
          ? "Resolved"
          : `Resolved — ${data.supportOpenCount ?? 0} open remaining`,
      );
      setReplyingId(null);
      startTransition(() => router.refresh());
    } catch {
      setError("Network error");
    }
  }

  function startReply(item: SupportResolveItem) {
    setError(null);
    setDone(null);
    setReplyingId(item.id);
    setReplySubject(
      item.subject?.startsWith("Re:")
        ? item.subject
        : `Re: ${item.subject || "your message"}`,
    );
    setReplyBody(`Hi ${greetName},\n\n`);
  }

  async function onSendReply() {
    if (!replyingId) return;
    setError(null);
    setDone(null);
    setSendingReply(true);
    try {
      const res = await fetch("/api/relationships/support", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          relationshipId,
          action: "reply",
          itemId: replyingId,
          subject: replySubject,
          body: replyBody,
        }),
      });
      const data = (await res.json()) as {
        error?: string;
        delivery?: string;
      };
      if (!res.ok) {
        setError(data.error || "Could not send reply");
        return;
      }
      setDone(
        data.delivery === "sent"
          ? "Reply sent"
          : data.delivery === "simulated"
            ? "Reply logged (simulated send)"
            : "Reply recorded",
      );
      setReplyingId(null);
      startTransition(() => router.refresh());
    } catch {
      setError("Network error");
    } finally {
      setSendingReply(false);
    }
  }

  if (openCount <= 0 && openItems.length === 0) return null;

  if (compact) {
    if (!canAct) return null;
    return (
      <div className="mt-1 flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={() => void onResolve({ all: true })}
          className="rounded-sm border border-[color-mix(in_srgb,var(--taupe-medium)_55%,transparent)] bg-[var(--true-white)] px-2.5 py-1 text-xs font-medium text-[var(--forest-sage)] disabled:opacity-60"
        >
          Resolve
        </button>
        {pending ? <span className="text-xs ws-muted">Saving…</span> : null}
        {error ? (
          <span className="text-xs text-[var(--dusty-rose)]">{error}</span>
        ) : null}
      </div>
    );
  }

  return (
    <div
      ref={panelRef}
      id="support"
      className="ws-panel scroll-mt-8 border-[var(--soft-sage)]/50 p-5"
    >
      <p className="ws-eyebrow">Open support</p>
      <h2 className="mt-1 font-heading text-xl">Feedback & support</h2>
      <p className="mt-2 text-sm ws-muted">
        {venueName} has {openCount} open item{openCount === 1 ? "" : "s"}. Read
        the message, reply to the owner, then resolve when done.
      </p>

      {openItems.length > 0 ? (
        <ul className="mt-4 space-y-5">
          {openItems.map((item) => {
            const focused =
              highlightedId === item.id || focusItemId === item.id;
            return (
              <li
                key={item.id}
                id={`support-item-${item.id}`}
                className={`scroll-mt-24 border-b border-[color-mix(in_srgb,var(--taupe-medium)_30%,transparent)] pb-5 last:border-0 last:pb-0 ${
                  focused
                    ? "rounded-sm ring-2 ring-[var(--heritage-sage)] ring-offset-2 ring-offset-[var(--true-white)]"
                    : ""
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">
                      {typeLabel(item.type)}
                      {item.subject ? ` · ${item.subject}` : ""}
                    </p>
                    <p className="mt-0.5 text-xs ws-muted">
                      {new Date(item.createdAt).toLocaleString("en-US", {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-2">
                    {canAct ? (
                      <>
                        <button
                          type="button"
                          disabled={pending || sendingReply || !ownerEmail}
                          title={
                            ownerEmail
                              ? "Reply to venue owner"
                              : "Owner email missing"
                          }
                          onClick={() => startReply(item)}
                          className="rounded-sm border border-[color-mix(in_srgb,var(--taupe-medium)_55%,transparent)] bg-[var(--true-white)] px-3 py-1.5 text-sm font-medium text-[var(--forest-sage)] disabled:opacity-60"
                        >
                          Reply
                        </button>
                        <button
                          type="button"
                          disabled={pending || sendingReply}
                          onClick={() => void onResolve({ itemId: item.id })}
                          className="rounded-sm bg-[var(--heritage-sage)] px-3 py-1.5 text-sm font-medium text-[var(--true-white)] disabled:opacity-60"
                        >
                          Resolve
                        </button>
                      </>
                    ) : null}
                  </div>
                </div>

                {item.body ? (
                  <div className="mt-3 whitespace-pre-wrap rounded-sm bg-[color-mix(in_srgb,var(--header-linen)_70%,var(--true-white))] px-3 py-2.5 text-sm leading-relaxed text-[var(--forest-sage)]">
                    {item.body}
                  </div>
                ) : (
                  <p className="mt-3 text-sm ws-muted">
                    No message body on this item — check Communications /
                    Timeline for the inbound note.
                  </p>
                )}

                {replyingId === item.id ? (
                  <div className="mt-4 space-y-3 rounded-sm border border-[color-mix(in_srgb,var(--taupe-medium)_40%,transparent)] bg-[var(--true-white)] p-3">
                    <p className="text-xs ws-muted">
                      To: {ownerEmail || "—"} · Email reply to owner
                    </p>
                    <label className="block text-sm">
                      <span className="ws-muted">Subject</span>
                      <input
                        type="text"
                        value={replySubject}
                        onChange={(e) => setReplySubject(e.target.value)}
                        className="mt-1 w-full rounded-sm border border-[color-mix(in_srgb,var(--taupe-medium)_50%,transparent)] bg-[var(--natural-cream)] px-3 py-2 text-[var(--forest-sage)]"
                      />
                    </label>
                    <label className="block text-sm">
                      <span className="ws-muted">Message</span>
                      <textarea
                        value={replyBody}
                        onChange={(e) => setReplyBody(e.target.value)}
                        rows={6}
                        className="mt-1 w-full rounded-sm border border-[color-mix(in_srgb,var(--taupe-medium)_50%,transparent)] bg-[var(--natural-cream)] px-3 py-2 text-[var(--forest-sage)]"
                      />
                    </label>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={
                          sendingReply ||
                          !replySubject.trim() ||
                          !replyBody.trim()
                        }
                        onClick={() => void onSendReply()}
                        className="rounded-sm bg-[var(--heritage-sage)] px-4 py-2 text-sm font-medium text-[var(--true-white)] disabled:opacity-60"
                      >
                        {sendingReply ? "Sending…" : "Send reply"}
                      </button>
                      <button
                        type="button"
                        disabled={sendingReply}
                        onClick={() => setReplyingId(null)}
                        className="rounded-sm border border-[color-mix(in_srgb,var(--taupe-medium)_55%,transparent)] px-4 py-2 text-sm font-medium text-[var(--forest-sage)] disabled:opacity-60"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="mt-4 text-sm ws-muted">
          Open count is {openCount} (legacy entry without item detail).
        </p>
      )}

      {(canAct && (openItems.length > 1 || hasLegacyOnly)) && (
        <div className="mt-4">
          <button
            type="button"
            disabled={pending || sendingReply}
            onClick={() => void onResolve({ all: true })}
            className="rounded-sm border border-[color-mix(in_srgb,var(--taupe-medium)_55%,transparent)] bg-[var(--warm-gray)] px-4 py-2 text-sm font-medium text-[var(--forest-sage)] disabled:opacity-60"
          >
            Resolve all
          </button>
        </div>
      )}

      {pending ? <p className="mt-2 text-xs ws-muted">Saving…</p> : null}
      {done ? (
        <p className="mt-2 text-sm text-[var(--heritage-sage)]">{done}</p>
      ) : null}
      {error ? (
        <p className="mt-2 text-sm text-[var(--dusty-rose)]">{error}</p>
      ) : null}
    </div>
  );
}
