import type { Metadata } from "next";

import { PrintToolbar } from "@/app/(app)/calendar/print/print-toolbar";
import { resolveCalendarView, type CalendarViewParams } from "@/lib/calendar/view-data";
import { getCurrentVenue } from "@/lib/venue/service";

export const metadata: Metadata = { title: "Calendar — Print" };

type Props = { searchParams: Promise<CalendarViewParams> };

/**
 * Print/export view (Calendar Integration Phase 4). Same window resolution
 * as the live page (lib/calendar/view-data.ts) — whatever items a
 * coordinator was looking at is exactly what prints, always rendered as a
 * clean chronological list regardless of which view (Month/Week/Day/
 * Agenda) it came from, since a grid doesn't print or export as legibly as
 * a list. Same mechanism as every other print page in this app: a
 * server-rendered document + the browser's native print dialog.
 */
export default async function CalendarPrintPage({ searchParams }: Props) {
  const params = await searchParams;
  const [{ view, items }, venue] = await Promise.all([resolveCalendarView(params), getCurrentVenue()]);

  const byDate = new Map<string, typeof items>();
  for (const item of items) {
    const existing = byDate.get(item.date) ?? [];
    byDate.set(item.date, [...existing, item]);
  }
  const sortedDates = [...byDate.keys()].sort();

  return (
    <>
      <style>{`
        @media print {
          @page { margin: 0.5in; }
          .no-print { display: none !important; }
          body { background: white !important; margin: 0; }
        }
        body { background: #f5f4f2; font-family: sans-serif; }
      `}</style>

      <div style={{ maxWidth: 720, margin: "0 auto", padding: "24px 16px" }}>
        <PrintToolbar items={items} filename={`calendar-${view}`} />

        <div style={{ background: "white", borderRadius: 12, overflow: "hidden", boxShadow: "0 4px 20px rgba(0,0,0,0.08)" }}>
          <div style={{ background: venue?.primaryColor ?? "#5D6F5D", padding: "14px 24px" }}>
            <div style={{ color: "white", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.1em", opacity: 0.7 }}>
              {venue?.name ?? "Calendar"}
            </div>
            <div style={{ color: "white", fontSize: 18, fontWeight: 700, marginTop: 2 }}>
              {sortedDates.length > 0
                ? `${new Date(sortedDates[0] + "T12:00:00").toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })} – ${new Date(sortedDates[sortedDates.length - 1] + "T12:00:00").toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}`
                : "Nothing in this window"}
            </div>
          </div>

          <div style={{ padding: 24 }}>
            {sortedDates.map((date) => (
              <div key={date} style={{ marginBottom: 18, breakInside: "avoid" }}>
                <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "#4F5F4F", borderBottom: "1px solid #DED6CA", paddingBottom: 4, marginBottom: 6 }}>
                  {new Date(date + "T12:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
                </div>
                {byDate.get(date)!.map((item) => (
                  <div key={item.id} style={{ display: "flex", gap: 10, padding: "4px 0", fontSize: 13 }}>
                    <span style={{ width: 64, flexShrink: 0, color: "#8E978E" }}>
                      {item.time ? new Date(0, 0, 0, ...item.time.split(":").map(Number) as [number, number]).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) : "All day"}
                    </span>
                    <span style={{ flex: 1 }}>
                      <strong style={{ color: "#4F5F4F" }}>{item.title}</strong>
                      {item.subtitle && <span style={{ color: "#8E978E" }}> — {item.subtitle}</span>}
                    </span>
                  </div>
                ))}
              </div>
            ))}
          </div>

          <div style={{ borderTop: "1px solid #DED6CA", padding: "8px 24px", display: "flex", justifyContent: "space-between" }}>
            <span style={{ fontSize: 10, color: "#B8AEA1" }}>{venue?.name}</span>
            <span style={{ fontSize: 10, color: "#B8AEA1" }}>Powered by Wevenu</span>
          </div>
        </div>
      </div>
    </>
  );
}
