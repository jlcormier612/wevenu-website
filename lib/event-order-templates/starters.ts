/**
 * Hello to Cheers — Delivery Event Order templates.
 * Sections plus optional snapshot offerings (priced or not).
 * Not a client invoice or commercial commitment.
 */

import type { TemplatePricingModel } from "@/lib/event-order-templates/offerings";

export type EventOrderStarterMasterKey = "EO-D-01" | "EO-D-02";

/** Legacy checklist masters — archived by provision, not applied as delivery lines. */
export const LEGACY_EVENT_ORDER_STARTER_KEYS = ["EO-01", "EO-02"] as const;

export type EventOrderStarterOffering = {
  name: string;
  description?: string;
  unitPrice?: number | null;
  pricingModel: TemplatePricingModel;
  unit?: string;
  defaultQuantity?: number;
  includedByDefault?: boolean;
};

export type EventOrderStarterSection = {
  name: string;
  guidance?: string;
  offerings?: EventOrderStarterOffering[];
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
    description: "A reusable delivery template for a wedding reception — add, remove, or reprice anything for your venue.",
    sections: [
      {
        name: "Catering",
        guidance: "Food this event is receiving. Prices are examples you can change.",
        offerings: [
          { name: "Plated Dinner", unitPrice: 85, pricingModel: "per_person", unit: "person" },
          { name: "Buffet Dinner", unitPrice: 72, pricingModel: "per_person", unit: "person" },
        ],
      },
      {
        name: "Bar",
        guidance: "Bar packages, toasts, and signature drinks.",
        offerings: [
          { name: "Beer & Wine", unitPrice: 28, pricingModel: "per_person", unit: "person" },
          { name: "Full Bar", unitPrice: 42, pricingModel: "per_person", unit: "person" },
        ],
      },
      {
        name: "Rentals",
        guidance: "Rental products the couple is receiving.",
        offerings: [
          { name: "Chiavari Chair", unitPrice: 8, pricingModel: "per_unit", unit: "chair", defaultQuantity: 150 },
          { name: "Farm Table", unitPrice: 85, pricingModel: "per_unit", unit: "table" },
        ],
      },
      {
        name: "Services",
        guidance: "Staffing and coordination.",
        offerings: [
          { name: "Day-of Coordination", unitPrice: 1200, pricingModel: "flat", includedByDefault: true },
        ],
      },
    ],
  },
  {
    key: "EO-D-02",
    name: "Ceremony + Reception",
    description: "Ceremony and reception delivery in one template — customize categories and prices for your venue.",
    sections: [
      {
        name: "Ceremony",
        guidance: "Ceremony-related offerings and rentals.",
        offerings: [
          { name: "Ceremony Coordination", unitPrice: 500, pricingModel: "flat" },
          { name: "Arbor", unitPrice: 350, pricingModel: "flat" },
        ],
      },
      {
        name: "Catering",
        guidance: "Food this event is receiving.",
        offerings: [
          { name: "Plated Dinner", unitPrice: 85, pricingModel: "per_person", unit: "person" },
          { name: "Buffet Dinner", unitPrice: 72, pricingModel: "per_person", unit: "person" },
        ],
      },
      {
        name: "Bar",
        guidance: "Bar packages, toasts, and signature drinks.",
        offerings: [
          { name: "Beer & Wine", unitPrice: 28, pricingModel: "per_person", unit: "person" },
        ],
      },
      {
        name: "Rentals",
        guidance: "Rental products the couple is receiving.",
        offerings: [
          { name: "Chiavari Chair", unitPrice: 8, pricingModel: "per_unit", unit: "chair" },
        ],
      },
      {
        name: "Services",
        guidance: "Staffing and coordination.",
        offerings: [
          { name: "Day-of Coordination", unitPrice: 1200, pricingModel: "flat" },
        ],
      },
    ],
  },
] as const;

export function getEventOrderStarterMaster(key: string): EventOrderStarterMaster | undefined {
  return EVENT_ORDER_STARTER_MASTERS.find((m) => m.key === key);
}

export function listEventOrderStarterMasters(): EventOrderStarterMaster[] {
  return [...EVENT_ORDER_STARTER_MASTERS];
}
