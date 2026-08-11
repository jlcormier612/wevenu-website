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
  "--muted": "var(--natural-cream)",
  "--muted-foreground": "color-mix(in oklch, var(--forest-sage) 70%, transparent)",
  "--secondary": "var(--natural-cream)",
  "--secondary-foreground": "var(--forest-sage)",
  "--border": "var(--taupe-light)",
  "--input": "var(--taupe-light)",
  "--ring": "var(--heritage-sage)",
  /* Soft portal radius — re-assert so staff’s sharper radius never leaks in. */
  "--radius": "1rem",
  "--natural-cream": "#f7f5f1",
} as CSSProperties;

export default function PortalLayout({ children }: { children: ReactNode }) {
  // Pin to the visible viewport. `min-h-svh` alone let the document scroll past
  // PortalShell’s h-screen box and expose this layout’s white background as a
  // large empty band under the venue footer on Home.
  return (
    <div
      className="h-svh overflow-hidden font-sans"
      style={{ ...LIGHT_THEME_VARS, background: "var(--natural-cream)" }}
    >
      {children}
    </div>
  );
}
