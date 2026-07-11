import type { CSSProperties, ReactNode } from "react";

// Portal layout — no coordinator sidebar, no auth requirement.
// Deliberately minimal: the couple's workspace has no coordinator navigation.
//
// The portal is a fixed, always-light brand surface, same reasoning as
// app/(auth)/login/page.tsx: `next-themes` applies `.dark` at the root
// <html> based on the coordinator's own OS/app preference (or a stale
// shared-browser localStorage value), and a nested wrapper can't block
// that `dark:` cascade via descendant selectors alone. Every portal
// component was built with hardcoded, light-oriented colors (never given
// `dark:` variants) — re-pinning the semantic tokens they actually consume
// keeps the couple's experience visually consistent regardless of whatever
// theme the venue's own device happens to be in.
const LIGHT_THEME_VARS = {
  "--background": "var(--true-white)",
  "--foreground": "var(--black)",
  "--card": "var(--true-white)",
  "--card-foreground": "var(--black)",
  "--popover": "var(--true-white)",
  "--popover-foreground": "var(--black)",
  "--heading": "var(--forest-sage)",
  "--muted-foreground": "color-mix(in oklch, var(--forest-sage) 70%, transparent)",
  "--border": "var(--taupe-light)",
  "--input": "var(--taupe-light)",
  "--ring": "var(--heritage-sage)",
} as CSSProperties;

export default function PortalLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-svh" style={LIGHT_THEME_VARS}>
      {children}
    </div>
  );
}
