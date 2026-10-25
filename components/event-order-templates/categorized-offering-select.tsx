"use client";

import * as React from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  filterOfferingsForSectionPicker,
  uniqueOfferingCategories,
  type OfferingCategoryFilter,
} from "@/lib/event-order-templates/section-workspace";
import type { OfferingWithCategory } from "@/lib/offerings/types";

/**
 * Contextual Offering picker — starts in the current commercial category,
 * with an explicit All categories escape. Selection uses offering id only.
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
  const [query, setQuery] = React.useState("");

  React.useEffect(() => {
    setFilter("preferred");
    setQuery("");
  }, [sectionName]);

  const { items, preferredEmpty } = filterOfferingsForSectionPicker(
    offerings,
    sectionName,
    filter,
  );

  const visible = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((o) => {
      const hay = `${o.name} ${o.categoryName ?? ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [items, query]);

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
        <div className="min-w-[8rem] flex-1 space-y-1">
          <Label htmlFor={id ? `${id}-search` : undefined} className="text-xs text-muted-foreground">
            Search
          </Label>
          <Input
            id={id ? `${id}-search` : undefined}
            value={query}
            disabled={disabled}
            placeholder="Filter by name"
            className="h-9"
            data-testid={testId ? `${testId}-search` : "eo-offering-search"}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </div>
      {filter === "preferred" && preferredEmpty && sectionName ? (
        <p className="text-xs text-amber-800" data-testid="eo-offering-filter-empty">
          No catalog Offerings match “{sectionName}” yet. Switch to All categories or another
          category deliberately — items are never linked by name.
        </p>
      ) : null}
      {filter === "preferred" && !preferredEmpty && sectionName ? (
        <p className="text-xs text-muted-foreground">
          Showing Offerings related to “{sectionName}”. Use All categories only when a
          cross-category item is intentional.
        </p>
      ) : null}
      {filter === "all" ? (
        <p className="text-xs text-muted-foreground" data-testid="eo-offering-all-categories-note">
          Browsing every catalog category. Prefer the suggested filter when possible.
        </p>
      ) : null}
      <select
        id={id}
        className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
        value={value}
        disabled={disabled || visible.length === 0}
        data-testid={testId ? `${testId}-list` : "eo-offering-list"}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">{emptyLabel}</option>
        {visible.map((off) => {
          const cross =
            filter === "all"
            && sectionName
            && off.categoryName
            && !off.categoryName.toLowerCase().includes(sectionName.split(" ")[0]!.toLowerCase());
          return (
            <option key={off.id} value={off.id}>
              {off.name}
              {off.categoryName ? ` · ${off.categoryName}` : " · uncategorized"}
              {off.defaultUnitPrice != null
                ? ` · $${off.defaultUnitPrice.toFixed(2)}`
                : " · unpriced"}
              {cross ? " · other category" : ""}
            </option>
          );
        })}
      </select>
      {visible.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          No active Offerings in this filter. Create catalog items, clear search, or switch category.
        </p>
      ) : null}
    </div>
  );
}
