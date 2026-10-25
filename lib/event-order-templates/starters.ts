/**
 * Hello to Cheers — Delivery Event Order templates.
 * Sections with included/fixed lines plus choice groups for required and
 * optional commercial decisions. Not a client invoice or commercial commitment.
 */

import type { TemplatePricingModel } from "@/lib/event-order-templates/offerings";
import type { EventOrderTemplateSelectionMode } from "@/lib/event-order-templates/types";

export type EventOrderStarterMasterKey = "EO-D-01" | "EO-D-02";

/** Legacy checklist masters — archived by provision, not applied as delivery lines. */
export const LEGACY_EVENT_ORDER_STARTER_KEYS = ["EO-01", "EO-02"] as const;

/** Fixed / included template lines (package baseline — not couple pickables). */
export type EventOrderStarterOffering = {
  name: string;
  description?: string;
  unitPrice?: number | null;
  pricingModel: TemplatePricingModel;
  unit?: string;
  defaultQuantity?: number;
  includedByDefault?: boolean;
};

/** Option inside a starter choice group. */
export type EventOrderStarterOption = {
  name: string;
  /** Pricing basis shown to couple (options store unit price only). */
  description?: string;
  unitPrice?: number | null;
  isIncluded?: boolean;
  isDefault?: boolean;
};

/** Required or optional commercial choice group. */
export type EventOrderStarterChoiceGroup = {
  name: string;
  instructions?: string;
  selectionMode: EventOrderTemplateSelectionMode;
  minSelect: number;
  maxSelect: number | null;
  allowQuantity?: boolean;
  options: EventOrderStarterOption[];
};

export type EventOrderStarterSection = {
  name: string;
  guidance?: string;
  /** Included / fixed lines only — never mutually exclusive alternatives. */
  offerings?: EventOrderStarterOffering[];
  choiceGroups?: EventOrderStarterChoiceGroup[];
};

export type EventOrderStarterMaster = {
  key: EventOrderStarterMasterKey;
  name: string;
  description: string;
  sections: EventOrderStarterSection[];
};

/**
 * Pre-correction flat line names (no choice groups). Used only to detect
 * uncustomized venue copies that are safe to upgrade in place.
 */
export const LEGACY_FLAT_STARTER_LINE_NAMES: Record<EventOrderStarterMasterKey, readonly string[]> = {
  "EO-D-01": [
    "Plated Dinner",
    "Buffet Dinner",
    "Beer & Wine",
    "Full Bar",
    "Chiavari Chair",
    "Farm Table",
    "Day-of Coordination",
  ],
  "EO-D-02": [
    "Ceremony Coordination",
    "Arbor",
    "Plated Dinner",
    "Buffet Dinner",
    "Beer & Wine",
    "Chiavari Chair",
    "Day-of Coordination",
  ],
};

