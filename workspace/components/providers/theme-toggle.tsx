"use client";

import * as React from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

import { cn } from "@/lib/utils";

/**
 * Light / dark theme control matching the venue portal pattern.
 * CRM does not use shadcn dropdowns, so this is a small native menu.
 */
export function ThemeToggle() {
  const { setTheme } = useTheme();
  const [open, setOpen] = React.useState(false);
  const rootRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-label="Toggle theme"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="relative inline-flex h-9 w-9 items-center justify-center rounded-sm text-foreground hover:bg-muted"
      >
        <Sun className="h-4 w-4 scale-100 dark:scale-0" />
        <Moon className="absolute h-4 w-4 scale-0 dark:scale-100" />
      </button>
      {open ? (
        <div
          role="menu"
          className="absolute right-0 top-full z-50 mt-1 min-w-[8.5rem] rounded-sm border border-border/45 bg-card py-1 text-card-foreground shadow-sm"
        >
          <ThemeMenuItem
            label="Light"
            icon={<Sun className="h-4 w-4" />}
            onSelect={() => {
              setTheme("light");
              setOpen(false);
            }}
          />
          <ThemeMenuItem
            label="Dark"
            icon={<Moon className="h-4 w-4" />}
            onSelect={() => {
              setTheme("dark");
              setOpen(false);
            }}
          />
        </div>
      ) : null}
    </div>
  );
}

function ThemeMenuItem({
  label,
  icon,
  onSelect,
}: {
  label: string;
  icon: React.ReactNode;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onSelect}
      className={cn(
        "flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-card-foreground",
        "hover:bg-muted",
      )}
    >
      {icon}
      {label}
    </button>
  );
}
