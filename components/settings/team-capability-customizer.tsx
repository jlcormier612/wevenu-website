"use client";

import * as React from "react";
import {
  CAPABILITY_CATALOG,
  presetHas,
  type AccessTitle,
  type BasisTitle,
  type CapabilityDefinition,
  type CapabilityKey,
  type CapabilityOverrides,
} from "@/lib/authorization";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

const CATEGORY_LABELS: Record<string, string> = {
  clients_leads: "Clients",
  events_planning: "Events",
  vendors: "Vendors",
  messaging: "Messaging",
  contracts_documents: "Contracts & Documents",
  payments_finances: "Payments",
  reporting_data: "Reporting & Data",
  team: "Team",
  venue_settings: "Settings",
  account_ownership: "Account",
};

interface Props {
  accessTitle: AccessTitle;
  titleBasis: BasisTitle;
  overrides: CapabilityOverrides;
  onChange: (next: CapabilityOverrides) => void;
  actorIsOwner: boolean;
}

export function TeamCapabilityCustomizer({
  accessTitle: _accessTitle,
  titleBasis,
  overrides,
  onChange,
  actorIsOwner,
}: Props) {
  const basis = titleBasis;

  function effectiveOn(key: CapabilityKey): boolean {
    if (key in overrides) return overrides[key] === true;
    return presetHas(basis, key);
  }

  function toggle(key: CapabilityKey, next: boolean) {
    const inPreset = presetHas(basis, key);
    const nextOverrides: CapabilityOverrides = { ...overrides };
    if (next === inPreset) {
      const copy = { ...nextOverrides } as Record<string, boolean>;
      delete copy[key];
      onChange(copy);
    } else {
      onChange({ ...nextOverrides, [key]: next });
    }
  }

  const byCategory = new Map<string, CapabilityDefinition[]>();
  for (const cap of CAPABILITY_CATALOG) {
    if (cap.ownershipOnly) continue;
    if (cap.key === "account.billing" && !actorIsOwner) {
      // Non-owners cannot grant billing in customize; Owners can
      continue;
    }
    if (!cap.customizable && cap.key !== "account.billing") continue;
    const list = byCategory.get(cap.category) ?? [];
    list.push(cap);
    byCategory.set(cap.category, list);
  }

  // Owners always see billing in Account category when customizing
  if (actorIsOwner) {
    const billing = CAPABILITY_CATALOG.find((c) => c.key === "account.billing");
    if (billing) {
      const list = byCategory.get("account_ownership") ?? [];
      if (!list.some((c) => c.key === "account.billing")) {
        list.push(billing);
        byCategory.set("account_ownership", list);
      }
    }
  }

  return (
    <div className="max-h-72 space-y-4 overflow-y-auto rounded-md border p-3">
      <p className="text-xs text-muted-foreground">
        Turn areas on or off for this person. Ownership controls stay with Owners.
      </p>
      {[...byCategory.entries()].map(([category, caps]) => (
        <div key={category} className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {CATEGORY_LABELS[category] ?? category}
          </p>
          <div className="space-y-2">
            {caps.map((cap) => {
              const checked = effectiveOn(cap.key);
              const grantBlocked =
                !checked
                && !presetHas(basis, cap.key)
                && !cap.grantableTo.includes(basis);
              return (
                <div key={cap.key} className="flex items-start gap-2">
                  <Checkbox
                    id={`cap-${cap.key}`}
                    checked={checked}
                    disabled={grantBlocked && !checked}
                    onCheckedChange={(v) => {
                      if (grantBlocked && v === true) return;
                      toggle(cap.key, v === true);
                    }}
                  />
                  <Label htmlFor={`cap-${cap.key}`} className="text-sm font-normal leading-snug">
                    {cap.label}
                    {cap.key === "account.billing" ? (
                      <span className="mt-0.5 block text-xs text-muted-foreground">
                        Billing
                      </span>
                    ) : null}
                  </Label>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
