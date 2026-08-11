/**
 * Hello to Cheers — Starter Event Order templates (EO-01 / EO-02).
 *
 * Structure only: section names + starter operational lines.
 * No fake dates, guest counts, venues, vendors, or prices.
 * Working Event Orders pull live event context from the Event domain.
 */

export type EventOrderStarterMasterKey = "EO-01" | "EO-02";

export type EventOrderStarterLine = {
  description: string;
  quantity?: number;
  unitPrice?: number;
};

export type EventOrderStarterSection = {
  name: string;
  lines: EventOrderStarterLine[];
};

export type EventOrderStarterMaster = {
  key: EventOrderStarterMasterKey;
  name: string;
  description: string;
  sections: EventOrderStarterSection[];
};

const process = (description: string): EventOrderStarterLine => ({
  description,
  quantity: 1,
  unitPrice: 0,
});

const FULL_SECTIONS: EventOrderStarterSection[] = [
  {
    name: "Event Overview",
    lines: [
      process("Confirm guest count against the Event record"),
      process("Confirm spaces against the booking"),
      process("Confirm package / selected services"),
      process("Coordinator assigned"),
    ],
  },
  {
    name: "Event Schedule",
    lines: [
      process("Venue Access / Setup"),
      process("Vendor Arrivals"),
      process("Ceremony"),
      process("Cocktail Hour"),
      process("Reception Begins"),
      process("Dinner"),
      process("Toasts / Speeches"),
      process("First Dance"),
      process("Cake / Dessert"),
      process("Dancing"),
      process("Event Ends"),
      process("Breakdown / Load-Out"),
    ],
  },
  {
    name: "Ceremony",
    lines: [
      process("Ceremony seating"),
      process("Ceremony chairs"),
      process("Arbor / backdrop"),
      process("Aisle"),
      process("Signing table"),
      process("Reserved seating"),
      process("Other ceremony setup"),
      process("Ceremony notes — add ceremony-specific details the venue team needs"),
    ],
  },
  {
    name: "Reception",
    lines: [
      process("Guest tables"),
      process("Head table / sweetheart table"),
      process("Cocktail tables"),
      process("Gift/card table"),
      process("Cake/dessert table"),
      process("DJ/band area"),
      process("Dance floor"),
      process("Bar"),
      process("Other reception setup"),
      process("Reception notes — add setup or service details the team needs"),
    ],
  },
  {
    name: "Food & Beverage",
    lines: [
      process("Meal type"),
      process("Service style"),
      process("Estimated meal count"),
      process("Service start"),
      process("Service location"),
      process("Bar service"),
      process("Bar location"),
      process("Bar service start"),
      process("Bar service end"),
      process("Dietary / guest considerations"),
      process("Catering notes"),
    ],
  },
  {
    name: "Rentals & Inventory",
    lines: [
      process("Tables — 60\" Round"),
      process("Tables — 72\" Round"),
      process("Tables — 6' Banquet"),
      process("Tables — 8' Banquet"),
      process("Tables — Cocktail Table"),
      process("Tables — Sweetheart Table"),
      process("Chairs — Standard Folding"),
      process("Chairs — Chiavari"),
      process("Chairs — Cross-Back"),
      process("Linens — 90\" Round"),
      process("Linens — 108\" Round"),
      process("Linens — 120\" Round"),
      process("Linens — Banquet Linen"),
      process("Ceremony — Arbor"),
      process("Ceremony — Signing Table"),
      process("Ceremony — Aisle Runner"),
      process("Reception — Cake Table"),
      process("Reception — Gift / Card Table"),
      process("Reception — Head Table"),
      process("Replace starter inventory lines with Working Inventory as items are confirmed"),
    ],
  },
  {
    name: "Room Setup",
    lines: [
      process("Link the Floor Plan for this space (use Floor Plan on this booking)"),
      process("Guest seating layout confirmed"),
      process("Major setup elements reviewed"),
      process("Room setup notes"),
    ],
  },
  {
    name: "Vendor Team",
    lines: [
      process("Planner / Coordinator"),
      process("Caterer"),
      process("Photographer"),
      process("Videographer"),
      process("Florist"),
      process("DJ / Band"),
      process("Hair & Makeup"),
      process("Transportation"),
      process("Rentals"),
      process("Other — use Vendor Network on this event; do not re-key vendors here"),
    ],
  },
  {
    name: "Vendor Arrival & Load-In",
    lines: [
      process("Arrival times confirmed with vendors on file"),
      process("Load-in location / access notes"),
      process("Setup location notes"),
      process("Parking / access notes"),
      process("Venue contact for arrivals"),
      process("Special load-in instructions"),
    ],
  },
  {
    name: "Staffing & Venue Responsibilities",
    lines: [
      process("Event Coordinator"),
      process("Venue Manager"),
      process("Event Staff"),
      process("Setup Team"),
      process("Bar Team"),
      process("Other venue roles"),
      process("Venue responsibilities for this celebration"),
    ],
  },
  {
    name: "Client Requests & Special Notes",
    lines: [
      process("Special requests — from planning forms or client notes"),
      process("Important moments — first dance"),
      process("Important moments — parent dances"),
      process("Important moments — toasts"),
      process("Important moments — cultural traditions"),
      process("Important moments — anniversary recognition"),
      process("Important moments — special announcements"),
      process("VIP / family considerations"),
    ],
  },
  {
    name: "Decor & Setup",
    lines: [
      process("Ceremony décor"),
      process("Reception décor"),
      process("Floral"),
      process("Signage"),
      process("Personal décor"),
      process("Candles"),
      process("Specialty installations"),
      process("Other décor"),
      process("Setup notes"),
      process("Breakdown notes"),
    ],
  },
  {
    name: "Client-Provided Items",
    lines: [
      process("Welcome sign"),
      process("Guest book"),
      process("Place cards"),
      process("Menus"),
      process("Favors"),
      process("Personal décor"),
      process("Cake topper"),
      process("Card box"),
      process("Other client-provided items"),
    ],
  },
  {
    name: "Payment Summary",
    lines: [
      process("Review Payment Plan — totals shown live from Financials (do not re-enter amounts here)"),
      process("Next payment confirmed with client if needed"),
    ],
  },
  {
    name: "Final Event Readiness",
    lines: [
      process("Final guest count confirmed (Event / Final Details)"),
      process("Final Details completed"),
      process("Vendors confirmed (Vendor Network)"),
      process("Timeline reviewed"),
      process("Floor plan confirmed"),
      process("Inventory confirmed (Working Inventory)"),
      process("Payment status reviewed (Payment Plan)"),
      process("Client requests reviewed"),
      process("Event team briefed"),
      process("Event Order ready"),
    ],
  },
  {
    name: "Day-of Notes",
    lines: [
      process("Day-of notes for the venue team"),
    ],
  },
  {
    name: "Event Closeout",
    lines: [
      process("Event ended"),
      process("Client departure"),
      process("Vendor load-out"),
      process("Damage / issues noted"),
      process("Lost & found"),
      process("Follow-up required"),
      process("Additional closeout notes"),
    ],
  },
];

const RECEPTION_ONLY_SECTIONS: EventOrderStarterSection[] = FULL_SECTIONS
  .filter((s) => s.name !== "Ceremony")
  .map((s) => {
    if (s.name !== "Event Schedule") return s;
    return {
      name: s.name,
      lines: s.lines.filter((l) => l.description !== "Ceremony"),
    };
  });

export const EVENT_ORDER_STARTER_MASTERS: readonly EventOrderStarterMaster[] = [
  {
    key: "EO-01",
    name: "Standard Wedding Event Order",
    description:
      "A complete starting point for organizing the details your team needs to prepare for and run a wedding. Customize the sections and information to match the way your venue operates.",
    sections: FULL_SECTIONS,
  },
  {
    key: "EO-02",
    name: "Standard Wedding — Reception Only",
    description:
      "A lighter Event Order for celebrations where the ceremony is not held at your venue. Same structure — without ceremony-specific sections.",
    sections: RECEPTION_ONLY_SECTIONS,
  },
] as const;

export function getEventOrderStarterMaster(key: string): EventOrderStarterMaster | undefined {
  return EVENT_ORDER_STARTER_MASTERS.find((m) => m.key === key);
}
