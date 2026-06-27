/**
 * Day-of Sheet — the printable document a venue coordinator hands to their team.
 *
 * Intentionally uses standard print colors (grays) rather than the app's design
 * tokens, because this is a paper document, not a screen UI. The venue's primary
 * color appears only in the header bar.
 */

import type { EventWithDetails } from "@/lib/events/types";
import { formatDate, formatTime } from "@/lib/events/constants";
import { eventTypeLabel } from "@/lib/leads/constants";
import type { Venue } from "@/lib/venue/types";
import { vendorCategoryLabel } from "@/lib/vendors/constants";

function formatVendorTime(hhmm: string): string {
  const [h, m] = hhmm.split(":");
  return new Date(0, 0, 0, Number(h), Number(m)).toLocaleTimeString("en-US", {
    hour: "numeric", minute: "2-digit",
  });
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-4 text-[10px] font-bold uppercase tracking-[0.18em] text-gray-400">
      {children}
    </p>
  );
}

function Rule() {
  return <hr className="my-6 border-gray-100" />;
}

export function DaySheetDocument({
  event,
  venue,
}: {
  event: EventWithDetails;
  venue: Venue;
}) {
  const startTime5 = event.startTime?.slice(0, 5) ?? null;

  const dayName = new Date(event.eventDate + "T12:00:00").toLocaleDateString(
    "en-US",
    { weekday: "long" },
  );

  const eventSummary = [
    event.eventType ? eventTypeLabel(event.eventType) : null,
    startTime5 ? `${formatTime(startTime5)} ceremony` : null,
    event.guestCount != null ? `${event.guestCount.toLocaleString()} guests` : null,
  ].filter(Boolean);

  // Also show setup → teardown range if available
  const dayRange = [
    event.setupTime ? `Setup ${formatTime(event.setupTime)}` : null,
    event.teardownTime ? `Teardown ${formatTime(event.teardownTime)}` : null,
  ].filter(Boolean);

  return (
    <div className="bg-white font-sans text-sm text-gray-800">
      {/* ── Header bar ─────────────────────────────────────────────────── */}
      <div
        className="px-10 py-5"
        style={{ backgroundColor: venue.primaryColor }}
      >
        <div className="flex items-end justify-between">
          <div className="flex items-center gap-4 text-white">
            {venue.logoUrl && (
              <img
                src={venue.logoUrl}
                alt={venue.name}
                className="h-12 w-12 rounded-lg object-contain"
                style={{ background: "rgba(255,255,255,0.15)" }}
              />
            )}
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest opacity-70">
                Day-of Sheet
              </p>
              <p className="mt-0.5 text-xl font-bold">{venue.name}</p>
            </div>
          </div>
          <div className="text-right text-white">
            <p className="text-base font-semibold">{formatDate(event.eventDate)}</p>
            <p className="text-sm opacity-70">{dayName}</p>
          </div>
        </div>
      </div>

      {/* ── Event identity ──────────────────────────────────────────────── */}
      <div className="px-10 pt-8 pb-2">
        <p className="font-heading text-4xl font-medium tracking-tight text-gray-900">
          {event.clientName ?? event.name}
        </p>
        {eventSummary.length > 0 && (
          <p className="mt-1.5 text-sm text-gray-500">
            {eventSummary.join(" · ")}
          </p>
        )}
        {dayRange.length > 0 && (
          <p className="mt-0.5 text-xs text-gray-400">
            {dayRange.join(" · ")}
          </p>
        )}
      </div>

      {/* ── Timeline ────────────────────────────────────────────────────── */}
      {event.timeline.length > 0 && (
        <div className="px-10 pt-6 pb-2">
          <Rule />
          <SectionLabel>Schedule</SectionLabel>
          <div className="space-y-2.5">
            {event.timeline.map((entry) => {
              const isStart = entry.entryTime === startTime5;
              return (
                <div key={entry.id} className="flex gap-5">
                  {/* Time column */}
                  <div className="w-20 shrink-0 text-right">
                    <span
                      className={`text-xs font-semibold ${isStart ? "text-gray-900" : "text-gray-400"}`}
                    >
                      {entry.entryTime ? formatTime(entry.entryTime) : ""}
                    </span>
                  </div>
                  {/* Content column */}
                  <div className="min-w-0 flex-1 pb-1.5 border-b border-gray-50">
                    <p
                      className={`leading-snug ${isStart ? "font-semibold text-gray-900" : "text-gray-700"}`}
                    >
                      {isStart && (
                        <span
                          className="mr-1.5 text-xs font-bold"
                          style={{ color: venue.primaryColor }}
                          aria-hidden
                        >
                          ★
                        </span>
                      )}
                      {entry.title}
                    </p>
                    {entry.description && (
                      <p className="mt-0.5 text-xs text-gray-400 italic">
                        {entry.description}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Vendors ──────────────────────────────────────────────────────── */}
      {event.vendorAssignments.length > 0 && (
        <div className="px-10 py-2">
          <Rule />
          <SectionLabel>Vendors</SectionLabel>
          <div className="space-y-1.5">
            {[...event.vendorAssignments]
              .sort((a, b) => (a.arrivalTime ?? "99:99").localeCompare(b.arrivalTime ?? "99:99"))
              .map((v) => (
                <div key={v.id} className="flex flex-wrap items-baseline gap-x-2 text-sm">
                  <span className="font-medium text-gray-800">{v.vendorName}</span>
                  {v.vendorCategory && <span className="text-gray-400 text-xs">{vendorCategoryLabel(v.vendorCategory)}</span>}
                  {v.arrivalTime && <span className="text-gray-500 text-xs">· Arriving {formatVendorTime(v.arrivalTime)}</span>}
                  {v.vendorPhone && <span className="text-gray-400 text-xs">{v.vendorPhone}</span>}
                </div>
              ))}
          </div>
        </div>
      )}

      {/* ── Team ────────────────────────────────────────────────────────── */}
      {event.team.length > 0 && (
        <div className="px-10 py-2">
          <Rule />
          <SectionLabel>Event Team</SectionLabel>
          <div className="grid gap-1.5 sm:grid-cols-2">
            {event.team.map((member) => (
              <div
                key={member.id}
                className="flex flex-wrap items-baseline gap-x-2 text-sm"
              >
                <span className="font-medium text-gray-800">{member.fullName}</span>
                {member.role && (
                  <span className="text-gray-400 text-xs">{member.role}</span>
                )}
                {member.phone && (
                  <span className="text-gray-400 text-xs">{member.phone}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Notes ───────────────────────────────────────────────────────── */}
      {event.notes.length > 0 && (
        <div className="px-10 py-2">
          <Rule />
          <SectionLabel>Notes</SectionLabel>
          <div className="space-y-3">
            {event.notes.map((note) => (
              <p
                key={note.id}
                className="whitespace-pre-wrap text-sm text-gray-600 italic leading-relaxed"
              >
                {note.body}
              </p>
            ))}
          </div>
        </div>
      )}

      {/* ── Footer ──────────────────────────────────────────────────────── */}
      <div className="mt-8 px-10 py-4 border-t border-gray-100 flex items-center justify-between">
        <p className="text-xs text-gray-300">{venue.name}</p>
        <p className="text-xs text-gray-300">Powered by Wevenu</p>
      </div>
    </div>
  );
}
