"use client";

import * as React from "react";

import { Label } from "@/components/ui/label";
import {
  filterOfferingsForSectionPicker,
  uniqueOfferingCategories,
  type OfferingCategoryFilter,
} from "@/lib/event-order-templates/section-workspace";
import type { OfferingWithCategory } from "@/lib/offerings/types";

/**
 * Contextual Offering picker — filters by section-related category by default,
 * with an explicit escape hatch to other categories. Selection still uses offering id.
 */
export function CategorizedOfferingSelect({
  offerings,
  sectionName,
  value,
  onChange,
  id,
  testId,
  disabled,
  emptyLabel = "Choose an offering…",
}: {
  offerings: OfferingWithCategory[];
  sectionName: string | null;
  value: string;
  onChange: (offeringId: string) => void;
  id?: string;
  testId?: string;
  disabled?: boolean;
  emptyLabel?: string;
}) {
  const categories = React.useMemo(() => uniqueOfferingCategories(offerings), [offerings]);
  const [filter, setFilter] = React.useState<OfferingCategoryFilter>("preferred");

  React.useEffect(() => {
    setFilter("preferred");
  }, [sectionName]);

  const { items, usedFallbackAll } = filterOfferingsForSectionPicker(
    offerings,
    sectionName,
    filter,
  );

  return (
    <div className="space-y-2" data-testid={testId ?? "eo-categorized-offering-select"}>
      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-[10rem] flex-1 space-y-1">
          <Label htmlFor={id ? `${id}-filter` : undefined} className="text-xs text-muted-foreground">
            Catalog category
          </Label>
          <select
            id={id ? `${id}-filter` : undefined}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            value={filter}
            disabled={disabled}
            data-testid={testId ? `${testId}-filter` : "eo-offering-category-filter"}
            onChange={(e) => setFilter(e.target.value as OfferingCategoryFilter)}
          >
            <option value="preferred">
              {sectionName ? `Suggested for “${sectionName}”` : "Suggested for this section"}
            </option>
            <option value="all">All categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
      </div>
      {filter === "preferred" && usedFallbackAll && sectionName ? (
        <p className="text-xs text-muted-foreground" data-testid="eo-offering-filter-fallback">
          No catalog items matched “{sectionName}” yet — showing all Offerings. Pick deliberately; nothing is linked by name.
        </p>
      ) : null}
      {filter === "preferred" && !usedFallbackAll && sectionName ? (
        <p className="text-xs text-muted-foreground">
          Showing Offerings in categories related to “{sectionName}”. Switch to All categories or another category when you need a cross-category item.
        </p>
      ) : null}
      <select
        id={id}
        className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
        value={value}
        disabled={disabled || items.length === 0}
        data-testid={testId ? `${testId}-list` : "eo-offering-list"}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">{emptyLabel}</option>
        {items.map((off) => (
          <option key={off.id} value={off.id}>
            {off.name}
            {off.categoryName ? ` · ${off.categoryName}` : ""}
            {off.defaultUnitPrice != null
              ? ` · $${off.defaultUnitPrice.toFixed(2)}`
              : " · unpriced"}
          </option>
        ))}
      </select>
      {items.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          No active Offerings in this filter. Create catalog items or switch category.
        </p>
      ) : null}
    </div>
  );
}
