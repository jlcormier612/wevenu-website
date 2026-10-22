"use client";

/**
 * HTC 12-hour time entry. Value prop/onChange use stored HH:MM (or "").
 * Displays AM/PM while editing; accepts military and AM/PM on blur.
 */

import * as React from "react";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  formatTimelineTimeForInput,
  parseTimelineTimeInput,
} from "@/lib/timeline/time-format";

export function TimeAmPmInput({
  id,
  value,
  onChange,
  disabled,
  className,
  "aria-label": ariaLabel,
  "data-testid": testId,
}: {
  id?: string;
  /** Stored HH:MM or "". */
  value: string;
  onChange: (hhmm: string) => void;
  disabled?: boolean;
  className?: string;
  "aria-label"?: string;
  "data-testid"?: string;
}) {
  const [text, setText] = React.useState(() => formatTimelineTimeForInput(value));
  const [invalid, setInvalid] = React.useState(false);

  React.useEffect(() => {
    setText(formatTimelineTimeForInput(value));
    setInvalid(false);
  }, [value]);

  function commit(raw: string) {
    const parsed = parseTimelineTimeInput(raw);
    if (parsed === null) {
      setInvalid(true);
      setText(formatTimelineTimeForInput(value));
      return;
    }
    setInvalid(false);
    setText(formatTimelineTimeForInput(parsed));
    if (parsed !== value) onChange(parsed);
  }

  return (
    <Input
      id={id}
      type="text"
      inputMode="text"
      autoComplete="off"
      placeholder="6:00 PM"
      aria-label={ariaLabel ?? "Time"}
      aria-invalid={invalid || undefined}
      data-testid={testId}
      disabled={disabled}
      className={cn(invalid && "border-destructive", className)}
      value={text}
      onChange={(e) => {
        setText(e.target.value);
        setInvalid(false);
      }}
      onBlur={() => commit(text)}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          commit(text);
          (e.target as HTMLInputElement).blur();
        }
      }}
    />
  );
}
