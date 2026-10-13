"use client";

/**
 * Communication Health Message History — supports attention-filter pagination
 * so every delivery-failure counted by the tile remains reachable.
 */
import * as React from "react";
import Link from "next/link";
import { Mail, Smartphone } from "lucide-react";

import { MessageTimelinePopover } from "@/components/messaging/message-timeline-popover";
import { MESSAGE_STATUS_META } from "@/lib/communication/status-labels";
import type { MessageHistoryItem } from "@/lib/communication/dashboard";

const DEFAULT_PAGE_SIZE = 20;

export function MessageHistoryList({
  items,
  paginate = false,
  pageSize = DEFAULT_PAGE_SIZE,
}: {
  items: MessageHistoryItem[];
  /** When true, reveal pages so large attention sets stay reachable. */
  paginate?: boolean;
  pageSize?: number;
}) {
  const [page, setPage] = React.useState(1);

  React.useEffect(() => {
    setPage(1);
  }, [items]);

  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground">No messages yet.</p>;
  }

  const size = Math.max(1, Math.trunc(pageSize));
  // Cumulative pages 1..n so Load more appends rather than replacing.
  const visibleCount = paginate
    ? Math.min(items.length, page * size)
    : items.length;
  const visible = items.slice(0, visibleCount);
  const hasMore = paginate && visibleCount < items.length;
  const total = items.length;

  return (
    <div className="space-y-3">
      <ul className="divide-y divide-border">
        {visible.map((m) => {
          const href = m.clientId
            ? `/clients/${m.clientId}`
            : m.leadId
              ? `/leads/${m.leadId}`
              : null;
          const Icon = m.channel === "sms" ? Smartphone : Mail;
          const nameBlock = (
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm text-heading">
                {m.recipientName
                  ?? (m.direction === "inbound" ? "Incoming message" : "Sent message")}
              </p>
              <p className="truncate text-xs text-muted-foreground">{m.preview}</p>
            </div>
          );
          return (
            <li
              key={`${m.source}-${m.id}`}
              className="flex items-start gap-3 py-2.5"
              data-testid="message-history-row"
              data-status={m.status ?? ""}
            >
              <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
              {href ? (
                <Link href={href} className="flex min-w-0 flex-1 hover:text-primary">
                  {nameBlock}
                </Link>
              ) : (
                nameBlock
              )}
              <div className="min-w-0 max-w-[min(100%,11.5rem)] shrink-0 text-left sm:max-w-[14rem] sm:text-right">
                {m.direction === "outbound" ? (
                  <div className="inline-flex max-w-full sm:justify-end">
                    <MessageTimelinePopover
                      messageId={m.id}
                      source={m.source}
                      status={m.status}
                      failureReason={m.failureReason}
                      channel={m.channel}
                      isOutbound
                    />
                  </div>
                ) : m.status && MESSAGE_STATUS_META[m.status] ? (
                  <p className="text-xs font-medium text-muted-foreground">
                    <span aria-hidden>{MESSAGE_STATUS_META[m.status].emoji}</span>{" "}
                    {MESSAGE_STATUS_META[m.status].label}
                  </p>
                ) : null}
                <p className="text-[11px] text-muted-foreground">
                  {new Date(m.occurredAt).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                  })}
                </p>
              </div>
            </li>
          );
        })}
      </ul>
      {paginate && hasMore && (
        <button
          type="button"
          onClick={() => setPage((p) => p + 1)}
          className="text-xs font-medium text-primary hover:underline"
          data-testid="message-history-load-more"
        >
          Load more ({visible.length} of {total})
        </button>
      )}
    </div>
  );
}
