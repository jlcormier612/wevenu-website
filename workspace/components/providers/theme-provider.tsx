"use client";

import * as React from "react";

import { ThemeProvider as NextThemesProvider } from "next-themes";

/**
 * Application theme provider (light / dark / system) backed by next-themes.
 * Uses the `class` strategy so Tailwind's `dark:` variants and the design
 * tokens in globals.css respond to the active theme.
 */
export function ThemeProvider({
  children,
  ...props
}: React.ComponentProps<typeof NextThemesProvider>) {
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>;
}
