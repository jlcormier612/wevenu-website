import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PrintButton } from "@/app/(app)/events/[id]/floor-plan-print/print-button";
import { getEvent } from "@/lib/events/service";
import { getSeatingDataForVenue } from "@/lib/seating/service";
import { getClient } from "@/lib/clients/service";
import { getCurrentVenue } from "@/lib/venue/service";
import { clientDisplayName } from "@/lib/clients/constants";
import { ACCESSIBILITY_LABELS } from "@/lib/portal/types";
import type { SeatingGuest } from "@/lib/portal/types";

type Props = { params: Promise<{ id: string }> };

export const metadata: Metadata = { title: "Seating — Print" };

/**
 * Print-friendly wedding-day seating rosters — one flow, every table, no
 * search, no interactivity. Reads the exact same data the couple's own
 * Seating tab and the venue's interactive lookup (app/(app)/events/[id]/seating)
 * both compute — no second seating data model, nothing new stored.
 */
export default async function SeatingPrintPage({ params }: Props) {
  const { id } = await params;
  const event = await getEvent(id);
  if (!event || !event.clientId) notFound();

  const [data, client, venue] = await Promise.all([
    getSeatingDataForVenue(id, event.clientId),
    getClient(event.clientId),
    getCurrentVenue(),
  ]);
  if (!venue) notFound();

  const coupleName = client
    ? clientDisplayName(client.firstName, client.lastName, client.partnerFirstName, client.partnerLastName) || event.name
    : event.name;

  const guestLine = (g: SeatingGuest) => {
    const bits: string[] = [];
    if (g.mealChoice) bits.push(g.mealChoice);
    if (g.accessibilityTags.length > 0) bits.push(g.accessibilityTags.map((t) => ACCESSIBILITY_LABELS[t] ?? t).join(", "));
    if (g.isChild) bits.push("child");
    if (g.isVendorMeal) bits.push("vendor meal");
    return bits.length > 0 ? `${g.name} (${bits.join(" · ")})` : g.name;
  };

  const allGuests = data
    ? [
        ...data.tables.flatMap((t) => t.guests),
        ...data.unassignedGuests,
        ...data.needsReassignment,
      ]
    : [];
  const mealCounts = new Map<string, number>();
  for (const g of allGuests) {
    if (g.isVendorMeal) continue;
    const label = g.mealChoice?.trim() || "Not yet chosen";
    mealCounts.set(label, (mealCounts.get(label) ?? 0) + 1);
  }
  const accessibilityGuests = allGuests.filter((g) => g.accessibilityTags.length > 0);

  return (
    <>
      <style>{`
        @media print {
          @page { size: portrait; margin: 0.5in; }
          .no-print { display: none !important; }
          body { background: white !important; margin: 0; }
          .seating-table { break-inside: avoid; }
        }
        body { background: #f5f4f2; font-family: sans-serif; }
      `}</style>

      <div style={{ maxWidth: 800, margin: "0 auto", padding: "24px 16px" }}>
        <div className="no-print" style={{ display: "flex", justifyContent: "space-between", marginBottom: 16, alignItems: "center" }}>
          <a href={`/events/${id}/seating`} style={{ fontSize: 14, color: "#5D6F5D", textDecoration: "none" }}>← Back to Wedding Day Seating</a>
          <PrintButton />
        </div>

        <div style={{ background: "white", borderRadius: 12, overflow: "hidden", boxShadow: "0 4px 20px rgba(0,0,0,0.08)" }}>
          <div style={{ background: venue.primaryColor, padding: "14px 24px", display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
            <div style={{ color: "white" }}>
              <div style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.1em", opacity: 0.7 }}>Seating Rosters</div>
              <div style={{ fontSize: 18, fontWeight: 700, marginTop: 2 }}>{venue.name}</div>
            </div>
            <div style={{ color: "white", textAlign: "right" }}>
              <div style={{ fontSize: 14, fontWeight: 600 }}>{coupleName}</div>
              {event.eventDate && (
                <div style={{ fontSize: 12, opacity: 0.8, marginTop: 2 }}>
                  {new Date(event.eventDate + "T12:00:00").toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
                </div>
              )}
            </div>
          </div>

          <div style={{ padding: 24 }}>
            {!data || !data.floorPlan ? (
              <p style={{ fontSize: 13, color: "#8E978E" }}>No floor plan is currently shared for seating, or no seating has been started yet.</p>
            ) : (
              <>
                <div style={{ display: "flex", gap: 24, marginBottom: 20, fontSize: 12, color: "#4F5F4F" }}>
                  <span><strong>{data.stats.totalAttending}</strong> attending</span>
                  <span><strong>{data.stats.totalAssigned}</strong> seated</span>
                  <span><strong>{data.stats.tableCount}</strong> tables</span>
                </div>

                {[...data.tables].sort((a, b) => (a.label ?? "").localeCompare(b.label ?? "")).map((t) => (
                  <div key={t.id} className="seating-table" style={{ borderTop: "1px solid #DED6CA", padding: "12px 0" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: "#3D5040" }}>{t.label ?? "Table"}</span>
                      <span style={{ fontSize: 12, color: "#8E978E" }}>{t.guests.length}{t.capacity != null ? `/${t.capacity}` : ""} seated</span>
                    </div>
                    {t.guests.length === 0 ? (
                      <p style={{ fontSize: 12, color: "#B8AEA1", margin: 0 }}>No one seated here yet.</p>
                    ) : (
                      <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: "#4F5F4F" }}>
                        {[...t.guests].sort((a, b) => a.name.localeCompare(b.name)).map((g) => (
                          <li key={g.guestId}>{guestLine(g)}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}

                {(data.unassignedGuests.length > 0 || data.needsReassignment.length > 0) && (
                  <div className="seating-table" style={{ borderTop: "1px solid #DED6CA", padding: "12px 0" }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: "#B8AEA1" }}>Not yet seated</span>
                    <ul style={{ margin: "6px 0 0", paddingLeft: 18, fontSize: 12, color: "#4F5F4F" }}>
                      {[...data.unassignedGuests, ...data.needsReassignment].sort((a, b) => a.name.localeCompare(b.name)).map((g) => (
                        <li key={g.guestId}>{guestLine(g)}</li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="seating-table" style={{ borderTop: "1px solid #DED6CA", padding: "12px 0" }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: "#3D5040" }}>Meal Counts</span>
                  <ul style={{ margin: "6px 0 0", paddingLeft: 18, fontSize: 12, color: "#4F5F4F" }}>
                    {[...mealCounts.entries()].sort((a, b) => b[1] - a[1]).map(([label, count]) => (
                      <li key={label}>{label}: {count}</li>
                    ))}
                  </ul>
                </div>

                {accessibilityGuests.length > 0 && (
                  <div className="seating-table" style={{ borderTop: "1px solid #DED6CA", padding: "12px 0" }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: "#3D5040" }}>Accessibility Notes</span>
                    <ul style={{ margin: "6px 0 0", paddingLeft: 18, fontSize: 12, color: "#4F5F4F" }}>
                      {accessibilityGuests.map((g) => (
                        <li key={g.guestId}>{g.name}: {g.accessibilityTags.map((t) => ACCESSIBILITY_LABELS[t] ?? t).join(", ")}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            )}
          </div>

          <div style={{ borderTop: "1px solid #DED6CA", padding: "8px 24px", display: "flex", justifyContent: "space-between" }}>
            <span style={{ fontSize: 10, color: "#B8AEA1" }}>{venue.name}</span>
            <span style={{ fontSize: 10, color: "#B8AEA1" }}>Powered by Wevenu</span>
          </div>
        </div>
      </div>
    </>
  );
}
