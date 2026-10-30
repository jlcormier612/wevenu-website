"use client";

import * as React from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  filterOfferingsForSectionPicker,
  uniqueOfferingCategories,
  type OfferingCategoryFilter,
} from "@/lib/event-order-templates/section-workspace";
import {
  filterOfferingsForAuthoringContext,
  majorOfferingIds,
  offeringRole,
  offeringRoleLabel,
} from "@/lib/offerings/hierarchy";
import type { OfferingWithCategory } from "@/lib/offerings/types";

export type OfferingAuthoringScope =
  | { kind: "primary" }
  | { kind: "underMajor"; parentOfferingId: string; parentLabel?: string }
  | { kind: "all" };

/**
 * Contextual Offering picker — starts in the current commercial category,
 * with an explicit All categories escape. Selection uses offering id only.
 * Optional hierarchy scope prefers major choices vs associated items.
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
  authoringScope = { kind: "all" },
}: {
  offerings: OfferingWithCategory[];
  sectionName: string | null;
  value: string;
  onChange: (offeringId: string) => void;
  id?: string;
  testId?: string;
  disabled?: boolean;
  emptyLabel?: string;
  authoringScope?: OfferingAuthoringScope;
}) {
  const categories = React.useMemo(() => uniqueOfferingCategories(offerings), [offerings]);
  const [filter, setFilter] = React.useState<OfferingCategoryFilter>("preferred");
  const [query, setQuery] = React.useState("");
  const majors = React.useMemo(() => majorOfferingIds(offerings), [offerings]);

  React.useEffect(() => {
    setFilter("preferred");
    setQuery("");
  }, [sectionName, authoringScope.kind, authoringScope.kind === "underMajor" ? authoringScope.parentOfferingId : ""]);

  const hierarchy = filterOfferingsForAuthoringContext(offerings, authoringScope);
  const { items, preferredEmpty } = filterOfferingsForSectionPicker(
    hierarchy.items,
    sectionName,
    filter,
  );

  const visible = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((o) => {
      const hay = `${o.name} ${o.categoryName ?? ""} ${o.parentOfferingName ?? ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [items, query]);

  const scopeHint =
    authoringScope.kind === "primary"
      ? "Showing top-level major choices and standalone offerings (not nested menu items)."
      : authoringScope.kind === "underMajor"
        ? hierarchy.items.length === 0
          ? `Nothing is set up under “${authoringScope.parentLabel ?? "this choice"}” yet. Add categories and items under it on the Offerings page.`
          : `Showing items associated with “${authoringScope.parentLabel ?? "this major choice"}” in your catalog.`
        : null;

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
      {scopeHint ? (
        <p
          className="text-xs text-muted-foreground"
          data-testid="eo-offering-hierarchy-hint"
        >
          {scopeHint}
        </p>
      ) : null}
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
          const role = offeringRole(off, majors);
          const cross =
            filter === "all"
            && sectionName
            && off.categoryName
            && !off.categoryName.toLowerCase().includes(sectionName.split(" ")[0]!.toLowerCase());
          return (
            <option key={off.id} value={off.id}>
              {off.parentOfferingName ? `${off.parentOfferingName} › ` : ""}
              {off.name}
              {` · ${offeringRoleLabel(role)}`}
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
          No active Offerings in this filter. Create catalog items on the Offerings page, clear search, or switch category.
        </p>
      ) : null}
    </div>
  );
}
