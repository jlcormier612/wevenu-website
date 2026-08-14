"use client";

import * as React from "react";

import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { MAX_ABS_DAYS_OFFSET } from "@/lib/playbooks/due-dates";
import {
  CUSTOM_DAYS_OFFSET,
  daysOffsetPresetLabel,
  isPresetDaysOffset,
  parseDaysOffsetInput,
  VENDOR_TASK_DAYS_OFFSET_PRESETS,
} from "@/lib/vendor-task-templates/presets";
import { cn } from "@/lib/utils";

const NONE = "__none__";

type Direction = "before" | "after";

function directionFor(offset: number): Direction {
  return offset < 0 ? "before" : "after";
}

function offsetFromCustom(days: string, direction: Direction): string {
  const n = Number.parseInt(days, 10);
  if (!Number.isFinite(n) || n <= 0) return direction === "before" ? "-1" : "1";
  const abs = Math.min(MAX_ABS_DAYS_OFFSET, Math.max(1, Math.trunc(n)));
  return String(direction === "before" ? -abs : abs);
}

/**
 * Preset list + Custom… (number + before/after). Value is the integer offset
 * string ("" = none) — same contract as vendor template drafts / create-task.
 */
export function VendorRelativeDuePicker({
  value,
  onChange,
  className,
  triggerClassName,
}: {
  value: string;
  onChange: (next: string) => void;
  className?: string;
  triggerClassName?: string;
}) {
  const parsed = parseDaysOffsetInput(value);
  const isCustom = value !== "" && !isPresetDaysOffset(value);
  const [customOpen, setCustomOpen] = React.useState(isCustom);
  const [customDays, setCustomDays] = React.useState(
    () => (parsed != null && parsed !== 0 ? String(Math.abs(parsed)) : "30"),
  );
  const [customDirection, setCustomDirection] = React.useState<Direction>(
    () => (parsed != null ? directionFor(parsed) : "before"),
  );

  React.useEffect(() => {
    const next = parseDaysOffsetInput(value);
    const custom = value !== "" && !isPresetDaysOffset(value);
    setCustomOpen(custom);
    if (custom && next != null && next !== 0) {
      setCustomDays(String(Math.abs(next)));
      setCustomDirection(directionFor(next));
    }
  }, [value]);

  const selectValue = value === "" ? NONE : isPresetDaysOffset(value) ? value : CUSTOM_DAYS_OFFSET;

  const items = [
    ...VENDOR_TASK_DAYS_OFFSET_PRESETS.map((p) => ({
      value: p.value || NONE,
      label: p.label,
    })),
    { value: CUSTOM_DAYS_OFFSET, label: "Custom…" },
  ];

  function commitCustom(days: string, direction: Direction) {
    onChange(offsetFromCustom(days, direction));
  }

  return (
    <div className={cn("space-y-1.5", className)}>
      <Select
        value={selectValue}
        onValueChange={(v) => {
          if (v === NONE) {
            setCustomOpen(false);
            onChange("");
            return;
          }
          if (v === CUSTOM_DAYS_OFFSET) {
            setCustomOpen(true);
            const seed =
              parsed != null && parsed !== 0
                ? String(Math.abs(parsed))
                : customDays || "30";
            const dir = parsed != null && parsed !== 0 ? directionFor(parsed) : customDirection;
            setCustomDays(seed);
            setCustomDirection(dir);
            commitCustom(seed, dir);
            return;
          }
          setCustomOpen(false);
          onChange(v);
        }}
        items={items}
      >
        <SelectTrigger className={triggerClassName}>
          <SelectValue placeholder={daysOffsetPresetLabel(null)} />
        </SelectTrigger>
        <SelectContent>
          {items.map((o) => (
            <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      {customOpen && (
        <div className="flex items-center gap-1.5">
          <Input
            type="number"
            min={1}
            max={MAX_ABS_DAYS_OFFSET}
            value={customDays}
            onChange={(e) => {
              const days = e.target.value;
              setCustomDays(days);
              commitCustom(days, customDirection);
            }}
            className="h-9 w-16 text-sm"
            aria-label="Number of days"
          />
          <Select
            value={customDirection}
            onValueChange={(v) => {
              const dir = v as Direction;
              setCustomDirection(dir);
              commitCustom(customDays, dir);
            }}
            items={[
              { value: "before", label: "before event" },
              { value: "after", label: "after event" },
            ]}
          >
            <SelectTrigger className="h-9 min-w-0 flex-1 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="before">before event</SelectItem>
              <SelectItem value="after">after event</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}
    </div>
  );
}
