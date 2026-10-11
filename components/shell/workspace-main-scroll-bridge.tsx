"use client";

import * as React from "react";

/**
 * Document scroll is locked under `.htc-staff` (see globals.css + WorkspaceShell).
 * PageDown / PageUp / Home / End therefore do nothing when focus is still on
 * `body` or chrome outside `main`. Forward those keys to the module scrollport
 * so tall pages (Migration Center, Settings, …) stay keyboard-reachable
 * without wrapping the App Router page slot in a client boundary.
 */
export function WorkspaceMainScrollBridge() {
  React.useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return;
      if (!["PageDown", "PageUp", "Home", "End"].includes(event.key)) return;

      const main = document.querySelector<HTMLElement>("[data-workspace-main]");
      if (!main) return;

      const active = document.activeElement;
      if (active instanceof Node && main.contains(active)) return;

      if (active instanceof HTMLElement) {
        const tag = active.tagName;
        if (
          tag === "INPUT" ||
          tag === "TEXTAREA" ||
          tag === "SELECT" ||
          active.isContentEditable
        ) {
          return;
        }
        if (active.closest("[role='listbox'], [role='menu'], [role='dialog']")) return;
      }

      if (main.scrollHeight <= main.clientHeight + 2) return;

      event.preventDefault();
      if (event.key === "Home") {
        main.scrollTop = 0;
        return;
      }
      if (event.key === "End") {
        main.scrollTop = main.scrollHeight;
        return;
      }
      const delta = Math.max(120, Math.round(main.clientHeight * 0.9));
      main.scrollBy({ top: event.key === "PageDown" ? delta : -delta });
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return null;
}
