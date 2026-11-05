"use client";

import * as React from "react";

import { ThemeProvider as NextThemesProvider } from "next-themes";

import { HTC_THEME_TOGGLE_ENABLED } from "@/lib/theme/htc-theme-access";

/**
 * Application theme provider (light / dark / system) backed by next-themes.
 * Uses the `class` strategy so Tailwind's `dark:` variants and the shadcn
 * design tokens defined in globals.css respond to the active theme.
 *
 * When `HTC_THEME_TOGGLE_ENABLED` is false, light is forced so users cannot
 * enter dark via UI or a stale localStorage preference — dark CSS remaps stay.
 */
export function ThemeProvider({
  children,
  ...props
}: React.ComponentProps<typeof NextThemesProvider>) {
  return (
    <NextThemesProvider
      {...props}
      forcedTheme={HTC_THEME_TOGGLE_ENABLED ? props.forcedTheme : "light"}
      enableSystem={HTC_THEME_TOGGLE_ENABLED ? props.enableSystem : false}
      defaultTheme={HTC_THEME_TOGGLE_ENABLED ? props.defaultTheme : "light"}
    >
      {children}
    </NextThemesProvider>
  );
}
