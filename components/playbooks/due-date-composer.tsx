"use client";

import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import type { DueDateDirection } from "@/lib/playbooks/constants";
import { cn } from "@/lib/utils";

/**
 * Relative due composer — venues never type a raw offset. Shared by the
 * Playbook template builder and per-event Planning task edit.
 */
export function DueDateComposer({
  direction,
  days,
  onChange,
  size = "default",
}: {
  direction: DueDateDirection;
  days: string;
  onChange: (direction: DueDateDirection, days: string) => void;
  size?: "default" | "sm";
}) {
  const h = size === "sm" ? "h-7 text-xs" : "h-9 text-sm";
  return (
    <div className="flex items-center gap-1.5">
      {direction !== "on" && (
        <Input
          type="number"
          value={days}
          onChange={(e) => onChange(direction, e.target.value)}
          className={cn("w-16", h)}
          min={0}
        />
      )}
      <Select
        value={direction}
        onValueChange={(v) => onChange(v as DueDateDirection, days)}
        items={[
          { value: "before", label: "days before the event" },
          { value: "on", label: "On the event day" },
          { value: "after", label: "days after the event" },
        ]}
      >
        <SelectTrigger className={cn(h, "min-w-0")}><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="before">days before the event</SelectItem>
          <SelectItem value="on">On the event day</SelectItem>
          <SelectItem value="after">days after the event</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
