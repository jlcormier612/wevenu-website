"use client";

import * as React from "react";
import { Eye, EyeOff } from "lucide-react";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export type PasswordInputProps = Omit<
  React.ComponentProps<typeof Input>,
  "type"
> & {
  /** Accessible name for the show/hide control. Defaults to Show/Hide password. */
  revealLabel?: { show: string; hide: string };
};

/**
 * Password field with an accessible eye toggle.
 * Does not clear or alter the value when revealing.
 */
export function PasswordInput({
  className,
  revealLabel = { show: "Show password", hide: "Hide password" },
  disabled,
  ...props
}: PasswordInputProps) {
  const [revealed, setRevealed] = React.useState(false);

  return (
    <div className="relative">
      <Input
        {...props}
        type={revealed ? "text" : "password"}
        disabled={disabled}
        className={cn("pr-10", className)}
      />
      <button
        type="button"
        onClick={() => setRevealed((v) => !v)}
        disabled={disabled}
        className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-sm p-0.5 text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
        aria-label={revealed ? revealLabel.hide : revealLabel.show}
        aria-pressed={revealed}
      >
        {revealed ? <EyeOff className="h-4 w-4" aria-hidden /> : <Eye className="h-4 w-4" aria-hidden />}
      </button>
    </div>
  );
}
