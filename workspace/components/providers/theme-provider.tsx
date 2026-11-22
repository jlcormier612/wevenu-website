"use client";

import * as React from "react";
import { ThemeProvider as NextThemesProvider } from "next-themes";

/**
 * Workspace is light-mode only (founder decision, Release 2).
 * Callers must pass forcedTheme="light" and enableSystem={false}.
 * Dark preference recovery is handled by the blocking script in app/layout.tsx.
 */
export function ThemeProvider({
  children,
  ...props
}: React.ComponentProps<typeof NextThemesProvider>) {
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>;
}
