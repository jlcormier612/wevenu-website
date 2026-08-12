"use client";

import * as React from "react";

import { LIBRARY_LABELS } from "@/components/library/labels";

const LEAVE_MESSAGE =
  "You have unsaved changes. Leave without saving?";

/**
 * Explicit-Save editors: track dirty, warn on tab close, and confirm on
 * in-app Cancel / back. Native confirm() — matches existing Delete pattern.
 */
export function useLibraryUnsavedGuard(dirty: boolean) {
  React.useEffect(() => {
    if (!dirty) return;
    function onBeforeUnload(e: BeforeUnloadEvent) {
      e.preventDefault();
      e.returnValue = "";
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  const confirmLeave = React.useCallback(() => {
    if (!dirty) return true;
    return window.confirm(LEAVE_MESSAGE);
  }, [dirty]);

  return { confirmLeave, leaveMessage: LEAVE_MESSAGE };
}

export function librarySavedToastMessage(): string {
  return "Changes saved.";
}

export { LIBRARY_LABELS };
