"use client";

import * as React from "react";

import { Input } from "@/components/ui/input";
import {
  filterTemplateApplyClientGroups,
  type TemplateApplyClientGroup,
  type TemplateApplyEventTarget,
} from "@/lib/library/template-apply-targets";

export type { TemplateApplyClientGroup, TemplateApplyEventTarget };

/**
 * Client-first Use Template picker.
 * Select a client, then (when needed) the event/workspace under that client.
 * Apply still uses eventId downstream.
 */
export function TemplateApplyTargetPicker({
  groups,
  disabled,
  onSelectEvent,
}: {
  groups: TemplateApplyClientGroup[];
  disabled?: boolean;
  onSelectEvent: (event: TemplateApplyEventTarget) => void;
}) {
  const [q, setQ] = React.useState("");
  const [expandedClientId, setExpandedClientId] = React.useState<string | null>(null);
  const filtered = filterTemplateApplyClientGroups(groups, q);

  return (
    <div data-testid="template-apply-target-picker">
      <Input
        placeholder="Search clients…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        className="mb-3"
        data-testid="template-apply-client-search"
      />
      {filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">No clients found.</p>
      ) : (
        <ul className="space-y-1">
          {filtered.map((group) => {
            const multi = group.events.length > 1;
            const expanded = expandedClientId === group.clientId;
            return (
              <li key={group.clientId} className="rounded-md border border-border">
                <button
                  type="button"
                  disabled={disabled}
                  data-testid={`template-apply-client-${group.clientId}`}
                  onClick={() => {
                    if (!multi) {
                      onSelectEvent(group.events[0]);
                      return;
                    }
                    setExpandedClientId(expanded ? null : group.clientId);
                  }}
                  className="w-full rounded-md px-3 py-2.5 text-left hover:bg-muted/40 disabled:opacity-50"
                >
                  <p className="text-sm font-medium text-heading">{group.clientDisplayName}</p>
                  {!multi ? (
                    <p className="text-xs text-muted-foreground">
                      {group.events[0].name} · {group.events[0].eventDate}
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      {group.events.length} events — choose which one
                    </p>
                  )}
                </button>
                {multi && expanded ? (
                  <ul className="border-t border-border bg-muted/20 px-2 py-2 space-y-1">
                    {group.events.map((ev) => (
                      <li key={ev.id}>
                        <button
                          type="button"
                          disabled={disabled}
                          data-testid={`template-apply-event-${ev.id}`}
                          onClick={() => onSelectEvent(ev)}
                          className="w-full rounded-md px-3 py-2 text-left text-sm hover:bg-background disabled:opacity-50"
                        >
                          <span className="font-medium text-heading">{ev.name}</span>
                          <span className="ml-2 text-xs text-muted-foreground">{ev.eventDate}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
