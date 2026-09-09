/**
 * Hello to Cheers — Delivery Event Order templates.
 * Structure only: section names (+ optional guidance). No checklist/process lines.
 */

export type EventOrderStarterMasterKey = "EO-D-01" | "EO-D-02";

/** Legacy checklist masters — archived by provision, not applied as delivery lines. */
export const LEGACY_EVENT_ORDER_STARTER_KEYS = ["EO-01", "EO-02"] as const;

export type EventOrderStarterSection = {
  name: string;
  guidance?: string;
  lines?: never[];
};

export type EventOrderStarterMaster = {
  key: EventOrderStarterMasterKey;
  name: string;
  description: string;
  sections: EventOrderStarterSection[];
};

export const EVENT_ORDER_STARTER_MASTERS: readonly EventOrderStarterMaster[] = [
  {
    key: "EO-D-01",
    name: "Wedding Reception",
    description: "Delivery structure for a full wedding reception — fill with Offerings.",
    sections: [
      { name: "Catering", guidance: "Add plated or buffet offerings for this event." },
      { name: "Bar", guidance: "Add bar packages, toasts, and signature drinks." },
      { name: "Rentals", guidance: "Add rental products the couple is receiving." },
      { name: "Services", guidance: "Add staffing and coordination services." },
      { name: "Other", guidance: "Anything else this event is receiving." },
    ],
  },
  {
    key: "EO-D-02",
    name: "Ceremony + Reception",
    description: "Delivery structure covering ceremony and reception provision.",
    sections: [
      { name: "Ceremony", guidance: "Ceremony-related offerings and rentals." },
      { name: "Catering", guidance: "Add plated or buffet offerings for this event." },
      { name: "Bar", guidance: "Add bar packages, toasts, and signature drinks." },
      { name: "Rentals", guidance: "Add rental products the couple is receiving." },
      { name: "Services", guidance: "Add staffing and coordination services." },
      { name: "Other", guidance: "Anything else this event is receiving." },
    ],
  },
] as const;

export function getEventOrderStarterMaster(key: string): EventOrderStarterMaster | undefined {
  return EVENT_ORDER_STARTER_MASTERS.find((m) => m.key === key);
}

export function listEventOrderStarterMasters(): EventOrderStarterMaster[] {
  return [...EVENT_ORDER_STARTER_MASTERS];
}
