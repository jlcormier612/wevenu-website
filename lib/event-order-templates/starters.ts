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
  /**
   * Parent option labels (same section / prior groups) that activate this group.
   * Resolved to option UUIDs at provision. Empty / omitted = always visible.
   * Illustrative follow-up names may ship unpriced; do not invent venue prices.
   */
  dependsOnOptionNames?: string[];
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

function unpriced(name: string, description?: string): EventOrderStarterOption {
  return description ? { name, description } : { name };
}

function platedDinnerFollowUps(): EventOrderStarterChoiceGroup[] {
  return [
    {
      name: "Entrées",
      selectionMode: "single",
      minSelect: 1,
      maxSelect: 1,
      dependsOnOptionNames: ["Plated Dinner"],
      options: [
        unpriced("Herb-Roasted Chicken"),
        unpriced("Braised Beef"),
        unpriced("Seasonal Vegetarian Entrée"),
      ],
    },
    {
      name: "Sides",
      selectionMode: "multi",
      minSelect: 0,
      maxSelect: 2,
      dependsOnOptionNames: ["Plated Dinner"],
      options: [
        unpriced("Roasted Potatoes"),
        unpriced("Seasonal Vegetables"),
        unpriced("Rice Pilaf"),
      ],
    },
    {
      name: "Desserts",
      selectionMode: "single",
      minSelect: 0,
      maxSelect: 1,
      dependsOnOptionNames: ["Plated Dinner"],
      options: [
        unpriced("Chocolate Cake"),
        unpriced("Vanilla Cake"),
        unpriced("Seasonal Fruit Dessert"),
      ],
    },
  ];
}

function buffetDinnerFollowUps(): EventOrderStarterChoiceGroup[] {
  return [
    {
      name: "Entrées",
      selectionMode: "multi",
      minSelect: 1,
      maxSelect: 2,
      dependsOnOptionNames: ["Buffet Dinner"],
      options: [
        unpriced("Roasted Chicken"),
        unpriced("Pasta Primavera"),
        unpriced("Braised Beef"),
      ],
    },
    {
      name: "Sides",
      selectionMode: "multi",
      minSelect: 0,
      maxSelect: 2,
      dependsOnOptionNames: ["Buffet Dinner"],
      options: [
        unpriced("Roasted Potatoes"),
        unpriced("Seasonal Vegetables"),
        unpriced("Rice Pilaf"),
      ],
    },
    {
      name: "Desserts",
      selectionMode: "single",
      minSelect: 0,
      maxSelect: 1,
      dependsOnOptionNames: ["Buffet Dinner"],
      options: [
        unpriced("Assorted Desserts"),
        unpriced("Seasonal Fruit"),
        unpriced("Mini Pastries"),
      ],
    },
  ];
}

function dinnerServiceGroup(): EventOrderStarterChoiceGroup {
  return {
    name: "Dinner service",
    selectionMode: "single",
    minSelect: 1,
    maxSelect: 1,
    options: [
      unpriced("Plated Dinner", "Per person"),
      unpriced("Buffet Dinner", "Per person"),
    ],
  };
}

function beerAndWineFollowUps(): EventOrderStarterChoiceGroup[] {
  return [
    {
      name: "Beer selections",
      selectionMode: "multi",
      minSelect: 0,
      maxSelect: 2,
      dependsOnOptionNames: ["Beer & Wine"],
      options: [
        unpriced("House Lager"),
        unpriced("Seasonal IPA"),
        unpriced("Non-Alcoholic Beer"),
      ],
    },
    {
      name: "Wine selections",
      selectionMode: "multi",
      minSelect: 0,
      maxSelect: 2,
      dependsOnOptionNames: ["Beer & Wine"],
      options: [
        unpriced("House Red"),
        unpriced("House White"),
        unpriced("Sparkling Wine"),
      ],
    },
  ];
}

function optionalDayOfCoordinationGroup(): EventOrderStarterChoiceGroup {
  return {
    name: "Optional services",
    selectionMode: "single",
    minSelect: 0,
    maxSelect: 1,
    options: [
      unpriced("Day-of Coordination", "Flat fee"),
    ],
  };
}

/**
 * Pre-correction flat line names (no choice groups). Used only to detect
 * uncustomized venue copies that are safe to upgrade in place.
 * Chiavari Chair remains a historical fingerprint, not a new-starter offering.
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
        guidance: "Example dinner services and dishes. Keep, remove, or configure each offering for your venue — nothing is priced or included until you decide.",
        choiceGroups: [
          dinnerServiceGroup(),
          ...platedDinnerFollowUps(),
          ...buffetDinnerFollowUps(),
        ],
      },
      {
        name: "Bar",
        guidance: "Example bar packages. Keep, remove, or configure them — packages are not assumed to be available or priced.",
        choiceGroups: [
          {
            name: "Bar package",
            selectionMode: "single",
            minSelect: 1,
            maxSelect: 1,
            options: [
              unpriced("Beer & Wine", "Per person"),
              unpriced("Full Bar", "Per person"),
            ],
          },
          ...beerAndWineFollowUps(),
        ],
      },
      {
        name: "Rentals",
        guidance: "Example rental offerings. Inventory stock is a separate system — do not treat stock items as Event Order offerings automatically.",
        choiceGroups: [
          {
            name: "Optional rentals",
            selectionMode: "multi",
            minSelect: 0,
            maxSelect: null,
            allowQuantity: true,
            options: [
              unpriced("Farm Table", "Per table"),
            ],
          },
        ],
      },
      {
        name: "Services",
        guidance: "Example optional services. Keep or remove them; they are not included or priced until you configure them.",
        choiceGroups: [optionalDayOfCoordinationGroup()],
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
        guidance: "Example ceremony offerings. Keep, remove, or configure them — nothing is included or priced until you decide.",
        choiceGroups: [
          {
            name: "Ceremony services",
            selectionMode: "single",
            minSelect: 0,
            maxSelect: 1,
            options: [
              unpriced("Ceremony Coordination", "Flat fee"),
            ],
          },
          {
            name: "Ceremony enhancements",
            selectionMode: "multi",
            minSelect: 0,
            maxSelect: null,
            options: [
              unpriced("Arbor", "Flat fee"),
            ],
          },
        ],
      },
      {
        name: "Catering",
        guidance: "Example dinner services and dishes. Keep, remove, or configure each offering for your venue — nothing is priced or included until you decide.",
        choiceGroups: [
          dinnerServiceGroup(),
          ...platedDinnerFollowUps(),
          ...buffetDinnerFollowUps(),
        ],
      },
      {
        name: "Bar and beverages",
        guidance: "Example bar service. Leave unselected for no bar, or configure the package for your venue.",
        choiceGroups: [
          {
            name: "Bar package",
            selectionMode: "single",
            minSelect: 0,
            maxSelect: 1,
            options: [
              unpriced("Beer & Wine", "Per person"),
            ],
          },
          ...beerAndWineFollowUps(),
        ],
      },
      {
        name: "Rentals",
        guidance: "Add rental offerings if you provide them. Inventory stock is managed separately.",
      },
      {
        name: "Services",
        guidance: "Example optional services. Keep or remove them; they are not included or priced until you configure them.",
        choiceGroups: [optionalDayOfCoordinationGroup()],
      },
    ],
  },
];

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
