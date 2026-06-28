import type { ReactNode } from "react";

// Portal layout — no coordinator sidebar, no auth requirement.
// Deliberately minimal: the couple's workspace has no coordinator navigation.
export default function PortalLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
