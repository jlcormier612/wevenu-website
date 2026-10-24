"use client";

/**
 * Staff Client Portal Preview — read-only Timeline presentation.
 * Mirrors couple empty-state copy and chronological entry cards without
 * portal token mutations (edit / submit / visibility / share).
 */

import { Clock } from "lucide-react";

import {
  compareTimelineEntries,
  formatTime,
  formatTimelineDayHeader,
  isMultiDayEvent,
  maxDayOffset,
} from "@/lib/timeline/constants";

export type TimelinePreviewEntry = {
  id: string;
  title: string;
  description: string | null;
  entryTime: string | null;
  dayOffset: number;
  sectionId: string | null;
  sectionName: string | null;
  sortOrder: number;
  owner: "venue" | "client";
};

function formatEntryTime(entryTime: string | null): string {
  if (!entryTime) return "";
  return formatTime(entryTime);
}

export function TimelinePortalPreviewView({
  entries,
  venueName,
  eventDate = null,
  eventEndDate = null,
  staffPreviewLabel = null,
}: {
  entries: TimelinePreviewEntry[];
  venueName: string;
  eventDate?: string | null;
  eventEndDate?: string | null;
  staffPreviewLabel?: string | null;
}) {
  if (entries.length === 0) {
    return (
      <div
        className="rounded-2xl border border-dashed border-border py-16 text-center px-6 space-y-2"
        data-testid="timeline-portal-preview-empty"
      >
        <p className="text-2xl" aria-hidden>
          🕒
        </p>
        <p className="text-sm font-medium text-heading">No timeline shared yet</p>
        <p className="text-xs text-muted-foreground max-w-xs mx-auto">
          {staffPreviewLabel
            ? staffPreviewLabel
            : `${venueName} will share the Timeline here as it comes together.`}
        </p>
      </div>
    );
  }

  const multiDay = isMultiDayEvent(eventDate, eventEndDate);
  const dayOffsets = multiDay && eventDate
    ? Array.from({ length: maxDayOffset(eventDate, eventEndDate) + 1 }, (_, i) => i)
    : [null as number | null];

  function entriesForDay(day: number | null) {
    return entries
      .filter((e) => day == null || Number(e.dayOffset ?? 0) === day)
      .slice()
      .sort(compareTimelineEntries);
  }

  function renderDay(day: number | null) {
    const list = entriesForDay(day);
    if (list.length === 0) return null;

    return (
      <div className="space-y-2">
        {list.map((entry, index) => {
          const sectionName = entry.sectionName;
          const prev = index > 0 ? list[index - 1] : null;
          const showSectionLabel = !!sectionName && sectionName !== prev?.sectionName;
          return (
            <div key={entry.id} className="space-y-1">
              {showSectionLabel ? (
                <p className="pt-1 text-[10px] font-medium uppercase tracking-widest text-muted-foreground px-0.5">
                  {sectionName}
                </p>
              ) : null}
              <div className="w-full rounded-xl border border-border/60 bg-card px-3 py-3">
                <div className="flex flex-wrap items-center gap-2">
                  {entry.entryTime ? (
                    <span className="flex items-center gap-1 text-xs font-semibold text-heading">
                      <Clock className="h-3 w-3" aria-hidden /> {formatEntryTime(entry.entryTime)}
                    </span>
                  ) : (
                    <span className="text-[10px] italic text-muted-foreground">No time set</span>
                  )}
                  {entry.owner === "venue" ? (
                    <span className="rounded-full bg-muted px-1.5 py-0.5 text-[9px] font-semibold text-muted-foreground">
                      🔒 From your venue
                    </span>
                  ) : null}
                </div>
                <p className="mt-0.5 text-sm font-medium text-foreground">{entry.title}</p>
                {entry.description ? (
                  <p className="mt-0.5 whitespace-pre-wrap text-xs text-muted-foreground">
                    {entry.description}
                  </p>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className="w-full space-y-5" data-testid="timeline-portal-preview">
      {staffPreviewLabel ? (
        <p className="px-1 text-xs text-muted-foreground">{staffPreviewLabel}</p>
      ) : null}
      {dayOffsets.map((day) => {
        if (!multiDay || day == null || !eventDate) {
          return <div key="single">{renderDay(null)}</div>;
        }
        return (
          <div key={day} className="space-y-4">
            <h3 className="font-heading text-sm font-semibold text-heading border-b border-border pb-2">
              {formatTimelineDayHeader(eventDate, day)}
            </h3>
            <div className="space-y-5">{renderDay(day)}</div>
          </div>
        );
      })}
    </div>
  );
}
