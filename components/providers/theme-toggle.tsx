"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { HTC_THEME_TOGGLE_ENABLED } from "@/lib/theme/htc-theme-access";

/**
 * Theme control. Hidden while hospitality dark QA is outstanding
 * (`HTC_THEME_TOGGLE_ENABLED`). Component + dark CSS remaps remain so dark
 * can be restored without rebuilding the control.
 */
export function ThemeToggle() {
  const { setTheme } = useTheme();

  if (!HTC_THEME_TOGGLE_ENABLED) {
    return null;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="ghost" size="icon" aria-label="Toggle theme" />
        }
      >
        <Sun className="h-5 w-5 scale-100 dark:scale-0" />
        <Moon className="absolute h-5 w-5 scale-0 dark:scale-100" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => setTheme("light")}>
          <Sun className="mr-2 h-4 w-4" />
          Light
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("dark")}>
          <Moon className="mr-2 h-4 w-4" />
          Dark
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
