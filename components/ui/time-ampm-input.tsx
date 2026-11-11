"use client";

/**
 * HTC 12-hour time entry. Value prop/onChange use stored HH:MM (or "").
 * Displays AM/PM while editing; accepts military and AM/PM.
 *
 * Parent state must update as soon as a value is parseable — not only on
 * blur — so "Save all" / row Save clicked immediately after typing does not
 * persist a stale empty time while the input still shows AM/PM text.
 */

import * as React from "react";
import { flushSync } from "react-dom";

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
  const valueRef = React.useRef(value);
  valueRef.current = value;

  React.useEffect(() => {
    setText(formatTimelineTimeForInput(value));
    setInvalid(false);
  }, [value]);

  function publish(hhmm: string) {
    if (hhmm === valueRef.current) return;
    // flushSync so a subsequent Save click in the same gesture sees the new draft.
    flushSync(() => {
      onChange(hhmm);
    });
  }

  function commit(raw: string) {
    const parsed = parseTimelineTimeInput(raw);
    if (parsed === null) {
      setInvalid(true);
      setText(formatTimelineTimeForInput(valueRef.current));
      return;
    }
    setInvalid(false);
    setText(formatTimelineTimeForInput(parsed));
    publish(parsed);
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
        const raw = e.target.value;
        setText(raw);
        setInvalid(false);
        if (!raw.trim()) {
          publish("");
          return;
        }
        const parsed = parseTimelineTimeInput(raw);
        if (parsed !== null) publish(parsed);
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
