"use client";

import Link from "next/link";

import { Field } from "@/components/setup/field";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import type { VenueSpace } from "@/lib/availability/types";

export function EventSpaceField({
  value,
  onChange,
  spaces,
  spacesRequired,
  error,
}: {
  value: string;
  onChange: (v: string) => void;
  spaces: VenueSpace[];
  spacesRequired: boolean;
  error?: string;
}) {
  const active = spaces.filter((s) => s.isActive);
  if (!spacesRequired && active.length === 0) return null;

  if (spacesRequired && active.length === 0) {
    return (
      <Field label="Event space" htmlFor="sp" error={error} required>
        <p className="text-sm text-destructive">
          This venue can host more than one event at the same time. Add an Event Space in{" "}
          <Link href="/settings/availability" className="font-medium underline underline-offset-2">
            Availability settings
          </Link>{" "}
          before booking.
        </p>
      </Field>
    );
  }

  const items = spacesRequired
    ? active.map((s) => ({
        value: s.id,
        label: `${s.name}${s.capacity != null ? ` — ${s.capacity.toLocaleString()} guests` : ""}`,
      }))
    : [
        { value: "", label: "No specific space" },
        ...active.map((s) => ({
          value: s.id,
          label: `${s.name}${s.capacity != null ? ` — ${s.capacity.toLocaleString()} guests` : ""}`,
        })),
      ];

  return (
    <Field
      label="Event space"
      htmlFor="sp"
      error={error}
      required={spacesRequired}
      hint={spacesRequired
        ? "Required — overlapping events must be in different spaces."
        : "Optional — assign this event to a specific space."}
    >
      <Select value={value} onValueChange={onChange} items={items}>
        <SelectTrigger id="sp">
          <SelectValue placeholder={spacesRequired ? "Select a space" : "No specific space"} />
        </SelectTrigger>
        <SelectContent>
          {!spacesRequired && <SelectItem value="">No specific space</SelectItem>}
          {active.map((s) => (
            <SelectItem key={s.id} value={s.id}>
              {s.name}{s.capacity != null ? ` — ${s.capacity.toLocaleString()} guests` : ""}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Field>
  );
}