export const EVENT_ORDER_STARTER_MASTERS: readonly EventOrderStarterMaster[] = [
  {
    key: "EO-D-01",
    name: "Wedding Reception",
    description: "A reusable delivery template for a wedding reception — add, remove, or reprice anything for your venue.",
    sections: [
      {
        name: "Catering",
        guidance: "The couple must choose one dinner service.",
        choiceGroups: [
          {
            name: "Dinner service",
            instructions: "Pick one — prices are per person.",
            selectionMode: "single",
            minSelect: 1,
            maxSelect: 1,
            options: [
              { name: "Plated Dinner", description: "Per person", unitPrice: 85 },
              { name: "Buffet Dinner", description: "Per person", unitPrice: 72 },
            ],
          },
        ],
      },
      {
        name: "Bar",
        guidance: "Bar packages are alternatives — choose one.",
        choiceGroups: [
          {
            name: "Bar package",
            instructions: "Pick one bar package — prices are per person.",
            selectionMode: "single",
            minSelect: 1,
            maxSelect: 1,
            options: [
              { name: "Beer & Wine", description: "Per person", unitPrice: 28 },
              { name: "Full Bar", description: "Per person", unitPrice: 42 },
            ],
          },
        ],
      },
      {
        name: "Rentals",
        guidance: "Optional rental products the couple may add.",
        choiceGroups: [
          {
            name: "Optional rentals",
            instructions: "Add any rentals you want — priced per unit.",
            selectionMode: "multi",
            minSelect: 0,
            maxSelect: null,
            allowQuantity: true,
            options: [
              { name: "Chiavari Chair", description: "Per chair", unitPrice: 8 },
              { name: "Farm Table", description: "Per table", unitPrice: 85 },
            ],
          },
        ],
      },
      {
        name: "Services",
        guidance: "Staffing and coordination included with this package.",
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
        guidance: "Standard ceremony setup is included. Enhancements are optional paid add-ons.",
        offerings: [
          { name: "Ceremony Coordination", unitPrice: 500, pricingModel: "flat", includedByDefault: true },
        ],
        choiceGroups: [
          {
            name: "Ceremony enhancements",
            instructions: "Optional paid add-ons — select only what you want to purchase.",
            selectionMode: "multi",
            minSelect: 0,
            maxSelect: null,
            options: [
              { name: "Arbor", description: "Flat fee", unitPrice: 350 },
            ],
          },
        ],
      },
      {
        name: "Catering",
        guidance: "The couple must choose one dinner service.",
        choiceGroups: [
          {
            name: "Dinner service",
            instructions: "Pick one — prices are per person.",
            selectionMode: "single",
            minSelect: 1,
            maxSelect: 1,
            options: [
              { name: "Plated Dinner", description: "Per person", unitPrice: 85 },
              { name: "Buffet Dinner", description: "Per person", unitPrice: 72 },
            ],
          },
        ],
      },
      {
        name: "Bar and beverages",
        guidance: "Bar service is optional — decline by leaving unselected.",
        choiceGroups: [
          {
            name: "Bar package",
            instructions: "Optional — pick one package, or leave unselected for no bar service. Price is per person.",
            selectionMode: "single",
            minSelect: 0,
            maxSelect: 1,
            options: [
              { name: "Beer & Wine", description: "Per person", unitPrice: 28 },
            ],
          },
        ],
      },
      {
        name: "Rentals",
        guidance: "Optional rental products the couple may add.",
        choiceGroups: [
          {
            name: "Optional rentals",
            instructions: "Add any rentals you want — priced per unit.",
            selectionMode: "multi",
            minSelect: 0,
            maxSelect: null,
            allowQuantity: true,
            options: [
              { name: "Chiavari Chair", description: "Per chair", unitPrice: 8 },
            ],
          },
        ],
      },
      {
        name: "Services",
        guidance: "Staffing and coordination included with this package.",
        offerings: [
          { name: "Day-of Coordination", unitPrice: 1200, pricingModel: "flat", includedByDefault: true },
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

/** All fixed-line names defined on a master (included / package baseline). */
export function starterFixedLineNames(master: EventOrderStarterMaster): string[] {
  return master.sections.flatMap((s) => (s.offerings ?? []).map((o) => o.name));
}

/** All choice-option names defined on a master. */
export function starterChoiceOptionNames(master: EventOrderStarterMaster): string[] {
  return master.sections.flatMap((s) =>
    (s.choiceGroups ?? []).flatMap((g) => g.options.map((o) => o.name)),
  );
}

/** All choice groups on a master (flattened). */
export function starterChoiceGroups(master: EventOrderStarterMaster): EventOrderStarterChoiceGroup[] {
  return master.sections.flatMap((s) => s.choiceGroups ?? []);
}

/**
 * True when an existing venue template still matches the pre-correction flat
 * starter (zero groups, exact legacy line names) and is safe to upgrade.
 * Customized templates (extra/renamed lines, or any choice groups) are left alone.
 */
export function isUncustomizedLegacyFlatStarter(
  masterKey: string,
  lineDescriptions: readonly string[],
  groupCount: number,
): boolean {
  if (groupCount > 0) return false;
  if (masterKey !== "EO-D-01" && masterKey !== "EO-D-02") return false;
  const expected = LEGACY_FLAT_STARTER_LINE_NAMES[masterKey];
  if (lineDescriptions.length !== expected.length) return false;
  const sortedActual = [...lineDescriptions].map((n) => n.trim()).sort();
  const sortedExpected = [...expected].map((n) => n.trim()).sort();
  return sortedActual.every((name, i) => name === sortedExpected[i]);
}
