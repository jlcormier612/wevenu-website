"use client";

/**
 * Screen-only print/export toolbar (Calendar Integration Phase 4). Same
 * mechanism as every other print page in this app (floor-plan-print,
 * timeline-print) — the browser's native print dialog, no PDF library.
 * CSV export is added here since a coordinator asking to "export" the
 * items they're looking at is the other half of the same request, and a
 * flat CalendarItem[] converts to CSV trivially client-side, no server
 * round-trip needed.
 */
import { Download, Printer } from "lucide-react";

import type { CalendarItem } from "@/lib/calendar/types";

function toCsv(items: CalendarItem[]): string {
  const header = ["Date", "Time", "Type", "Title", "Subtitle"];
  const rows = items.map((i) => [i.date, i.time ?? "", i.type, i.title, i.subtitle ?? ""]);
  const escape = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  return [header, ...rows].map((row) => row.map(escape).join(",")).join("\n");
}

export function PrintToolbar({ items, filename }: { items: CalendarItem[]; filename: string }) {
  function handleExport() {
    const blob = new Blob([toCsv(items)], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${filename}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="no-print flex items-center justify-between gap-2 mb-4">
      <a href="/calendar" style={{ fontSize: 14, color: "#5D6F5D", textDecoration: "none" }}>← Back to Calendar</a>
      <div style={{ display: "flex", gap: 8 }}>
        <button
          onClick={handleExport}
          style={{ padding: "6px 16px", background: "transparent", color: "#5D6F5D", border: "1px solid #5D6F5D", borderRadius: 8, cursor: "pointer", fontSize: 14, display: "flex", alignItems: "center", gap: 6 }}
        >
          <Download size={14} /> Export CSV
        </button>
        <button
          onClick={() => window.print()}
          style={{ padding: "6px 16px", background: "#5D6F5D", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 14, display: "flex", alignItems: "center", gap: 6 }}
        >
          <Printer size={14} /> Print / Save as PDF
        </button>
      </div>
    </div>
  );
}
