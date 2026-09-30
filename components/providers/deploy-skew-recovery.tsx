"use client";

import { useEffect } from "react";

import {
  consumeSkewReload,
  isLikelyDeploySkewError,
} from "@/lib/deploy/client-skew-recovery";

/**
 * Catches deploy-skew failures (stale chunks / module scripts) before they
 * settle into Next's DefaultGlobalError ("This page couldn't load").
 * Mount once in the root layout.
 */
export function DeploySkewRecovery() {
  useEffect(() => {
    function maybeReload(error: unknown) {
      if (!isLikelyDeploySkewError(error)) return;
      const path = `${window.location.pathname}${window.location.search}`;
      if (!consumeSkewReload(path)) return;
      window.location.reload();
    }

    function onError(event: ErrorEvent) {
      maybeReload(event.error ?? event.message);
    }

    function onRejection(event: PromiseRejectionEvent) {
      maybeReload(event.reason);
    }

    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);

  return null;
}
