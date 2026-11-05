import type { CSSProperties, ReactNode } from "react";

/**
 * Portal layout — no coordinator sidebar, no auth requirement.
 *
 * Always-light Celebration Soft (palette B): ivory canvas + white working
 * cards + botanical actions + soft-blush celebration accents. Same HTC
 * family as venue staff, younger weighting — not a staff CRM twin.
 *
 * Token pin survives next-themes `.dark` on <html> (same contract as login).
 * Do not invent parallel colors — see docs/design/htc-visual-system.md.
 */
const PORTAL_CELEBRATION_SOFT_B = {
  /* Page / shell canvas — ivory, not true white */
  "--background": "#faf9f5",
  "--foreground": "#24332b",
  "--heading": "#24332b",
  "--card": "#ffffff",
  "--card-foreground": "#24332b",
  "--popover": "#ffffff",
  "--popover-foreground": "#24332b",
  /* Quiet eucalyptus mist — not a full blush wash */
  "--muted": "color-mix(in oklch, #a7c2af 14%, #faf9f5)",
  "--muted-foreground": "#5f6f68",
  "--secondary": "#f3f0e9",
  "--secondary-foreground": "#24332b",
  "--primary": "#446b56",
  "--primary-foreground": "#ffffff",
  "--accent": "#a7c2af",
  "--accent-foreground": "#24332b",
  "--border": "#e6e3dc",
  "--input": "#e6e3dc",
  "--ring": "#446b56",
  "--destructive": "#d99a9e",
  "--destructive-foreground": "#24332b",
  /* Soft portal radius — re-assert so staff’s sharper radius never leaks in. */
  "--radius": "1rem",
  /* Named HTC surfaces for sections that read CSS variables directly */
  "--htc-ivory": "#faf9f5",
  "--htc-canvas": "#faf9f5",
  "--htc-linen": "#f3f0e9",
  "--htc-soft-blush": "#f7e9eb",
  "--htc-blush": "#d99a9e",
  "--htc-petal": "#f0d8db",
  "--htc-blush-pale": "#fbf6f7",
  "--htc-border-warm": "#e6e3dc",
  "--htc-botanical": "#446b56",
  "--htc-eucalyptus": "#a7c2af",
  "--htc-eucalyptus-surface": "#dce8e0",
  "--htc-calm-blue": "#eaf1f7",
  "--htc-border-calm": "#d5e1eb",
  "--htc-calm-accent": "#63819a",
  /* Legacy cream alias used by a few portal modules */
  "--natural-cream": "#faf9f5",
} as CSSProperties;

export default function PortalLayout({ children }: { children: ReactNode }) {
  // Pin to the visible viewport. `min-h-svh` alone let the document scroll past
  // PortalShell’s h-screen box and expose this layout’s background as a
  // large empty band under the venue footer on Home.
  return (
    <div
      data-theme-lock="light"
      data-portal-palette="celebration-soft-b"
      className="htc-portal h-svh overflow-hidden font-sans"
      style={{
        ...PORTAL_CELEBRATION_SOFT_B,
        background: "var(--htc-ivory)",
      }}
    >
      {children}
    </div>
  );
}
